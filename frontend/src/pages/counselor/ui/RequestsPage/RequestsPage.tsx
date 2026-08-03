import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  consultationDateTimeLabel,
  consultationProblemLabel,
  consultationRef,
  consultationStatusLabel,
  destinationTypeLabel,
  useConsultStore,
  waitedLabel,
} from '@/entities/consult';
import {
  acceptConsultation,
  ApiError,
  getCounselorConsultation,
  getCounselorConsultations,
} from '@/shared/api';
import { COUNSELOR_ROUTES } from '@/shared/config';
import { Button, Icon } from '@/shared/ui';
import { CounselorConsoleShell } from '@/widgets/counselor-console';
import styles from './RequestsPage.module.css';

const STATUS_CLASS: Record<string, string> = {
  WAITING: styles.badgeWaiting,
  ACCEPTED: styles.badgeLive,
  IN_PROGRESS: styles.badgeLive,
  ENDED: styles.badgeDone,
  CANCELED: styles.badgeMuted,
  REJECTED: styles.badgeMuted,
  FAILED: styles.badgeMuted,
};

/** 카드 배경과 왼쪽 띠 색. 상태별로 목록이 한눈에 묶여 보이게 한다. */
const CARD_CLASS: Record<string, string> = {
  WAITING: styles.cardWaiting,
  ACCEPTED: styles.cardLive,
  IN_PROGRESS: styles.cardLive,
  ENDED: styles.cardDone,
  CANCELED: styles.cardMuted,
  REJECTED: styles.cardMuted,
  FAILED: styles.cardMuted,
};

/** 대기 중 → 상담 중 → 종료 → 취소·거절 순으로 목록을 정렬한다. */
const STATUS_ORDER: Record<string, number> = {
  WAITING: 0,
  ACCEPTED: 1,
  IN_PROGRESS: 1,
  ENDED: 2,
  CANCELED: 3,
  REJECTED: 3,
  FAILED: 3,
};

function errorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return '요청 상태가 이미 변경됐거나 처리하지 못했습니다.';
  // 상태 때문에 막힌 경우에는 어디서 바꿔야 하는지까지 알려준다.
  if (error.code === 'COUNSELOR_NOT_AVAILABLE') {
    return '상담 상태가 “상담 가능”일 때만 수락할 수 있어요. 오른쪽 위에서 상태를 바꿔 주세요.';
  }
  return error.message;
}

/** 담당 역의 실제 상담 대기열을 조회하고 수락·거절을 서버 상태로 처리한다. */
export function RequestsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setConsultation = useConsultStore((state) => state.setConsultation);
  const setSignalingRoom = useConsultStore((state) => state.setSignalingRoom);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const queueQuery = useQuery({
    queryKey: ['counselor-consultations'],
    queryFn: () => getCounselorConsultations(),
    refetchInterval: 5000,
  });
  // 서버는 요청 시각 순으로 주므로, 상태별로만 다시 묶는다. sort는 안정 정렬이라
  // 같은 상태 안에서는 오래 기다린 요청이 위에 남는다.
  const requests = useMemo(
    () =>
      [...(queueQuery.data ?? [])].sort(
        (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
      ),
    [queueQuery.data],
  );
  const selected = requests.find((request) => request.consultationId === selectedId) ?? requests[0];

  const acceptMutation = useMutation({
    mutationFn: acceptConsultation,
    onMutate: () => setActionError(''),
    onSuccess: (response) => {
      if (!response.consultationId || !response.signalingRoomId) return;
      setConsultation(response.consultationId);
      setSignalingRoom(response.signalingRoomId, response.signalingAccessToken);
      void queryClient.invalidateQueries({ queryKey: ['counselor-consultations'] });
      // 수락하면 서버가 상담자를 '상담 중'으로 바꾸므로 헤더 상태도 다시 읽는다.
      void queryClient.invalidateQueries({ queryKey: ['counselor-me'] });
      void navigate(COUNSELOR_ROUTES.CONNECTING);
    },
    // 상담 상태가 '상담 가능'이 아니면 서버가 거절하므로 그 이유를 그대로 보여준다.
    onError: (error) => setActionError(errorMessage(error)),
  });

  // 이미 수락한 상담으로 다시 들어갈 때는 상세 조회로 signaling 토큰을 새로 받아야 접속된다.
  const reenterMutation = useMutation({
    mutationFn: getCounselorConsultation,
    onMutate: () => setActionError(''),
    onSuccess: (response) => {
      if (!response.consultationId || !response.signalingRoomId) return;
      setConsultation(response.consultationId);
      setSignalingRoom(response.signalingRoomId, response.signalingAccessToken);
      void navigate(COUNSELOR_ROUTES.SESSION);
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  return (
    <CounselorConsoleShell>
      <div className={styles.wrap}>
        <div className={styles.rail}>
          <div className={styles.railScroll}>
            {queueQuery.isPending && <p>상담 요청을 불러오는 중입니다.</p>}
            {queueQuery.isError && <p role="alert">상담 요청을 불러오지 못했습니다.</p>}
            {!queueQuery.isPending && requests.length === 0 && <p>대기 중인 상담이 없습니다.</p>}
            {requests.map((request) => (
              <button
                key={request.consultationId}
                type="button"
                aria-pressed={request.consultationId === selected?.consultationId}
                className={[
                  styles.request,
                  CARD_CLASS[request.status] ?? styles.cardMuted,
                  request.consultationId === selected?.consultationId && styles.requestOn,
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelectedId(request.consultationId)}
              >
                <span className={styles.cardHead}>
                  <span className={styles.tag}>
                    {consultationProblemLabel(request.problemType)}
                  </span>
                  <span className={[styles.statusBadge, STATUS_CLASS[request.status]].join(' ')}>
                    {consultationStatusLabel(request.status)}
                  </span>
                </span>
                <div className={styles.meta}>
                  {request.status === 'WAITING'
                    ? `${waitedLabel(request.requestedAt)} 기다리는 중`
                    : consultationDateTimeLabel(request.requestedAt)}
                </div>
                <div className={styles.loc}>
                  {request.currentLocationLabel ?? '위치를 아직 못 찾은 사용자'}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.detail}>
          {selected ? (
            <>
              <div className={styles.detailHead}>
                <div>
                  <div className={styles.eyebrow}>
                    <Icon name="pin" size={13} />
                    사용자 정보
                  </div>
                  <div className={styles.headingRow}>
                    <h2 className={styles.heading}>
                      {consultationProblemLabel(selected.problemType)}
                    </h2>
                    <span className={[styles.statusBadge, STATUS_CLASS[selected.status]].join(' ')}>
                      {consultationStatusLabel(selected.status)}
                    </span>
                  </div>
                  <div className={styles.route}>
                    {selected.currentLocationLabel ?? '위치 확인 안 됨'} →{' '}
                    {selected.destinationLabel ?? '목적지 미정'}
                  </div>
                </div>
                {selected.status === 'WAITING' && (
                  <Button
                    size="sm"
                    className={styles.accept}
                    onClick={() => acceptMutation.mutate(selected.consultationId)}
                    disabled={acceptMutation.isPending}
                  >
                    상담 수락
                  </Button>
                )}
                {selected.status === 'ACCEPTED' && (
                  <Button
                    size="sm"
                    className={styles.openSession}
                    onClick={() => reenterMutation.mutate(selected.consultationId)}
                    disabled={reenterMutation.isPending}
                  >
                    {reenterMutation.isPending ? '연결 준비 중…' : '상담 화면 열기'}
                  </Button>
                )}
              </div>

              {actionError && (
                <p className={styles.actionError} role="alert">
                  {actionError}
                </p>
              )}

              <div className={styles.cards}>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>현재 위치</div>
                  <div className={styles.cardValue}>
                    {selected.currentLocationLabel ?? '확인 안 됨'}
                  </div>
                  {!selected.currentLocationLabel && (
                    <p className={styles.cardHint}>
                      사용자가 위치 인식을 끝내지 못한 채 상담을 요청했어요. 상담 중에 함께 찾아
                      주세요.
                    </p>
                  )}
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>목적지</div>
                  <div className={styles.cardValue}>{selected.destinationLabel ?? '미정'}</div>
                  <p className={styles.cardHint}>
                    {destinationTypeLabel(selected.destinationType) ??
                      '사용자가 목적지를 아직 고르지 않았어요.'}
                  </p>
                </div>
              </div>

              <div className={`${styles.card} ${styles.issueCard}`}>
                <div className={styles.cardLabel}>문제 유형</div>
                <div className={styles.issueText}>
                  {consultationProblemLabel(selected.problemType)}
                </div>
                <div className={styles.optionList}>
                  <span>요청 시각 {consultationDateTimeLabel(selected.requestedAt)}</span>
                  {/* 전체 식별자는 문의·로그 대조용으로만 필요해 툴팁에 남긴다. */}
                  <span title={selected.consultationId}>
                    상담 번호 {consultationRef(selected.consultationId)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p>왼쪽 목록에서 상담 요청을 선택해 주세요.</p>
          )}
        </div>
      </div>
    </CounselorConsoleShell>
  );
}
