import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { consultationProblemLabel, consultationStatusLabel } from '@/entities/consult';
import { getCounselorConsultations } from '@/shared/api';
import { Icon, PillButton } from '@/shared/ui';
import { CounselorConsoleShell } from '@/widgets/counselor-console';
import styles from './HistoryPage.module.css';

const CLOSED_STATUSES = new Set(['ENDED', 'CANCELED', 'REJECTED', 'FAILED']);

/** 서버의 종료 상담 목록을 표시한다. */
export function HistoryPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const historyQuery = useQuery({
    queryKey: ['counselor-consultations', 'history'],
    queryFn: () => getCounselorConsultations(),
  });
  const history = (historyQuery.data ?? []).filter((item) => CLOSED_STATUSES.has(item.status));

  return (
    <CounselorConsoleShell>
      <div className={styles.body}>
        <div>
          <h2 className={styles.heading}>상담 내역</h2>
          <p className={styles.lede}>담당 역에서 종료된 상담 기록입니다.</p>
        </div>

        {historyQuery.isPending && <p>상담 내역을 불러오는 중입니다.</p>}
        {historyQuery.isError && <p role="alert">상담 내역을 불러오지 못했습니다.</p>}
        <div className={styles.list}>
          {history.map((entry) => {
            const open = openId === entry.consultationId;
            return (
              <div key={entry.consultationId} className={styles.entry}>
                <div className={styles.entryHead}>
                  <span className={styles.agent}>{consultationStatusLabel(entry.status)}</span>
                  <span className={styles.date}>
                    {new Date(entry.requestedAt).toLocaleString('ko-KR')}
                  </span>
                </div>
                <div className={styles.summary}>
                  <span className={styles.summaryIcon}>
                    <Icon name="sparkle" size={14} />
                  </span>
                  <b className={styles.summaryText}>
                    {consultationProblemLabel(entry.problemType)}
                  </b>
                </div>
                <div className={styles.facts}>
                  <span className={styles.factLabel}>출발 위치</span>
                  <b className={styles.factValue}>{entry.currentLocationLabel ?? '미확정'}</b>
                  <span className={styles.factLabel}>목적지</span>
                  <b className={styles.factValue}>{entry.destinationLabel ?? '미지정'}</b>
                  <span className={styles.factLabel}>상담 ID</span>
                  <b className={styles.factValue}>{entry.consultationId}</b>
                </div>
                <PillButton
                  className={styles.toggle}
                  onClick={() => setOpenId(open ? null : entry.consultationId)}
                >
                  {open ? '상세 닫기' : '상세 보기'}
                </PillButton>
                {open && (
                  <div className={styles.transcript}>
                    <div className={styles.transcriptLabel}>
                      <Icon name="chat" size={12} />
                      상담 메타데이터
                    </div>
                    <span className={styles.line}>
                      역 ID {entry.stationId} · 현재 노드 {entry.currentNodeId ?? '-'} · 목적지 유형{' '}
                      {entry.destinationType ?? '-'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {!historyQuery.isPending && history.length === 0 && <p>종료된 상담 내역이 없습니다.</p>}
        </div>
      </div>
    </CounselorConsoleShell>
  );
}
