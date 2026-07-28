import { useNavigate } from 'react-router-dom';
import { CONSULT_REQUESTS, useCounselorQueueStore } from '@/entities/consult';
import { COUNSELOR_ROUTES } from '@/shared/config';
import { Button, ButtonLink, Icon, MapPreview } from '@/shared/ui';
import { CounselorConsoleShell } from '@/widgets/counselor-console';
import styles from './RequestsPage.module.css';

/** Screens 28·29 (FR-C-002 / FR-C-003) — request queue and its detail pane. */
export function RequestsPage() {
  const navigate = useNavigate();
  const selected = useCounselorQueueStore((state) => state.selected);
  const statuses = useCounselorQueueStore((state) => state.statuses);
  const select = useCounselorQueueStore((state) => state.select);
  const accept = useCounselorQueueStore((state) => state.accept);

  const statusOf = (index: number) => statuses[index] ?? 'waiting';
  const request = CONSULT_REQUESTS[selected] ?? CONSULT_REQUESTS[0];
  const status = statusOf(selected);

  const onAccept = () => {
    accept(selected);
    void navigate(COUNSELOR_ROUTES.CONNECTING);
  };

  return (
    <CounselorConsoleShell>
      <div className={styles.wrap}>
        <div className={styles.rail}>
          <div className={styles.railScroll}>
            {CONSULT_REQUESTS.map((item, index) => {
              const isSelected = index === selected;
              const itemStatus = statusOf(index);
              return (
                <button
                  key={item.type}
                  type="button"
                  aria-pressed={isSelected}
                  className={[
                    styles.request,
                    isSelected && styles.requestOn,
                    itemStatus === 'done' && styles.requestDone,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => select(index)}
                >
                  {itemStatus === 'active' && (
                    <span className={styles.liveBadge}>
                      <span className={styles.liveDot} aria-hidden />
                      상담중
                    </span>
                  )}
                  {itemStatus === 'done' && (
                    <span className={styles.doneBadge}>
                      <Icon name="check" size={10} />
                      완료
                    </span>
                  )}
                  <span className={styles.tag}>{item.type}</span>
                  <div className={styles.meta}>
                    요청 {item.time} · 대기 {item.wait}
                  </div>
                  <div className={styles.loc}>{item.loc}</div>
                  {itemStatus === 'active' && (
                    <div className={styles.assigned}>
                      <Icon name="person" size={13} />
                      김상담 상담원이 진행 중 · 배정됨
                    </div>
                  )}
                  {itemStatus === 'done' && (
                    <div className={styles.completed}>
                      <Icon name="flag" size={13} />
                      상담 완료 · 이력에 저장됨
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.detail}>
          <div className={styles.detailHead}>
            <div>
              <div className={styles.eyebrow}>
                <Icon name="pin" size={13} />
                사용자 정보
              </div>
              <h2 className={styles.heading}>{request.type}</h2>
              <div className={styles.route}>역삼역 {request.loc} → 목적지 3번 출구 · 한국어</div>
            </div>
            {status === 'active' && (
              <span className={styles.inProgress}>
                <span className={styles.inProgressDot} aria-hidden />
                상담 진행 중
              </span>
            )}
            {status === 'done' && (
              <span className={styles.completedChip}>
                <Icon name="check" size={13} />
                상담 완료
              </span>
            )}
            {status === 'waiting' && (
              <Button size="sm" className={styles.accept} onClick={onAccept}>
                상담 수락
              </Button>
            )}
          </div>

          <div className={styles.cards}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>현재 위치</div>
              <div className={styles.cardValue}>{request.loc}</div>
              <MapPreview className={styles.cardMap} me={{ left: '44%', top: '50%' }} />
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>목적지 · 이동 옵션</div>
              <div className={styles.cardValue}>3번 출구 · 스타벅스 역삼점</div>
              <div className={styles.optionList}>
                <span className={styles.option}>
                  <Icon name="luggage" size={13} />
                  계단 없는 경로 선택
                </span>
                <span className={styles.option}>
                  <Icon name="elevator" size={13} />
                  엘리베이터 중심
                </span>
                <span>⏱️ 예상 6분 · 230m</span>
              </div>
            </div>
          </div>

          <div className={`${styles.card} ${styles.issueCard}`}>
            <div className={styles.cardLabel}>문제 유형</div>
            <div className={styles.issueText}>
              {request.type} — {request.detail}
            </div>
          </div>

          {status === 'active' && (
            <div className={styles.acceptedBanner}>
              <span>상담을 수락했습니다. 사용자와 연결 중이에요.</span>
              <ButtonLink to={COUNSELOR_ROUTES.SESSION} size="sm" className={styles.openSession}>
                상담 화면 열기
              </ButtonLink>
            </div>
          )}

          {status === 'done' && (
            <div className={styles.doneBanner}>
              <span>상담이 종료되었습니다. 대화 내용은 상담 이력에서 확인할 수 있어요.</span>
              <ButtonLink
                to={COUNSELOR_ROUTES.HISTORY}
                size="sm"
                variant="secondary"
                className={styles.openHistory}
              >
                상담 이력 보기
              </ButtonLink>
            </div>
          )}
        </div>
      </div>
    </CounselorConsoleShell>
  );
}
