import { Fragment, useRef, useState } from 'react';
import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import { USER_ROUTES } from '@/shared/config';
import { Button, ButtonLink, HeadingMarker, Icon, MapPreview, Sheet } from '@/shared/ui';
import type { IconName } from '@/shared/ui';
import { ViewfinderBack } from '@/widgets/capture-viewfinder';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './NavigationPage.module.css';

const FLOORS = ['1F', 'B1', 'B2', 'B3'] as const;

const MAP_FACILITIES: readonly {
  name: string;
  detail: string;
  icon: IconName;
  left: string;
  top: string;
}[] = [
  { name: '화장실', detail: 'B1 대합실 · 약 80m', icon: 'restroom', left: '21%', top: '25%' },
  { name: '승차권 충전', detail: '2번 개찰구 옆 · 약 45m', icon: 'card', left: '73%', top: '73%' },
  { name: '엘리베이터', detail: 'B1 ↔ 1F · 약 110m', icon: 'elevator', left: '76%', top: '25%' },
  { name: '내린 위치', detail: 'B2 승강장 · 3-2 탑승칸', icon: 'train', left: '23%', top: '66%' },
];

const MAP_FILTERS: readonly { name: string; icon: IconName }[] = [
  ...MAP_FACILITIES.map(({ name, icon }) => ({ name, icon })),
  { name: '출구', icon: 'door' },
];

/** Camera guidance with an interactive indoor map and up to two stops. */
export function NavigationPage() {
  const station = useStationStore((state) => state.station);
  const floor = useStationStore((state) => state.floor);
  const setFloor = useStationStore((state) => state.setFloor);
  const destination = useNavigationStore((state) => state.destination) ?? '강남파이낸스센터';
  const route = useNavigationStore((state) => state.route);
  const waypoints = useNavigationStore((state) => state.waypoints);
  const addWaypoint = useNavigationStore((state) => state.addWaypoint);
  const removeWaypoint = useNavigationStore((state) => state.removeWaypoint);
  const setDestination = useNavigationStore((state) => state.setDestination);
  const stepsOpen = useNavigationStore((state) => state.stepsOpen);
  const toggleSteps = useNavigationStore((state) => state.toggleSteps);
  const exit = route === 'elev' ? '2번 출입구' : '7번 출입구';
  const initialDestination = useRef(destination);
  const [selectedFacility, setSelectedFacility] = useState<(typeof MAP_FACILITIES)[number] | null>(
    null,
  );
  const [facilityFilter, setFacilityFilter] = useState<string | null>(null);
  const [activeDestination, setActiveDestination] = useState(exit);
  const [recalculated, setRecalculated] = useState(false);
  const destinationChanged = activeDestination !== exit;
  const selectedFacilityIsWaypoint = selectedFacility
    ? waypoints.includes(selectedFacility.name)
    : false;
  const selectedFacilityIsDestination = selectedFacility
    ? selectedFacility.name === activeDestination
    : false;

  return (
    <PhoneFrame
      dark
      layout="flush"
      overlay={
        selectedFacility ? (
          <Sheet
            label={`${selectedFacility.name} 경로 설정`}
            onDismiss={() => setSelectedFacility(null)}
          >
            <div className={styles.sheetHandle} aria-hidden />
            <div className={styles.sheetHead}>
              <span className={styles.sheetIcon}>
                <Icon name={selectedFacility.icon} size={20} />
              </span>
              <div>
                <h2>{selectedFacility.name}</h2>
                <p>{selectedFacility.detail}</p>
              </div>
            </div>
            <p className={styles.sheetNote}>
              경유지는 최대 2개까지 추가할 수 있어요. 변경하면 현재 위치에서 경로를 다시 계산합니다.
            </p>
            <div className={styles.sheetActions}>
              <Button
                disabled={
                  waypoints.length >= 2 ||
                  selectedFacilityIsWaypoint ||
                  selectedFacilityIsDestination
                }
                onClick={() => {
                  if (selectedFacilityIsWaypoint || selectedFacilityIsDestination) return;
                  addWaypoint(selectedFacility.name);
                  setRecalculated(true);
                  setSelectedFacility(null);
                }}
              >
                {selectedFacilityIsDestination
                  ? '현재 목적지는 추가 불가'
                  : selectedFacilityIsWaypoint
                    ? '이미 추가된 경유지'
                    : waypoints.length >= 2
                      ? '경유지 2개 추가 완료'
                      : '경유지로 추가'}
              </Button>
              <Button
                variant="secondary"
                disabled={selectedFacilityIsWaypoint || selectedFacilityIsDestination}
                onClick={() => {
                  if (selectedFacilityIsWaypoint || selectedFacilityIsDestination) return;
                  setDestination(selectedFacility.name);
                  setActiveDestination(selectedFacility.name);
                  setRecalculated(true);
                  setSelectedFacility(null);
                }}
              >
                {selectedFacilityIsWaypoint
                  ? '경유지로 등록된 장소'
                  : selectedFacilityIsDestination
                    ? '현재 목적지'
                    : '새 목적지로 설정'}
              </Button>
            </div>
          </Sheet>
        ) : undefined
      }
    >
      <>
        <div className={styles.cam}>
          <div className={styles.topBar}>
            <ViewfinderBack to={USER_ROUTES.ROUTE_OPTIONS} />
            <ConsultCta variant="icon" />
          </div>

          <div
            className={[styles.journeyHeader, waypoints.length > 0 && styles.journeyHeaderCompact]
              .filter(Boolean)
              .join(' ')}
            aria-label="현재 경로"
          >
            <div className={styles.routePoint}>
              <span className={styles.routeLabel}>
                <span className={styles.pointDot} aria-hidden />
                <small>출발지</small>
              </span>
              <strong>{station} B1</strong>
            </div>
            {waypoints.map((waypoint, index) => (
              <Fragment key={waypoint}>
                <span className={styles.routeArrow} aria-hidden>
                  <Icon name="arrow-right" size={16} />
                </span>
                <div className={`${styles.routePoint} ${styles.waypointPoint}`}>
                  <button
                    type="button"
                    className={styles.removeWaypoint}
                    onClick={() => {
                      removeWaypoint(waypoint);
                      setRecalculated(true);
                    }}
                    aria-label={`${waypoint} 경유지 삭제`}
                    title={`${waypoint} 경유지 삭제`}
                  >
                    ×
                  </button>
                  <span className={styles.routeLabel}>
                    <span className={`${styles.pointDot} ${styles.pointDotWaypoint}`} aria-hidden />
                    <small>경유 {index + 1}</small>
                  </span>
                  <strong title={waypoint}>{waypoint}</strong>
                </div>
              </Fragment>
            ))}
            <span className={styles.routeArrow} aria-hidden>
              <Icon name="arrow-right" size={16} />
            </span>
            <div className={`${styles.routePoint} ${styles.destinationPoint}`}>
              {destinationChanged && (
                <button
                  type="button"
                  className={styles.resetDestination}
                  onClick={() => {
                    setDestination(initialDestination.current);
                    setActiveDestination(exit);
                    setRecalculated(true);
                  }}
                  aria-label={`목적지를 ${exit}로 되돌리기`}
                  title={`처음 목적지 ${exit}로 되돌리기`}
                >
                  <Icon name="refresh" size={10} />
                </button>
              )}
              <span className={styles.routeLabel}>
                <span className={`${styles.pointDot} ${styles.pointDotDestination}`} aria-hidden />
                <small>목적지</small>
              </span>
              <strong title={activeDestination}>{activeDestination}</strong>
            </div>
          </div>

          <div className={styles.instructionCard}>
            <span className={styles.instructionIcon}>
              <Icon name="arrow-right" size={16} className={styles.upArrow} />
            </span>
            <div className={styles.instructionBody}>
              <span className={styles.instructionEyebrow}>
                다음 안내 · {recalculated ? '경로 업데이트 완료' : '25m'}
              </span>
              <strong className={styles.instructionTitle}>직진 25m</strong>
              <span className={styles.instructionMeta}>
                개찰구를 지나 에스컬레이터 방향으로 이동
              </span>
            </div>
          </div>
          <div className={styles.arrow}>↑</div>
          <div className={styles.camCaption}>정면 통로를 따라 직진하세요</div>
        </div>

        <div className={styles.lower}>
          <div className={styles.lowerBody}>
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
                <rect x="40" y="40" width="52" height="44" rx="4" fill="#eef6f0" />
                <rect x="210" y="210" width="48" height="44" rx="4" fill="#f7eef2" />
                <rect x="40" y="210" width="48" height="44" rx="4" fill="#fef8ec" />
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

              <div className={styles.facilityFilters} role="group" aria-label="시설 필터">
                {MAP_FILTERS.map((filter) => {
                  const active = facilityFilter === filter.name;

                  return (
                    <button
                      key={filter.name}
                      type="button"
                      className={[styles.facilityFilter, active && styles.facilityFilterOn]
                        .filter(Boolean)
                        .join(' ')}
                      aria-label={`${filter.name} ${active ? '필터 해제' : '필터 적용'}`}
                      aria-pressed={active}
                      title={filter.name}
                      onClick={() => setFacilityFilter(active ? null : filter.name)}
                    >
                      <Icon name={filter.icon} size={14} />
                    </button>
                  );
                })}
              </div>

              {(facilityFilter == null || facilityFilter === '출구') && (
                <div className={styles.destLabel}>{exit}</div>
              )}
              <HeadingMarker style={{ left: '40%', top: '70%' }} />

              {MAP_FACILITIES.filter(
                (facility) => facilityFilter == null || facility.name === facilityFilter,
              ).map((facility) => (
                <button
                  key={facility.name}
                  type="button"
                  className={styles.facility}
                  style={{ left: facility.left, top: facility.top }}
                  onClick={() => setSelectedFacility(facility)}
                  aria-label={`${facility.name} 경로 옵션 열기`}
                >
                  <Icon name={facility.icon} size={13} />
                  <span>{facility.name}</span>
                </button>
              ))}
            </MapPreview>

            <div className={styles.mapLegend}>
              <span>지도 시설을 눌러 경유지 추가</span>
              <strong>{waypoints.length}/2</strong>
            </div>

            {stepsOpen && (
              <div className={styles.steps}>
                <div className={styles.step}>
                  <span className={styles.stepIcon}>↑</span>
                  <b>직진 25m</b>
                  <span>개찰구 지나 계속</span>
                </div>
                {waypoints.map((waypoint) => (
                  <div key={waypoint} className={styles.step}>
                    <span className={styles.stepIcon}>
                      <Icon name="pin" size={14} />
                    </span>
                    <b>{waypoint}</b>
                    <span>추가 경유지</span>
                  </div>
                ))}
                <div className={styles.step}>
                  <span className={styles.stepIcon}>
                    <Icon name="flag" size={14} />
                  </span>
                  <b>{exit} 도착</b>
                  <span>{destination} 방면</span>
                </div>
              </div>
            )}

            <div className={styles.actions}>
              <Button
                variant="secondary"
                size="sm"
                className={styles.action}
                onClick={toggleSteps}
                aria-expanded={stepsOpen}
              >
                <Icon name="list" size={15} />
                상세 경로
              </Button>
              <ButtonLink to={USER_ROUTES.ARRIVAL} size="sm" className={styles.action}>
                도착
              </ButtonLink>
            </div>
          </div>
        </div>
      </>
    </PhoneFrame>
  );
}
