import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clearAuthSession,
  getCounselorMe,
  getHealth,
  queryKeys,
  updateCounselorMe,
} from '@/shared/api';
import { COUNSELOR_ROUTES } from '@/shared/config';
import { WindowTabs } from '@/shared/ui';
import type { WindowTab } from '@/shared/ui';
import { OfflineConnectionModal } from '@/widgets/offline-connection';
import styles from './CounselorConsoleShell.module.css';

const TABS: readonly WindowTab[] = [
  { to: COUNSELOR_ROUTES.REQUESTS, label: '상담 요청 목록', icon: 'list' },
  { to: COUNSELOR_ROUTES.HISTORY, label: '상담 이력', icon: 'clock' },
];

type CounselorConsoleShellProps = {
  children: ReactNode;
  /** Shows the live-call status in the window chrome during a session. */
  connected?: boolean;
};

/**
 * 상담자 화면이 공유하는 상단 탭 바와 본문 영역.
 *
 * 프로토타입은 가짜 브라우저 창 안에 콘솔을 넣어 보여줬다. 실제 웹사이트로 배포하므로
 * 그 테두리를 걷어냈다. 창 제목줄에 있던 통화 상태 표시는 탭 바 우측으로 옮겼다.
 */
export function CounselorConsoleShell({ children, connected }: CounselorConsoleShellProps) {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const profileQuery = useQuery({
    queryKey: queryKeys.counselorMe(),
    queryFn: getCounselorMe,
    staleTime: 30_000,
  });
  const statusMutation = useMutation({
    mutationFn: (status: 'AVAILABLE' | 'BUSY' | 'OFFLINE') => updateCounselorMe({ status }),
    // 성공이든 실패든 서버 값을 다시 읽어, 셀렉트가 반영되지 않은 값을 보여주지 않게 한다.
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.counselorMe() }),
  });

  const checkConnection = useCallback(async () => {
    try {
      await getHealth();
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    const handleOffline = () => setOnline(false);
    const handleOnline = () => void checkConnection();

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [checkConnection]);

  return (
    <div className={styles.layout}>
      <WindowTabs
        tabs={TABS}
        label="상담자 콘솔"
        trailing={
          <>
            {connected && <span className={styles.connected}>● 상담 연결됨</span>}
            <span className={styles.name}>{profileQuery.data?.name ?? '상담원'}</span>
            <select
              className={styles.status}
              aria-label="상담 상태"
              value={profileQuery.data?.status ?? 'OFFLINE'}
              disabled={statusMutation.isPending}
              onChange={(event) =>
                statusMutation.mutate(event.target.value as 'AVAILABLE' | 'BUSY' | 'OFFLINE')
              }
            >
              <option value="AVAILABLE">상담 가능</option>
              <option value="BUSY">상담 중</option>
              <option value="OFFLINE">오프라인</option>
            </select>
            {statusMutation.isError && (
              <span className={styles.statusError} role="alert">
                상태를 바꾸지 못했어요
              </span>
            )}
            <Link to={COUNSELOR_ROUTES.LOGIN} className={styles.logout} onClick={clearAuthSession}>
              로그아웃
            </Link>
          </>
        }
      />
      <main className={styles.content}>{children}</main>
      {!online && <OfflineConnectionModal onRetry={() => void checkConnection()} />}
    </div>
  );
}
