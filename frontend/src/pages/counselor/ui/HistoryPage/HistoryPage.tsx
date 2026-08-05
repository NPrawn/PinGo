import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  consultationDateTimeLabel,
  consultationProblemLabel,
  consultationRef,
  consultationStatusLabel,
  isClosedConsultation,
  speakerColor,
  useCounselorConsultations,
} from '@/entities/consult';
import {
  ApiError,
  getConsultationSummary,
  queryKeys,
  submitConsultationTranscript,
} from '@/shared/api';
import { GhostButton, Icon, PillButton, SelectField } from '@/shared/ui';
import { CounselorConsoleShell } from '@/widgets/counselor-console';
import styles from './HistoryPage.module.css';

/** 요약은 상담 종료 뒤 AI가 비동기로 만든다. 만드는 동안 다시 물어보는 간격. */
const SUMMARY_POLL_MS = 3000;
const SPEAKER_LABELS = { USER: '사용자', COUNSELOR: '상담원' } as const;

/** 정렬해서 중복을 없앤 필터 후보. 실제 기록에 있는 날짜만 고를 수 있게 한다. */
function descendingOptions(values: readonly number[]) {
  return [...new Set(values)].sort((a, b) => b - a);
}

function consultationTimestamp(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/** 요약이 아직 없는 상담은 몇 번을 물어도 404다. 그 응답만 재시도에서 뺀다. */
function isMissingSummary(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

/** 상담 내용 패널이 비었을 때의 한 줄 안내. 제목은 남겨서 무엇이 비었는지 알린다. */
function Notice({ children, alert }: { children: ReactNode; alert?: boolean }) {
  return (
    <>
      <div className={styles.transcriptLabel}>
        <Icon name="chat" size={12} />
        상담 내용
      </div>
      <span className={styles.line} role={alert ? 'alert' : undefined}>
        {children}
      </span>
    </>
  );
}

/**
 * 상담 하나의 요약. 접힌 카드의 한 줄과 펼친 상세가 같은 키를 쓰므로 요청은 한 번만 나가고,
 * 상세를 열면 이미 받아 둔 응답이 그대로 보인다.
 */
function useConsultationSummary(consultationId: string) {
  return useQuery({
    queryKey: queryKeys.consultationSummary(consultationId),
    queryFn: () => getConsultationSummary(consultationId),
    retry: (failureCount, error) => !isMissingSummary(error) && failureCount < 2,
    // 생성이 끝나면 멈춘다. 실패로 끝난 요약은 다시 물어도 그대로다.
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? SUMMARY_POLL_MS : false),
  });
}

/**
 * 접힌 카드에 얹는 AI 한 줄 요약. 상세를 열기 전에 무슨 상담이었는지 알아보라고 두는 자리라
 * 긴 요약은 한 줄로 자른다. 전문(全文)은 상세의 같은 항목에서 본다.
 */
function ConsultationSummaryLine({ consultationId }: { consultationId: string }) {
  const summaryQuery = useConsultationSummary(consultationId);

  if (summaryQuery.isPending) {
    return <span className={styles.summaryMuted}>요약을 불러오는 중입니다.</span>;
  }

  if (summaryQuery.isError) {
    return (
      <span className={styles.summaryMuted}>
        {isMissingSummary(summaryQuery.error)
          ? '저장된 상담 내용이 없어 요약도 없습니다.'
          : '요약을 불러오지 못했습니다.'}
      </span>
    );
  }

  const { status, summaryText } = summaryQuery.data;

  if (status === 'COMPLETED' && summaryText) {
    return <b className={styles.summaryLine}>{summaryText}</b>;
  }

  return (
    <span className={styles.summaryMuted}>
      {status === 'PENDING' ? 'AI가 요약을 만들고 있습니다.' : '요약을 만들지 못했습니다.'}
    </span>
  );
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
    return <Notice>상담 내용을 불러오는 중입니다.</Notice>;
  }

  if (summaryQuery.isError) {
    const missing = isMissingSummary(summaryQuery.error);
    return (
      <Notice alert={!missing}>
        {missing
          ? '저장된 상담 내용이 없습니다. 상담자가 자막을 남기지 않고 끝냈거나, 자막을 지원하지 않는 브라우저였을 수 있어요.'
          : '상담 내용을 불러오지 못했습니다.'}
      </Notice>
    );
  }

  const summary = summaryQuery.data;
  const transcript = summary.transcript ?? [];

  return (
    <>
      <div className={styles.transcriptLabel}>
        <Icon name="sparkle" size={12} />
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
            <span className={styles.line} role="alert">
              다시 만들기를 시작하지 못했습니다.
            </span>
          )}
        </>
      )}
      {summary.status === 'COMPLETED' && (
        <p className={styles.aiSummary}>{summary.summaryText ?? '요약 내용이 비어 있습니다.'}</p>
      )}

      {/* 요약이 실패해도 전문은 남아 있다. 상담자에게는 이쪽이 더 중요하다. */}
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
    </>
  );
}

/** 서버의 종료 상담 목록을 날짜로 필터링해 표시한다. */
export function HistoryPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  /** 빈 문자열은 '전체'. */
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const historyQuery = useCounselorConsultations();

  const closed = useMemo(
    () =>
      (historyQuery.data ?? [])
        .filter((item) => isClosedConsultation(item.status))
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
                {/* 상태와 문의 유형은 훑어보며 거르는 값이라 태그로 묶어 위에 붙인다. */}
                <div className={styles.entryHead}>
                  <div className={styles.tags}>
                    <span className={styles.agent}>{consultationStatusLabel(entry.status)}</span>
                    <span className={styles.problemTag}>
                      {consultationProblemLabel(entry.problemType)}
                    </span>
                  </div>
                  <span className={styles.date}>
                    {consultationDateTimeLabel(entry.requestedAt)}
                  </span>
                </div>
                <div className={styles.summary}>
                  <span className={styles.summaryIcon}>
                    <Icon name="sparkle" size={14} />
                  </span>
                  <span className={styles.summaryText}>
                    <span className={styles.summaryKind}>AI 요약</span>
                    <ConsultationSummaryLine consultationId={entry.consultationId} />
                  </span>
                </div>
                <div className={styles.facts}>
                  <span className={styles.factLabel}>출발 위치</span>
                  <b className={styles.factValue}>{entry.currentLocationLabel ?? '확인 안 됨'}</b>
                  <span className={styles.factLabel}>목적지</span>
                  <b className={styles.factValue}>{entry.destinationLabel ?? '미정'}</b>
                  <span className={styles.factLabel}>상담 번호</span>
                  {/* 전체 식별자는 문의·로그 대조용으로만 필요해 툴팁에 남긴다. */}
                  <b className={styles.factValue} title={entry.consultationId}>
                    {consultationRef(entry.consultationId)}
                  </b>
                </div>
                <PillButton
                  className={styles.toggle}
                  onClick={() => setOpenId(open ? null : entry.consultationId)}
                >
                  {open ? '상세 닫기' : '상세 보기'}
                </PillButton>
                {/* 역 ID·노드 ID 같은 내부 식별자는 상담자가 쓸 일이 없어 상담 내용만 담는다. */}
                {open && (
                  <div className={styles.transcript}>
                    <ConsultationSummaryView consultationId={entry.consultationId} />
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
