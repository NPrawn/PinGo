import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getIceServers,
  publishConsultationFallbackEvent,
  subscribeToConsultationWaitingEvents,
} from '@/shared/api';
import { env } from '@/shared/config';
import type {
  ConsultationFallbackEventRequest,
  ConsultationTranscriptSegment,
  IceServersResponse,
} from '@/shared/api';
import { createConsultEvent, parseConsultEvent } from '@/shared/types';
import type { ConsultDataEvent, ConsultEventBody } from '@/shared/types';
import {
  captureConsultMedia,
  isConsultScreenLive,
  peekConsultMedia,
  replaceConsultScreenTrack,
} from './consultMedia';
import { createConsultEventFallback } from './consultEventFallback';
import type { ConsultEventFallback } from './consultEventFallback';

/** 서버가 한 번에 받는 전문 조각 수와 조각당 길이. 넘기면 400으로 거절된다. */
const MAX_TRANSCRIPT_SEGMENTS = 500;
const MAX_SEGMENT_LENGTH = 2000;

/**
 * `disconnected` 를 끊긴 것으로 볼 때까지 기다리는 시간.
 *
 * 망이 잠깐 흔들리면 브라우저가 알아서 `connected` 로 돌아온다. 그때마다 연결을 다시 맺으면
 * 멀쩡한 상담이 더 자주 끊긴다.
 */
const DISCONNECTED_GRACE_MS = 4000;

/**
 * 다시 맺기를 시도하는 횟수.
 *
 * 끝없이 되풀이하면 살아날 수 없는 상담을 붙잡고 서버만 두드린다. 여기까지 실패하면
 * 사용자에게 알리고 멈춘다.
 */
const MAX_RECOVERY_ATTEMPTS = 5;

/**
 * 음성 인식이 잇따라 실패해도 다시 시작해 보는 횟수.
 *
 * 한두 번은 흔한 일이라 곧바로 알리면 상담자를 불필요하게 놀라게 한다. 그 이상 이어지면
 * 다시 시도해도 달라지지 않으므로 멈추고 알린다.
 */
const MAX_CAPTION_ERROR_STREAK = 3;

/**
 * 인식을 시작한 뒤 이만큼 아무 말도 못 알아들으면 무언가 잘못된 것으로 본다.
 *
 * 상담을 시작하고 20초 넘게 양쪽 모두 한마디도 하지 않는 일은 드물다. 조용해서가 아니라
 * 소리가 들어오지 않는 것이라고 보는 편이 실제에 가깝다.
 */
const CAPTION_SILENCE_MS = 20000;

/**
 * 화면·마이크를 얻는 데 기다려 주는 시간.
 *
 * `getUserMedia` 는 거절될 때만 오류를 던진다. 장치가 다른 앱에 잡혀 있거나 사용자가 권한
 * 창을 그대로 두면 **아무 대답 없이 계속 매달려 있다.** 협상이 그 뒤에 있으면 offer 를 영영
 * 만들지 못해, 화면에는 `연결 상태: signaling` 만 남고 화면 공유가 시작되지 않는다.
 * 여기서 끊고 협상만이라도 진행한다.
 */
const MEDIA_CAPTURE_TIMEOUT_MS = 8000;

/** 정해진 시간 안에 끝나지 않으면 포기한다. 원래 약속은 그대로 흘러가게 둔다. */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error('media_capture_timeout')), timeoutMs);
    }),
  ]);
}

type SignalingRole = 'USER' | 'COUNSELOR';
type SignalingType =
  | 'JOIN'
  | 'LEAVE'
  | 'OFFER'
  | 'ANSWER'
  | 'ICE_CANDIDATE'
  | 'CAPTION'
  | 'RENEGOTIATE'
  | 'ERROR';

type CaptionPayload = {
  text: string;
  final: boolean;
  language: string;
};

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
};

type SpeechRecognitionEventLike = {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorLike = {
  readonly error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SignalingMessage = {
  sessionId: string;
  senderType: SignalingRole | 'SYSTEM';
  type: SignalingType;
  payload?: unknown;
  timestamp: string;
};

/**
 * 서버가 ICE 설정을 주지 못할 때 쓰는 값.
 *
 * 빌드 시점에 박히는 값이라 TURN 자격증명이 만료되면 그대로 쓸 수 없다. 서버 응답을
 * 우선하고, 여기는 서버에 닿지 못했을 때의 마지막 수단이다.
 */
function envRtcConfiguration(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [];
  if (env.VITE_STUN_URL) iceServers.push({ urls: env.VITE_STUN_URL });
  if (env.VITE_TURN_URL) {
    iceServers.push({
      urls: env.VITE_TURN_URL,
      username: env.VITE_TURN_USERNAME,
      credential: env.VITE_TURN_CREDENTIAL,
    });
  }
  return { iceServers };
}

function toRtcConfiguration(response: IceServersResponse): RTCConfiguration {
  const iceServers = (response.iceServers ?? [])
    .filter((server) => (server.urls?.length ?? 0) > 0)
    .map((server) => ({
      urls: server.urls!,
      ...(server.username ? { username: server.username } : {}),
      ...(server.credential ? { credential: server.credential } : {}),
    }));

  // 서버가 빈 목록을 주면 연결이 거의 안 된다. 그럴 바엔 빌드 값이라도 쓴다.
  return iceServers.length > 0 ? { iceServers } : envRtcConfiguration();
}

/**
 * 상담 signaling WebSocket과 WebRTC peer를 한 생명주기로 관리한다.
 * 상담자는 offer를 만들고 사용자는 answer로 응답한다.
 */
export function useConsultSignaling(
  roomId: string | null,
  role: SignalingRole,
  accessToken?: string | null,
  onDataEvent?: (event: ConsultDataEvent) => void,
) {
  /**
   * 매 렌더마다 바뀌는 콜백을 effect 의존성에 넣으면 연결이 끊었다 붙기를 반복한다.
   * 최신 콜백만 ref 로 갈아 끼운다.
   */
  const dataEventRef = useRef(onDataEvent);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  /** DataChannel 이 열리지 않았을 때 상담 이벤트를 서버 편으로 보내는 우회로. */
  const eventFallbackRef = useRef<ConsultEventFallback | null>(null);
  /**
   * 상담 이벤트 채널이 열려 있는지.
   *
   * 화면이 상태 스냅숏(지도 등)을 다시 보내야 할 시점이다. 연결 상태만 보고 보내면 채널이
   * 아직 닫혀 있는 순간에 걸려 상대에게 닿지 못한다.
   */
  const [eventChannelOpen, setEventChannelOpen] = useState(false);

  useEffect(() => {
    dataEventRef.current = onDataEvent;
  }, [onDataEvent]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  /** 상대가 보내온 스트림. 영상 요소가 아직 없을 때 받아 두었다가 붙인다. */
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<RTCPeerConnectionState | 'idle' | 'signaling'>('idle');
  const [error, setError] = useState<string | null>(null);
  /**
   * 끊긴 연결을 자동으로 다시 맺는 중인지.
   *
   * signaling 소켓이 한 번 열렸다가(JOIN까지는 성공) 채 붙기도 전에 닫히면(예: SDP가
   * 컨테이너 버퍼를 넘겨 1009로 닫히는 경우) 화면에는 원인 코드가 그대로 노출된 채
   * 아무 안내 없이 멈춰 있었다. 재시도가 끝날 때까지는 그 자리에 로딩 화면을 보여 주고,
   * 다시 시도해도 안 되면(한도 초과) 이 값을 내려 실제 실패 안내로 돌아간다.
   */
  const [reconnecting, setReconnecting] = useState(false);
  /**
   * 마이크·화면을 얻지 못했다는 안내. 연결 오류와 따로 둔다.
   *
   * 연결이 맺어지면 연결 오류는 사실이 아니게 되어 지우지만, 마이크가 없다는 사실은
   * 그대로다. 한 칸에 담으면 연결되는 순간 지워져, 상담자는 자기 목소리가 나가지 않는 줄
   * 모른 채 상담을 이어 간다.
   */
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [localCaption, setLocalCaption] = useState('');
  const [remoteCaption, setRemoteCaption] = useState('');
  /** 상대가 말을 마친 마지막 문장. 번역은 이 값으로만 건다. */
  const [remoteFinalCaption, setRemoteFinalCaption] = useState('');
  const [captionsSupported, setCaptionsSupported] = useState(true);
  /**
   * 음성 인식이 왜 안 되는지.
   *
   * 기록이 안 되는 것을 상담이 끝난 뒤에야 아는 일이 없어야 한다. 전문이 비면 AI 요약도
   * 만들어지지 않아 그 상담은 아무 기록 없이 사라진다.
   */
  const [captionError, setCaptionError] = useState<string | null>(null);
  /** 화면의 '자막 다시 시도'가 부를 함수. 연결을 끊지 않고 인식만 되살린다. */
  const restartCaptionsRef = useRef<() => void>(() => {});
  const restartCaptions = useCallback(() => restartCaptionsRef.current(), []);
  const [transcript, setTranscript] = useState<ConsultationTranscriptSegment[]>([]);
  const [transcriptRoomId, setTranscriptRoomId] = useState(roomId);
  /** 사용자가 화면 대신 카메라를 보내고 있는 상태. 화면 공유를 거절했거나 도중에 멈춘 경우다. */
  const [screenShareBlocked, setScreenShareBlocked] = useState(false);
  /** 화면 공유를 다시 시작할 때 보내는 트랙만 갈아 끼우려고 붙잡아 둔다. */
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  /** 서버가 준 STUN·TURN 설정. 받기 전에는 연결을 시작하지 않는다. */
  const [rtcConfig, setRtcConfig] = useState<RTCConfiguration | null>(null);
  /** 연결을 처음부터 다시 맺어야 할 때 올린다. 값이 바뀌면 아래 effect 가 통째로 다시 돈다. */
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  /**
   * 붙지 못한 채 다시 맺기를 시도한 횟수.
   *
   * effect 를 넘어 살아남아야 한다 — 다시 맺기가 곧 effect 를 다시 도는 일이라, 안에 두면
   * 매번 0으로 돌아가 끝없이 되풀이한다.
   */
  const recoveryAttemptsRef = useRef(0);

  /**
   * 받은 스트림을 영상 요소에 붙이고 재생시킨다.
   *
   * `autoplay` 만으로는 부족하다. 브라우저는 소리가 있는 영상의 자동 재생을 막는 경우가
   * 있어, 트랙이 멀쩡히 들어오는데도 화면은 검은 채로 멈춰 있고 상대 목소리도 들리지
   * 않는다. 직접 재생을 요청해 두면 화면을 누른 적이 있는 상담에서는 그대로 재생된다.
   */
  const attachRemoteStream = useCallback((stream: MediaStream) => {
    const element = remoteVideoRef.current;
    if (!element) return;
    if (element.srcObject !== stream) element.srcObject = stream;
    // jsdom 처럼 재생을 구현하지 않은 환경도 있다. 반환값이 Promise 일 때만 실패를 삼킨다.
    const played = element.play?.();
    if (played && typeof played.catch === 'function') played.catch(() => undefined);
  }, []);

  // 영상 요소가 뒤늦게 붙는 화면에서도 받아 둔 스트림이 그대로 남지 않게 한 번 더 붙인다.
  useEffect(() => {
    const stream = remoteStreamRef.current;
    if (stream) attachRemoteStream(stream);
  }, [attachRemoteStream, status]);

  // 상담별 signaling 토큰으로 확인하는 API 라서, 토큰을 받은 뒤에 물어본다.
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void getIceServers(accessToken)
      .then((response) => {
        if (!cancelled) setRtcConfig(toRtcConfiguration(response));
      })
      .catch(() => {
        // 설정을 못 받았다고 상담을 포기할 수는 없다. 빌드 값으로라도 시도한다.
        if (!cancelled) setRtcConfig(envRtcConfiguration());
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  // 다른 상담으로 들어가면 앞 상담의 자막이 섞이지 않게 비운다. effect로 미루면 그사이
  // 한 번은 이전 전문이 그대로 보이므로 렌더 중에 맞춘다.
  if (transcriptRoomId !== roomId) {
    setTranscriptRoomId(roomId);
    setTranscript([]);
  }

  useEffect(() => {
    if (!roomId) return;
    // 서버는 room과 함께 발급한 토큰이 없는 handshake를 401로 거절한다. 토큰 없이
    // 접속하면 무조건 실패하므로, 화면이 토큰을 받아올 때까지 기다린다.
    // (토큰이 채워지면 이 effect가 다시 돌면서 접속한다.)
    if (!accessToken) return;
    // ICE 설정 없이 연결을 열면 서로 다른 망에 있는 상대와 붙지 못한다.
    if (!rtcConfig) return;

    let disposed = false;
    let offerTimer: number | undefined;
    let localStream: MediaStream | null = null;
    /**
     * 상담 요청 화면이 맡겨 둔 스트림을 그대로 쓰는 중인지.
     *
     * 그런 스트림은 이 연결의 것이 아니라 상담 전체의 것이다. 연결을 정리할 때 같이 끄면
     * 재연결에서 화면 공유가 사라진다. 끄는 일은 상담 화면이 떠날 때 한 번만 한다.
     */
    let reusedPreparedStream = false;
    let recognition: SpeechRecognitionLike | null = null;
    let shouldRecognize = true;
    let socketOpened = false;
    // 메시지 처리가 서로 끼어들지 않게 한 줄로 세운다. OFFER를 적용하는 동안
    // 다음 메시지가 먼저 처리되면 candidate가 SDP보다 앞질러 버린다.
    let handling: Promise<void> = Promise.resolve();
    /** 상대 SDP가 적용되기 전에 도착한 candidate. 지금 넣으면 addIceCandidate가 실패한다. */
    const pendingRemoteCandidates: RTCIceCandidateInit[] = [];
    /** 상대가 아직 없을 때 보낸 candidate는 서버가 버리므로 offer를 다시 보낼 때 함께 재전송한다. */
    const localCandidates: RTCIceCandidateInit[] = [];
    /** 이미 답한 offer 의 SDP. 상담자가 답을 받기 전에 다시 보낸 같은 offer 를 가려낸다. */
    let answeredOfferSdp: string | null = null;
    /** `disconnected` 가 잠깐인지 지켜보는 타이머. */
    let recoverTimer: number | undefined;
    /** 이 연결에서 이미 다시 맺기를 시작했는지. 여러 신호가 겹쳐도 한 번만 돈다. */
    let recovering = false;
    /**
     * 보낼 트랙이 준비될 때까지 협상을 붙잡아 둔다.
     *
     * 화면을 고르는 동안 상담자의 offer 에 그대로 답해 버리면, 사용자 쪽 트랙이 하나도
     * 없는 채로 협상이 끝난다. 그 뒤에 트랙을 추가해도 재협상을 하지 않아 상담자 화면은
     * 계속 비어 있다.
     */
    let markMediaReady = () => {};
    const mediaReady = new Promise<void>((resolve) => {
      markMediaReady = resolve;
    });
    const peer = new RTCPeerConnection(rtcConfig);
    /**
     * 그리기 같은 상담 이벤트를 나르는 채널.
     *
     * offer 를 만드는 상담자가 채널을 열어야 SDP 에 자리가 잡힌다. 연결이 맺어진 뒤에
     * 열면 재협상이 필요한데 지금 협상 흐름은 재협상을 하지 않는다.
     */
    const seenEventIds = new Set<string>();
    /**
     * 받은 이벤트를 화면에 옮긴다.
     *
     * DataChannel 과 서버 우회로가 같은 이벤트를 각각 실어 나를 수 있어, 같은 eventId 는
     * 어느 길로 왔든 한 번만 처리한다(명세 4장).
     */
    const applyConsultEvent = (parsed: ConsultDataEvent) => {
      // 내가 보낸 것이 서버를 돌아 되돌아온 것은 화면에 옮길 이유가 없다.
      if (parsed.senderType === role) return;
      if (seenEventIds.has(parsed.eventId)) return;
      seenEventIds.add(parsed.eventId);
      dataEventRef.current?.(parsed);
    };
    const attachDataChannel = (channel: RTCDataChannel) => {
      dataChannelRef.current = channel;
      channel.onmessage = (event) => {
        const parsed = parseConsultEvent(String(event.data));
        if (parsed) applyConsultEvent(parsed);
      };
      /**
       * 채널이 열린 순간을 화면에 알린다.
       *
       * peer 가 `connected` 가 되는 것과 이 채널이 열리는 것은 같은 순간이 아니다. SCTP
       * 연결은 그보다 조금 늦게 맺어진다. 그 틈에 보낸 이벤트는 채널이 아직 닫혀 있어
       * 서버 우회로로 새는데, 상담자는 그 우회로를 듣지 않아 그대로 사라진다. 지도 상태를
       * 딱 한 번만 보내던 화면이 "지도를 기다리는 중"에서 멈춰 있던 이유가 이것이다.
       */
      const syncOpen = () => {
        if (!disposed) setEventChannelOpen(channel.readyState === 'open');
      };
      channel.onopen = syncOpen;
      channel.onclose = syncOpen;
      syncOpen();
    };

    if (role === 'COUNSELOR') {
      attachDataChannel(peer.createDataChannel('consult', { ordered: true }));
    } else {
      peer.ondatachannel = (event) => attachDataChannel(event.channel);
    }
    const wsBase = env.VITE_WS_BASE_URL.replace(/\/$/, '');
    const socket = new WebSocket(`${wsBase}/ws/signaling?token=${encodeURIComponent(accessToken)}`);
    const consultationId = roomId.startsWith('room_') ? roomId.slice('room_'.length) : roomId;
    /** 정리된 뒤에 도착한 이벤트로 화면에 실패를 남기지 않는다. */
    const fail = (message: string) => {
      if (!disposed) setError(message);
    };
    /**
     * 무엇이 안 되는지 서버에 알린다.
     *
     * 이 알림은 상담을 이어 가는 일과 무관한 곁가지다. 여기서 던진 오류가 이 알림을 부른
     * 흐름(협상 시작 직전의 실패 처리)까지 끌고 내려가지 않도록 통째로 삼킨다.
     */
    const publishMediaFailure = (
      type: ConsultationFallbackEventRequest['type'],
      reason: string,
    ) => {
      try {
        void publishConsultationFallbackEvent(consultationId, { type, reason })?.catch(
          () => undefined,
        );
      } catch {
        // 알릴 수 없다고 상담을 멈출 이유는 없다.
      }
    };
    /** 상담자는 마이크만 잡는다. 그쪽의 확보 실패를 영상 실패로 올리면 원인이 뒤바뀐다. */
    const localCaptureFailureType: ConsultationFallbackEventRequest['type'] =
      role === 'COUNSELOR' ? 'AUDIO_FAILED' : 'VIDEO_FAILED';

    // DataChannel 이 열리지 않았을 때 보내는 쪽이 쓰는 우회로.
    const eventFallback = createConsultEventFallback(consultationId);
    eventFallbackRef.current = eventFallback;

    /**
     * 우회로로 온 이벤트를 받는다.
     *
     * 서버는 상담 하나당 SSE 구독자를 하나만 둔다. 나중에 구독한 쪽이 앞의 구독을 끊어
     * 버리므로 양쪽이 함께 들을 수 없다. 그리기는 상담자에서 사용자로 흐르는 한 방향이라
     * 받는 쪽인 사용자만 구독한다. 상담자까지 구독하면 서로 밀어내다가 대기 중인 다른
     * 사용자의 수락 알림까지 끊길 수 있다.
     */
    let fallbackEvents: EventSource | null = null;
    if (role === 'USER') {
      fallbackEvents = subscribeToConsultationWaitingEvents(consultationId);
      fallbackEvents.addEventListener('DATA_CHANNEL', ((message: MessageEvent<string>) => {
        try {
          const envelope = JSON.parse(message.data) as { payload?: unknown };
          if (envelope.payload == null) return;
          const parsed = parseConsultEvent(JSON.stringify(envelope.payload));
          if (parsed) applyConsultEvent(parsed);
        } catch {
          // 모양이 맞지 않는 이벤트 하나 때문에 나머지까지 못 받을 이유는 없다.
        }
      }) as EventListener);
    }
    const remoteRole: SignalingRole = role === 'COUNSELOR' ? 'USER' : 'COUNSELOR';
    /**
     * 확정된 자막만 상담 전문으로 쌓는다. 중간 결과는 말하는 도중 계속 고쳐 써서
     * 그대로 모으면 같은 문장이 여러 번 남는다.
     */
    const appendFinalCaption = (speaker: SignalingRole, text: string) => {
      const content = text.trim().slice(0, MAX_SEGMENT_LENGTH);
      if (!content) return;

      setTranscript((previous) => {
        // 앞부분이 요약에 더 중요하다. 한도를 넘으면 뒤를 버린다.
        if (previous.length >= MAX_TRANSCRIPT_SEGMENTS) return previous;

        // 같은 문장을 두 번 확정해 보내는 브라우저가 있어 직전과 같은 말은 넘긴다.
        const last = previous.at(-1);
        if (last?.speaker === speaker && last.content === content) return previous;

        return [...previous, { seq: previous.length + 1, speaker, content }];
      });
    };
    /** 잇따라 실패한 횟수. 한 번 알아들으면 0으로 돌아간다. */
    let captionErrorStreak = 0;
    /** 한 번이라도 알아들었는지. 조용히 아무것도 못 듣는 상태를 가려낸다. */
    let heardAnything = false;
    let captionWatchdog: number | undefined;

    /**
     * 시작만 하고 아무 소리도 못 듣는 경우를 잡는다.
     *
     * 브라우저 음성 인식은 오류 하나 없이 시작된 뒤 소리를 한 조각도 받지 못할 수 있다.
     * 다른 앱이나 같은 페이지의 `getUserMedia` 가 마이크를 붙잡고 있을 때가 그렇다. 그때는
     * `onerror` 도 오지 않아 화면에는 "인식하고 있습니다"만 떠 있고, 상담자는 자기 말이
     * 기록되는 줄 알고 상담을 끝낸다. 전문은 비어 있고 요약도 만들어지지 않는다.
     */
    const armCaptionWatchdog = () => {
      if (captionWatchdog !== undefined) window.clearTimeout(captionWatchdog);
      captionWatchdog = window.setTimeout(() => {
        if (disposed || heardAnything) return;
        setCaptionError(
          '마이크 소리가 음성 인식으로 들어오지 않습니다. 마이크가 다른 앱에 잡혀 있지 않은지 확인하고, 아래 버튼으로 다시 시도해 주세요.',
        );
      }, CAPTION_SILENCE_MS);
    };

    const startCaptions = () => {
      const speechWindow = window as typeof window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };
      const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
      if (!Recognition) {
        setCaptionsSupported(false);
        setCaptionError('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome이나 Edge에서 열어 주세요.');
        return;
      }

      recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = role === 'COUNSELOR' ? 'ko-KR' : navigator.language || 'en-US';
      recognition.onresult = (event) => {
        // 누적 전문(`transcript` 상태)과 헷갈리지 않게 이번 결과 조각은 `spoken`으로 둔다.
        let spoken = '';
        let final = false;
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          spoken += event.results[index][0].transcript;
          final ||= event.results[index].isFinal;
        }
        const text = spoken.trim();
        if (!text) return;
        // 한 번이라도 알아들었으면 앞의 실패는 지나간 일이다.
        captionErrorStreak = 0;
        heardAnything = true;
        if (captionWatchdog !== undefined) window.clearTimeout(captionWatchdog);
        setCaptionError(null);
        setLocalCaption(text);
        if (final) appendFinalCaption(role, text);
        send('CAPTION', { text, final, language: recognition?.lang ?? navigator.language });
      };
      /**
       * 왜 인식이 안 되는지 화면에 남긴다.
       *
       * 예전에는 권한 거부만 처리하고 나머지는 조용히 삼켰다. 그런데 실제로 가장 자주 나는
       * 것은 `network` 다 — 브라우저의 음성 인식은 구글 서버로 소리를 보내 글자를 받아오는
       * 방식이라, 그 요청이 막히면 아무 일도 일어나지 않는다. Chromium 계열 중 음성 API 키가
       * 없는 빌드도 늘 이 오류가 난다. 그때 화면에는 "인식하고 있습니다"만 떠 있어서,
       * 상담자는 자기 말이 기록되는 줄 알고 상담을 끝냈고 전문은 비어 있었다.
       */
      recognition.onerror = (event) => {
        // 말이 끊긴 것뿐이다. 브라우저가 곧 `onend` 를 부르고 아래에서 다시 시작한다.
        if (event.error === 'no-speech' || event.error === 'aborted') return;

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          shouldRecognize = false;
          setCaptionsSupported(false);
          setCaptionError('마이크 사용이 차단돼 음성이 기록되지 않습니다. 주소창의 자물쇠에서 마이크를 허용해 주세요.');
          return;
        }

        captionErrorStreak += 1;
        if (captionErrorStreak < MAX_CAPTION_ERROR_STREAK) return;

        /**
         * 잇따라 실패하면 다시 시도해도 달라지지 않는다. 조용히 되풀이하면 기록되지 않는
         * 상태가 상담 내내 이어지므로 여기서 멈추고 알린다.
         */
        shouldRecognize = false;
        setCaptionError(
          event.error === 'network'
            ? '음성 인식 서버에 연결하지 못해 대화가 기록되지 않습니다. 네트워크를 확인하거나 Chrome에서 다시 열어 주세요.'
            : `음성 인식이 멈췄습니다(${event.error}). 상담 내용이 기록되지 않습니다.`,
        );
      };
      /**
       * 인식은 짧게 끊어지며 스스로 끝난다. 그때마다 다시 시작해야 자막이 이어진다.
       *
       * 예전에는 signaling 소켓이 열려 있을 때만 다시 시작했다. 자막은 이 브라우저의
       * 마이크만 쓰는 일이라 소켓과 상관이 없는데, 소켓이 한 번 끊기면 통화가 멀쩡히
       * 이어지는 중에도 상담 메모가 그대로 멈춰 버렸다.
       */
      recognition.onend = () => {
        if (!shouldRecognize || disposed) return;
        try {
          recognition?.start();
        } catch {
          // The browser can still be winding down the previous recognition session.
        }
      };
      try {
        recognition.start();
        armCaptionWatchdog();
      } catch {
        setCaptionsSupported(false);
        setCaptionError('음성 인식을 시작하지 못했습니다. 상담 내용이 기록되지 않습니다.');
      }
    };

    /**
     * 자막을 처음부터 다시 시작한다. 화면의 '다시 시도' 버튼이 부른다.
     *
     * 마이크를 다른 앱에서 놓아 준 뒤, 상담을 끊지 않고 자막만 되살릴 수 있어야 한다.
     */
    restartCaptionsRef.current = () => {
      if (disposed) return;
      shouldRecognize = true;
      captionErrorStreak = 0;
      heardAnything = false;
      setCaptionsSupported(true);
      setCaptionError(null);
      try {
        recognition?.stop();
      } catch {
        // 이미 멈춰 있으면 그대로 두고 새로 시작한다.
      }
      startCaptions();
    };

    const send = (type: SignalingType, payload?: unknown) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      const message: SignalingMessage = {
        sessionId: roomId,
        senderType: role,
        type,
        payload,
        timestamp: new Date().toISOString(),
      };
      socket.send(JSON.stringify(message));
    };

    const addRemoteCandidate = async (candidate: RTCIceCandidateInit) => {
      try {
        await peer.addIceCandidate(candidate);
      } catch {
        // 후보 하나가 거절돼도 다른 후보로 연결될 수 있어 상담을 끊지 않는다.
      }
    };

    const applyRemoteDescription = async (description: RTCSessionDescriptionInit) => {
      await peer.setRemoteDescription(description);
      while (pendingRemoteCandidates.length > 0) {
        await addRemoteCandidate(pendingRemoteCandidates.shift()!);
      }
    };

    /**
     * 상담자가 offer를 알린다.
     *
     * 사용자가 아직 들어오지 않으면 서버가 중계하지 못하고 버리므로, answer가
     * 도착할 때까지 같은 offer와 그동안 모인 candidate를 다시 보낸다.
     */
    const sendOffer = async () => {
      if (role !== 'COUNSELOR' || socket.readyState !== WebSocket.OPEN) return;
      // answer를 적용했으면 협상이 끝났다. 여기서 다시 offer를 만들면 재협상이 된다.
      if (peer.remoteDescription) return;

      if (peer.signalingState === 'have-local-offer' && peer.localDescription) {
        send('OFFER', peer.localDescription.toJSON());
        localCandidates.forEach((candidate) => send('ICE_CANDIDATE', candidate));
        return;
      }
      if (peer.signalingState !== 'stable') return;

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      send('OFFER', offer);
    };

    /**
     * 연결을 처음부터 다시 맺는다.
     *
     * 협상이 끝난 뒤 미디어만 끊기는 일이 있다(ICE 실패, 와이파이 전환, 절전). 예전에는
     * 여기서 아무것도 하지 않아 상담자 화면이 검은 채로 남았다 — 그리기와 자막은 다른 길로
     * 오가니 멀쩡해 보이는데 화면 공유만 사라진 이유가 이것이다.
     *
     * 답하는 쪽이 혼자 다시 맺어 봐야 소용이 없다. offer 를 만드는 상담자는 이미 answer 를
     * 적용해 두어 다시는 offer 를 만들지 않기 때문이다. 그래서 사용자는 다시 맺기 전에
     * 상담자에게 협상을 새로 시작하라고 알린다.
     */
    const recover = (reason: string) => {
      if (disposed || recovering) return;

      if (recoveryAttemptsRef.current >= MAX_RECOVERY_ATTEMPTS) {
        setReconnecting(false);
        setError('상담 연결을 회복하지 못했습니다. 상담을 다시 시작해 주세요.');
        return;
      }

      recovering = true;
      recoveryAttemptsRef.current += 1;
      setReconnecting(true);
      if (role === 'USER') send('RENEGOTIATE', { reason });
      setConnectionEpoch((epoch) => epoch + 1);
    };

    peer.onconnectionstatechange = () => {
      if (disposed) return;
      setStatus(peer.connectionState);
      if (peer.connectionState === 'connected') {
        if (offerTimer) window.clearInterval(offerTimer);
        if (recoverTimer) window.clearTimeout(recoverTimer);
        recoverTimer = undefined;
        // 한 번 붙었으면 앞의 실패는 셈에서 지운다. 시도 한도는 잇따른 실패를 막으려는 것이지
        // 상담 내내 몇 번 끊겼는지를 세려는 것이 아니다.
        recoveryAttemptsRef.current = 0;
        // 재접속으로 연결됐다면 이전 시도의 실패 안내는 더 이상 사실이 아니다.
        setError(null);
        setReconnecting(false);
      }
      if (peer.connectionState === 'failed') {
        publishMediaFailure('VIDEO_FAILED', 'peer_connection_failed');
        recover('peer_failed');
      }
      /**
       * `disconnected` 는 잠깐 끊긴 것일 수도 있어 곧바로 접지 않는다.
       *
       * 망이 잠시 흔들린 경우라면 브라우저가 알아서 `connected` 로 돌아온다. 그때는 위에서
       * 타이머를 지운다. 돌아오지 않으면 그 자체로 끊긴 것이므로 다시 맺는다.
       */
      if (peer.connectionState === 'disconnected' && recoverTimer === undefined) {
        recoverTimer = window.setTimeout(() => recover('peer_disconnected'), DISCONNECTED_GRACE_MS);
      }
    };
    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      remoteStreamRef.current = stream;
      attachRemoteStream(stream);
    };
    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON();
      localCandidates.push(candidate);
      send('ICE_CANDIDATE', candidate);
    };

    /**
     * 사용자는 화면 전체를, 상담자는 카메라를 보낸다.
     *
     * 상담자가 지도 위에 길을 그려 주려면 사용자가 실제로 보고 있는 화면이 필요하다.
     * 카메라 영상만으로는 지도도 경로도 보이지 않아 그릴 대상이 없다.
     *
     * 화면 공유는 브라우저가 사용자 조작 직후에만 허용하는 경우가 있고, 모바일 브라우저는
     * 아예 지원하지 않는다. 실패하면 카메라로 물러나되 화면에서 다시 시도할 수 있게 알린다.
     */
    const captureLocalStream = async () => {
      if (role === 'USER') {
        // 상담 요청 화면에서 이미 잡아 둔 것이 있으면 그대로 쓴다. 화면 선택 창을 다시
        // 열지 않으니 연결되자마자 영상이 나가고, 재연결 때도 다시 묻지 않는다.
        const prepared = peekConsultMedia();
        if (prepared) {
          reusedPreparedStream = true;
          /**
           * 화면 공유가 이미 끝난 스트림일 수 있다.
           *
           * 사용자가 '공유 중지'를 눌렀거나 브라우저가 멈춘 경우다. 끝난 트랙은 되살릴 수
           * 없어 그대로 보내면 상담자에게 검은 화면만 간다. 소리는 살아 있으니 스트림은
           * 그대로 쓰고, 화면만 다시 공유하라고 알린다.
           */
          if (!isConsultScreenLive()) setScreenShareBlocked(true);
          return prepared;
        }

        try {
          return await captureConsultMedia();
        } catch {
          setScreenShareBlocked(true);
        }

        // 화면 공유가 막혔어도 카메라로라도 주변 상황은 보여 준다.
        return navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }

      /**
       * 상담자는 목소리만 보낸다.
       *
       * 사용자 화면에 상담자 영상을 띄우면, 그 화면이 통째로 다시 상담자에게 공유되면서
       * 화면 속에 화면이 겹쳐 보인다. 캡처 대상에서 특정 요소만 빼는 방법은 없으므로
       * 애초에 보내지 않는다.
       */
      return navigator.mediaDevices.getUserMedia({ audio: true });
    };

    /**
     * 상담자가 협상을 시작한다.
     *
     * 보내는 트랙이 없는 종류라도 자리는 만들어 둔다. offer 를 만드는 쪽이 m-line 을 두지
     * 않으면 상대는 그 종류의 트랙을 실을 곳이 없어, 마이크 하나가 막힌 것이 사용자 화면과
     * 사용자 목소리까지 통째로 막아 버린다.
     */
    const startNegotiation = async () => {
      if (role !== 'COUNSELOR' || disposed) return;

      // 상담자는 영상을 보내지 않지만 사용자 화면은 받아야 한다.
      peer.addTransceiver('video', { direction: 'recvonly' });
      // 마이크를 얻었다면 그 트랙이 이미 자리를 잡았다. 못 얻었어도 듣기는 해야 한다.
      if (!localStream?.getAudioTracks().length) {
        peer.addTransceiver('audio', { direction: 'recvonly' });
      }

      await sendOffer();
      if (disposed) return;
      offerTimer = window.setInterval(() => void sendOffer(), 2000);
    };

    socket.onopen = async () => {
      socketOpened = true;
      setStatus('signaling');
      // 접속에 성공했으므로 지난 시도의 실패 안내는 더 이상 사실이 아니다.
      setError(null);
      send('JOIN');
      try {
        /**
         * 매달려 있는 장치 요청에 협상을 볼모로 잡히지 않는다.
         *
         * 마이크가 다른 앱에 잡혀 있으면 `getUserMedia` 는 거절도 응답도 하지 않고 그대로
         * 멈춰 있다. 예전에는 그 뒤에 offer 를 만들었기 때문에, 장치 하나가 상담 전체를
         * 세워 버렸다 — `연결 상태: signaling` 에서 더 나아가지 못하던 것이 이것이다.
         */
        const stream = await withTimeout(captureLocalStream(), MEDIA_CAPTURE_TIMEOUT_MS);
        /**
         * 기다리는 사이에 화면을 벗어났으면 여기서 직접 끈다.
         *
         * 정리 함수는 이미 지나갔고 그때 `localStream`은 아직 비어 있었다. 그대로 반환하면
         * 아무도 이 스트림을 모르는 채 카메라와 마이크가 계속 켜져 있게 된다.
         */
        if (disposed) {
          // 맡겨 둔 스트림은 이 연결의 것이 아니다. 여기서 끄면 다시 연결할 때 화면 선택
          // 창이 또 뜬다.
          if (!reusedPreparedStream) stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStream = stream;
        setMediaError(null);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
        localStream.getTracks().forEach((track) => {
          const sender = peer.addTrack(track, localStream!);
          if (track.kind === 'video') videoSenderRef.current = sender;
        });
        // 사용자가 브라우저의 '공유 중지'를 누르면 트랙이 그대로 끝난다. 그때부터는 상담자에게
        // 검은 화면만 가므로, 다시 공유할 수 있다고 알려야 한다.
        localStream
          .getVideoTracks()
          .forEach((track) => track.addEventListener('ended', () => setScreenShareBlocked(true)));
      } catch (cause) {
        const timedOut = cause instanceof Error && cause.message === 'media_capture_timeout';
        if (!disposed) {
          setMediaError(
            timedOut
              ? '마이크·화면 장치가 응답하지 않아 소리 없이 연결합니다. 다른 앱이 마이크를 쓰고 있는지 확인해 주세요.'
              : '화면 공유 또는 마이크를 사용할 수 없습니다.',
          );
        }
        publishMediaFailure(
          localCaptureFailureType,
          timedOut ? 'media_capture_timeout' : 'media_device_unavailable',
        );
      }

      if (disposed) return;

      /**
       * 미디어를 얻지 못했어도 여기까지는 반드시 온다.
       *
       * 예전에는 자막 시작과 협상이 미디어 확보와 같은 `try` 안에 있었다. 상담자 마이크
       * 하나가 막히면 offer 를 만드는 데까지 가지 못해, 상담자는 사용자 화면을 영영 받지
       * 못하고 양쪽 자막도 뜨지 않았다. 화면에는 그 원인 대신 한참 뒤의 연결 종료 안내만
       * 남아 무엇이 잘못됐는지 알 수 없었다.
       */
      markMediaReady();
      await startNegotiation();
    };

    const handleMessage = async (raw: string) => {
      const message = JSON.parse(raw) as SignalingMessage;
      if (message.type === 'ERROR') {
        const payload = message.payload as { retryable?: boolean; message?: string } | undefined;
        // 재시도 가능한 오류는 대개 상대가 아직 입장하지 않은 경우다. offer 타이머가 다시 알린다.
        if (!payload?.retryable) fail(payload?.message ?? '상담 연결에 실패했습니다.');
        return;
      }
      if (message.type === 'OFFER' && role === 'USER') {
        const offer = message.payload as RTCSessionDescriptionInit;

        /**
         * 상담자는 answer 가 도착할 때까지 같은 offer 를 2초마다 다시 보낸다. 답을 보낸
         * 직후에 그 재전송이 도착하는 일은 흔한데, 이를 새 상담자로 오해해 연결을 다시
         * 맺으면 되돌아올 수 없다 — 상담자는 이미 answer 를 적용해 두어 다시는 offer 를
         * 만들지 않으므로, 새로 만든 이쪽 연결은 영영 offer 를 기다린다. 결과는 끝내
         * 뜨지 않는 화면 공유다. 같은 offer 면 답만 다시 보낸다.
         */
        if (answeredOfferSdp !== null && answeredOfferSdp === offer.sdp) {
          if (peer.localDescription) send('ANSWER', peer.localDescription.toJSON());
          return;
        }

        /**
         * 이미 협상을 마친 연결에 다른 offer 가 왔다는 것은, 상담자가 화면을 나갔다 들어와
         * 연결을 새로 만들었다는 뜻이다. 지금 연결은 이미 사라진 상대를 향하고 있어
         * 이어 붙일 수 없으므로 이쪽도 처음부터 다시 맺는다. 상담자는 답이 올 때까지
         * offer 를 다시 보내므로 새 연결이 그 다음 offer 를 받는다.
         */
        if (peer.remoteDescription) {
          if (!disposed) setConnectionEpoch((epoch) => epoch + 1);
          return;
        }

        await mediaReady;
        await applyRemoteDescription(offer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        answeredOfferSdp = offer.sdp ?? '';
        send('ANSWER', answer);
        return;
      }
      if (message.type === 'ANSWER' && role === 'COUNSELOR') {
        // 재전송한 offer에 사용자가 다시 답하면 answer가 두 번 온다. 두 번째는 버린다.
        if (peer.signalingState !== 'have-local-offer') return;
        await applyRemoteDescription(message.payload as RTCSessionDescriptionInit);
        return;
      }
      if (message.type === 'ICE_CANDIDATE' && message.payload) {
        const candidate = message.payload as RTCIceCandidateInit;
        if (!peer.remoteDescription) {
          pendingRemoteCandidates.push(candidate);
          return;
        }
        await addRemoteCandidate(candidate);
        return;
      }
      /**
       * 상대가 연결을 다시 맺자고 알려 왔다.
       *
       * 상담자만 offer 를 만들 수 있으므로 상담자가 받아 처리한다. 이미 answer 를 적용해 둔
       * peer 로는 새 협상을 시작할 수 없어, 연결을 통째로 새로 만든다.
       */
      if (message.type === 'RENEGOTIATE' && role === 'COUNSELOR') {
        recover('peer_requested');
        return;
      }
      if (message.type === 'CAPTION' && message.payload) {
        const caption = message.payload as CaptionPayload;
        if (typeof caption.text !== 'string') return;
        setRemoteCaption(caption.text);
        if (caption.final) {
          appendFinalCaption(remoteRole, caption.text);
          // 번역은 확정된 문장만 건다. 중간 결과는 계속 고쳐 쓰여 옮겨 봐야 곧 달라진다.
          setRemoteFinalCaption(caption.text);
        }
      }
    };

    socket.onmessage = (event) => {
      handling = handling
        .then(() => handleMessage(String(event.data)))
        .catch(() => fail('실시간 연결 정보를 처리하지 못했습니다.'));
    };
    socket.onerror = () => fail('상담 연결 서버에 접속하지 못했습니다.');
    socket.onclose = (event) => {
      /**
       * 누가 왜 끊었는지를 남긴다.
       *
       * 서버는 방을 닫을 때 `4400`(상담 종료)·`4408`(방 만료) 같은 코드를 실어 보내고,
       * 중간의 프록시가 끊으면 또 다른 코드가 온다. 이걸 버리고 "연결이 끊어졌습니다"만
       * 보여 주면 서버가 끊은 것인지, 프록시가 끊은 것인지, 이쪽이 접은 것인지 구분할
       * 방법이 없어 원인을 짚을 수 없다. 1000·1005 는 정상 종료라 덧붙이지 않는다.
       */
      const detail =
        event.code && event.code !== 1000 && event.code !== 1005
          ? ` (코드 ${event.code}${event.reason ? `: ${event.reason}` : ''})`
          : '';

      if (!socketOpened) {
        fail(`상담 연결 서버에 접속하지 못했습니다.${detail}`);
        return;
      }
      // 이미 영상까지 붙었으면 signaling이 닫혀도 통화는 유지된다.
      if (peer.connectionState === 'connected') return;
      fail(`상담 연결이 끊어졌습니다. 잠시 후 다시 시도해 주세요.${detail}`);

      /**
       * 협상이 끝나기 전에 signaling 소켓만 먼저 닫힌 경우 다시 맺는다.
       *
       * SDP가 컨테이너 버퍼를 넘겨 1009로 닫히는 경우가 이런 모양이다 — JOIN까지는
       * 성공했지만(`socketOpened`) offer를 보내는 순간 연결이 끊겨 협상이 시작도 못 한다.
       * 서버가 상담을 끝내며 보낸 4400(종료)·4408(방 만료)까지 다시 맺으면 이미 끝난
       * 상담을 붙잡고 헛수고를 하게 되므로 그 둘은 뺀다.
       */
      if (event.code !== 4400 && event.code !== 4408) {
        recover('signaling_closed_before_connected');
      }
    };

    /**
     * 음성 인식을 여기서 시작한다. 소켓이 열리기도, 마이크를 잡기도 전이다.
     *
     * 두 가지를 고친다.
     *
     * 하나. 예전에는 `socket.onopen` 안에서 시작해, signaling 접속이 늦거나 실패하면 자막도
     * 함께 죽었다. 자막은 이 브라우저의 마이크만 쓰는 일이라 서버와 상관이 없다.
     *
     * 둘. `getUserMedia` 가 기본 마이크를 먼저 붙잡고 있으면, 그 뒤에 시작한 음성 인식이
     * 오류 없이 시작되고도 소리를 한 조각도 받지 못하는 일이 있다. 그러면 화면에는 아무
     * 경고도 없이 자막만 영영 비어 있다. 인식을 먼저 걸어 두면 이 순서 문제를 피한다.
     */
    startCaptions();

    return () => {
      disposed = true;
      if (offerTimer) window.clearInterval(offerTimer);
      if (recoverTimer) window.clearTimeout(recoverTimer);
      if (captionWatchdog) window.clearTimeout(captionWatchdog);
      /**
       * 다시 맺는 중이면 자리를 비운다고 알리지 않는다.
       *
       * `LEAVE` 는 서버 방에서 나를 지운다. 곧바로 다시 들어오는 참인데 지워 버리면, 그
       * 사이에 상대가 보낸 offer 가 갈 곳을 잃어 새 연결이 첫 offer 를 놓친다.
       */
      if (!recovering) send('LEAVE');
      shouldRecognize = false;
      recognition?.stop();
      dataChannelRef.current = null;
      setEventChannelOpen(false);
      fallbackEvents?.close();
      eventFallback.stop();
      eventFallbackRef.current = null;
      socket.close();
      peer.close();
      if (!reusedPreparedStream) localStream?.getTracks().forEach((track) => track.stop());
    };
  }, [accessToken, attachRemoteStream, connectionEpoch, role, roomId, rtcConfig]);

  /**
   * 화면 공유를 (다시) 시작한다.
   *
   * 브라우저가 화면 선택 창을 사용자 조작 직후에만 띄워 주는 경우가 있어, 연결 시점에
   * 자동으로 잡지 못하면 화면의 버튼에서 이 함수를 부른다. 이미 협상이 끝난 연결이라
   * 보내는 트랙만 갈아 끼워 다시 협상하지 않는다.
   */
  const shareScreen = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) return;

    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const [track] = display.getVideoTracks();
      if (!track) return;

      const sender = videoSenderRef.current;
      /**
       * 이미 협상이 끝난 연결이면 보내는 트랙만 갈아 끼운다. 보낼 자리조차 없다면
       * (트랙 없이 협상이 끝난 경우) 바꿔 낄 곳이 없어 연결을 다시 맺는다.
       */
      if (sender) {
        const previous = sender.track;
        await sender.replaceTrack(track);
        // 맡겨 둔 스트림은 여기서 정리한다. 옛 트랙은 아래에서 함께 멈춘다.
        if (previous && previous !== track) previous.stop();
      }
      /**
       * 맡겨 둔 스트림도 새 화면으로 바꿔 둔다.
       *
       * 이걸 빠뜨리면 다음에 연결이 다시 맺어질 때 이미 끝난 옛 트랙을 도로 집어 든다.
       * 사용자는 방금 다시 공유했는데 상담자 화면은 계속 검은 채로 남는다.
       */
      replaceConsultScreenTrack(track);
      if (localVideoRef.current) localVideoRef.current.srcObject = new MediaStream([track]);
      track.addEventListener('ended', () => setScreenShareBlocked(true));
      setScreenShareBlocked(false);
      if (!sender) setConnectionEpoch((epoch) => epoch + 1);
    } catch {
      setScreenShareBlocked(true);
    }
  }, []);

  /**
   * 상담 이벤트를 상대에게 보낸다.
   *
   * DataChannel 이 열려 있으면 그 길로 간다. 열리지 않았으면 서버를 거치는 우회로로
   * 보낸다. 예전에는 이 경우를 조용히 버렸는데, DataChannel 이 막힌 상담에서는 상담자가
   * 아무리 그려도 사용자 화면에 아무것도 나타나지 않았다. 무엇이 잘못됐는지 알 방법도
   * 없어, 상담자는 사용자가 보고 있다고 믿은 채 설명을 이어 갔다.
   */
  const sendConsultEvent = useCallback(
    (body: ConsultEventBody) => {
      if (!roomId) return false;

      const event = createConsultEvent(roomId, role, body);
      const channel = dataChannelRef.current;
      if (channel && channel.readyState === 'open') {
        channel.send(JSON.stringify(event));
        return true;
      }

      const fallback = eventFallbackRef.current;
      if (!fallback) return false;

      fallback.send(event);
      return true;
    },
    [role, roomId],
  );

  return {
    localVideoRef,
    remoteVideoRef,
    status,
    /**
     * 화면에 보여 줄 실패 안내.
     *
     * 연결이 끊겼다는 말보다 마이크·화면을 못 얻었다는 말이 먼저다. 상담자가 손쓸 수 있는
     * 쪽이고, 연결 문제도 대개 거기서 시작된다.
     */
    error: mediaError ?? error,
    /**
     * 끊긴 연결을 자동으로 다시 맺는 중. 화면은 이 값이 참이면 실패 문구 대신 로딩 화면을
     * 보여 줘야 한다 — 재시도가 곧 이어지므로 코드 1009 같은 원인 문구만 보여 주고 멈춰
     * 있으면 사용자가 새로고침 말고는 손쓸 방법이 없다고 오해한다.
     */
    reconnecting,
    localCaption,
    remoteCaption,
    /** 상대가 말을 마친 마지막 문장. 번역에 쓴다. */
    remoteFinalCaption,
    captionsSupported,
    /** 음성 인식이 멈춘 이유. null 이면 정상이다. */
    captionError,
    /** 상담을 끊지 않고 자막만 다시 시작한다. */
    restartCaptions,
    /** 상담 종료 뒤 서버에 넘길 확정 자막. 말한 순서대로 쌓인다. */
    transcript,
    /** 사용자가 화면 대신 카메라를 보내고 있는지. 참이면 화면에서 다시 공유를 권해야 한다. */
    screenShareBlocked,
    shareScreen,
    sendConsultEvent,
    /** 상담 이벤트 채널이 열렸는지. 상태 스냅숏을 다시 보내야 할 시점이다. */
    eventChannelOpen,
  };
}
