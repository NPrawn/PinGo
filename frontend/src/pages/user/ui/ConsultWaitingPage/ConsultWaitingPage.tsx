import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { useUserSessionStore } from '@/entities/user-session';
import { releaseConsultMedia } from '@/features/consult-signaling';
import { usePermissionsRevoked } from '@/features/permissions';
import {
  ApiError,
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

const MISSING_TOKEN_MESSAGE = '상담 연결 정보를 받지 못했습니다. 잠시 후 다시 시도해 주세요.';

/**
 * Screen 19 (FR-U-014) — waiting in the consult queue.
 *
 * 상담 대기 SSE를 구독하고 수락 이벤트를 받으면 상담 화면으로 이동한다.
 */
export function ConsultWaitingPage() {
  const navigate = useNavigate();
  const consultationId = useConsultStore((state) => state.consultationId);
  const setSignalingRoom = useConsultStore((state) => state.setSignalingRoom);
  const clearConsultation = useConsultStore((state) => state.clearConsultation);
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const [statusMessage, setStatusMessage] = useState('잠시만 기다려 주세요 · 평균 30초 소요');

  useEffect(() => {
    if (!consultationId || !userSessionId) return;

    let active = true;

    void getConsultation(consultationId, userSessionId)
      .then((consultation) => {
        if (!active) return;
        if (consultation.status === 'ACCEPTED' && consultation.signalingRoomId) {
          if (!consultation.signalingAccessToken) {
            setStatusMessage(MISSING_TOKEN_MESSAGE);
            return;
          }
          setSignalingRoom(consultation.signalingRoomId, consultation.signalingAccessToken);
          void navigate(USER_ROUTES.CONSULT_SESSION);
          return;
        }
        // 세션에 남아 있던 옛 요청이면 대기할 것이 없다.
        if (consultation.status && consultation.status !== 'WAITING') {
          clearConsultation();
          void navigate(USER_ROUTES.CONSULT_REQUEST);
        }
      })
      .catch(() => {
        clearConsultation();
        void navigate(USER_ROUTES.CONSULT_REQUEST);
      });

    const events = subscribeToConsultationWaitingEvents(consultationId);
    const handleAccepted = (event: MessageEvent<string>) => {
      if (!active) return;
      try {
        const acceptedRoomId = (JSON.parse(event.data) as { signalingRoomId?: string })
          .signalingRoomId;
        // SSE 이벤트에는 handshake 토큰이 없다. 토큰 없이 상담 화면을 열면 서버가
        // WebSocket 접속을 거절하므로, 상세 조회로 토큰을 받은 뒤에 넘어간다.
        void getConsultation(consultationId, userSessionId)
          .then((consultation) => {
            if (!active) return;
            const roomId = consultation.signalingRoomId ?? acceptedRoomId;
            if (!roomId || !consultation.signalingAccessToken) {
              setStatusMessage(MISSING_TOKEN_MESSAGE);
              return;
            }
            setSignalingRoom(roomId, consultation.signalingAccessToken);
            void navigate(USER_ROUTES.CONSULT_SESSION);
          })
          .catch(() => setStatusMessage(MISSING_TOKEN_MESSAGE));
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
    const handleCanceled = () => {
      active = false;
      releaseConsultMedia();
      clearConsultation();
      void navigate(USER_ROUTES.CONSULT_REQUEST);
    };

    events.addEventListener('ACCEPTED', handleAccepted as EventListener);
    events.addEventListener('REJECTED', handleUnavailable as EventListener);
    events.addEventListener('NO_COUNSELOR', handleUnavailable as EventListener);
    events.addEventListener('CANCELED', handleCanceled as EventListener);

    return () => {
      active = false;
      events.close();
    };
  }, [clearConsultation, consultationId, navigate, setSignalingRoom, userSessionId]);

  const leaveWaiting = useCallback(() => {
    // 상담으로 이어지지 않았으니 미리 잡아 둔 카메라·마이크를 놓아 준다. 그대로 두면 장치를
    // 계속 물고 있어서 다음 권한 요청이 응답 없이 멈춘다.
    releaseConsultMedia();
    clearConsultation();
    void navigate(USER_ROUTES.CONSULT_REQUEST);
  }, [clearConsultation, navigate]);

  /**
   * 기다리는 동안 권한이 사라지면 요청을 거둬들인다.
   *
   * 이 화면은 경로 가드(`RequirePermissions`) 밖에 있다. 가드에 맡기면 권한 화면으로 튕겨
   * 나가면서 잡아 둔 장치가 그대로 남고, 서버에는 응답할 사람 없는 요청이 대기열에 남아
   * 상담자가 수락한 뒤에야 잘못된 것을 알게 된다.
   */
  const permissionsRevoked = usePermissionsRevoked();
  const withdrawingRef = useRef(false);

  useEffect(() => {
    if (!permissionsRevoked || withdrawingRef.current) return;

    withdrawingRef.current = true;
    releaseConsultMedia();
    if (consultationId && userSessionId) {
      void cancelConsultation(consultationId, userSessionId).catch(() => undefined);
    }
    clearConsultation();
    void navigate(USER_ROUTES.PERMISSION);
  }, [clearConsultation, consultationId, navigate, permissionsRevoked, userSessionId]);

  const cancel = async () => {
    if (!consultationId || !userSessionId) {
      leaveWaiting();
      return;
    }

    try {
      await cancelConsultation(consultationId, userSessionId);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      // 이미 취소·종료됐거나 찾을 수 없는 요청이면 대기 화면에 남을 이유가 없다.
      const alreadyGone =
        code === 'CONSULTATION_NOT_CANCELABLE' || code === 'CONSULTATION_NOT_FOUND';
      if (!alreadyGone) {
        setStatusMessage(
          error instanceof ApiError ? error.message : '상담 요청을 취소하지 못했습니다.',
        );
        return;
      }
    }

    leaveWaiting();
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
