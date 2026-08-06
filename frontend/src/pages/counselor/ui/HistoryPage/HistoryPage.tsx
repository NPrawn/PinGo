import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  consultationProblemLabel,
  consultationRef,
  consultationStatusLabel,
  isConsultationAssignedToCounselor,
  speakerColor,
  useCounselorConsultations,
} from '@/entities/consult';
import {
  getConsultationSummary,
  getCounselorMe,
  queryKeys,
  submitConsultationTranscript,
} from '@/shared/api';
import { GhostButton, Icon, PillButton, SelectField } from '@/shared/ui';
import { CounselorConsoleShell } from '@/widgets/counselor-console';
import styles from './HistoryPage.module.css';

/** 요약은 상담 종료 뒤 AI가 비동기로 만든다. 만드는 동안 다시 물어보는 간격. */
const SUMMARY_POLL_MS = 3000;
const PAGE_SIZE = 10;
/** 날짜 필터 API가 추가되기 전까지 선택 가능한 날짜와 건수를 계산할 이력 데이터셋 크기. */
const HISTORY_FILTER_DATASET_SIZE = 2_000;
const SPEAKER_LABELS = { USER: '사용자', COUNSELOR: '상담원' } as const;
type HistoryScope = 'ALL' | 'MINE';

/** 정렬해서 중복을 없앤 필터 후보. 실제 기록에 있는 날짜만 고를 수 있게 한다. */
function descendingOptions(values: readonly number[]) {
  return [...new Set(values)].sort((a, b) => b - a);
}

function consultationTimestamp(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function historyDateTimeLabel(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 상세가 열린 상담 하나의 요약. 요약 없음은 null 성공 결과로 캐시하고,
 * PENDING인 동안만 상태를 다시 확인한다.
 */
function useConsultationSummary(consultationId: string) {
  return useQuery({
    queryKey: queryKeys.consultationSummary(consultationId),
    queryFn: () => getConsultationSummary(consultationId),
    retry: 1,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    // 생성이 끝나면 멈춘다. 실패로 끝난 요약은 다시 물어도 그대로다.
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? SUMMARY_POLL_MS : false),
  });
}

/** 상세를 펼친 상담 하나의 AI 요약과 상담 전문. */
function ConsultationSummaryView({ consultationId }: { consultationId: string }) {
  const queryClient = useQueryClient();
  const summaryQuery = useConsultationSummary(consultationId);

  /**
   * 전문은 서버에 그대로 남아 있다. 빈 본문이 곧 '저장된 전문으로 다시 만들라'는 뜻이라
   * 자막을 다시 올리지 않는다. (API 명세서 11.7)
   */
  const retryMutation = useMutation({
    mutationFn: () => submitConsultationTranscript(consultationId, {}),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.consultationSummary(consultationId) }),
  });

  if (summaryQuery.isPending) {
    return (
      <div className={styles.details}>
        <section className={styles.aiPanel} aria-label="AI 요약">
          <div className={styles.detailLabel}>
            <Icon name="sparkle" size={13} />
            AI 요약
          </div>
          <p className={styles.detailMuted}>상담 요약을 불러오는 중입니다.</p>
        </section>
        <section className={styles.transcript} aria-label="상담 전문">
          <div className={styles.transcriptLabel}>
            <Icon name="chat" size={12} />
            상담 전문
          </div>
          <span className={styles.line}>상담 내용을 불러오는 중입니다.</span>
        </section>
      </div>
    );
  }

  if (summaryQuery.isError) {
    return (
      <div className={styles.details}>
        <section className={styles.aiPanel} aria-label="AI 요약">
          <div className={styles.detailLabel}>
            <Icon name="sparkle" size={13} />
            AI 요약
          </div>
          <p className={styles.detailMuted} role="alert">
            요약을 불러오지 못했습니다.
          </p>
        </section>
        <section className={styles.transcript} aria-label="상담 전문">
          <div className={styles.transcriptLabel}>
            <Icon name="chat" size={12} />
            상담 전문
          </div>
          <span className={styles.line} role="alert">
            상담 내용을 불러오지 못했습니다.
          </span>
        </section>
      </div>
    );
  }

  const summary = summaryQuery.data;
  if (summary == null) {
    return (
      <div className={styles.details}>
        <section className={styles.aiPanel} aria-label="AI 요약">
          <div className={styles.detailLabel}>
            <Icon name="sparkle" size={13} />
            AI 요약
          </div>
          <p className={styles.detailMuted}>저장된 상담 내용이 없어 AI 요약을 제공하지 않습니다.</p>
        </section>
        <section className={styles.transcript} aria-label="상담 전문">
          <div className={styles.transcriptLabel}>
            <Icon name="chat" size={12} />
            상담 전문
          </div>
          <span className={styles.line}>저장된 대화가 없습니다.</span>
        </section>
      </div>
    );
  }
  const transcript = summary.transcript ?? [];

  return (
    <div className={styles.details}>
      <section className={styles.aiPanel} aria-label="AI 요약">
        <div className={styles.detailLabel}>
          <Icon name="sparkle" size={13} />
          AI 요약
        </div>
        {summary.status === 'PENDING' && (
          <p className={styles.aiSummary}>AI가 요약을 만들고 있습니다. 잠시만 기다려 주세요.</p>
        )}
        {summary.status === 'FAILED' && (
          <>
            <p className={styles.aiSummary}>요약을 만들지 못했습니다.</p>
            <PillButton
              className={styles.retry}
              disabled={retryMutation.isPending}
              onClick={() => retryMutation.mutate()}
            >
              {retryMutation.isPending ? '다시 만드는 중…' : '요약 다시 만들기'}
            </PillButton>
            {retryMutation.isError && (
              <span className={styles.retryError} role="alert">
                다시 만들기를 시작하지 못했습니다.
              </span>
            )}
          </>
        )}
        {summary.status === 'COMPLETED' && (
          <p className={styles.aiSummary}>{summary.summaryText ?? '요약 내용이 비어 있습니다.'}</p>
        )}
      </section>

      <section className={styles.transcript} aria-label="상담 전문">
        <div className={styles.transcriptLabel}>
          <Icon name="chat" size={12} />
          상담 전문 {transcript.length > 0 && `· ${transcript.length}마디`}
        </div>
        {transcript.length === 0 ? (
          <span className={styles.line}>저장된 대화가 없습니다.</span>
        ) : (
          transcript.map((segment) => {
            const speaker = SPEAKER_LABELS[segment.speaker ?? 'USER'];
            return (
              <span key={segment.seq} className={styles.line}>
                <b className={styles.speaker} style={{ color: speakerColor(speaker) }}>
                  {speaker}
                </b>{' '}
                {segment.content}
                {segment.translatedContent && segment.translatedContent !== segment.content && (
                  <span className={styles.translation}> ({segment.translatedContent})</span>
                )}
              </span>
            );
          })
        )}
      </section>
    </div>
  );
}

/** 서버의 종료 상담 목록을 날짜로 필터링해 표시한다. */
export function HistoryPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [scope, setScope] = useState<HistoryScope>('ALL');
  /** 빈 문자열은 '전체'. */
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [page, setPage] = useState(0);
  const allHistoryQuery = useCounselorConsultations({
    status: 'ENDED',
    scope: 'ALL',
    page: 0,
    size: HISTORY_FILTER_DATASET_SIZE,
    sort: 'requestedAt,desc',
  });
  const mineHistoryQuery = useCounselorConsultations(
    {
      status: 'ENDED',
      scope: 'MINE',
      page: 0,
      size: HISTORY_FILTER_DATASET_SIZE,
      sort: 'requestedAt,desc',
    },
    scope === 'MINE',
  );
  const profileQuery = useQuery({
    queryKey: queryKeys.counselorMe(),
    queryFn: getCounselorMe,
    staleTime: 30_000,
  });
  const activeHistoryQuery = scope === 'MINE' ? mineHistoryQuery : allHistoryQuery;
  const loadingHistory =
    allHistoryQuery.isPending ||
    profileQuery.isPending ||
    (scope === 'MINE' && mineHistoryQuery.isPending);

  const allClosed = useMemo(
    () =>
      (allHistoryQuery.data?.content ?? [])
        .map((item) => {
          const requestedAt = new Date(item.requestedAt);
          return {
            ...item,
            requestedAtTimestamp: consultationTimestamp(item.requestedAt),
            year: requestedAt.getFullYear(),
            month: requestedAt.getMonth() + 1,
            day: requestedAt.getDate(),
          };
        })
        .sort((a, b) => b.requestedAtTimestamp - a.requestedAtTimestamp),
    [allHistoryQuery.data?.content],
  );
  const mineClosed = useMemo(
    () =>
      (mineHistoryQuery.data?.content ?? [])
        .map((item) => {
          const requestedAt = new Date(item.requestedAt);
          return {
            ...item,
            requestedAtTimestamp: consultationTimestamp(item.requestedAt),
            year: requestedAt.getFullYear(),
            month: requestedAt.getMonth() + 1,
            day: requestedAt.getDate(),
          };
        })
        .sort((a, b) => b.requestedAtTimestamp - a.requestedAtTimestamp),
    [mineHistoryQuery.data?.content],
  );

  const years = descendingOptions(allClosed.map((item) => item.year));
  const months = descendingOptions(
    allClosed.filter((item) => !year || String(item.year) === year).map((item) => item.month),
  );
  const days = descendingOptions(
    allClosed
      .filter((item) => !year || String(item.year) === year)
      .filter((item) => !month || String(item.month) === month)
      .map((item) => item.day),
  );

  const datedAllHistory = allClosed
    .filter((item) => !year || String(item.year) === year)
    .filter((item) => !month || String(item.month) === month)
    .filter((item) => !day || String(item.day) === day);
  const datedMineHistory = mineClosed
    .filter((item) => !year || String(item.year) === year)
    .filter((item) => !month || String(item.month) === month)
    .filter((item) => !day || String(item.day) === day);
  const mineCount = datedAllHistory.filter((item) =>
    isConsultationAssignedToCounselor(item, profileQuery.data?.accountId),
  ).length;
  const filteredHistory = scope === 'MINE' ? datedMineHistory : datedAllHistory;
  const allCount = datedAllHistory.length;
  const totalPages = Math.ceil(filteredHistory.length / PAGE_SIZE);
  const history = filteredHistory.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const dateFiltered = Boolean(year || month || day);
  const resetFilters = () => {
    setYear('');
    setMonth('');
    setDay('');
    setPage(0);
    setOpenId(null);
  };

  return (
    <CounselorConsoleShell>
      <div className={styles.body}>
        <div>
          <h2 className={styles.heading}>상담 이력</h2>
          <p className={styles.lede}>담당 역에서 종료된 상담을 날짜별로 확인할 수 있어요.</p>
        </div>

        <div className={styles.filters}>
          <div className={styles.scopeFilters} aria-label="상담 이력 범위">
            <PillButton
              className={styles.scopeButton}
              on={scope === 'ALL'}
              disabled={loadingHistory}
              onClick={() => {
                setScope('ALL');
                setPage(0);
                setOpenId(null);
              }}
            >
              전체 {loadingHistory ? '…' : allCount}
            </PillButton>
            <PillButton
              className={styles.scopeButton}
              on={scope === 'MINE'}
              disabled={loadingHistory || profileQuery.isError}
              onClick={() => {
                setScope('MINE');
                setPage(0);
                setOpenId(null);
              }}
            >
              내 상담 {loadingHistory ? '…' : mineCount}
            </PillButton>
            <GhostButton
              className={styles.resetButton}
              disabled={loadingHistory || !dateFiltered}
              onClick={resetFilters}
            >
              초기화
            </GhostButton>
          </div>
          <div className={styles.dateFilters}>
            <SelectField
              className={styles.select}
              value={year}
              aria-label="연도 필터"
              disabled={loadingHistory}
              onChange={(event) => {
                setYear(event.target.value);
                setMonth('');
                setDay('');
                setPage(0);
                setOpenId(null);
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
              disabled={loadingHistory}
              onChange={(event) => {
                setMonth(event.target.value);
                setDay('');
                setPage(0);
                setOpenId(null);
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
              disabled={loadingHistory}
              onChange={(event) => {
                setDay(event.target.value);
                setPage(0);
                setOpenId(null);
              }}
            >
              <option value="">전체 일</option>
              {days.map((value) => (
                <option key={value} value={String(value)}>
                  {value}일
                </option>
              ))}
            </SelectField>
          </div>
        </div>

        {!loadingHistory && (allHistoryQuery.isError || activeHistoryQuery.isError) && (
          <p className={styles.stateMessage} role="alert">
            상담 내역을 불러오지 못했습니다.
          </p>
        )}
        {!loadingHistory && profileQuery.isError && (
          <p className={styles.stateMessage} role="alert">
            내 상담 여부를 확인할 수 없어 전체 이력만 표시합니다.
          </p>
        )}
        <div className={styles.list} aria-label="상담 이력 목록" aria-busy={loadingHistory}>
          {!loadingHistory &&
            history.map((entry) => {
              const open = openId === entry.consultationId;
              const mine =
                profileQuery.data?.accountId != null &&
                entry.counselorId === profileQuery.data.accountId;
              return (
                <div key={entry.consultationId} className={styles.entry}>
                  {/* 내 상담 여부와 상태는 카드를 훑을 때 바로 보이도록 배지로 둔다. */}
                  <div className={styles.entryHead}>
                    <div className={styles.tags}>
                      {mine && <span className={styles.mine}>내 상담</span>}
                      <span className={styles.agent}>{consultationStatusLabel(entry.status)}</span>
                    </div>
                    <span className={styles.date}>{historyDateTimeLabel(entry.requestedAt)}</span>
                  </div>
                  <div className={styles.cardBody}>
                    <h3 className={styles.problemTitle}>
                      {consultationProblemLabel(entry.problemType)}
                    </h3>
                    <p className={styles.route}>
                      {entry.currentLocationLabel ?? '현재 위치 확인 안 됨'}
                      <span aria-hidden="true"> → </span>
                      {entry.destinationLabel ?? '목적지 미정'}
                    </p>
                    <span className={styles.reference} title={entry.consultationId}>
                      상담 번호 {consultationRef(entry.consultationId)}
                    </span>
                  </div>
                  <PillButton
                    className={styles.toggle}
                    onClick={() => setOpenId(open ? null : entry.consultationId)}
                  >
                    {open ? '상세 닫기' : '상세 보기'}
                  </PillButton>
                  {/* 접힌 카드는 요약을 조회하지 않고, 상세를 열 때만 요청한다. */}
                  {open && <ConsultationSummaryView consultationId={entry.consultationId} />}
                </div>
              );
            })}
          {!loadingHistory &&
            !allHistoryQuery.isError &&
            !activeHistoryQuery.isError &&
            history.length === 0 && (
              <p className={styles.stateMessage}>
                {scope === 'MINE' || dateFiltered
                  ? '선택한 조건의 상담 이력이 없습니다.'
                  : '종료된 상담 이력이 없습니다.'}
              </p>
            )}
        </div>
        <div className={styles.pagination} aria-label="상담 이력 페이지">
          <GhostButton
            className={styles.pageButton}
            disabled={page === 0 || activeHistoryQuery.isFetching}
            onClick={() => {
              setPage((current) => Math.max(0, current - 1));
              setOpenId(null);
            }}
          >
            이전
          </GhostButton>
          <span className={styles.pageLabel}>
            {totalPages > 0 ? `${page + 1} / ${totalPages}` : '0 / 0'}
          </span>
          <GhostButton
            className={styles.pageButton}
            disabled={page + 1 >= totalPages || activeHistoryQuery.isFetching}
            onClick={() => {
              setPage((current) => current + 1);
              setOpenId(null);
            }}
          >
            다음
          </GhostButton>
        </div>
      </div>
    </CounselorConsoleShell>
  );
}
