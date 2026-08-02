import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { consultationProblemLabel, consultationStatusLabel } from '@/entities/consult';
import { getCounselorConsultations } from '@/shared/api';
import { GhostButton, Icon, PillButton, SelectField } from '@/shared/ui';
import { CounselorConsoleShell } from '@/widgets/counselor-console';
import styles from './HistoryPage.module.css';

const CLOSED_STATUSES = new Set(['ENDED', 'CANCELED', 'REJECTED', 'FAILED']);

/** 정렬해서 중복을 없앤 필터 후보. 실제 기록에 있는 날짜만 고를 수 있게 한다. */
function descendingOptions(values: readonly number[]) {
  return [...new Set(values)].sort((a, b) => b - a);
}

/** 서버의 종료 상담 목록을 날짜로 필터링해 표시한다. */
export function HistoryPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  /** 빈 문자열은 '전체'. */
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const historyQuery = useQuery({
    queryKey: ['counselor-consultations', 'history'],
    queryFn: () => getCounselorConsultations(),
  });

  const closed = useMemo(
    () =>
      (historyQuery.data ?? [])
        .filter((item) => CLOSED_STATUSES.has(item.status))
        .map((item) => {
          const requestedAt = new Date(item.requestedAt);
          return {
            ...item,
            year: requestedAt.getFullYear(),
            month: requestedAt.getMonth() + 1,
            day: requestedAt.getDate(),
          };
        }),
    [historyQuery.data],
  );

  const years = descendingOptions(closed.map((item) => item.year));
  const months = descendingOptions(
    closed.filter((item) => !year || String(item.year) === year).map((item) => item.month),
  );
  const days = descendingOptions(
    closed
      .filter((item) => !year || String(item.year) === year)
      .filter((item) => !month || String(item.month) === month)
      .map((item) => item.day),
  );

  const history = closed
    .filter((item) => !year || String(item.year) === year)
    .filter((item) => !month || String(item.month) === month)
    .filter((item) => !day || String(item.day) === day);

  const filtered = Boolean(year || month || day);
  const resetFilters = () => {
    setYear('');
    setMonth('');
    setDay('');
  };

  return (
    <CounselorConsoleShell>
      <div className={styles.body}>
        <div>
          <h2 className={styles.heading}>상담 내역</h2>
          <p className={styles.lede}>담당 역에서 종료된 상담을 날짜별로 확인할 수 있어요.</p>
        </div>

        <div className={styles.filters}>
          <SelectField
            className={styles.select}
            value={year}
            aria-label="연도 필터"
            onChange={(event) => {
              setYear(event.target.value);
              setMonth('');
              setDay('');
            }}
          >
            <option value="">전체 연도</option>
            {years.map((value) => (
              <option key={value} value={String(value)}>
                {value}년
              </option>
            ))}
          </SelectField>
          <SelectField
            className={styles.select}
            value={month}
            aria-label="월 필터"
            onChange={(event) => {
              setMonth(event.target.value);
              setDay('');
            }}
          >
            <option value="">전체 월</option>
            {months.map((value) => (
              <option key={value} value={String(value)}>
                {String(value).padStart(2, '0')}월
              </option>
            ))}
          </SelectField>
          <SelectField
            className={styles.select}
            value={day}
            aria-label="일 필터"
            onChange={(event) => setDay(event.target.value)}
          >
            <option value="">전체 일</option>
            {days.map((value) => (
              <option key={value} value={String(value)}>
                {value}일
              </option>
            ))}
          </SelectField>
          <div className={styles.filterActions}>
            <span className={styles.count}>{history.length}건</span>
            {filtered && (
              <GhostButton className={styles.filterButton} onClick={resetFilters}>
                초기화
              </GhostButton>
            )}
          </div>
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
          {!historyQuery.isPending && history.length === 0 && (
            <p>
              {filtered ? '선택한 날짜의 상담 내역이 없습니다.' : '종료된 상담 내역이 없습니다.'}
            </p>
          )}
        </div>
      </div>
    </CounselorConsoleShell>
  );
}
