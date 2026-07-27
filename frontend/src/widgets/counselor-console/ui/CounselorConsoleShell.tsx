import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { COUNSELOR_ROUTES } from '@/shared/config';
import { DesktopWindow, WindowTabs } from '@/shared/ui';
import type { WindowTab } from '@/shared/ui';
import styles from './CounselorConsoleShell.module.css';

const TABS: readonly WindowTab[] = [
  { to: COUNSELOR_ROUTES.REQUESTS, label: '상담 요청 목록', icon: 'list' },
  { to: COUNSELOR_ROUTES.HISTORY, label: '상담 이력', icon: 'clock' },
  { to: COUNSELOR_ROUTES.STATS, label: '통계', icon: 'chart' },
];

type CounselorConsoleShellProps = {
  children: ReactNode;
  /** Shows the live-call status in the window chrome during a session. */
  connected?: boolean;
};

/** Browser window plus the three-tab strip shared by the counselor screens. */
export function CounselorConsoleShell({ children, connected }: CounselorConsoleShellProps) {
  return (
    <DesktopWindow
      url="counselor.pingo.kr"
      barExtra={connected ? <span className={styles.connected}>● 상담 연결됨</span> : undefined}
    >
      <WindowTabs
        tabs={TABS}
        label="상담자 콘솔"
        trailing={
          <Link to={COUNSELOR_ROUTES.LOGIN} className={styles.logout}>
            로그아웃
          </Link>
        }
      />
      {children}
    </DesktopWindow>
  );
}
