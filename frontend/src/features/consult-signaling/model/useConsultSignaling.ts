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
    const peer = new RTCPeerConnection(rtcConfiguration());
    const wsBase = env.VITE_WS_BASE_URL.replace(/\/$/, '');
    const socket = new WebSocket(
      `${wsBase}/ws/signaling?token=${encodeURIComponent(accessToken)}`,
    );
    const consultationId = roomId.startsWith('room_') ? roomId.slice('room_'.length) : roomId;
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

    const makeOffer = async () => {
      if (role !== 'COUNSELOR' || socket.readyState !== WebSocket.OPEN) return;
      if (peer.signalingState !== 'stable') return;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      send('OFFER', offer);
    };

    peer.onconnectionstatechange = () => {
      if (!disposed) setStatus(peer.connectionState);
      if (peer.connectionState === 'connected' && offerTimer) window.clearInterval(offerTimer);
      if (peer.connectionState === 'failed') publishVideoFailure('peer_connection_failed');
    };
    peer.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };
    peer.onicecandidate = (event) => {
      if (event.candidate) send('ICE_CANDIDATE', event.candidate.toJSON());
    };

    socket.onopen = async () => {
      setStatus('signaling');
      send('JOIN');
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (disposed) return;
        if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
        localStream.getTracks().forEach((track) => peer.addTrack(track, localStream!));
        startCaptions();
        if (role === 'COUNSELOR') {
          await makeOffer();
          offerTimer = window.setInterval(() => void makeOffer(), 2000);
        }
      } catch {
        if (!disposed) setError('카메라 또는 마이크를 사용할 수 없습니다.');
        publishVideoFailure('media_device_unavailable');
      }
    };

    socket.onmessage = (event) => {
      void (async () => {
        const message = JSON.parse(String(event.data)) as SignalingMessage;
        if (message.type === 'ERROR') {
          const payload = message.payload as { retryable?: boolean; message?: string } | undefined;
          if (
            payload?.retryable &&
            role === 'COUNSELOR' &&
            peer.signalingState === 'have-local-offer'
          ) {
            await peer.setLocalDescription({ type: 'rollback' });
          } else if (!payload?.retryable) {
            setError(payload?.message ?? '상담 연결에 실패했습니다.');
          }
          return;
        }
        if (message.type === 'OFFER' && role === 'USER') {
          await peer.setRemoteDescription(message.payload as RTCSessionDescriptionInit);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          send('ANSWER', answer);
        } else if (message.type === 'ANSWER' && role === 'COUNSELOR') {
          await peer.setRemoteDescription(message.payload as RTCSessionDescriptionInit);
        } else if (message.type === 'ICE_CANDIDATE' && message.payload) {
          await peer.addIceCandidate(message.payload as RTCIceCandidateInit);
        } else if (message.type === 'CAPTION' && message.payload) {
          const caption = message.payload as CaptionPayload;
          if (typeof caption.text === 'string') setRemoteCaption(caption.text);
        }
      })().catch(() => setError('실시간 연결 정보를 처리하지 못했습니다.'));
    };
    socket.onerror = () => setError('상담 연결 서버에 접속하지 못했습니다.');

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
