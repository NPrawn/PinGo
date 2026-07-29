import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { COUNSELOR_ROUTES } from '@/shared/config';
import { ButtonLink } from '@/shared/ui';
import { CounselorConsoleShell } from '@/widgets/counselor-console';
import styles from './ConnectingPage.module.css';

/** How long the prototype waited before dropping into the session screen. */
const CONNECT_MS = 2000;

/**
 * Screen 29-1 — connecting to the user.
 *
 * TODO: Replace the timer with the real WebRTC connection state once the
 * signalling contract is implemented.
 */
export function ConnectingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => void navigate(COUNSELOR_ROUTES.SESSION), CONNECT_MS);
    return () => clearTimeout(timer);
  }, [navigate]);

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
