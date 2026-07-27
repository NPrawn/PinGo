import { COUNSELOR_ROUTES } from '@/shared/config';
import { ButtonLink } from '@/shared/ui';
import { CounselorConsoleShell } from '@/widgets/counselor-console';
import styles from './ConnectFailedPage.module.css';

/** Screen 29-2 — the user dropped before the session started. */
export function ConnectFailedPage() {
  return (
    <CounselorConsoleShell>
      <div className={styles.stage}>
        <div className={styles.mark}>
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C24A3D"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 8v5" />
            <path d="M12 16.5v.2" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <h2 className={styles.heading}>사용자와 연결하지 못했어요</h2>
        <p className={styles.body}>
          사용자가 요청을 취소했거나 네트워크가 끊어졌어요.
          <br />
          요청은 대기 목록으로 되돌려 두었습니다.
        </p>

        <div className={styles.chips}>
          <span className={`${styles.chip} ${styles.chipError}`}>✕ WebRTC 세션 종료</span>
          <span className={`${styles.chip} ${styles.chipMuted}`}>마지막 신호 · 12:04:31</span>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>해당 요청</div>
          <div className={styles.cardTitle}>현재 위치를 못 찾겠어요</div>
          <div className={styles.cardMeta}>역삼역 B1 12번 기둥 부근 · 요청 12:03 · 대기 2분</div>
        </div>

        <div className={styles.actions}>
          <ButtonLink
            to={COUNSELOR_ROUTES.REQUESTS}
            size="sm"
            variant="secondary"
            className={styles.action}
          >
            목록으로
          </ButtonLink>
          <ButtonLink to={COUNSELOR_ROUTES.CONNECTING} size="sm" className={styles.action}>
            다시 연결 시도
          </ButtonLink>
        </div>
      </div>
    </CounselorConsoleShell>
  );
}
