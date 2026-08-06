import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { isCaptionEchoWindow } from './captionEchoGuard';
import { captureConsultMicrophone, peekConsultMedia, swapConsultVideoTrack } from './consultMedia';
import { startServerCaptionRecorder } from './serverCaptionRecorder';
import type { ServerCaptionRecorder } from './serverCaptionRecorder';
import { createConsultEventFallback } from './consultEventFallback';
import type { ConsultEventFallback } from './consultEventFallback';
import { signalingBaseUrl } from './signalingBaseUrl';
import { flushConsultPhaseReport, markConsultPhase, startRtcStatsMonitor } from '@/shared/lib/perf';
import type { CaptionTrouble } from './captionTrouble';

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
 * 만료된 토큰을 새로 받아 다시 붙어 보는 횟수.
 *
 * signaling 토큰은 10분이면 끝나는데 상담은 그보다 오래간다. 그동안 화면을 새로고침하지
 * 않은 쪽은 처음 받은 토큰을 그대로 들고 있어서, 연결을 다시 맺어야 하는 순간(상대가
 * 새로고침했거나 ICE 가 끊긴 때) handshake 가 401 로 거절된다. 그러면 그 상담은 두 번
 * 다시 붙지 못하고, 상대 화면은 `연결 상태: signaling` 에서 영영 멈춘다.
 *
 * 끝없이 되풀이하지는 않는다. 상담이 이미 끝났거나 방이 사라진 경우에도 거절되는데,
 * 그때는 새 토큰을 받아도 결과가 같다.
 */
const MAX_TOKEN_REFRESH_ATTEMPTS = 3;

/**
 * 음성 인식이 잇따라 실패해도 다시 시작해 보는 횟수.
 *
 * 한두 번은 흔한 일이라 곧바로 알리면 상담자를 불필요하게 놀라게 한다. 그 이상 이어지면
 * 다시 시도해도 달라지지 않으므로 멈추고 알린다.
 */
const MAX_CAPTION_ERROR_STREAK = 3;
const INTERIM_CAPTION_INTERVAL_MS = 200;
const MAX_PENDING_FINAL_CAPTIONS = 50;
const CAPTION_RESTART_DELAY_MS = 500;

/**
 * 인식을 시작한 뒤 이만큼 아무 말도 못 알아들으면 무언가 잘못된 것으로 본다.
 *
 * 상담을 시작하고 20초 넘게 양쪽 모두 한마디도 하지 않는 일은 드물다. 조용해서가 아니라
 * 소리가 들어오지 않는 것이라고 보는 편이 실제에 가깝다.
 */
const CAPTION_SILENCE_MS = 20000;

/**
 * 카메라·마이크를 얻는 데 기다려 주는 시간.
 *
 * `getUserMedia` 는 거절될 때만 오류를 던진다. 장치가 다른 앱에 잡혀 있거나 사용자가 권한
 * 창을 그대로 두면 **아무 대답 없이 계속 매달려 있다.** 협상이 그 뒤에 있으면 offer 를 영영
 * 만들지 못해, 화면에는 `연결 상태: signaling` 만 남고 영상이 시작되지 않는다.
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

/**
 * 자막 글자를 어디서 만드는지.
 *
 * `browser` 는 `SpeechRecognition` 이다. 빠르고 중간 결과가 있지만 `getUserMedia` 와 마이크를
 * 다투어 안드로이드에서는 잡히지 않는다. `server` 는 마이크 소리를 녹음해 서버에 맡긴다.
 * 중간 결과가 없고 3초쯤 늦는 대신 기기를 가리지 않는다.
 */
type CaptionSource = 'browser' | 'server';

/** 서버 받아쓰기가 잇따라 실패해도 상대에게 알리기까지 견디는 횟수. */
const MAX_TRANSCRIBE_ERROR_STREAK = 3;
type SignalingType =
  'JOIN' | 'LEAVE' | 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE' | 'CAPTION' | 'RENEGOTIATE' | 'ERROR';

type CaptionPayload = {
  text: string;
  final: boolean;
  language: string;
  captionId?: string;
  occurredAt?: string;
};

type TranscriptTimelineEntry = {
  segment: ConsultationTranscriptSegment;
  captionId: string;
  occurredAt: number;
  order: number;
};

type TranscriptTimelineSegment = ConsultationTranscriptSegment & {
  captionId: string;
};

/**
 * 자막이 왜 오지 않는지 알리는 payload. 자막 본문 대신 이것만 실려 온다.
 *
 * 새 signaling 타입을 만들지 않고 `CAPTION` 에 얹는다. 서버는 payload 를 들여다보지 않고
 * 그대로 중계하므로, 이 한 줄을 나르자고 서버 enum 을 늘릴 이유가 없다.
 */
type CaptionStatusPayload = {
  captionStatus: CaptionTrouble | null;
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
  localSpeechLanguage?: string,
  captionSource: CaptionSource = 'browser',
) {
  /**
   * 매 렌더마다 바뀌는 콜백을 effect 의존성에 넣으면 연결이 끊었다 붙기를 반복한다.
   * 최신 콜백만 ref 로 갈아 끼운다.
   */
  const dataEventRef = useRef(onDataEvent);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  /**
   * 지금 살아 있는 연결. 영상 트랙을 갈아 끼우는 데만 쓴다. (S15P11A206-89)
   *
   * 연결 객체 자체를 밖으로 내보내지 않는다 — 화면이 협상에 끼어들 수 있게 되면 이 훅이
   * 들고 있는 상태와 실제 연결이 어긋난다.
   */
  const peerRef = useRef<RTCPeerConnection | null>(null);
  /**
   * 영상을 보내는 sender. **`addTrack` 이 돌려준 참조를 그대로 들고 있는다.** (S15P11A206-89 리뷰)
   *
   * 예전에는 필요할 때마다 `getSenders()` 에서 `track?.kind === 'video'` 로 찾았다. 그런데
   * `replaceTrack(null)` 이 성공하면 `sender.track` 이 null 이 되어, **그 다음부터는 같은 조건으로
   * 영상 sender 를 찾지 못한다.** 한 번 끈 영상은 다시 켤 수 없었다.
   *
   * `kind` 는 sender 자체에 남지 않고 트랙에만 있으므로, 트랙을 비운 뒤에 종류로 되찾는 방법은
   * 없다. 붙일 때 받은 참조를 보관하는 것이 유일하게 확실한 길이다.
   *
   * 연결이 새로 맺어질 때마다 다시 채운다. 남겨 두면 닫힌 연결의 sender 에 `replaceTrack` 을
   * 걸어 조용히 실패한다.
   */
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  /** DataChannel 이 열리지 않았을 때 상담 이벤트를 서버 편으로 보내는 우회로. */
  const eventFallbackRef = useRef<ConsultEventFallback | null>(null);
  /** Keep final captions until the signaling and peer connections can relay them. */
  const pendingFinalCaptionsRef = useRef<CaptionPayload[]>([]);
  const captionSequenceRef = useRef(0);
  useEffect(() => {
    pendingFinalCaptionsRef.current = [];
    captionSequenceRef.current = 0;
  }, [roomId]);
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
  const [localCaptionFinal, setLocalCaptionFinal] = useState(true);
  const [localFinalCaptionId, setLocalFinalCaptionId] = useState<string | null>(null);
  const [remoteCaption, setRemoteCaption] = useState('');
  /** 상대가 말을 마친 마지막 문장. 번역은 이 값으로만 건다. */
  const [remoteFinalCaption, setRemoteFinalCaption] = useState('');
  /**
   * 지금 들고 있는 `remoteCaption` 이 말을 마친 문장인지.
   *
   * 거짓이면 상대가 말하는 중이다. 화면은 이 값으로 "아직 옮기지 않은 원문이 흘러가는 중"과
   * "옮길 준비가 끝난 문장"을 구분한다.
   */
  const [remoteCaptionFinal, setRemoteCaptionFinal] = useState(true);
  const [remoteFinalCaptionId, setRemoteFinalCaptionId] = useState<string | null>(null);
  /**
   * 상대 쪽 음성 인식이 멈춘 이유. null 이면 정상이다.
   *
   * 이쪽 마이크가 멀쩡해도 상대 자막은 오지 않을 수 있다. 그 사실을 알 방법이 없으면
   * 화면은 "상대가 조용한 것"과 똑같아 보인다.
   */
  const [remoteCaptionError, setRemoteCaptionError] = useState<CaptionTrouble | null>(null);
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
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptTimelineEntry[]>([]);
  const [transcriptRoomId, setTranscriptRoomId] = useState(roomId);
  const transcriptTimeline = useMemo<TranscriptTimelineSegment[]>(
    () =>
      [...transcriptEntries]
        .sort((left, right) => left.occurredAt - right.occurredAt || left.order - right.order)
        .map((entry, index) => ({
          ...entry.segment,
          seq: index + 1,
          captionId: entry.captionId,
        })),
    [transcriptEntries],
  );
  const transcript = useMemo(
    () =>
      transcriptTimeline.map((segment) => ({
        seq: segment.seq,
        speaker: segment.speaker,
        content: segment.content,
        ...(segment.translatedContent ? { translatedContent: segment.translatedContent } : {}),
      })),
    [transcriptTimeline],
  );
  const updateTranscriptTranslation = useCallback(
    (captionId: string, translatedContent: string) => {
      const normalizedTranslation = translatedContent.trim();
      if (!captionId || !normalizedTranslation) return;

      setTranscriptEntries((previous) => {
        const entryIndex = previous.findIndex((entry) => entry.captionId === captionId);
        if (entryIndex < 0) return previous;

        const entry = previous[entryIndex];
        if (entry.segment.translatedContent === normalizedTranslation) return previous;

        const next = [...previous];
        next[entryIndex] = {
          ...entry,
          segment: { ...entry.segment, translatedContent: normalizedTranslation },
        };
        return next;
      });
    },
    [],
  );
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
   * 지금 끊는 것이 자리를 비우는 것이 아니라 곧바로 다시 붙기 위한 것인지.
   *
   * effect 를 넘어 살아남아야 한다. 다시 맺기가 곧 effect 를 다시 도는 일이라, 정리 함수가
   * 이 값을 읽는 시점은 새 effect 가 돌기 전이다. 화면 바깥(`shareScreen`)에서 다시 맺는
   * 경우도 있어 effect 안의 지역 변수로는 닿지 않는다.
   */
  const rebuildingRef = useRef(false);
  /** 만료된 토큰으로 거절당한 횟수. 한 번 붙으면 0으로 돌아간다. */
  const tokenRefreshAttemptsRef = useRef(0);
  /**
   * handshake 가 거절됐다고 화면에 알리는 신호. 값이 오르면 화면이 토큰을 새로 받아 온다.
   *
   * 토큰을 받아 오는 일은 화면의 몫이다 — 사용자 화면과 상담원 화면이 서로 다른 API 로
   * 받는다. 이 훅은 "지금 들고 있는 토큰으로는 못 붙는다"는 사실만 알린다.
   */
  const [tokenRejected, setTokenRejected] = useState(0);

  useEffect(() => {
    if (!roomId || !accessToken) return;

    let wasOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const handleOffline = () => {
      wasOffline = true;
      setReconnecting(true);
    };
    const handleOnline = () => {
      if (!wasOffline) return;
      wasOffline = false;
      // Rebuild both signaling and peer state after a browser-level outage.
      rebuildingRef.current = true;
      setReconnecting(true);
      setConnectionEpoch((epoch) => epoch + 1);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    if (wasOffline) setReconnecting(true);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [accessToken, roomId]);

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
    markConsultPhase('ICE 서버 조회 시작'); // LOGGING

    void getIceServers(accessToken)
      .then((response) => {
        if (!cancelled) setRtcConfig(toRtcConfiguration(response));
        markConsultPhase('ICE 서버 조회 완료'); // 추가
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
    setTranscriptEntries([]);
    setLocalFinalCaptionId(null);
    setRemoteFinalCaptionId(null);
  }

  useEffect(() => {
    if (!roomId) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    // 서버는 room과 함께 발급한 토큰이 없는 handshake를 401로 거절한다. 토큰 없이
    // 접속하면 무조건 실패하므로, 화면이 토큰을 받아올 때까지 기다린다.
    // (토큰이 채워지면 이 effect가 다시 돌면서 접속한다.)
    if (!accessToken) return;
    // ICE 설정 없이 연결을 열면 서로 다른 망에 있는 상대와 붙지 못한다.
    if (!rtcConfig) return;

    // 이번 연결은 정상적으로 시작한다. 앞 연결이 남긴 "곧 다시 붙는다" 표시를 지운다.
    rebuildingRef.current = false;

    let disposed = false;
    let offerTimer: number | undefined;
    let localStream: MediaStream | null = null;
    /**
     * 상담 요청 화면이 맡겨 둔 스트림을 그대로 쓰는 중인지.
     *
     * 그런 스트림은 이 연결의 것이 아니라 상담 전체의 것이다. 연결을 정리할 때 같이 끄면
     * 재연결에서 카메라와 목소리가 사라진다. 끄는 일은 상담 화면이 떠날 때 한 번만 한다.
     */
    let reusedPreparedStream = false;
    let recognition: SpeechRecognitionLike | null = null;
    let recognitionGeneration = 0;
    let captionRestartTimer: number | undefined;
    let shouldRecognize = true;
    let socketOpened = false;
    // 메시지 처리가 서로 끼어들지 않게 한 줄로 세운다. OFFER를 적용하는 동안
    // 다음 메시지가 먼저 처리되면 candidate가 SDP보다 앞질러 버린다.
    let handling: Promise<void> = Promise.resolve();
    /** 연결 품질(RTT·지터·손실) 모니터를 끄는 함수. connected 가 된 뒤에만 채워진다. */
    let stopRtcStatsMonitor: (() => void) | undefined;
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

    peerRef.current = peer;
    // 새 연결에는 아직 붙인 트랙이 없다. 지난 연결의 sender 를 물려받으면 조용히 실패한다.
    videoSenderRef.current = null;
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
    /**
     * 보낼 영상이 없을 때만 **보낼 자리**를 잡아 둔다. (S15P11A206-206)
     *
     * 상담자는 영상 m-line 을 `recvonly` 로 열고, 방향은 answer 를 만드는 사용자 쪽이 정한다.
     * 그때 영상 트랜시버가 하나도 없으면 그 m-line 은 `inactive` 로 협상되고 **그대로 굳는다.**
     * 이 흐름은 재협상을 하지 않으므로(아래 `mediaReady` 주석) 뒤늦게 트랙이 생겨도 흘려보낼
     * 방향이 없다. 마이크가 다른 앱에 잡혀 캡처가 8초를 넘기는 경로가 실제로 그랬다.
     *
     * **트랙이 있으면 이 자리를 쓰지 않는다.** 예전에는 연결을 만들 때 무조건 잡아 두고 영상을
     * 그 자리에 `replaceTrack` 으로 넣었는데, `replaceTrack` 은 스트림 소속을 만들지 않아
     * answer 의 영상 m-line 에서 msid 가 빠졌다. 받는 쪽 `ontrack` 은 msid 로 `event.streams`
     * 를 채우니 빈 배열이 오고, 오디오만 소속이 있어 **소리는 나는데 화면은 검은** 상태가 됐다.
     * 잘 되던 정상 경로를 실패 경로 대비가 깨뜨린 것이다.
     *
     * 그래서 트랙이 있는 경우는 `addTrack(track, localStream)` 그대로 두고(소속이 함께 등록된다),
     * 자리 잡기는 트랙이 없을 때로 미룬다. 협상은 `mediaReady` 뒤에 열리므로 이 시점도 answer
     * 보다 앞이다.
     *
     * **소리는 이렇게 하지 않는다.** 마이크는 여기서 실패하면 나중에 얻을 경로가 아예 없어
     * (XR 세션은 카메라만 준다) 자리를 잡아 둘 이유가 없다.
     */
    const reserveVideoSlotIfNeeded = () => {
      if (role === 'COUNSELOR' || videoSenderRef.current) return;

      const transceiver = peer.addTransceiver('video', { direction: 'sendrecv' });
      videoSenderRef.current = transceiver.sender;
      /**
       * 소속을 붙일 수 있으면 붙인다. 오디오와 같은 스트림이어야 상담자가 트랙 둘을 하나로
       * 받는다. 캡처가 통째로 실패했으면 붙일 스트림이 없고, 그 경우는 받는 쪽이 소속 없이 온
       * 트랙을 주워 담는다(`peer.ontrack`).
       */
      if (localStream && typeof transceiver.sender.setStreams === 'function') {
        transceiver.sender.setStreams(localStream);
      }
    };
    markConsultPhase('signaling 소켓 생성'); // 추가
    const wsBase = signalingBaseUrl();
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
     *
     * 발화 ID와 원본 시각은 화면에서 중복을 걸러 내고 양쪽 브라우저에서 도착 순서가 달라도
     * 같은 타임라인으로 정렬하기 위해 함께 보관한다. 서버로 보낼 때는 API가 요구하는
     * `seq`, `speaker`, `content`만 다시 꺼낸다.
     */
    const appendFinalCaption = (
      speaker: SignalingRole,
      text: string,
      metadata: { captionId?: string; occurredAt?: string } = {},
    ) => {
      const content = text.trim().slice(0, MAX_SEGMENT_LENGTH);
      if (!content) return;

      const occurredAtValue = metadata.occurredAt ? Date.parse(metadata.occurredAt) : NaN;
      const occurredAt = Number.isFinite(occurredAtValue) ? occurredAtValue : Date.now();
      const captionId = metadata.captionId ?? `${speaker}:${occurredAt}:${content}`;

      setTranscriptEntries((previous) => {
        // 앞부분이 요약에 더 중요하다. 한도를 넘으면 뒤를 버린다.
        if (previous.length >= MAX_TRANSCRIPT_SEGMENTS) return previous;

        // 재연결이나 서버 중계 재시도에서 같은 최종 자막이 다시 와도 한 번만 기록한다.
        if (previous.some((entry) => entry.captionId === captionId)) return previous;

        return [
          ...previous,
          {
            captionId,
            occurredAt,
            // 중복·최대 개수 검사를 통과해 실제로 추가되는 경우에만 순서를 만든다.
            order: previous.length,
            segment: { seq: 0, speaker, content },
          },
        ];
      });
    };
    /** 잇따라 실패한 횟수. 한 번 알아들으면 0으로 돌아간다. */
    let captionErrorStreak = 0;
    /** 한 번이라도 알아들었는지. 조용히 아무것도 못 듣는 상태를 가려낸다. */
    let heardAnything = false;
    /** 서버 받아쓰기에서 마이크 음량 기준으로 발화가 감지된 적이 있는지. */
    let detectedSpeechActivity = false;
    /** 무음 감시 타이머. 인식을 시작할 때마다 다시 건다. */
    let captionWatchdog: number | undefined;
    /** 서버 받아쓰기를 쓸 때의 녹음기. 브라우저 인식과 둘 중 하나만 돈다. */
    let serverRecorder: ServerCaptionRecorder | null = null;
    /** 받아쓰기 요청이 잇따라 실패한 횟수. 한 번 성공하면 0으로 돌아간다. */
    let transcribeErrorStreak = 0;
    /** 상대에게 마지막으로 알린 자막 상태. 달라졌을 때만 다시 보낸다. */
    let captionStatus: CaptionTrouble | null = null;
    let lastInterimCaptionSentAt = 0;
    let lastInterimCaption = '';

    const sendCaptionStatus = () => send('CAPTION', { captionStatus });

    /**
     * 자막이 왜 안 되는지 화면과 **상대에게** 함께 알린다.
     *
     * 예전에는 이 사실이 이쪽 화면에만 남았다. 그런데 손해를 보는 쪽은 상대다 — 상담원이
     * Chrome 이 아닌 브라우저로 상담을 받으면, 사용자 화면에는 아무 경고 없이 "상담원이
     * 말하면 이 자리에 표시됩니다"만 상담 내내 떠 있었다. 자막이 고장난 것인지 상담원이
     * 조용한 것인지 구분할 방법이 없어, 사용자는 오지 않을 자막을 계속 기다렸다.
     */
    const reportCaptionStatus = (trouble: CaptionTrouble | null, message: string | null) => {
      setCaptionError(message);
      // 한 마디 알아들을 때마다 null 로 되돌리는 자리가 있다. 그대로면 보내지 않는다.
      if (captionStatus === trouble) return;
      captionStatus = trouble;
      sendCaptionStatus();
    };

    /**
     * 상대가 방에 들어온 뒤 한 번 더 알린다.
     *
     * 자막이 안 된다는 것은 대개 상담이 붙기도 전에 드러난다(브라우저가 지원하지 않는
     * 경우가 그렇다). 그때 보낸 알림은 중계할 상대가 아직 없어 서버가 버린다. 연결이
     * 맺어진 시점에 다시 보내지 않으면 상대는 끝내 알지 못한다.
     */
    const resendCaptionStatus = () => {
      if (captionStatus !== null) sendCaptionStatus();
    };

    /**
     * 시작만 하고 아무 소리도 못 듣는 경우를 잡는다.
     *
     * 브라우저 음성 인식은 오류 하나 없이 시작된 뒤 소리를 한 조각도 받지 못할 수 있다.
     * 다른 앱이나 같은 페이지의 `getUserMedia` 가 마이크를 붙잡고 있을 때가 그렇다. 그때는
     * `onerror` 도 오지 않아 화면에는 "인식하고 있습니다"만 떠 있고, 상담자는 자기 말이
     * 기록되는 줄 알고 상담을 끝낸다. 전문은 비어 있고 요약도 만들어지지 않는다.
     *
     * **상대에게도 알린다.** 이 고장은 이쪽 화면만 보고는 알 수 없고, 손해를 보는 쪽은
     * 상대다 — 한쪽 자막이 조용히 죽으면 그쪽 발화가 전문에서 통째로 빠지는데, 상대는
     * 그것을 상담이 끝난 뒤 이력에서야 알게 된다.
     */
    const armCaptionWatchdog = () => {
      if (captionWatchdog !== undefined) window.clearTimeout(captionWatchdog);
      captionWatchdog = window.setTimeout(() => {
        captionWatchdog = undefined;
        if (disposed || heardAnything) return;
        reportCaptionStatus(
          'stopped',
          captionSource === 'server' && detectedSpeechActivity
            ? '음성은 감지됐지만 받아쓰기 결과를 받지 못했습니다. 주변 소음을 줄이고 마이크 가까이에서 다시 말해 주세요.'
            : '마이크 소리가 음성 인식으로 들어오지 않습니다. 마이크가 다른 앱에 잡혀 있지 않은지 확인하고, 아래 버튼으로 다시 시도해 주세요.',
        );
      }, CAPTION_SILENCE_MS);
    };

    /** 스스로 끝난 인식을 잠시 뒤 다시 시작한다. 곧바로 부르면 브라우저가 거절한다. */
    const scheduleRecognitionRestart = (instance: SpeechRecognitionLike, generation: number) => {
      if (!shouldRecognize || disposed || captionRestartTimer !== undefined) return;

      captionRestartTimer = window.setTimeout(() => {
        captionRestartTimer = undefined;
        if (!shouldRecognize || disposed || generation !== recognitionGeneration) return;

        try {
          instance.start();
        } catch {
          // Create a fresh instance when the browser has not released the old one yet.
          startCaptions();
        }
      }, CAPTION_RESTART_DELAY_MS);
    };

    const startCaptions = () => {
      if (!shouldRecognize || disposed) return;
      const speechWindow = window as typeof window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };
      const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
      if (!Recognition) {
        setCaptionsSupported(false);
        reportCaptionStatus(
          'unsupported',
          '이 브라우저는 음성 인식을 지원하지 않습니다. Chrome이나 Edge에서 열어 주세요.',
        );
        return;
      }

      const currentRecognition = new Recognition();
      const generation = ++recognitionGeneration;
      recognition = currentRecognition;
      const processedFinalResultKeys = new Set<string>();
      currentRecognition.continuous = true;
      currentRecognition.interimResults = true;
      currentRecognition.lang =
        role === 'COUNSELOR' ? 'ko-KR' : localSpeechLanguage || navigator.language || 'en-US';
      currentRecognition.onresult = (event) => {
        if (disposed || generation !== recognitionGeneration) return;
        /**
         * 우리가 스피커로 내보내는 번역 음성이 우리 마이크로 되돌아온 것은 버린다.
         *
         * 상담원 화면은 사용자 발화를 한국어로 옮겨 소리내어 읽는데(`useTranslatedSpeech`),
         * 이쪽 인식기도 `ko-KR` 이다. 그대로 두면 **사용자가 한 말이 상담원 발화로 기록된다** —
         * 전문이 통째로 `COUNSELOR` 로 남던 원인이다.
         *
         * Chrome 의 음성 인식은 페이지의 `getUserMedia` 와 별도로 기본 입력 장치를 열고 에코
         * 제거를 적용하지 않는다. 그래서 통화 오디오에 걸린 AEC 는 여기를 지켜 주지 못한다.
         *
         * 읽는 도중뿐 아니라 끝난 직후 잠깐도 함께 막는다 — 인식기는 소리를 받은 뒤 조금
         * 늦게 문장을 확정해서, 말하는 동안만 막으면 문장 끝자락이 샌다.
         */
        if (isCaptionEchoWindow()) return;
        // `results`에는 이전 확정 결과도 남아 있을 수 있다. 이번 이벤트에서 바뀐 구간만
        // 확정 결과와 중간 결과로 나눠 처리해야 이전 문장이 다음 문장에 다시 붙지 않는다.
        const finalTexts: string[] = [];
        let interimText = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const fragment = result[0].transcript;
          if (result.isFinal) {
            const finalResultKey = `${index}:${fragment.trim()}`;
            if (processedFinalResultKeys.has(finalResultKey)) continue;
            processedFinalResultKeys.add(finalResultKey);
            finalTexts.push(fragment);
          } else interimText += fragment;
        }
        const finalTextValues = finalTexts.map((text) => text.trim()).filter(Boolean);
        const interimTextValue = interimText.trim();
        if (finalTextValues.length === 0 && !interimTextValue) return;
        // 한 번이라도 알아들었으면 앞의 실패는 지나간 일이다.
        captionErrorStreak = 0;
        heardAnything = true;
        if (captionWatchdog !== undefined) {
          window.clearTimeout(captionWatchdog);
          captionWatchdog = undefined;
        }
        reportCaptionStatus(null, null);

        // 한 이벤트에 확정 결과가 여러 개 들어오면 각각의 발화 ID를 유지한다. 하나로 합치면
        // 나중에 같은 문장이 다시 확정되는 것처럼 보이고, 타임라인 한 칸에 서로 다른 발화가
        // 붙는다.
        let lastFinalCaptionId: string | null = null;
        for (const text of finalTextValues) {
          const occurredAt = new Date().toISOString();
          const captionId = `${roomId}:${role}:${occurredAt}:${captionSequenceRef.current++}`;
          lastFinalCaptionId = captionId;
          appendFinalCaption(role, text, { captionId, occurredAt });
          sendCaption({
            text,
            final: true,
            language: currentRecognition.lang || navigator.language,
            captionId,
            occurredAt,
          });
        }

        if (interimTextValue) {
          setLocalCaption(interimTextValue);
          setLocalCaptionFinal(false);
          setLocalFinalCaptionId(null);
          const now = Date.now();
          if (
            now - lastInterimCaptionSentAt < INTERIM_CAPTION_INTERVAL_MS ||
            interimTextValue === lastInterimCaption
          ) {
            return;
          }
          lastInterimCaptionSentAt = now;
          lastInterimCaption = interimTextValue;
          sendCaption({
            text: interimTextValue,
            final: false,
            language: currentRecognition.lang || navigator.language,
          });
          return;
        }

        setLocalCaption(finalTextValues.at(-1) ?? '');
        setLocalCaptionFinal(true);
        setLocalFinalCaptionId(lastFinalCaptionId);
        lastInterimCaption = '';
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
      currentRecognition.onerror = (event) => {
        if (disposed || generation !== recognitionGeneration) return;
        // 말이 끊긴 것뿐이다. 브라우저가 곧 `onend` 를 부르고 아래에서 다시 시작한다.
        if (event.error === 'no-speech' || event.error === 'aborted') return;

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          shouldRecognize = false;
          setCaptionsSupported(false);
          reportCaptionStatus(
            'blocked',
            '마이크 사용이 차단돼 음성이 기록되지 않습니다. 주소창의 자물쇠에서 마이크를 허용해 주세요.',
          );
          return;
        }

        captionErrorStreak += 1;
        if (captionErrorStreak < MAX_CAPTION_ERROR_STREAK) return;

        /**
         * 잇따라 실패하면 다시 시도해도 달라지지 않는다. 조용히 되풀이하면 기록되지 않는
         * 상태가 상담 내내 이어지므로 여기서 멈추고 알린다.
         */
        shouldRecognize = false;
        reportCaptionStatus(
          event.error === 'network' ? 'network' : 'stopped',
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
      currentRecognition.onend = () => {
        if (!shouldRecognize || disposed || generation !== recognitionGeneration) return;
        try {
          scheduleRecognitionRestart(currentRecognition, generation);
        } catch {
          // The browser can still be winding down the previous recognition session.
        }
      };
      try {
        currentRecognition.start();
        armCaptionWatchdog();
      } catch {
        scheduleRecognitionRestart(currentRecognition, generation);
        reportCaptionStatus(
          'stopped',
          '음성 인식을 시작하지 못했습니다. 상담 내용이 기록되지 않습니다.',
        );
      }
    };

    /**
     * 마이크 소리를 녹음해 서버에 받아쓰기를 맡긴다.
     *
     * `startCaptions` 와 **둘 중 하나만** 돈다. 함께 돌리면 같은 발화가 두 번 기록된다.
     *
     * 받아쓴 글이 지나는 길은 브라우저 인식과 똑같다 — 같은 규칙으로 발화 ID를 만들어
     * `appendFinalCaption` 과 `sendCaption` 에 넣는다. 그래서 상대 화면, 전문 조립, 저장,
     * 요약까지 아무것도 바뀌지 않는다.
     */
    const startServerCaptions = () => {
      if (disposed || !localStream) return;

      // 현재 값은 실제 발화 언어가 아니라 화면 표시 언어다. Whisper에 강제하면 영어 화면에서
      // 한국어로 말하는 경우 영어처럼 억지로 받아쓰므로, 전사는 자동 언어 감지에 맡긴다.
      const captionLanguage = localSpeechLanguage || navigator.language;

      serverRecorder = startServerCaptionRecorder({
        consultationId,
        stream: localStream,
        onFinalText: (text) => {
          if (disposed) return;

          transcribeErrorStreak = 0;
          heardAnything = true;
          if (captionWatchdog !== undefined) {
            window.clearTimeout(captionWatchdog);
            captionWatchdog = undefined;
          }
          reportCaptionStatus(null, null);

          const occurredAt = new Date().toISOString();
          const captionId = `${roomId}:${role}:${occurredAt}:${captionSequenceRef.current++}`;
          appendFinalCaption(role, text, { captionId, occurredAt });
          setLocalCaption(text);
          setLocalCaptionFinal(true);
          setLocalFinalCaptionId(captionId);
          sendCaption({ text, final: true, language: captionLanguage, captionId, occurredAt });
        },
        /**
         * 말이 시작된 것만 알린다. 서버 받아쓰기에는 중간 결과가 없어서, 이것이 없으면 상대
         * 화면은 발화가 끝나고 3초가 지나도록 아무 변화가 없다. 상담원은 사용자가 말하는
         * 중인지 조용한 것인지 구분하지 못해 자꾸 말을 겹쳐 하게 된다.
         */
        onSpeakingChange: (speaking) => {
          if (disposed || !speaking) return;
          detectedSpeechActivity = true;
          setLocalCaptionFinal(false);
          sendCaption({ text: '…', final: false, language: captionLanguage });
        },
        onError: () => {
          if (disposed) return;
          transcribeErrorStreak += 1;
          if (transcribeErrorStreak < MAX_TRANSCRIBE_ERROR_STREAK) return;
          reportCaptionStatus(
            'network',
            '음성 인식 서버에 연결하지 못해 대화가 기록되지 않습니다. 네트워크를 확인해 주세요.',
          );
        },
      });

      if (!serverRecorder) {
        setCaptionsSupported(false);
        reportCaptionStatus(
          'unsupported',
          '이 브라우저에서는 음성을 녹음할 수 없어 대화가 기록되지 않습니다.',
        );
        return;
      }

      // 브라우저 인식과 같은 안전망이다. 한마디도 못 잡으면 양쪽에 알린다.
      armCaptionWatchdog();
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
      // 다시 시작하는 인식은 아직 아무것도 못 들었다. 감시기도 처음부터 다시 센다.
      heardAnything = false;
      detectedSpeechActivity = false;
      setCaptionsSupported(true);
      reportCaptionStatus(null, null);

      if (captionSource === 'server') {
        transcribeErrorStreak = 0;
        serverRecorder?.stop();
        serverRecorder = null;
        startServerCaptions();
        return;
      }

      recognitionGeneration += 1;
      const previousRecognition = recognition;
      recognition = null;
      try {
        previousRecognition?.stop();
      } catch {
        // 이미 멈춰 있으면 그대로 두고 새로 시작한다.
      }
      startCaptions();
    };

    const send = (type: SignalingType, payload?: unknown) => {
      if (socket.readyState !== WebSocket.OPEN) return false;
      const message: SignalingMessage = {
        sessionId: roomId,
        senderType: role,
        type,
        payload,
        timestamp: new Date().toISOString(),
      };
      try {
        socket.send(JSON.stringify(message));
        return true;
      } catch {
        return false;
      }
    };

    const flushPendingFinalCaptions = () => {
      if (socket.readyState !== WebSocket.OPEN || peer.connectionState !== 'connected') return;
      const pending = pendingFinalCaptionsRef.current.splice(0);
      pending.forEach((payload) => {
        if (!send('CAPTION', payload)) pendingFinalCaptionsRef.current.push(payload);
      });
    };

    const sendCaption = (payload: CaptionPayload) => {
      /**
       * 밀린 확정 자막을 먼저 흘려보낸다.
       *
       * 예전에는 `connected` 로 **바뀌는 순간**에만 큐를 비웠다. 그런데 peer 가 이미
       * `connected` 인 채로 소켓만 잠깐 흔들리면 상태 전이가 일어나지 않아, 그때 쌓인 확정
       * 자막은 두 번 다시 나가지 못했다. 중간 결과는 조건 없이 나가므로 상대 화면의 실시간
       * 자막은 멀쩡해 보이고, **전문에서만 그쪽 발화가 통째로 사라진다.**
       */
      flushPendingFinalCaptions();

      if (
        payload.final &&
        (socket.readyState !== WebSocket.OPEN || peer.connectionState !== 'connected')
      ) {
        if (pendingFinalCaptionsRef.current.length < MAX_PENDING_FINAL_CAPTIONS) {
          pendingFinalCaptionsRef.current.push(payload);
        }
        return;
      }

      if (!send('CAPTION', payload) && payload.final) {
        if (pendingFinalCaptionsRef.current.length < MAX_PENDING_FINAL_CAPTIONS) {
          pendingFinalCaptionsRef.current.push(payload);
        }
      }
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
        markConsultPhase('OFFER 재전송'); // 추가
        localCandidates.forEach((candidate) => send('ICE_CANDIDATE', candidate));
        return;
      }
      if (peer.signalingState !== 'stable') return;

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      send('OFFER', offer);
      markConsultPhase('OFFER 최초 전송'); // 추가
    };

    /**
     * 연결을 처음부터 다시 맺는다.
     *
     * 협상이 끝난 뒤 미디어만 끊기는 일이 있다(ICE 실패, 와이파이 전환, 절전). 예전에는
     * 여기서 아무것도 하지 않아 상담자 화면이 검은 채로 남았다 — 그리기와 자막은 다른 길로
     * 오가니 멀쩡해 보이는데 영상만 사라진 이유가 이것이다.
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
      rebuildingRef.current = true;
      recoveryAttemptsRef.current += 1;
      setReconnecting(true);
      if (role === 'USER') send('RENEGOTIATE', { reason });
      setConnectionEpoch((epoch) => epoch + 1);
    };

    peer.onconnectionstatechange = () => {
      if (disposed) return;
      setStatus(peer.connectionState);
      if (peer.connectionState === 'connected') {
        markConsultPhase('연결 완료(connected)'); // 추가
        flushConsultPhaseReport(); // 추가 — 여기서 표로 출력
        if (offerTimer) window.clearInterval(offerTimer);
        if (recoverTimer) window.clearTimeout(recoverTimer);
        recoverTimer = undefined;
        // 한 번 붙었으면 앞의 실패는 셈에서 지운다. 시도 한도는 잇따른 실패를 막으려는 것이지
        // 상담 내내 몇 번 끊겼는지를 세려는 것이 아니다.
        recoveryAttemptsRef.current = 0;
        // 재접속으로 연결됐다면 이전 시도의 실패 안내는 더 이상 사실이 아니다.
        setError(null);
        setReconnecting(false);
        // 항목 5·6 — 이제부터 실제 통화 품질(편도 지연·지터·패킷 손실)을 잴 수 있다.
        // 재연결로 다시 'connected' 가 되어도 하나만 돌리면 되므로 이미 있으면 새로 켜지 않는다.
        stopRtcStatsMonitor ??= startRtcStatsMonitor(peer);
        // 상대가 확실히 방에 있는 시점이다. 붙기 전에 보낸 자막 경고는 버려졌으므로 다시 알린다.
        resendCaptionStatus();
        flushPendingFinalCaptions();
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
      /**
       * 스트림 소속 없이 온 트랙도 버리지 않는다. (S15P11A206-206 리뷰)
       *
       * 캡처가 8초를 넘겨 트랙 없이 answer 가 먼저 나간 경로에서는, 뒤늦게 `replaceTrack` 으로
       * 자리를 채워도 msid 를 다시 알릴 재협상이 없다. 그때 `event.streams` 는 빈 배열로 오는데
       * 예전에는 여기서 그대로 돌아섰다 — 영상이 흐르고 있는데도 화면은 끝까지 검었다.
       *
       * **처음 본 스트림 하나에 트랙을 모은다.** 화면은 `srcObject` 하나만 보므로, 소리와
       * 영상이 서로 다른 스트림으로 오면 나중에 온 쪽이 앞의 것을 덮어 버린다.
       */
      const attached = remoteStreamRef.current;
      /**
       * 이미 붙어 있는 트랙이면 아무것도 하지 않는다. (S15P11A206-206 리뷰)
       *
       * 같은 구성을 새 스트림으로 다시 대입하면 요소가 소스를 처음부터 다시 읽어 화면이 순간
       * 깜빡이고 소리가 끊긴다. 소속이 온전한 정상 경로에서는 **두 번째 `ontrack` 이 늘 이
       * 경우다** — 소리와 영상이 같은 msid 로 오므로 첫 호출에서 이미 둘 다 담겨 있다.
       *
       * **판단은 `attached` 로만 한다.** `event.streams[0]` 에는 그 트랙이 이미 들어 있어서,
       * 그것으로 판단하면 첫 트랙에서 그대로 돌아서 화면에 아무것도 붙지 않는다.
       */
      if (attached?.getTracks().some((existing) => existing.id === event.track.id)) return;

      /**
       * 소속이 있으면 그 스트림을 그대로 쓴다. 없으면 알고 있던 트랙에 새 트랙을 더해 **새
       * 객체**로 만든다.
       *
       * 붙어 있는 스트림에 `addTrack` 으로 더하기만 하면 크롬은 그 트랙을 그리기 시작하지
       * 않는다. 요소는 `srcObject` 가 다른 객체로 바뀔 때 트랙 구성을 다시 읽는다. 소리가 먼저
       * 붙고 영상이 뒤에 오는 순서에서 실제로 그랬다 — 소리는 나는데 화면만 끝까지 검었다.
       */
      const stream =
        attached == null && event.streams[0] != null
          ? event.streams[0]
          : new MediaStream([...(attached?.getTracks() ?? []), event.track]);
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
     * 사용자는 카메라와 목소리를, 상담자는 목소리만 보낸다.
     *
     * 상담자가 보는 지도는 이 영상에 담기지 않는다. MAP_SYNC 로 따로 건너간 값으로 상담자
     * 화면이 직접 다시 그린다 — 그래서 여기서는 눈앞 상황만 보내면 된다.
     */
    const captureLocalStream = async () => {
      if (role === 'USER') {
        /*
          상담 요청 화면에서 무엇을 보낼지 이미 정하고 잡아 두었다. 그대로 쓴다.

          여기서 새로 잡으면 사용자가 끄기로 한 카메라를 다시 열게 된다. 재연결 때마다
          표시등이 깜빡이는 것도 이걸 빠뜨렸을 때 생긴다.
        */
        const prepared = peekConsultMedia();
        if (prepared) {
          reusedPreparedStream = true;
          return prepared;
        }

        /*
          동의 화면을 거치지 않고 이 화면에 닿은 경우다. 무엇을 보내도 좋다는 답을 받은 적이
          없으므로 카메라는 열지 않고 목소리만 보낸다.
        */
        return captureConsultMicrophone();
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
      markConsultPhase('소켓 open, JOIN 전송'); // 추가
      // 붙었으니 토큰은 멀쩡하다. 다음에 거절당하면 다시 처음부터 셈한다.
      tokenRefreshAttemptsRef.current = 0;
      setStatus('signaling');
      // 접속에 성공했으므로 지난 시도의 실패 안내는 더 이상 사실이 아니다.
      setError(null);
      send('JOIN');
      /**
       * 자막은 소켓보다 먼저 시작한다. 그 사이에 드러난 고장은 보낼 소켓이 없어 그대로
       * 묻혔다. 방에 들어오자마자 한 번 알린다(상대가 아직이면 아래 연결 시점에 또 보낸다).
       */
      resendCaptionStatus();
      // 소켓이 닫혀 있는 동안 쌓인 확정 자막을 여기서 내보낸다. peer 가 그사이 `connected`
      // 를 유지했다면 상태 전이가 없어 이 자리 말고는 큐를 비울 기회가 없다.
      flushPendingFinalCaptions();
      try {
        /**
         * 매달려 있는 장치 요청에 협상을 볼모로 잡히지 않는다.
         *
         * 마이크가 다른 앱에 잡혀 있으면 `getUserMedia` 는 거절도 응답도 하지 않고 그대로
         * 멈춰 있다. 예전에는 그 뒤에 offer 를 만들었기 때문에, 장치 하나가 상담 전체를
         * 세워 버렸다 — `연결 상태: signaling` 에서 더 나아가지 못하던 것이 이것이다.
         */
        markConsultPhase('미디어 캡처 시작'); // 추가
        const stream = await withTimeout(captureLocalStream(), MEDIA_CAPTURE_TIMEOUT_MS);
        markConsultPhase('미디어 캡처 완료'); // 추가
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
        for (const track of localStream.getTracks()) {
          /**
           * **트랙과 스트림을 함께 붙인다.** (S15P11A206-206)
           *
           * `addTrack(track, stream)` 은 스트림 소속까지 등록하므로 협상에 msid 가 실린다. 받는
           * 쪽 `ontrack` 이 `event.streams` 로 스트림을 얻는 근거가 그 msid 다.
           *
           * 예약해 둔 자리에 `replaceTrack` 으로 넣지 않는다 — 그것은 트랙만 바꾸고 소속을
           * 만들지 않아, 소리는 나는데 화면은 검은 상태를 만들었다. 자리 잡기는 보낼 트랙이
           * 아예 없을 때만 한다(`reserveVideoSlotIfNeeded`).
           */
          const sender = peer.addTrack(track, localStream);
          /**
           * 영상 sender 를 붙일 때 받아 둔다. 나중에 `getSenders()` 에서 되찾을 수 없다 —
           * 트랙을 비우면 종류를 알 방법이 사라진다. (S15P11A206-89 리뷰)
           */
          if (track.kind === 'video') videoSenderRef.current = sender;
        }
      } catch (cause) {
        const timedOut = cause instanceof Error && cause.message === 'media_capture_timeout';
        markConsultPhase(timedOut ? '미디어 캡처 타임아웃(8초)' : '미디어 캡처 실패'); // 추가
        if (!disposed) {
          setMediaError(
            timedOut
              ? '카메라·마이크가 응답하지 않아 소리 없이 연결합니다. 다른 앱이 마이크를 쓰고 있는지 확인해 주세요.'
              : '카메라 또는 마이크를 사용할 수 없습니다.',
          );
        }
        publishMediaFailure(
          localCaptureFailureType,
          timedOut ? 'media_capture_timeout' : 'media_device_unavailable',
        );
      }

      if (disposed) return;

      /**
       * 보낼 영상이 없으면 여기서 자리를 잡는다. **협상을 열기 직전이다.**
       *
       * 캡처가 실패했거나 사용자가 카메라를 끈 경우다. 이 자리가 없으면 상담자의 `recvonly`
       * 영상 m-line 이 `inactive` 로 굳어, 뒤에 XR 세션이 카메라 트랙을 만들어도 보낼 방향이
       * 없다. 트랙이 이미 붙었으면 아무것도 하지 않는다. (S15P11A206-206)
       */
      reserveVideoSlotIfNeeded();

      /**
       * 미디어를 얻지 못했어도 여기까지는 반드시 온다.
       *
       * 예전에는 자막 시작과 협상이 미디어 확보와 같은 `try` 안에 있었다. 상담자 마이크
       * 하나가 막히면 offer 를 만드는 데까지 가지 못해, 상담자는 사용자 화면을 영영 받지
       * 못하고 양쪽 자막도 뜨지 않았다. 화면에는 그 원인 대신 한참 뒤의 연결 종료 안내만
       * 남아 무엇이 잘못됐는지 알 수 없었다.
       */
      markMediaReady();
      markConsultPhase('협상 시작'); // 추가
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
         * 뜨지 않는 사용자 영상이다. 같은 offer 면 답만 다시 보낸다.
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
          if (!disposed) {
            /**
             * 곧바로 다시 들어올 참이므로 자리를 비운다고 알리지 않는다.
             *
             * `LEAVE` 는 서버 방에서 나를 지운다. 그 사이에 상담자가 2초마다 보내는 offer 는
             * 갈 곳을 잃고 버려진다. 상담자 화면이 `연결 상태: signaling` 에서 멈춰 있던
             * 원인 중 하나가 이것이다.
             */
            rebuildingRef.current = true;
            setConnectionEpoch((epoch) => epoch + 1);
          }
          return;
        }

        await mediaReady;
        await applyRemoteDescription(offer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        answeredOfferSdp = offer.sdp ?? '';
        send('ANSWER', answer);
        markConsultPhase('ANSWER 전송'); // 추가
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
        const payload = message.payload as Partial<CaptionPayload & CaptionStatusPayload>;

        /**
         * 자막 본문이 아니라 "자막이 왜 안 오는지"를 알려 온 것이다. 지금 떠 있는 자막을
         * 건드리지 않는다 — 마지막으로 들은 말까지 지울 이유는 없다.
         */
        if ('captionStatus' in payload) {
          setRemoteCaptionError(payload.captionStatus ?? null);
          return;
        }

        const caption = payload as CaptionPayload;
        if (typeof caption.text !== 'string') return;
        // 한 마디라도 도착했다면 상대 자막은 살아 있다. 지난 경고는 더 이상 사실이 아니다.
        setRemoteCaptionError(null);
        setRemoteCaption(caption.text);
        setRemoteCaptionFinal(Boolean(caption.final));
        // 중간 결과에서는 직전 확정 ID를 유지한다. 실시간 번역문과 현재 원문을 함께 보여 주는 동안
        // 같은 확정문을 로그에서 숨겨 중복 렌더링을 막는다.
        if (caption.final) {
          const captionId =
            caption.captionId ?? `${remoteRole}:${message.timestamp}:${caption.text}`;
          appendFinalCaption(remoteRole, caption.text, {
            captionId,
            occurredAt: caption.occurredAt ?? message.timestamp,
          });
          setRemoteFinalCaptionId(captionId);
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
        /**
         * handshake 자체가 거절됐다. 대부분 토큰이 만료된 경우다.
         *
         * signaling 토큰은 10분이면 끝나는데 상담은 그보다 오래간다. 화면을 새로고침하지
         * 않은 쪽은 처음 받은 토큰을 그대로 들고 있어서, 연결을 다시 맺어야 하는 순간
         * — 상대가 새로고침했거나 ICE 가 끊긴 때 — 여기로 떨어져 두 번 다시 붙지 못했다.
         * 상대 화면에는 `연결 상태: signaling` 만 남았다.
         *
         * 만료가 원인이라면 새 토큰으로 붙을 수 있다. 화면에 토큰을 다시 받아 오라고
         * 알리고, 실패를 알리는 것은 그래도 안 될 때로 미룬다.
         */
        if (!disposed && tokenRefreshAttemptsRef.current < MAX_TOKEN_REFRESH_ATTEMPTS) {
          tokenRefreshAttemptsRef.current += 1;
          setTokenRejected(tokenRefreshAttemptsRef.current);
          return;
        }

        fail(`상담 연결 서버에 접속하지 못했습니다.${detail}`);
        return;
      }
      // 이미 영상까지 붙었으면 signaling이 닫혀도 통화는 유지된다.
      if (peer.connectionState === 'connected') {
        if (event.code === 4400 || event.code === 4408) return;
        recover('signaling_closed');
        return;
      }
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
     *
     * **예전 코드는 이 둘째 항을 실제로는 지키지 않았다.** 지원 브라우저에서만 `mediaReady`
     * 를 기다렸는데, 그것이 바로 위에서 경고한 순서다. 즉시 시작하던 나머지 분기는 "이
     * 브라우저는 지원하지 않는다"는 안내만 내고 끝나는 쪽이라 아무 소용이 없었다.
     *
     * **서버 받아쓰기는 반대로 마이크를 잡은 뒤에 시작한다.** 녹음할 트랙이 있어야 하기
     * 때문인데, 그쪽은 마이크를 새로 열지 않으므로 위의 순서 문제가 애초에 없다.
     */
    if (captionSource === 'server') {
      void mediaReady.then(() => {
        if (!disposed) startServerCaptions();
      });
    } else {
      startCaptions();
    }

    return () => {
      disposed = true;
      if (offerTimer) window.clearInterval(offerTimer);
      if (recoverTimer) window.clearTimeout(recoverTimer);
      if (captionRestartTimer) window.clearTimeout(captionRestartTimer);
      if (captionWatchdog !== undefined) window.clearTimeout(captionWatchdog);
      stopRtcStatsMonitor?.();
      /**
       * 다시 맺는 중이면 자리를 비운다고 알리지 않는다.
       *
       * `LEAVE` 는 서버 방에서 나를 지운다. 곧바로 다시 들어오는 참인데 지워 버리면, 그
       * 사이에 상대가 보낸 offer 가 갈 곳을 잃어 새 연결이 첫 offer 를 놓친다.
       */
      if (!rebuildingRef.current) send('LEAVE');
      shouldRecognize = false;
      recognitionGeneration += 1;
      recognition?.stop();
      serverRecorder?.stop();
      serverRecorder = null;
      dataChannelRef.current = null;
      setEventChannelOpen(false);
      fallbackEvents?.close();
      eventFallback.stop();
      eventFallbackRef.current = null;
      socket.close();
      peer.close();
      // 내가 만든 연결일 때만 지운다. 다음 연결이 이미 자리를 잡았으면 그것을 남긴다.
      if (peerRef.current === peer) {
        peerRef.current = null;
        videoSenderRef.current = null;
      }
      if (!reusedPreparedStream) localStream?.getTracks().forEach((track) => track.stop());
    };
  }, [
    accessToken,
    attachRemoteStream,
    captionSource,
    connectionEpoch,
    localSpeechLanguage,
    role,
    roomId,
    rtcConfig,
  ]);

  /**
   * 상담 이벤트를 상대에게 보낸다.
   *
   * DataChannel 이 열려 있으면 그 길로 간다. 열리지 않았으면 서버를 거치는 우회로로
   * 보낸다. 예전에는 이 경우를 조용히 버렸는데, DataChannel 이 막힌 상담에서는 상담자가
   * 아무리 그려도 사용자 화면에 아무것도 나타나지 않았다. 무엇이 잘못됐는지 알 방법도
   * 없어, 상담자는 사용자가 보고 있다고 믿은 채 설명을 이어 갔다.
   */
  /**
   * 보내는 영상 트랙을 다른 것으로 갈아 끼운다. **두 곳을 함께 바꾼다.** (S15P11A206-89)
   *
   * XR 세션과 `getUserMedia`가 공존하지 못하므로(11.8), 세션을 여는 순간 카메라 트랙을 세션에서
   * 뽑은 트랙으로 바꿔야 한다. 그런데 바꿀 곳이 두 군데다.
   *
   * ```
   * 지금 맺어진 연결   → sender.replaceTrack   (재협상 없이 즉시 바뀐다)
   * 맡겨 둔 스트림     → swapConsultVideoTrack (끊겼다 다시 맺을 때 실릴 트랙)
   * ```
   *
   * **하나만 하면 반쪽만 낫는다.** 연결만 바꾸면 재연결에서 멈춘 옛 트랙이 다시 실려 상담자
   * 화면이 검게 되고, 맡겨 둔 스트림만 바꾸면 지금 화면은 옛 트랙 그대로다. 예전에는 이 둘을
   * 화면이 차례로 불렀는데, 짝을 맞추는 책임이 호출부에 있으면 한쪽을 빠뜨린 것을 아무도 알아채지
   * 못한다 — 그때 드러나는 증상이 "재연결하면 검은 화면"이라 원인을 찾기도 어렵다.
   * 그래서 한 문으로 묶었다. (S15P11A206-89 리뷰)
   *
   * 영상 sender 가 없으면 연결 쪽은 건너뛴다. 사용자가 카메라 공유를 거절했거나 장치 요청이
   * 시간을 넘겼을 때다. 새 m-line 을 만들려면 재협상이 필요한데 지금 협상 흐름은 재협상을 하지
   * 않는다. 맡겨 둔 스트림 쪽도 카메라를 잡은 적이 없으면 스스로 아무것도 하지 않는다.
   *
   * 돌려주는 값은 **연결 쪽이 실제로 바뀌었는지**다. 지금 보이는 화면이 바뀌었는지를 뜻한다.
   */
  const replaceLocalVideoTrack = useCallback(async (track: MediaStreamTrack | null) => {
    /**
     * 붙일 때 받아 둔 sender 를 쓴다. `getSenders()` 에서 `track?.kind` 로 찾으면 한 번
     * `replaceTrack(null)` 을 한 뒤에는 되찾을 수 없다. (S15P11A206-89 리뷰)
     */
    const sender = videoSenderRef.current;
    let replaced = false;

    if (sender) {
      try {
        await sender.replaceTrack(track);
        replaced = true;
      } catch {
        // 트랙 종류가 맞지 않거나 연결이 이미 닫혔다. 상담 자체는 이어 가야 한다.
        replaced = false;
      }
    }

    /**
     * 재연결에 실릴 트랙도 같이 바꾼다. **연결 쪽이 실패해도 한다.**
     *
     * 연결이 이미 닫혀 `replaceTrack` 이 실패하는 경우가 곧 재연결이 필요한 상황이다. 그때
     * 맡겨 둔 스트림을 옛 트랙으로 남겨 두면, 다시 맺은 연결이 멈춘 트랙을 실어 보낸다.
     */
    swapConsultVideoTrack(track);

    return replaced;
  }, []);

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
    /** 보내는 영상 트랙을 갈아 끼운다. XR 세션이 카메라를 가져갈 때 쓴다. */
    replaceLocalVideoTrack,
    status,
    /**
     * 화면에 보여 줄 실패 안내.
     *
     * 연결이 끊겼다는 말보다 카메라·마이크를 못 얻었다는 말이 먼저다. 상담자가 손쓸 수 있는
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
    localCaptionFinal,
    localFinalCaptionId,
    remoteCaption,
    /** 상대가 말을 마친 마지막 문장. 번역에 쓴다. */
    remoteFinalCaption,
    remoteFinalCaptionId,
    /** `remoteCaption` 이 말을 마친 문장인지. 거짓이면 상대가 지금 말하는 중이다. */
    remoteCaptionFinal,
    /** 상대 쪽 음성 인식이 멈춘 이유. null 이면 정상이다. */
    remoteCaptionError,
    captionsSupported,
    /** 음성 인식이 멈춘 이유. null 이면 정상이다. */
    captionError,
    /** 상담을 끊지 않고 자막만 다시 시작한다. */
    restartCaptions,
    /** 상담 종료 뒤 서버에 넘길 확정 자막. 말한 순서대로 쌓인다. */
    transcript,
    /** 실시간 영역에서 현재 확정 발화를 타임라인과 구분할 때 쓰는 식별자를 포함한다. */
    transcriptTimeline,
    updateTranscriptTranslation,
    sendConsultEvent,
    /** 상담 이벤트 채널이 열렸는지. 상태 스냅숏을 다시 보내야 할 시점이다. */
    eventChannelOpen,
    /**
     * handshake 가 거절된 횟수. 오르면 화면이 signaling 토큰을 새로 받아 와야 한다.
     *
     * 0 이면 아직 거절당한 적이 없다.
     */
    tokenRejected,
  };
}
