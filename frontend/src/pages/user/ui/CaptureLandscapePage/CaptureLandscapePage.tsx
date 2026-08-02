import { Link } from 'react-router-dom';
import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import { USER_ROUTES } from '@/shared/config';
import { ButtonLink } from '@/shared/ui';
import { CameraFallbackNotice, CameraFeed, useCameraPreview } from '@/widgets/camera-preview';
import styles from './CaptureLandscapePage.module.css';

const DIRECTIONS = [
  { label: '정면', state: 'done' },
  { label: '오른쪽', state: 'done' },
  { label: '뒤쪽', state: 'current' },
  { label: '왼쪽', state: 'todo' },
] as const;

const barClass = {
  done: styles.barDone,
  current: styles.barCurrent,
  todo: styles.barTodo,
} as const;

/**
 * Screen 05b (FR-U-004) — landscape capture.
 *
 * This is the one screen that does not use `PhoneFrame`: the prototype rotated
 * the device shell 90° and counter-rotated its contents, so the frame markup
 * differs structurally.
 *
 * TODO: 회전 진행 게이지는 아직 상수다. 실제 촬영 진행으로 움직여야 한다.
 */
export function CaptureLandscapePage() {
  const station = useStationStore((state) => state.station);
  const camera = useCameraPreview();

  return (
    <div className={styles.stage}>
      <div className={styles.rotatedArea}>
        <div className={styles.phone}>
          <div className={styles.viewport}>
            <div className={styles.cameraFrame}>
              <CameraFeed camera={camera} className={styles.feed} />

              {/* 카메라를 켤 수 없을 때의 대체 그림. 검은 화면으로 두지 않는다. */}
              {!camera.isLive && (
                <svg
                  viewBox="0 0 722 338"
                  preserveAspectRatio="none"
                  className={styles.scene}
                  aria-hidden
                >
                  <path d="M0 338 L259.92 155.48 H462.08 L722 338 Z" fill="rgba(60,216,160,0.07)" />
                  <path
                    d="M0 338 L259.92 155.48 M722 338 L462.08 155.48 M259.92 155.48 H462.08"
                    stroke="rgba(127,239,195,0.24)"
                    strokeWidth="1.2"
                    fill="none"
                  />
                  <path
                    d="M259.92 155.48 V43.94 H462.08 V155.48"
                    stroke="rgba(127,239,195,0.16)"
                    strokeWidth="1.2"
                    fill="none"
                  />
                  <rect
                    x="303.24"
                    y="64.22"
                    width="115.52"
                    height="30.42"
                    rx="3"
                    fill="rgba(127,239,195,0.2)"
                  />
                  <path
                    d="M0 263.64 H187.72 M534.28 263.64 H722"
                    stroke="rgba(127,239,195,0.12)"
                    strokeWidth="1"
                    fill="none"
                  />
                </svg>
              )}

              <CameraFallbackNotice status={camera.status} />

              <div className={styles.band} aria-hidden />
              <div className={styles.horizon} aria-hidden />

              <div className={styles.frameGuides} aria-hidden>
                <div className={styles.cornerTl} />
                <div className={styles.cornerTr} />
                <div className={styles.cornerBl} />
                <div className={styles.cornerBr} />
              </div>
            </div>

            <div className={styles.statusBar} aria-hidden>
              <span>9:41</span>
              <span className={styles.statusRight}>●●● ▮</span>
            </div>

            <div className={styles.topBar}>
              <Link to={USER_ROUTES.CAPTURE_GUIDE} className={styles.back} aria-label="촬영 안내로">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#DFF6E6"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </Link>
              <span className={styles.rec}>
                <span className={styles.recDot} aria-hidden />
                <span className={styles.recLabel}>REC · {station}</span>
              </span>
              <span className={styles.modeBadge}>가로 모드 · 시야 2배</span>
              <div className={styles.topActions}>
                <Link to={USER_ROUTES.CAPTURE_PORTRAIT} className={styles.switchLink}>
                  세로로 전환
                </Link>
                <ButtonLink to={USER_ROUTES.ANALYZING} className={styles.finish}>
                  완료
                </ButtonLink>
              </div>
            </div>
            <ConsultCta variant="icon" className={styles.help} />

            <div className={styles.hint}>
              <span className={styles.hintText}>천천히 오른쪽으로</span>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7FEFC3"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.hintArrow}
                aria-hidden
              >
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </div>

            <div className={styles.dock}>
              <div className={styles.tip}>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#7FEFC3"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  style={{ flex: 'none' }}
                  aria-hidden
                >
                  <path d="M12 3v4" />
                  <rect x="4" y="7" width="16" height="12" rx="3" />
                  <path d="M9 13h6" />
                </svg>
                <span className={styles.tipText}>
                  역 이름 표지판이나 기둥 번호가 보이면 <b>1초만 멈춰</b>주세요
                </span>
              </div>

              <div className={styles.steps}>
                {DIRECTIONS.map((direction) => (
                  <div key={direction.label} className={styles.step}>
                    <span className={`${styles.bar} ${barClass[direction.state]}`} />
                    <span
                      className={[
                        styles.stepLabel,
                        direction.state === 'todo' && styles.stepLabelTodo,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {direction.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.notch} aria-hidden />
          <div className={styles.homeBar} aria-hidden />
        </div>
      </div>
    </div>
  );
}
