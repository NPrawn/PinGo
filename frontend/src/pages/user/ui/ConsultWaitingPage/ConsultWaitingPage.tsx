import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

/**
 * Screen 19 (FR-U-014) — waiting in the consult queue.
 *
 * 상담 대기 SSE를 구독하고 수락 이벤트를 받으면 상담 화면으로 이동한다.
 */
export function ConsultWaitingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const consultationId = useConsultStore((state) => state.consultationId);
  const setSignalingRoom = useConsultStore((state) => state.setSignalingRoom);
  const clearConsultation = useConsultStore((state) => state.clearConsultation);
  const entryRoute = useConsultStore((state) => state.entryRoute);
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const [statusMessage, setStatusMessage] = useState(() => t('user.consultWaiting.status'));
  const missingTokenMessage = t('user.consultWaiting.missingToken');

  /**
   * 상담을 그만두고 돌아갈 자리. (S15P11A206-353)
   *
   * 취소는 한 단계 되돌리는 것이 아니라 신청을 접는 것이다. 앞 화면(공유 동의)으로 보내면
   * 방금 취소한 상담을 다시 만드는 버튼 앞에 서게 되고, 문의 유형 화면으로 보내면 그만둔
   * 사람에게 유형을 다시 고르라고 내미는 셈이 된다. 상담을 시작한 화면으로 되돌린다.
   *
   * 마운트 시점 값에 고정한다 — `clearConsultation()`이 `entryRoute`까지 비우므로 떠나는
   * 순간에 읽으면 이미 null이다. 상담 CTA를 거치지 않고 닿았다면 돌아갈 자리를 모르니 역
   * 선택으로 간다.
   */
  const [returnRoute] = useState(() => entryRoute ?? USER_ROUTES.STATION);

  /**
   * 이미 떠나기로 정했는지. 이 화면을 벗어나는 통로가 여럿이라 서로 겹치는 것을 막는다.
   *
   * 취소 요청이 실패해 화면에 그대로 머무는 경우가 있으므로, 실제로 떠나는 시점에만 세운다.
   */
  const leavingRef = useRef(false);

  const leaveWaiting = useCallback(
    (target: string) => {
      leavingRef.current = true;
      // 상담으로 이어지지 않았으니 미리 잡아 둔 카메라·마이크를 놓아 준다. 그대로 두면 장치를
      // 계속 물고 있어서 다음 권한 요청이 응답 없이 멈춘다.
      releaseConsultMedia();
      clearConsultation();
      /*
        신청 흐름을 기록에 남기지 않는다. (S15P11A206-353)

        push로 나가면 뒤로가기가 이미 취소된 대기 화면으로 되돌아가고, 그 화면은 "상담원
        연결 중"을 그대로 띄워 사용자에게는 상담이 다시 신청된 것처럼 보인다.
      */
      void navigate(target, { replace: true });
    },
    [clearConsultation, navigate],
  );

  /**
   * 기다릴 상담이 없으면 이 화면에 머물 이유가 없다. (S15P11A206-353)
   *
   * 주소로 직접 들어오거나 세션에 상담 정보가 없는 채로 닿으면, 끝나지 않는 "상담원 연결 중"
   * 화면이 그대로 보여 사용자는 신청된 줄 알고 계속 기다린다. 돌아갈 자리를 알 수 없는
   * 경우이므로 진입 화면이 아니라 문의 유형 화면으로 내보낸다.
   */
  useEffect(() => {
    if (consultationId || leavingRef.current) return;
    void navigate(USER_ROUTES.CONSULT_REQUEST, { replace: true });
  }, [consultationId, navigate]);

  /*
    기기 뒤로가기로 이 화면을 벗어나는 경우는 여기서 잡지 못한다. (S15P11A206-353)

    언마운트 정리는 StrictMode 가 마운트 직후 실행해 기다리기도 전에 상담을 취소하고,
    `popstate` 는 라우터가 먼저 받아 이 화면을 걷어내면서 리스너까지 떼어 가 호출되지 않는다.
    그래서 되돌아 도착하는 화면(`useWithdrawAbandonedConsultation`)이 상담을 거둬들인다.
  */

  useEffect(() => {
    if (!consultationId || !userSessionId) return;

    let active = true;

    void getConsultation(consultationId, userSessionId)
      .then((consultation) => {
        if (!active) return;
        if (
          (consultation.status === 'ACCEPTED' || consultation.status === 'IN_PROGRESS') &&
          consultation.signalingRoomId
        ) {
          if (!consultation.signalingAccessToken) {
            setStatusMessage(missingTokenMessage);
            return;
          }
          setSignalingRoom(consultation.signalingRoomId, consultation.signalingAccessToken);
          // 상담으로 이어진 것이므로 아래 뒤로가기 정리가 이 상담을 거둬들이지 않게 한다.
          leavingRef.current = true;
          void navigate(USER_ROUTES.CONSULT_SESSION);
          return;
        }
        // 세션에 남아 있던 옛 요청이면 대기할 것이 없다. 그만둔 것이 아니라 기다릴 대상이
        // 없는 경우이므로, 진입 화면이 아니라 문의 유형 화면에서 다시 시작하게 한다.
        if (consultation.status && consultation.status !== 'WAITING') {
          leaveWaiting(USER_ROUTES.CONSULT_REQUEST);
        }
      })
      .catch(() => {
        leaveWaiting(USER_ROUTES.CONSULT_REQUEST);
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
              setStatusMessage(missingTokenMessage);
              return;
            }
            setSignalingRoom(roomId, consultation.signalingAccessToken);
            leavingRef.current = true;
            void navigate(USER_ROUTES.CONSULT_SESSION);
          })
          .catch(() => setStatusMessage(missingTokenMessage));
      } catch {
        setStatusMessage(t('user.consultWaiting.readError'));
      }
    };
    const handleUnavailable = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { message?: string };
        setStatusMessage(payload.message ?? t('user.consultWaiting.connectError'));
      } catch {
        setStatusMessage(t('user.consultWaiting.connectError'));
      }
    };
    // 상담자가 거둬들인 경우다. 사용자가 취소한 것과 결과가 같으므로 같은 자리로 되돌린다.
    const handleCanceled = () => {
      active = false;
      leaveWaiting(returnRoute);
    };

    events.addEventListener('ACCEPTED', handleAccepted as EventListener);
    events.addEventListener('REJECTED', handleUnavailable as EventListener);
    events.addEventListener('NO_COUNSELOR', handleUnavailable as EventListener);
    events.addEventListener('CANCELED', handleCanceled as EventListener);

    return () => {
      active = false;
      events.close();
    };
  }, [
    consultationId,
    leaveWaiting,
    missingTokenMessage,
    navigate,
    returnRoute,
    setSignalingRoom,
    t,
    userSessionId,
  ]);

  /**
   * 기다리는 동안 권한이 사라지면 요청을 거둬들인다.
   *
   * 이 화면은 경로 가드(`RequirePermissions`) 밖에 있다. 가드에 맡기면 권한 화면으로 튕겨
   * 나가면서 잡아 둔 장치가 그대로 남고, 서버에는 응답할 사람 없는 요청이 대기열에 남아
   * 상담자가 수락한 뒤에야 잘못된 것을 알게 된다.
   */
  const permissionsRevoked = usePermissionsRevoked();

  useEffect(() => {
    if (!permissionsRevoked || leavingRef.current) return;

    leavingRef.current = true;
    releaseConsultMedia();
    if (consultationId && userSessionId) {
      void cancelConsultation(consultationId, userSessionId).catch(() => undefined);
    }
    clearConsultation();
    // 권한을 다시 받아야 하는 경우라 진입 화면이 아니라 권한 화면으로 간다. 대기 화면은
    // 기록에서 지운다 — 뒤로가기로 되돌아와도 기다릴 상담이 이미 없다. (S15P11A206-353)
    void navigate(USER_ROUTES.PERMISSION, { replace: true });
  }, [clearConsultation, consultationId, navigate, permissionsRevoked, userSessionId]);

  const cancel = async () => {
    if (!consultationId || !userSessionId) {
      leaveWaiting(returnRoute);
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
          error instanceof ApiError ? error.message : t('user.consultWaiting.cancelError'),
        );
        return;
      }
    }

    leaveWaiting(returnRoute);
  };

  return (
    <PhoneFrame bodyClassName={styles.body}>
      <>
        <LivePill>{t('user.consultWaiting.pill')}</LivePill>

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

        <Title className={styles.title} style={{ whiteSpace: 'pre-line' }}>
          {t('user.consultWaiting.title')}
        </Title>
        <Sub className={styles.sub}>{statusMessage}</Sub>

        <Card className={styles.tip}>
          <span className={styles.tipIcon}>
            <Icon name="bulb" size={18} />
          </span>
          <div className={styles.tipCopy}>
            <strong className={styles.tipTitle}>{t('user.consultWaiting.tipTitle')}</strong>
            <span className={styles.tipLine}>
              {t('user.consultWaiting.tipVisit')}
            </span>
            <span className={styles.tipLine}>{t('user.consultWaiting.tipExtra')}</span>
          </div>
        </Card>

        <Spring />
        <GhostButton className={styles.cancel} onClick={() => void cancel()}>
          {t('user.consultWaiting.cancel')}
        </GhostButton>
      </>
    </PhoneFrame>
  );
}
