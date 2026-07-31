import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { useUserSessionStore } from '@/entities/user-session';
import {
  cancelConsultation,
  getConsultation,
  subscribeToConsultationWaitingEvents,
} from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import {
  Blob,
  BlobHero,
  BlobPin,
  Card,
  GhostButton,
  Icon,
  LivePill,
  Spring,
  Sub,
  Title,
} from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './ConsultWaitingPage.module.css';

/**
 * Screen 19 (FR-U-014) — waiting in the consult queue.
 *
 * 상담 대기 SSE를 구독하고 수락 이벤트를 받으면 상담 화면으로 이동한다.
 */
export function ConsultWaitingPage() {
  const navigate = useNavigate();
  const consultationId = useConsultStore((state) => state.consultationId);
  const setSignalingRoom = useConsultStore((state) => state.setSignalingRoom);
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const [statusMessage, setStatusMessage] = useState('잠시만 기다려 주세요 · 평균 30초 소요');

  useEffect(() => {
    if (!consultationId || !userSessionId) return;

    void getConsultation(consultationId, userSessionId).then((consultation) => {
      if (consultation.status === 'ACCEPTED' && consultation.signalingRoomId) {
        setSignalingRoom(consultation.signalingRoomId, consultation.signalingAccessToken);
        void navigate(USER_ROUTES.CONSULT_SESSION);
      }
    });

    const events = subscribeToConsultationWaitingEvents(consultationId);
    const handleAccepted = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { signalingRoomId?: string };
        if (payload.signalingRoomId) setSignalingRoom(payload.signalingRoomId);
        // The SSE payload carries no handshake token, so re-read the consultation
        // to pick it up before the session screen opens its WebSocket.
        void getConsultation(consultationId, userSessionId)
          .then((consultation) => {
            if (consultation.signalingRoomId) {
              setSignalingRoom(consultation.signalingRoomId, consultation.signalingAccessToken);
            }
          })
          .catch(() => undefined);
        void navigate(USER_ROUTES.CONSULT_SESSION);
      } catch {
        setStatusMessage('상담 연결 정보를 읽지 못했습니다.');
      }
    };
    const handleUnavailable = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { message?: string };
        setStatusMessage(payload.message ?? '상담 연결을 완료하지 못했습니다.');
      } catch {
        setStatusMessage('상담 연결을 완료하지 못했습니다.');
      }
    };

    events.addEventListener('ACCEPTED', handleAccepted as EventListener);
    events.addEventListener('REJECTED', handleUnavailable as EventListener);
    events.addEventListener('NO_COUNSELOR', handleUnavailable as EventListener);

    return () => events.close();
  }, [consultationId, navigate, setSignalingRoom, userSessionId]);

  const cancel = async () => {
    try {
      if (consultationId && userSessionId) {
        await cancelConsultation(consultationId, userSessionId);
      }
      void navigate(USER_ROUTES.CONSULT_REQUEST);
    } catch {
      setStatusMessage('상담 요청을 취소하지 못했습니다.');
    }
  };

  return (
    <PhoneFrame bodyClassName={styles.body}>
      <>
        <LivePill>CONNECTING · 상담 대기 중</LivePill>

        <BlobHero className={styles.hero}>
          <span className={styles.ripple} aria-hidden />
          <span className={`${styles.ripple} ${styles.rippleDelayed}`} aria-hidden />
          <Blob slot="main" style={{ width: 160, height: 160 }} />
          <Blob tone="lilac" slot="a" style={{ top: '8%', right: '14%', width: 48, height: 48 }} />
          <Blob
            tone="coral"
            slot="b"
            style={{ bottom: '10%', left: '16%', width: 38, height: 38 }}
          />
          <BlobPin>
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden>
              <circle cx="16" cy="11" r="6" fill="#0EA36F" />
              <path
                d="M16 19c-6 0-10.5 4-10.5 9.2A1.8 1.8 0 007.3 30h17.4a1.8 1.8 0 001.8-1.8C26.5 23 22 19 16 19z"
                fill="#3CD8A0"
              />
            </svg>
          </BlobPin>
        </BlobHero>

        <Title className={styles.title}>
          상담원을
          <br />
          연결하고 있어요
        </Title>
        <Sub className={styles.sub}>{statusMessage}</Sub>

        <Card className={styles.tip}>
          <span className={styles.tipIcon}>
            <Icon name="bulb" size={18} />
          </span>
          <div className={styles.tipCopy}>
            <strong className={styles.tipTitle}>상담원 연결이 어려운 경우</strong>
            <span className={styles.tipLine}>
              <b>B1 고객안내센터</b>를 방문해 주세요.
            </span>
            <span className={styles.tipLine}>역무원용 안내 문장도 준비되어 있어요.</span>
          </div>
        </Card>

        <Spring />
        <GhostButton className={styles.cancel} onClick={() => void cancel()}>
          요청 취소
        </GhostButton>
      </>
    </PhoneFrame>
  );
}
