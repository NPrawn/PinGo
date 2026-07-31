import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearAuthSession, getCounselorMe, updateCounselorMe } from '@/shared/api';
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
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ['counselor-me'],
    queryFn: getCounselorMe,
  });
  const statusMutation = useMutation({
    mutationFn: (status: 'AVAILABLE' | 'BUSY' | 'OFFLINE') => updateCounselorMe({ status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['counselor-me'] }),
  });

  return (
    <DesktopWindow
      url="counselor.pingo.kr"
      barExtra={connected ? <span className={styles.connected}>● 상담 연결됨</span> : undefined}
    >
      <WindowTabs
        tabs={TABS}
        label="상담자 콘솔"
        trailing={
          <>
            <span className={styles.name}>{profileQuery.data?.name ?? '상담원'}</span>
            <select
              className={styles.status}
              aria-label="상담 상태"
              value={profileQuery.data?.status ?? 'OFFLINE'}
              onChange={(event) =>
                statusMutation.mutate(event.target.value as 'AVAILABLE' | 'BUSY' | 'OFFLINE')
              }
            >
              <option value="AVAILABLE">상담 가능</option>
              <option value="BUSY">상담 중</option>
              <option value="OFFLINE">오프라인</option>
            </select>
            <Link to={COUNSELOR_ROUTES.LOGIN} className={styles.logout} onClick={clearAuthSession}>
              로그아웃
            </Link>
          </>
        }
      />
      {children}
    </DesktopWindow>
  );
}
