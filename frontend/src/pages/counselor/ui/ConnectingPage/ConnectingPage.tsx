import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { isClosedConsultation, useConsultStore, useCounselorQueueStore } from '@/entities/consult';
import { COUNSELOR_ROUTES } from '@/shared/config';
import {
  ApiError,
  endConsultation,
  getCounselorConsultations,
  queryKeys,
} from '@/shared/api';
import { Button } from '@/shared/ui';
import { CounselorConsoleShell } from '@/widgets/counselor-console';
import styles from './ConnectingPage.module.css';

/**
 * 협상이 끝나기를 기다리는 한도.
 *
 * 사용자 쪽 카메라·마이크가 늦게 열리는 경우까지 감안한 값이다. 넘겨도 실패로 단정하지
 * 않고 상담 화면으로 넘긴다 — 그쪽이 연결 상태와 오류를 그대로 보여 준다.
 */
const CONNECT_TIMEOUT_MS = 20000;

/** Screen 29-1 — connecting to the user. */
export function ConnectingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const consultationId = useConsultStore((state) => state.consultationId);
  const signalingRoomId = useConsultStore((state) => state.signalingRoomId);
  const signalingAccessToken = useConsultStore((state) => state.signalingAccessToken);
  const clearConsultation = useConsultStore((state) => state.clearConsultation);
  const selected = useCounselorQueueStore((state) => state.selected);
  const complete = useCounselorQueueStore((state) => state.complete);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const queueQuery = useQuery({
    queryKey: queryKeys.counselorConsultations(),
    queryFn: () => getCounselorConsultations(),
    enabled: Boolean(consultationId),
    refetchInterval: 2_000,
  });
  const consultation = queueQuery.data?.find((item) => item.consultationId === consultationId);
  const closed = Boolean(consultation && isClosedConsultation(consultation.status));
  const signalingReady = Boolean(signalingRoomId && signalingAccessToken);

  const leave = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.counselorConsultations() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.counselorMe() });
    complete(selected);
    clearConsultation();
    void navigate(COUNSELOR_ROUTES.REQUESTS);
  }, [clearConsultation, complete, navigate, queryClient, selected]);

  useEffect(() => {
    if (!closed) return;
    leave();
  }, [closed, leave]);

  const cancelConnection = useCallback(async () => {
    if (!consultationId || canceling) return;
    setCanceling(true);
    setCancelError(null);
    try {
      // ACCEPTED 상태를 남기면 상담원이 BUSY로 고정되므로 서버 상태도 종료한다.
      await endConsultation(consultationId);
      leave();
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : undefined;
      if (code === 'CONSULTATION_NOT_ENDABLE' || code === 'CONSULTATION_NOT_FOUND') {
        leave();
        return;
      }

      // Network failures must not clear the local consultation while the server
      // may still keep the counselor BUSY.
      setCanceling(false);
      setCancelError('연결을 취소하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.');
    }
  }, [canceling, consultationId, leave]);

  /**
   * 상담 화면으로 넘어갈 조건은 signaling 방과 토큰이 준비된 것이다. 여기서 직접 연결을
   * 열면 상담 화면이 또 하나를 여는 셈이라, 방금 맺은 연결을 스스로 끊게 된다.
   */
  useEffect(() => {
    if (signalingReady) {
      void navigate(COUNSELOR_ROUTES.SESSION);
      return;
    }

    const timer = setTimeout(() => void cancelConnection(), CONNECT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [cancelConnection, navigate, signalingReady]);

  return (
    <CounselorConsoleShell>
      <div className={styles.stage}>
        <div className={styles.spinner} aria-hidden />
        <h2 className={styles.heading}>사용자와 연결하고 있어요</h2>
        <p className={styles.body}>WebRTC 세션을 준비 중입니다 · 영상·음성 협상 중</p>
        <div className={styles.chips}>
          <span className={`${styles.chip} ${styles.chipDone}`}>✓ 상담 수락됨</span>
          <span className={`${styles.chip} ${styles.chipActive}`}>
            <span className={styles.chipDot} aria-hidden />
            연결 중
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className={styles.cancel}
          disabled={canceling}
          onClick={() => void cancelConnection()}
        >
          {canceling ? '연결 취소 중...' : '연결 취소'}
        </Button>
        {cancelError && <p role="alert">{cancelError}</p>}
        <Link to={COUNSELOR_ROUTES.CONNECT_FAILED} className={styles.failureLink}>
          연결 실패 시 화면 보기 →
        </Link>
      </div>
    </CounselorConsoleShell>
  );
}
