import { useEffect, useRef, useState } from 'react';
import { publishConsultationFallbackEvent } from '@/shared/api';
import { env } from '@/shared/config';

type SignalingRole = 'USER' | 'COUNSELOR';
type SignalingType = 'JOIN' | 'LEAVE' | 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE' | 'CAPTION' | 'ERROR';

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

function rtcConfiguration(): RTCConfiguration {
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

/**
 * 상담 signaling WebSocket과 WebRTC peer를 한 생명주기로 관리한다.
 * 상담자는 offer를 만들고 사용자는 answer로 응답한다.
 */
export function useConsultSignaling(
  roomId: string | null,
  role: SignalingRole,
  accessToken?: string | null,
) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<RTCPeerConnectionState | 'idle' | 'signaling'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [localCaption, setLocalCaption] = useState('');
  const [remoteCaption, setRemoteCaption] = useState('');
  const [captionsSupported, setCaptionsSupported] = useState(true);

  useEffect(() => {
    if (!roomId) return;
    // 서버는 room과 함께 발급한 토큰이 없는 handshake를 401로 거절한다. 토큰 없이
    // 접속하면 무조건 실패하므로, 화면이 토큰을 받아올 때까지 기다린다.
    // (토큰이 채워지면 이 effect가 다시 돌면서 접속한다.)
    if (!accessToken) return;

    let disposed = false;
    let offerTimer: number | undefined;
    let localStream: MediaStream | null = null;
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
    const peer = new RTCPeerConnection(rtcConfiguration());
    const wsBase = env.VITE_WS_BASE_URL.replace(/\/$/, '');
    const socket = new WebSocket(`${wsBase}/ws/signaling?token=${encodeURIComponent(accessToken)}`);
    const consultationId = roomId.startsWith('room_') ? roomId.slice('room_'.length) : roomId;
    /** 정리된 뒤에 도착한 이벤트로 화면에 실패를 남기지 않는다. */
    const fail = (message: string) => {
      if (!disposed) setError(message);
    };
    const publishVideoFailure = (reason: string) => {
      void publishConsultationFallbackEvent(consultationId, {
        type: 'VIDEO_FAILED',
        reason,
      }).catch(() => undefined);
    };
    const startCaptions = () => {
      const speechWindow = window as typeof window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };
      const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
      if (!Recognition) {
        setCaptionsSupported(false);
        return;
      }

      recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = role === 'COUNSELOR' ? 'ko-KR' : navigator.language || 'en-US';
      recognition.onresult = (event) => {
        let transcript = '';
        let final = false;
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          transcript += event.results[index][0].transcript;
          final ||= event.results[index].isFinal;
        }
        const text = transcript.trim();
        if (!text) return;
        setLocalCaption(text);
        send('CAPTION', { text, final, language: recognition?.lang ?? navigator.language });
      };
      recognition.onerror = (event) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          shouldRecognize = false;
          setCaptionsSupported(false);
        }
      };
      recognition.onend = () => {
        if (shouldRecognize && !disposed && socket.readyState === WebSocket.OPEN) {
          try {
            recognition?.start();
          } catch {
            // The browser can still be winding down the previous recognition session.
          }
        }
      };
      try {
        recognition.start();
      } catch {
        setCaptionsSupported(false);
      }
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

    peer.onconnectionstatechange = () => {
      if (disposed) return;
      setStatus(peer.connectionState);
      if (peer.connectionState === 'connected') {
        if (offerTimer) window.clearInterval(offerTimer);
        // 재접속으로 연결됐다면 이전 시도의 실패 안내는 더 이상 사실이 아니다.
        setError(null);
      }
      if (peer.connectionState === 'failed') publishVideoFailure('peer_connection_failed');
    };
    peer.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };
    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON();
      localCandidates.push(candidate);
      send('ICE_CANDIDATE', candidate);
    };

    socket.onopen = async () => {
      socketOpened = true;
      setStatus('signaling');
      // 접속에 성공했으므로 지난 시도의 실패 안내는 더 이상 사실이 아니다.
      setError(null);
      send('JOIN');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        /**
         * 기다리는 사이에 화면을 벗어났으면 여기서 직접 끈다.
         *
         * 정리 함수는 이미 지나갔고 그때 `localStream`은 아직 비어 있었다. 그대로 반환하면
         * 아무도 이 스트림을 모르는 채 카메라와 마이크가 계속 켜져 있게 된다.
         */
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStream = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
        localStream.getTracks().forEach((track) => peer.addTrack(track, localStream!));
        startCaptions();
        if (role === 'COUNSELOR') {
          await sendOffer();
          offerTimer = window.setInterval(() => void sendOffer(), 2000);
        }
      } catch {
        if (!disposed) setError('카메라 또는 마이크를 사용할 수 없습니다.');
        publishVideoFailure('media_device_unavailable');
      }
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
        await applyRemoteDescription(message.payload as RTCSessionDescriptionInit);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
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
      if (message.type === 'CAPTION' && message.payload) {
        const caption = message.payload as CaptionPayload;
        if (typeof caption.text === 'string') setRemoteCaption(caption.text);
      }
    };

    socket.onmessage = (event) => {
      handling = handling
        .then(() => handleMessage(String(event.data)))
        .catch(() => fail('실시간 연결 정보를 처리하지 못했습니다.'));
    };
    socket.onerror = () => fail('상담 연결 서버에 접속하지 못했습니다.');
    socket.onclose = () => {
      if (!socketOpened) {
        fail('상담 연결 서버에 접속하지 못했습니다.');
        return;
      }
      // 이미 영상까지 붙었으면 signaling이 닫혀도 통화는 유지된다.
      if (peer.connectionState === 'connected') return;
      fail('상담 연결이 끊어졌습니다. 잠시 후 다시 시도해 주세요.');
    };

    return () => {
      disposed = true;
      if (offerTimer) window.clearInterval(offerTimer);
      send('LEAVE');
      shouldRecognize = false;
      recognition?.stop();
      socket.close();
      peer.close();
      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, [accessToken, role, roomId]);

  return {
    localVideoRef,
    remoteVideoRef,
    status,
    error,
    localCaption,
    remoteCaption,
    captionsSupported,
  };
}
