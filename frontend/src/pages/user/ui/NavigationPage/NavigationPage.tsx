import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { facilityIconOf, useStationFacilities, type Facility } from '@/entities/facility';
import { floorCodeOf, floorIdOf, MOCK_FLOOR_ID, useStationFloorMaps } from '@/entities/floor-map';
import { useNavigationStore, type IndoorPoint } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import { USER_ROUTES } from '@/shared/config';
import type { FloorId } from '@/shared/types';
import { Button, ButtonLink, Icon, MapPreview, Sheet } from '@/shared/ui';
import type { IconName } from '@/shared/ui';
import { ViewfinderBack } from '@/widgets/capture-viewfinder';
import { IndoorMapView } from '@/widgets/indoor-map';
import { PhoneFrame } from '@/widgets/phone-frame';
import { useXrNavigationSession, XrSessionNotice, XrTrackingBadge } from '@/widgets/xr-navigation';
import styles from './NavigationPage.module.css';

/**
 * 지도 위 시설 필터.
 *
 * **기본은 아무것도 켜지 않는다.** 역삼역 B2는 실제 240m 폭이 이 지도에서 287px에 들어가
 * 1m가 1.2px이고, 그 층 시설 36개를 모두 그리면 마커 간 최소 간격이 3.9px이 되어 서로를
 * 덮는다. 유형 하나를 켜면 많아도 13개(계단)라 겹치지 않는다 — FR-U-006의 점진적 공개다.
 *
 * 이름과 아이콘은 프로토타입(`#s-nav`)의 칩 다섯 개에서 출발했고, 각 칩이 실제
 * `facilityType`을 켜도록 연결했다.
 *
 * **에스컬레이터와 계단을 뒤에 붙였다.** 역삼역에서 가장 많은 두 유형인데(B1 기준 각각
 * 10개·13개) 칩이 없어 지도에 한 번도 뜨지 않았다. 층을 오르내리는 통로라 길안내에서 오히려
 * 자주 찾는 것들이다. 밀도는 문제되지 않는다 — 위 계산의 상한이 바로 계단 13개다.
 *
 * TODO: `platform`은 역삼역에 등록된 시설이 없어 눌러도 표시할 것이 없다. 승강장 시설이
 * 시드되면 그대로 동작한다(백엔드 요청 예정).
 */
const MAP_FILTERS: readonly { name: string; icon: IconName; facilityType: string }[] = [
  { name: '화장실', icon: 'restroom', facilityType: 'restroom' },
  { name: '승차권 충전', icon: 'card', facilityType: 'card_charger' },
  { name: '엘리베이터', icon: 'elevator', facilityType: 'elevator' },
  { name: '에스컬레이터', icon: 'escalator', facilityType: 'escalator' },
  { name: '계단', icon: 'stairs', facilityType: 'stair' },
  { name: '내린 위치', icon: 'train', facilityType: 'platform' },
  { name: '출구', icon: 'door', facilityType: 'exit' },
];

/**
 * 안내 진입 시점의 확정 실내 위치.
 *
 * **모듈 상수로 둔다.** 296 훅이 이 값을 진입 시점에 고정된 입력으로 다루므로(앵커가 생긴 뒤
 * 바꾸면 조용히 무시된다) 렌더마다 새 객체를 만들면 앵커 발화 effect가 불필요하게 다시 돈다.
 *
 * 좌표는 B2 대합실 통로 위, 어느 시설과도 30m 이상 떨어진 지점이다.
 *
 * **원점 `(0, 0)`을 쓰지 않는다.** 그 지점은 좌표계의 기준으로 삼은 `B2-B3 엘리베이터 B`가
 * 실제로 서 있는 자리다. 거기에 현재 위치를 두면 시설 마커와 정확히 겹쳐, 엘리베이터를 고르는
 * 순간 내 위치에 테두리가 쳐진 것처럼 보인다. 가까운 시설도 마찬가지라 넉넉히 띄운다.
 *
 * TODO: 위치 인식(FR-U-004)·수동 선택(FR-U-007) 결과를 받는 경로가 아직 없다. 확정 좌표를
 * 담는 스토어가 없어서(navigationStore는 목적지 문자열만 갖는다) 여기서 목업으로 채운다.
 * 그 흐름이 생기면 이 상수를 지우고 응답 좌표를 넘긴다.
 */
const MOCK_CONFIRMED_LOCATION: IndoorPoint = {
  floorId: MOCK_FLOOR_ID.B2,
  mapX: -30,
  mapY: 10,
};

/**
 * 화면이 들고 있는 출구 이름으로 실제 출구 시설을 찾는다.
 *
 * 화면은 `7번 출입구`, 응답은 `7번 출구`로 표기가 다르다. 출구 번호만 뽑아 맞춘다.
 * 번호가 없는 이름(`강남파이낸스센터(GFC몰) 연결 출입구` 등)은 대조하지 않는다.
 */
function matchExitByName(exits: readonly Facility[], name: string): Facility | null {
  const number = /^(\d+)번/.exec(name)?.[1];
  if (!number) return null;

  return exits.find((exit) => exit.nameKo.startsWith(`${number}번`)) ?? null;
}

/** Camera guidance with an interactive indoor map and up to two stops. */
export function NavigationPage() {
  const station = useStationStore((state) => state.station);
  const setFloor = useStationStore((state) => state.setFloor);
  const destination = useNavigationStore((state) => state.destination) ?? '강남파이낸스센터';
  const route = useNavigationStore((state) => state.route);
  const waypoints = useNavigationStore((state) => state.waypoints);
  const addWaypoint = useNavigationStore((state) => state.addWaypoint);
  const removeWaypoint = useNavigationStore((state) => state.removeWaypoint);
  const setDestination = useNavigationStore((state) => state.setDestination);
  const stepsOpen = useNavigationStore((state) => state.stepsOpen);
  const toggleSteps = useNavigationStore((state) => state.toggleSteps);
  const beginRelocalize = useNavigationStore((state) => state.beginRelocalize);
  const endRelocalize = useNavigationStore((state) => state.endRelocalize);
  const navigate = useNavigate();

  /**
   * 안내 화면에 도착했으면 재인식이 끝난 것이다.
   *
   * U-05의 CTA에 걸지 않고 여기서 지운다. 어떤 경로로 돌아와도(브라우저 뒤로가기, 다른 링크)
   * 표시가 남지 않아야 다음 재인식 판정이 틀리지 않는다.
   */
  useEffect(() => {
    endRelocalize();
  }, [endRelocalize]);
  const exit = route === 'elev' ? '2번 출입구' : '7번 출입구';
  const initialDestination = useRef(destination);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  /** 켜 둔 시설 유형(`facilityType`). null이면 시설을 그리지 않는다. */
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
    headingDeg,
    source,
    anchorStatus,
  } = useXrNavigationSession({ currentIndoorLocation: MOCK_CONFIRMED_LOCATION });

  /**
   * 층 탭. **목록을 지도 응답에서 만든다.** (S15P11A206-280)
   *
   * 프로토타입은 `1F·B1·B2·B3`를 하드코딩해 뒀는데, 역삼역에 등록된 지도는 B1·B2·B3 세 장이라
   * `1F`를 눌러도 보여줄 지도가 없었다. `floor_id`는 auto-increment라 코드↔id 매핑을 상수로
   * 두면 시드가 바뀔 때 조용히 어긋나므로 응답에서 찾는다.
   */
  const floorMapsQuery = useStationFloorMaps(1);
  const floorMaps = floorMapsQuery.data ?? [];
  /** 사용자가 탭으로 고른 층. null이면 현재 위치를 따라간다. */
  const [pickedFloorCode, setPickedFloorCode] = useState<string | null>(null);
  const followedFloorId = currentLocation?.floorId ?? MOCK_CONFIRMED_LOCATION.floorId;
  const displayedFloorId =
    (pickedFloorCode === null ? undefined : floorIdOf(floorMaps, pickedFloorCode)) ??
    followedFloorId;
  const displayedFloorCode = floorCodeOf(floorMaps, displayedFloorId);

  /**
   * 목적지 마커. **이름과 좌표가 같은 곳을 가리켜야 한다.**
   *
   * 이전에는 좌표가 목업 상수(3번출구 엘리베이터)이고 이름은 경로 옵션 화면에서 온 문자열
   * (`7번 출입구`)이라, 3번 출구 자리에 7번이라고 적힌 마커가 그려졌다. 두 목업이 서로 다른
   * 곳에서 와서 맞춰진 적이 없었다.
   *
   * 이제 출구 이름으로 실제 시설을 찾아 그 좌표를 쓴다. 찾지 못하면 그리지 않는다 — 틀린
   * 자리에 표시하는 것보다 없는 편이 낫다. 사용자가 시설을 새 목적지로 지정한 경우에는 그
   * 시설을 그대로 쓴다.
   *
   * TODO(297): 경로 조회가 붙으면 목적지는 경로 응답의 마지막 노드에서 온다. 그때 이 조회와
   * 이름 대조를 지운다.
   */
  const exitsQuery = useStationFacilities(1, { facilityType: 'exit' });
  const [pickedDestination, setPickedDestination] = useState<Facility | null>(null);
  const destinationFacility =
    pickedDestination ?? matchExitByName(exitsQuery.data ?? [], activeDestination);

  const destinationChanged = activeDestination !== exit;
  const selectedFacilityIsWaypoint = selectedFacility
    ? waypoints.includes(selectedFacility.nameKo)
    : false;
  const selectedFacilityIsDestination = selectedFacility
    ? selectedFacility.nameKo === activeDestination
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
            label={`${selectedFacility.nameKo} 경로 설정`}
            onDismiss={() => setSelectedFacility(null)}
          >
            <div className={styles.sheetHandle} aria-hidden />
            <div className={styles.sheetHead}>
              <span className={styles.sheetIcon}>
                <Icon name={facilityIconOf(selectedFacility.facilityType)} size={20} />
              </span>
              <div>
                <h2>{selectedFacility.nameKo}</h2>
                {/* 목업이던 거리·층 설명 대신 응답에 있는 값을 쓴다. 거리는 경로 계산(297)이
                    붙으면 넣는다 — 지금 임의로 만들면 틀린 숫자를 보여주게 된다. */}
                <p>
                  {selectedFacility.isAccessible
                    ? '계단 없이 갈 수 있어요'
                    : '계단 구간이 있을 수 있어요'}
                </p>
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
                  addWaypoint(selectedFacility.nameKo);
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
                  setDestination(selectedFacility.nameKo);
                  setActiveDestination(selectedFacility.nameKo);
                  // 좌표를 아는 시설이므로 그대로 목적지 마커로 쓴다.
                  setPickedDestination(selectedFacility);
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
                    setPickedDestination(null);
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
                  floorId={displayedFloorId}
                  currentLocation={currentLocation}
                  currentHeadingDeg={headingDeg}
                  /* 길안내 화면이므로 시점이 내 위치를 따라간다. 밀거나 확대하면 풀리고
                     `내 위치` 버튼으로 돌아온다. */
                  followCamera
                  /* 실제 시설 좌표를 넘긴다. 목업 목적지를 쓰지 않는다 — 좌표와 이름이
                     다른 곳을 가리키던 원인이다. 다른 층의 목적지는 오버레이가 걸러낸다. */
                  destination={
                    destinationFacility
                      ? {
                          floorId: destinationFacility.floorId,
                          mapX: destinationFacility.mapX,
                          mapY: destinationFacility.mapY,
                        }
                      : null
                  }
                  /* 이름은 응답의 것을 쓴다. 마커와 같은 좌표계에서 그려야 둘이 붙어 있다.
                     시설 필터가 걸리면 원본과 같이 출구 표시를 감춘다. */
                  destinationLabel={
                    (facilityFilter == null || facilityFilter === 'exit') &&
                    destinationFacility !== null
                      ? destinationFacility.nameKo
                      : null
                  }
                  facilityType={facilityFilter}
                  selectedFacilityId={selectedFacility?.facilityId}
                  onSelectFacility={setSelectedFacility}
                  useMockData
                />
              </div>

              {/*
                U-10의 "현재 위치 다시 인식". 주변을 다시 촬영해 위치를 새로 확정하는 흐름이므로
                U-04로 나간다(화면 정의서 U-10 사용자 액션).

                하단 액션 행이 아니라 지도 위에 둔다. 원본 액션 행은 버튼이 두 개이고, 셋으로
                늘리면 좁은 화면에서 글자가 눌린다. 위치 표시를 다시 잡는 조작이라 지도에 붙는
                편이 뜻도 더 분명하다.

                **세션이 끊기고 앵커가 사라지는 것이 정상이다.** 이 버튼을 누르는 상황은 이미
                위치를 신뢰할 수 없는 상태(경로 이탈, 엘리베이터 하차 등)라 지킬 앵커가 없다.
                앵커를 유지한 채 좌표만 갱신하는 세션 안 위치 인식은 이것과 별개이며, 그쪽은
                camera-access로 프레임을 얻어 화면을 벗어나지 않는다(11.8).

                돌아오는 경로는 스토어의 relocalizing 표시가 담당한다 — U-05의 기본 CTA가 경로
                옵션 선택이라, 표시가 없으면 목적지를 다시 고르는 화면부터 밟게 된다.
              */}
              <button
                type="button"
                className={styles.relocalize}
                aria-label="현재 위치 다시 인식"
                onClick={() => {
                  beginRelocalize();
                  navigate(USER_ROUTES.CAPTURE_PORTRAIT);
                }}
              >
                <Icon name="refresh" size={14} />
                재인식
              </button>

              <div className={styles.floorButtons} role="group" aria-label="층 선택">
                {floorMaps.map((map) => {
                  const on = map.floorCode === displayedFloorCode;

                  return (
                    <button
                      key={map.floorId}
                      type="button"
                      aria-pressed={on}
                      className={[styles.floorButton, on && styles.floorButtonOn]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        setPickedFloorCode(map.floorCode);
                        // 다른 층의 시설을 고른 상태로 남기지 않는다.
                        setSelectedFacility(null);
                        // 다른 화면(U-07 등)이 보는 층 상태도 함께 맞춘다.
                        setFloor(map.floorCode as FloorId);
                      }}
                    >
                      {map.floorCode}
                    </button>
                  );
                })}
              </div>

              <div className={styles.facilityFilters} role="group" aria-label="시설 필터">
                {MAP_FILTERS.map((filter) => {
                  const active = facilityFilter === filter.facilityType;

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
                      onClick={() => {
                        setFacilityFilter(active ? null : filter.facilityType);
                        // 다른 유형으로 넘어가면 이전에 고른 시설의 이름표가 남지 않게 한다.
                        setSelectedFacility(null);
                      }}
                    >
                      <Icon name={filter.icon} size={14} />
                    </button>
                  );
                })}
              </div>

              {/* 현재 위치·방향·목적지·시설은 모두 IndoorMapView가 실제 좌표로 그린다.
                  퍼센트로 고정돼 있던 마커들을 남겨 두면 표시가 둘이 되어 어느 쪽이 실제인지
                  구분할 수 없다. */}
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
