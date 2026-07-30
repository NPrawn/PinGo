import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCounselorConsultations } from '@/shared/api';
import { CounselorConsoleShell } from '@/widgets/counselor-console';
import styles from './StatsPage.module.css';

/** 상담 목록을 기반으로 현재 담당 역의 실시간 운영 통계를 계산한다. */
export function StatsPage() {
  const statsQuery = useQuery({
    queryKey: ['counselor-consultations', 'stats'],
    queryFn: () => getCounselorConsultations(),
  });
  const stats = useMemo(() => {
    const consultations = statsQuery.data ?? [];
    const byProblem = new Map<string, number>();
    for (const item of consultations) {
      byProblem.set(item.problemType, (byProblem.get(item.problemType) ?? 0) + 1);
    }
    return {
      total: consultations.length,
      waiting: consultations.filter((item) => item.status === 'WAITING').length,
      active: consultations.filter(
        (item) => item.status === 'ACCEPTED' || item.status === 'IN_PROGRESS',
      ).length,
      closed: consultations.filter((item) =>
        ['ENDED', 'CANCELED', 'REJECTED', 'FAILED'].includes(item.status),
      ).length,
      byProblem: [...byProblem.entries()].sort((left, right) => right[1] - left[1]),
    };
  }, [statsQuery.data]);

  return (
    <CounselorConsoleShell>
      <div className={styles.body}>
        <div className={styles.head}>
          <div>
            <h2 className={styles.heading}>상담 통계</h2>
            <p className={styles.lede}>담당 역의 현재 상담 데이터 기준입니다.</p>
          </div>
        </div>

        {statsQuery.isError && <p role="alert">상담 통계를 불러오지 못했습니다.</p>}
        <div className={styles.tiles}>
          {[
            ['전체', stats.total],
            ['대기 중', stats.waiting],
            ['진행 중', stats.active],
            ['종료', stats.closed],
          ].map(([label, value]) => (
            <div key={label} className={styles.card}>
              <div className={styles.tileLabel}>{label}</div>
              <div className={styles.tileValue}>{value}</div>
            </div>
          ))}
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>문제 유형별 상담 건수</div>
          <div className={styles.bars}>
            {stats.byProblem.map(([problemType, count]) => (
              <div key={problemType}>
                <span>{problemType}</span>
                <strong>{count}건</strong>
              </div>
            ))}
            {!statsQuery.isPending && stats.byProblem.length === 0 && (
              <p>집계할 상담이 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </CounselorConsoleShell>
  );
}
