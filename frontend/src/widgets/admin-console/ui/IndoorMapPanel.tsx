import { Button } from '@/shared/ui';
import styles from './IndoorMapPanel.module.css';

type FloorPlan = {
  name: string;
  label: string;
  facs: number;
  updated: string;
  status: '최신' | '보정 필요';
};

/** TODO: Replace with the indoor-map API once the floor-plan contract exists. */
const FLOOR_PLANS: readonly FloorPlan[] = [
  { name: '1F', label: '지상 출구층', facs: 8, updated: '07/21', status: '최신' },
  { name: 'B1', label: '대합실', facs: 14, updated: '07/24', status: '최신' },
  { name: 'B2', label: '승강장', facs: 11, updated: '06/30', status: '보정 필요' },
];

const CURRENT = { bg: '#d9f0df', fg: '#0f5a3e' };
const NEEDS_WORK = { bg: '#fbf0db', fg: '#8a6412' };

type IndoorMapPanelProps = {
  onFlash: (message: string) => void;
};

/** Admin console tab for uploading and calibrating indoor floor plans. */
export function IndoorMapPanel({ onFlash }: IndoorMapPanelProps) {
  return (
    <>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>실내지도 관리</h2>
          <p className={styles.desc}>역삼역 층별 실내 도면과 좌표 보정 상태를 관리해요.</p>
        </div>
        <Button
          size="sm"
          className={styles.upload}
          onClick={() => onFlash('도면 업로드 창을 열었어요')}
        >
          ＋ 도면 업로드
        </Button>
      </div>

      <div className={styles.grid}>
        {FLOOR_PLANS.map((plan) => {
          const tone = plan.status === '최신' ? CURRENT : NEEDS_WORK;
          return (
            <div key={plan.name} className={styles.card}>
              <div className={styles.preview}>
                <svg
                  viewBox="0 0 240 132"
                  preserveAspectRatio="none"
                  className={styles.previewSvg}
                  aria-hidden
                >
                  <rect x="0" y="0" width="240" height="132" fill="#eef1f5" />
                  <rect
                    x="16"
                    y="12"
                    width="208"
                    height="108"
                    rx="7"
                    fill="#f8fafc"
                    stroke="#cdd5df"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M60 104 V64 H168 V32"
                    fill="none"
                    stroke="#e3e9f1"
                    strokeWidth="17"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <rect
                    x="30"
                    y="22"
                    width="38"
                    height="28"
                    rx="3"
                    fill="#eef6f0"
                    stroke="#c4dfca"
                    strokeWidth="1.2"
                  />
                  <rect
                    x="176"
                    y="82"
                    width="34"
                    height="26"
                    rx="3"
                    fill="#f7eef2"
                    stroke="#e2c7d3"
                    strokeWidth="1.2"
                  />
                </svg>
                <span className={styles.floorTag}>{plan.name}</span>
                <span className={styles.statusTag} style={{ background: tone.bg, color: tone.fg }}>
                  {plan.status}
                </span>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardTitle}>{plan.label}</div>
                <div className={styles.cardMeta}>
                  시설 {plan.facs}개 · 최종 수정 {plan.updated}
                </div>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={`${styles.cardAction} ${styles.cardActionPrimary}`}
                    onClick={() => onFlash('도면 편집기로 이동해요')}
                  >
                    도면 편집
                  </button>
                  <button
                    type="button"
                    className={`${styles.cardAction} ${styles.cardActionSecondary}`}
                    onClick={() => onFlash('좌표 보정 모드를 시작했어요')}
                  >
                    좌표 보정
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.notice}>
        <span className={styles.noticeMark}>
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8A6412"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 8v5" />
            <path d="M12 16.4v.2" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </span>
        <div className={styles.noticeBody}>
          <div className={styles.noticeTitle}>B2 도면의 VPS 좌표 보정이 필요해요</div>
          <div className={styles.noticeDesc}>
            승강장 구간 인식 정확도가 68%로 낮습니다. 기준점을 다시 지정해 주세요.
          </div>
        </div>
        <Button
          size="sm"
          className={styles.noticeAction}
          onClick={() => onFlash('좌표 보정 모드를 시작했어요')}
        >
          지금 보정
        </Button>
      </div>
    </>
  );
}
