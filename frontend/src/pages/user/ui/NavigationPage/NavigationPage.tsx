import { Link } from 'react-router-dom';
import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import type { FloorId } from '@/shared/types';
import { USER_ROUTES } from '@/shared/config';
import { Button, ButtonLink, HeadingMarker, Icon, MapPreview } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './NavigationPage.module.css';

const FLOORS: readonly FloorId[] = ['1F', 'B1', 'B2'];

const SHORTCUTS = [
  { to: USER_ROUTES.ROUTE_OPTIONS, label: '경로 변경' },
  { to: USER_ROUTES.NAVIGATION_REROUTE, label: '경로 이탈' },
  { to: USER_ROUTES.OFFLINE, label: '연결 끊김' },
];

/** Screen 15 (FR-U-010) — camera guidance with a synced indoor map. */
export function NavigationPage() {
  const floor = useStationStore((state) => state.floor);
  const setFloor = useStationStore((state) => state.setFloor);
  const stepsOpen = useNavigationStore((state) => state.stepsOpen);
  const toggleSteps = useNavigationStore((state) => state.toggleSteps);

  return (
    <PhoneFrame dark layout="flush">
      <>
        <div className={styles.cam}>
          <div className={styles.camBar}>
            <span className={styles.camBarIcon}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#04231A"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 19V6M6 12l6-6 6 6" />
              </svg>
            </span>
            <div className={styles.camBarBody}>
              <div className={styles.camBarTitle}>
                3번 출구까지 <span className={styles.camBarDistance}>210m</span>
              </div>
              <div className={styles.camBarMeta}>도보 4분 · 에스컬레이터 1회</div>
            </div>
            <Link to={USER_ROUTES.CONSULT_REQUEST} className={styles.consultCta}>
              <span className={styles.consultCtaIcon}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#5C3A0F"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M4 14v-2a8 8 0 0116 0v2" />
                  <rect x="2.5" y="13.5" width="4.5" height="7" rx="2" />
                  <rect x="17" y="13.5" width="4.5" height="7" rx="2" />
                  <path d="M19.2 20.5c0 1.4-1.6 2.5-3.6 2.5" />
                </svg>
              </span>
              <span className={styles.consultCtaLabel}>상담요청</span>
            </Link>
          </div>
          <div className={styles.arrow}>↑</div>
          <div className={styles.camCaption}>직진 후 에스컬레이터에서 좌회전</div>
        </div>

        <div className={styles.lower}>
          <MapPreview className={styles.map} dest={{ left: '74%', top: '22%' }}>
            <svg
              viewBox="0 0 300 300"
              preserveAspectRatio="xMidYMid slice"
              className={styles.mapSvg}
              aria-hidden
            >
              <rect x="0" y="0" width="300" height="300" fill="#eef1f5" />
              <rect
                x="24"
                y="24"
                width="252"
                height="252"
                rx="10"
                fill="#f8fafc"
                stroke="#cdd5df"
                strokeWidth="2"
              />
              <path
                d="M120 210 V96 H228 V60"
                fill="none"
                stroke="#e3e9f1"
                strokeWidth="26"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <rect
                x="40"
                y="40"
                width="52"
                height="44"
                rx="4"
                fill="#eef6f0"
                stroke="#c4dfca"
                strokeWidth="1.5"
              />
              <rect
                x="210"
                y="210"
                width="48"
                height="44"
                rx="4"
                fill="#f7eef2"
                stroke="#e2c7d3"
                strokeWidth="1.5"
              />
              <rect
                x="40"
                y="210"
                width="48"
                height="44"
                rx="4"
                fill="#fef8ec"
                stroke="#e6d7ac"
                strokeWidth="1.5"
              />
              <rect x="150" y="150" width="8" height="8" rx="2" fill="#B08640" />
              <polyline
                points="120,210 120,96 228,96 228,66"
                fill="none"
                stroke="#3EB489"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="1 11"
              />
            </svg>

            <div className={styles.floorButtons} role="group" aria-label="층 선택">
              {FLOORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={floor === option}
                  className={[styles.floorButton, floor === option && styles.floorButtonOn]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setFloor(option)}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className={styles.destLabel}>3번 출구</div>
            <HeadingMarker style={{ left: '40%', top: '70%' }} />
          </MapPreview>

          {stepsOpen && (
            <div className={styles.steps}>
              <div className={styles.step}>
                <span className={styles.stepIcon}>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="butt"
                    strokeLinejoin="miter"
                    aria-hidden
                  >
                    <path d="M12 20.4V4.4M5.8 10.6 12 4.4l6.2 6.2" />
                  </svg>
                </span>
                <b className={styles.stepTitle}>직진 25m</b>
                <span className={styles.stepNote}>개찰구 지나 계속</span>
                <span className={styles.stepSpring} />
                <span className={styles.stepDistance}>25m</span>
              </div>
              <div className={styles.step}>
                <span className={styles.stepIcon}>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="butt"
                    strokeLinejoin="miter"
                    aria-hidden
                  >
                    <path d="M17 20.4V10.6H7M12.6 5.4 7 10.6l5.6 5.2" />
                  </svg>
                </span>
                <b className={styles.stepTitle}>좌회전</b>
                <span className={styles.stepNote}>에스컬레이터 · 1F로 이동</span>
                <span className={styles.stepSpring} />
                <span className={styles.stepDistance}>15m</span>
              </div>
              <div className={`${styles.step} ${styles.stepLast}`}>
                <span className={`${styles.stepIcon} ${styles.stepIconGoal}`}>
                  <Icon name="flag" size={16} />
                </span>
                <b className={styles.stepTitle}>3번 출구 도착</b>
                <span className={styles.stepNote}>City Square</span>
                <span className={styles.stepSpring} />
              </div>
            </div>
          )}

          <div className={styles.shortcuts}>
            {SHORTCUTS.map((shortcut) => (
              <Link key={shortcut.to} to={shortcut.to} className={styles.shortcut}>
                {shortcut.label}
              </Link>
            ))}
          </div>

          <div className={styles.actions}>
            <Button
              variant="secondary"
              size="sm"
              className={styles.action}
              onClick={toggleSteps}
              aria-expanded={stepsOpen}
            >
              <Icon name="list" size={15} />
              상세 경로 안내
            </Button>
            <ButtonLink to={USER_ROUTES.ARRIVAL} size="sm" className={styles.action}>
              도착
            </ButtonLink>
          </div>
        </div>
      </>
    </PhoneFrame>
  );
}
