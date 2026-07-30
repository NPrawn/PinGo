import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { acceptConsultation, getCounselorConsultations, rejectConsultation } from '@/shared/api';
import { COUNSELOR_ROUTES } from '@/shared/config';
import { Button, Icon, MapPreview } from '@/shared/ui';
import { CounselorConsoleShell } from '@/widgets/counselor-console';
import styles from './RequestsPage.module.css';

const PROBLEM_LABELS: Record<string, string> = {
  CANNOT_FIND_EXIT: '출구를 찾을 수 없어요',
  LOST: '현재 위치를 모르겠어요',
  ROUTE_HELP: '경로 안내가 필요해요',
  OTHER: '기타 문의',
};

function elapsedLabel(requestedAt: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(requestedAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds}초`;
  return `${Math.floor(seconds / 60)}분`;
}

/** 담당 역의 실제 상담 대기열을 조회하고 수락·거절을 서버 상태로 처리한다. */
export function RequestsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setConsultation = useConsultStore((state) => state.setConsultation);
  const setSignalingRoom = useConsultStore((state) => state.setSignalingRoom);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const queueQuery = useQuery({
    queryKey: ['counselor-consultations'],
    queryFn: () => getCounselorConsultations(),
    refetchInterval: 5000,
  });
  const requests = queueQuery.data ?? [];
  const selected = requests.find((request) => request.consultationId === selectedId) ?? requests[0];

  const acceptMutation = useMutation({
    mutationFn: acceptConsultation,
    onSuccess: (response) => {
      if (!response.consultationId || !response.signalingRoomId) return;
      setConsultation(response.consultationId);
      setSignalingRoom(response.signalingRoomId);
      void queryClient.invalidateQueries({ queryKey: ['counselor-consultations'] });
      void navigate(COUNSELOR_ROUTES.CONNECTING);
    },
  });
  const rejectMutation = useMutation({
    mutationFn: rejectConsultation,
    onSuccess: () => {
      setSelectedId(null);
      void queryClient.invalidateQueries({ queryKey: ['counselor-consultations'] });
    },
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
                  request.consultationId === selected?.consultationId && styles.requestOn,
                  request.status === 'ENDED' && styles.requestDone,
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelectedId(request.consultationId)}
              >
                <span className={styles.tag}>
                  {PROBLEM_LABELS[request.problemType] ?? request.problemType}
                </span>
                {request.status === 'ACCEPTED' && <span className={styles.liveBadge}>상담중</span>}
                {request.status === 'ENDED' && <span className={styles.doneBadge}>완료</span>}
                <div className={styles.meta}>대기 {elapsedLabel(request.requestedAt)}</div>
                <div className={styles.loc}>{request.currentLocationLabel ?? '위치 미확정'}</div>
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
                  <h2 className={styles.heading}>
                    {PROBLEM_LABELS[selected.problemType] ?? selected.problemType}
                  </h2>
                  <div className={styles.route}>
                    {selected.currentLocationLabel ?? '현재 위치 미확정'} →{' '}
                    {selected.destinationLabel ?? '목적지 미지정'}
                  </div>
                </div>
                {selected.status === 'WAITING' && (
                  <div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => rejectMutation.mutate(selected.consultationId)}
                      disabled={rejectMutation.isPending}
                    >
                      거절
                    </Button>
                    <Button
                      size="sm"
                      className={styles.accept}
                      onClick={() => acceptMutation.mutate(selected.consultationId)}
                      disabled={acceptMutation.isPending}
                    >
                      상담 수락
                    </Button>
                  </div>
                )}
                {selected.status === 'ACCEPTED' && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setConsultation(selected.consultationId);
                      setSignalingRoom(`room_${selected.consultationId}`);
                      void navigate(COUNSELOR_ROUTES.SESSION);
                    }}
                  >
                    상담 화면 열기
                  </Button>
                )}
              </div>

              {(acceptMutation.isError || rejectMutation.isError) && (
                <p role="alert">요청 상태가 이미 변경됐거나 처리하지 못했습니다.</p>
              )}

              <div className={styles.cards}>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>현재 위치</div>
                  <div className={styles.cardValue}>
                    {selected.currentLocationLabel ?? '위치 미확정'}
                  </div>
                  <MapPreview className={styles.cardMap} me={{ left: '44%', top: '50%' }} />
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>목적지</div>
                  <div className={styles.cardValue}>
                    {selected.destinationLabel ?? '목적지 미지정'}
                  </div>
                  <div className={styles.optionList}>
                    <span>
                      요청 시각 {new Date(selected.requestedAt).toLocaleTimeString('ko-KR')}
                    </span>
                    <span>상담 ID {selected.consultationId}</span>
                  </div>
                </div>
              </div>

              <div className={`${styles.card} ${styles.issueCard}`}>
                <div className={styles.cardLabel}>문제 유형</div>
                <div className={styles.issueText}>
                  {PROBLEM_LABELS[selected.problemType] ?? selected.problemType}
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
