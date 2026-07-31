import { Fragment, useRef, useState } from 'react';
import { MOCK_FLOOR_ID } from '@/entities/floor-map';
import { useNavigationStore, type IndoorPoint } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import { USER_ROUTES } from '@/shared/config';
import { Button, ButtonLink, Icon, MapPreview, Sheet } from '@/shared/ui';
import type { IconName } from '@/shared/ui';
import { ViewfinderBack } from '@/widgets/capture-viewfinder';
import { IndoorMapView } from '@/widgets/indoor-map';
import { PhoneFrame } from '@/widgets/phone-frame';
import { useXrNavigationSession, XrSessionNotice, XrTrackingBadge } from '@/widgets/xr-navigation';
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

/**
 * 안내 진입 시점의 확정 실내 위치.
 *
 * **모듈 상수로 둔다.** 296 훅이 이 값을 진입 시점에 고정된 입력으로 다루므로(앵커가 생긴 뒤
 * 바꾸면 조용히 무시된다) 렌더마다 새 객체를 만들면 앵커 발화 effect가 불필요하게 다시 돈다.
 *
 * 목업 도면 B2의 미터 원점이라 도면 가운데 부근에 찍힌다. 값 자체는 검산이 쉬운 (0, 0)이다.
 *
 * TODO: 위치 인식(FR-U-004)·수동 선택(FR-U-007) 결과를 받는 경로가 아직 없다. 확정 좌표를
 * 담는 스토어가 없어서(navigationStore는 목적지 문자열만 갖는다) 여기서 목업으로 채운다.
 * 그 흐름이 생기면 이 상수를 지우고 응답 좌표를 넘긴다.
 */
const MOCK_CONFIRMED_LOCATION: IndoorPoint = {
  floorId: MOCK_FLOOR_ID.B2,
  mapX: 0,
  mapY: 0,
};

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
  /**
   * XR 세션 게이트. 진입 시 안내를 띄우고 사용자가 확인하면 세션을 연다(11.7).
   *
   * 세션이 그리는 카메라 위에 이 화면 전체가 dom-overlay로 얹힌다. 별도 `<video>`를 만들지
   * 않는다 — `getUserMedia`와 세션은 공존하지 못하고, 켠 채로 열면 pose가 하나도 들어오지
   * 않는다(11.8).
   */
  const {
    overlayRef,
    isNoticeOpen,
    isSessionOpen,
    support,
    status: xrStatus,
    reason: xrReason,
    canRetry,
    confirm: startXrSession,
    continueWithoutTracking,
    currentLocation,
    source,
    anchorStatus,
  } = useXrNavigationSession({ currentIndoorLocation: MOCK_CONFIRMED_LOCATION });
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
        /**
         * 세션 안내가 시설 시트보다 앞선다. 세션을 열기 전에는 다른 조작을 받을 필요가 없고,
         * 실패 안내가 시트에 가리면 사용자가 상태를 알 수 없다.
         */
        isNoticeOpen ? (
          <XrSessionNotice
            support={support}
            status={xrStatus}
            reason={xrReason}
            canRetry={canRetry}
            onConfirm={startXrSession}
            onContinueWithoutTracking={continueWithoutTracking}
          />
        ) : selectedFacility ? (
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
      <div className={styles.overlayRoot} ref={overlayRef}>
        <div className={[styles.cam, isSessionOpen && styles.camLive].filter(Boolean).join(' ')}>
          <div className={styles.topBar}>
            <ViewfinderBack to={USER_ROUTES.ROUTE_OPTIONS} />
            <XrTrackingBadge status={xrStatus} anchorStatus={anchorStatus} source={source} />
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
            <MapPreview className={styles.map}>
              {/* 실제 실내 지도(282). 목업 스키매틱 SVG가 있던 자리를 그대로 채운다.
                  현재 위치 마커는 이 컴포넌트가 그린다 — 296 훅이 준 캐노니컬 미터 좌표를
                  넘기면 프레임 변환(meterToPixel)은 그쪽이 한다. 여기서 좌표를 가공하지 않는다.

                  표시 층은 현재 위치를 따라간다. 사용자가 버튼으로 층을 바꾸는 기능은 280이다.

                  TODO: useMockData를 끄면 실제 층 지도 API를 쓴다. 지금은 도면 이미지가
                  업로드되지 않아(mapUrl이 null) 목업 도면으로 마커 움직임을 확인한다. */}
              <div className={styles.mapCanvas}>
                <IndoorMapView
                  stationId={1}
                  floorId={currentLocation?.floorId ?? MOCK_CONFIRMED_LOCATION.floorId}
                  currentLocation={currentLocation}
                  useMockData
                />
              </div>

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
              {/* 현재 위치는 IndoorMapView가 실제 좌표로 그린다. 퍼센트로 고정된 HeadingMarker를
                  남겨 두면 마커가 둘이 되어 어느 쪽이 실제인지 구분할 수 없다.
                  TODO(141): 방향(heading) 표시를 실제 pose로 되살린다. */}

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
      </div>
    </PhoneFrame>
  );
}
