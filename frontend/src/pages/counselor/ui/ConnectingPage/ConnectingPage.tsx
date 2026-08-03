import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { COUNSELOR_ROUTES } from '@/shared/config';
import { ButtonLink } from '@/shared/ui';
import { CounselorConsoleShell } from '@/widgets/counselor-console';
import styles from './ConnectingPage.module.css';

/**
 * 협상이 끝나기를 기다리는 한도.
 *
 * 사용자가 화면 공유를 고르는 데 걸리는 시간까지 감안한 값이다. 넘겨도 실패로 단정하지
 * 않고 상담 화면으로 넘긴다 — 그쪽이 연결 상태와 오류를 그대로 보여 준다.
 */
const CONNECT_TIMEOUT_MS = 20000;

/** Screen 29-1 — connecting to the user. */
export function ConnectingPage() {
  const navigate = useNavigate();
  const signalingRoomId = useConsultStore((state) => state.signalingRoomId);
  const signalingAccessToken = useConsultStore((state) => state.signalingAccessToken);

  /**
   * 상담 화면으로 넘어갈 조건은 signaling 방과 토큰이 준비된 것이다. 여기서 직접 연결을
   * 열면 상담 화면이 또 하나를 여는 셈이라, 방금 맺은 연결을 스스로 끊게 된다.
   */
  useEffect(() => {
    if (signalingRoomId && signalingAccessToken) {
      void navigate(COUNSELOR_ROUTES.SESSION);
      return;
    }

    const timer = setTimeout(() => void navigate(COUNSELOR_ROUTES.SESSION), CONNECT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [navigate, signalingAccessToken, signalingRoomId]);

  return (
    <CounselorConsoleShell>
      <div className={styles.stage}>
        <div className={styles.spinner} aria-hidden />
        <h2 className={styles.heading}>사용자와 연결하고 있어요</h2>
        <p className={styles.body}>WebRTC 세션을 준비 중입니다 · 화면·음성 공유 협상 중</p>
        <div className={styles.chips}>
          <span className={`${styles.chip} ${styles.chipDone}`}>✓ 상담 수락됨</span>
          <span className={`${styles.chip} ${styles.chipActive}`}>
            <span className={styles.chipDot} aria-hidden />
            연결 중
          </span>
        </div>
        <ButtonLink
          to={COUNSELOR_ROUTES.REQUESTS}
          size="sm"
          variant="secondary"
          className={styles.cancel}
        >
          연결 취소
        </ButtonLink>
        <Link to={COUNSELOR_ROUTES.CONNECT_FAILED} className={styles.failureLink}>
          연결 실패 시 화면 보기 →
        </Link>
      </div>
    </CounselorConsoleShell>
  );
}
