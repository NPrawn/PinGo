import { Fragment, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FACILITY_MAP_FILTERS,
  facilityIconOf,
  useStationFacilities,
  type Facility,
} from '@/entities/facility';
import { floorCodeOf, floorIdOf, useStationFloorMaps } from '@/entities/floor-map';
import {
  routeBearingOf,
  routePathNodesOf,
  routeProgressOf,
  useNavigationStore,
  type IndoorPoint,
} from '@/entities/navigation';
import { routeOriginOf, routeUnavailableText, SEND_CURRENT_POSITION } from '@/entities/route';
import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import { createIndoorRoute } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import { localizeUserLabel } from '@/shared/lib/localizeUserLabel';
import type { FloorId, RouteUnavailableReason } from '@/shared/types';
import { Button, ButtonLink, Icon, MapPreview, Sheet } from '@/shared/ui';
import { stopCamera } from '@/widgets/camera-preview';
import { ViewfinderBack } from '@/widgets/capture-viewfinder';
import { IndoorMapView } from '@/widgets/indoor-map';
import { PhoneFrame } from '@/widgets/phone-frame';
import { useXrNavigationSession, XrSessionNotice, XrTrackingBadge } from '@/widgets/xr-navigation';
import styles from './NavigationPage.module.css';

/**
 * 지도 위 시설 필터.
 *
 * **기본은 표시 층의 시설을 모두 켠다.** 무엇이 어디에 있는지 먼저 보여 준 다음 유형으로
 * 좁히는 흐름이다. 아무것도 없는 지도에서 시작하면 사용자는 칩을 눌러 보기 전까지 이 지도가
 * 무엇을 알려 줄 수 있는지 알 수 없다.
 *
 * 대신 겹친다. 역삼역 B2는 실제 240m 폭이 이 지도에서 287px에 들어가 1m가 1.2px이고, 그 층
 * 시설 36개를 모두 그리면 마커 간 최소 간격이 3.9px이다. 훑어보는 용도이고, 하나를 고르려면
 * 유형을 켜야 한다 — 그러면 많아도 13개(계단)라 겹치지 않는다.
 *
 * 이름과 아이콘은 프로토타입(`#s-nav`)의 칩 다섯 개에서 출발했고, 각 칩이 실제
 * `facilityType`을 켜도록 연결했다. 에스컬레이터·계단은 역삼역에서 가장 많은 두 유형인데
 * (B1 기준 각각 10개·13개) 칩이 없어 지도에 한 번도 뜨지 않아 뒤에 붙였다.
 *
 * **표시 층에 없는 유형은 칩도 두지 않는다.** 역삼역 B3에는 승차권 충전기가 없는데 칩이 늘
 * 떠 있으면, 눌러서 아무것도 나오지 않는 것을 확인해야만 없다는 것을 알 수 있다. `platform`
 * 처럼 아직 시드되지 않은 유형도 같은 규칙으로 자연히 사라진다.
 */
const MAP_FILTERS = FACILITY_MAP_FILTERS;

/**
 * 카메라 화면의 문구. 화살표가 가리키는 방향을 말로 한 번 더 적는다.
 *
 * 아래 안내 카드의 문구(`25m 직진하세요`)와 겹치지 않게 **방향만** 말한다. 거리는 카드가, 방향은
 * 여기가 담당한다 — 같은 말을 두 곳에 쓰면 둘이 어긋날 여지만 생긴다.
 */
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
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'ko';
  const station = useStationStore((state) => state.station);
  /**
   * 확정된 역의 백엔드 id. 예전에는 이 화면이 `1`을 직접 적어 썼다.
   *
   * 등록되지 않은 역이면 null이다. 조회 훅은 양수가 아닌 id에서 요청을 걸지 않으므로
   * (`useStationFloorMaps`) 0으로 넘겨 조회를 끈다.
   */
  const stationId = useStationStore((state) => state.stationId);
  const setFloor = useStationStore((state) => state.setFloor);
  const destination =
    useNavigationStore((state) => state.destination) ?? t('user.navigation.defaultDestination');
  const route = useNavigationStore((state) => state.route);
  const currentNodeId = useNavigationStore((state) => state.currentNodeId);
  const targetNodeId = useNavigationStore((state) => state.targetNodeId);
  const targetExitLabel = useNavigationStore((state) => state.targetExitLabel);
  const currentLocationLabel = useNavigationStore((state) => state.currentLocationLabel);
  const displayedOrigin = localizeUserLabel(currentLocationLabel ?? station, language);
  const displayedDestination = localizeUserLabel(destination, language);
  const currentFloorId = useNavigationStore((state) => state.currentFloorId);
  const currentMapX = useNavigationStore((state) => state.currentMapX);
  const currentMapY = useNavigationStore((state) => state.currentMapY);
  const setTargetNode = useNavigationStore((state) => state.setTargetNode);
  const setRouteResult = useNavigationStore((state) => state.setRouteResult);
  const progressKey = useNavigationStore((state) => state.progressKey);
  const storedTravelledM = useNavigationStore((state) => state.travelledM);
  const setRouteProgress = useNavigationStore((state) => state.setRouteProgress);
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
  /**
   * 안내를 시작할 때의 출입구. 경로 옵션 화면이 유형별로 정해 스토어에 남긴 값이다.
   *
   * 예전에는 `route === 'elevator_only' ? '2번 출입구' : '7번 출입구'`로 적어 두었는데,
   * 지도에 그려지는 경로는 실제 도착 노드를 따라가므로 헤더와 지도가 서로 다른 곳을
   * 가리켰다.
   *
   * **진입 시점 값으로 고정한다.** 지도에서 시설을 새 목적지로 지정하면 스토어의 출구 정보가
   * 지워지는데, 되돌리기 버튼은 처음 출구로 돌아가는 수단이라 그 이름을 계속 알아야 한다.
   * `initialDestination`을 ref로 잡아 두는 것과 같은 이유다.
   */
  const [exit] = useState(() => targetExitLabel ?? t('user.navigation.defaultExit'));
  /** 되돌리기가 복원할 도착 노드. `exit`과 같은 이유로 진입 시점 값에 고정한다. */
  const [initialTarget] = useState(() => ({ nodeId: targetNodeId, label: targetExitLabel }));
  const initialDestination = useRef(destination);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  /**
   * 지도에 그릴 시설.
   *
   * - `all` — 표시 층의 시설 전부. 진입 시 기본값이다.
   * - `none` — 아무것도 그리지 않는다. 경로와 내 위치만 보려는 상태다.
   * - 그 외 — 그 `facilityType`만.
   *
   * 셋을 한 값에 담는다. `facilityType` 코드에 `all`·`none`이 없어(FACILITY_MAP_FILTERS)
   * 섞이지 않고, 상태 두 개로 나누면 "숨김인데 유형도 켜져 있는" 조합이 생긴다.
   */
  const [facilityView, setFacilityView] = useState<string>('all');
  const [activeDestination, setActiveDestination] = useState(exit);
  const [recalculated, setRecalculated] = useState(false);
  /**
   * 선택한 경로의 상세 안내. 출발·도착 노드가 모두 있어야 조회할 수 있다.
   *
   * **경유지가 키에 들어간다.** 예전에는 빠져 있어서, 경유지를 추가해도 같은 키의 응답을 그대로
   * 재사용했다. 요청에도 실리지 않았으니 서버는 애초에 최단 경로만 알고 있었고, 화면만
   * "경로 업데이트 완료"라고 적혀 있었다.
   *
   * **사용자 좌표는 지금 보내지 않는다.** 보내면 서버가 진입 노드를 다시 고르는데, 그 기준이 직선
   * 거리라 선로를 모른다 — B3 승강장에서 선로 건너편 계단이 뽑혀 관통하는 경로가 나왔다. 사유와
   * 되돌리는 방법은 `SEND_CURRENT_POSITION`에 적어 두었다.
   *
   * 배선은 남겨 둔다. 좌표는 선택 필드라 `enabled`에 넣지 않는다 — 좌표 정합이 없는 층(역삼역 B1)
   * 에서는 위치 인식이 좌표를 주지 못하는데, 조건에 넣으면 그 층에서 안내 자체를 받지 못한다.
   */
  const waypointNodeIds = waypoints.map((waypoint) => waypoint.nodeId);
  const origin = SEND_CURRENT_POSITION ? routeOriginOf(currentMapX, currentMapY) : null;
  const routeQuery = useQuery({
    queryKey: [
      'indoor-route',
      stationId,
      currentNodeId,
      targetNodeId,
      route,
      waypointNodeIds,
      /* 좌표가 바뀌면 서버가 진입 노드를 다시 골라 다른 경로가 나온다. 키에 없으면 재인식으로
         출발 노드가 그대로인 채 좌표만 바뀐 경우 옛 경로가 그대로 보인다. */
      origin?.currentMapX ?? null,
      origin?.currentMapY ?? null,
      language,
    ],
    queryFn: () =>
      createIndoorRoute({
        stationId: stationId!,
        startNodeId: currentNodeId!,
        targetNodeId: targetNodeId!,
        waypointNodeIds,
        routeType: route,
        language,
        ...(origin ?? {}),
      }),
    enabled: stationId != null && currentNodeId != null && targetNodeId != null,
    retry: false,
  });
  const routeResult = routeQuery.data;

  /**
   * 안내 진입 시점의 확정 실내 위치. 위치 인식(FR-U-004)이 앵커링해 준 좌표다.
   *
   * **첫 렌더 값에 고정한다.** 296 훅이 이 값을 진입 시점에 고정된 입력으로 다루므로(앵커가
   * 생긴 뒤 바꾸면 조용히 무시된다) 렌더마다 새 객체를 만들면 앵커 발화 effect가 불필요하게
   * 다시 돈다. 지연 초기화 `useState`를 쓰는 이유는 ref를 렌더 중에 읽지 않기 위해서다.
   *
   * 좌표 정합이 없는 층(역삼역 B1)은 위치 인식이 좌표를 주지 못해 null이다. 그때는 XR 앵커링
   * 없이 안내만 한다 — 훅이 null을 그대로 받는다.
   */
  const [confirmedLocation] = useState<IndoorPoint | null>(() =>
    currentFloorId != null && currentMapX != null && currentMapY != null
      ? { floorId: currentFloorId, mapX: currentMapX, mapY: currentMapY }
      : null,
  );

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
  } = useXrNavigationSession({
    currentIndoorLocation: confirmedLocation,
    /**
     * 앞 화면들이 켜 둔 카메라를 세션 직전에 반납한다. (11.8)
     *
     * 두 위젯을 잇는 자리가 화면이다 — 위젯끼리는 서로를 import하지 않는다.
     */
    releaseCamera: stopCamera,
  });

  /**
   * 층 탭. **목록을 지도 응답에서 만든다.** (S15P11A206-280)
   *
   * 프로토타입은 `1F·B1·B2·B3`를 하드코딩해 뒀는데, 역삼역에 등록된 지도는 B1·B2·B3 세 장이라
   * `1F`를 눌러도 보여줄 지도가 없었다. `floor_id`는 auto-increment라 코드↔id 매핑을 상수로
   * 두면 시드가 바뀔 때 조용히 어긋나므로 응답에서 찾는다.
   */
  const floorMapsQuery = useStationFloorMaps(stationId ?? 0);
  const floorMaps = floorMapsQuery.data ?? [];
  /** 사용자가 탭으로 고른 층. null이면 현재 위치를 따라간다. */
  const [pickedFloorCode, setPickedFloorCode] = useState<string | null>(null);
  const followedFloorId = currentLocation?.floorId ?? confirmedLocation?.floorId ?? 0;
  const displayedFloorId =
    (pickedFloorCode === null ? undefined : floorIdOf(floorMaps, pickedFloorCode)) ??
    followedFloorId;
  const displayedFloorCode = floorCodeOf(floorMaps, displayedFloorId);

  /**
   * 내가 있는 층으로 되돌린다. 지도의 `내 위치` 버튼이 부른다.
   *
   * 고른 층을 지우면 표시 층이 다시 현재 위치를 따라간다(`displayedFloorId`). 다른 화면이 보는
   * 층 상태도 층 버튼을 누를 때와 똑같이 맞춘다 — 여기서 빠뜨리면 지도만 내려오고 나머지
   * 화면은 아까 보던 층에 남는다.
   */
  const returnToMyFloor = () => {
    setPickedFloorCode(null);
    setSelectedFacility(null);

    const code = floorCodeOf(floorMaps, followedFloorId);
    if (code) setFloor(code as FloorId);
  };

  /**
   * 경로상 어디까지 왔는지. 안내 카드와 상세 경로가 이 값으로 현재 구간을 고른다.
   *
   * **진행 거리는 스토어에 둔다.** 뒤로 가지 않게 지금까지의 최대값을 들고 있어야 하는데, 렌더
   * 중에 ref를 읽거나 쓰는 것은 막혀 있고(`react-hooks/refs`) effect에서 상태를 갱신하는 것도
   * 막혀 있다(`set-state-in-effect`). 스토어 값은 렌더에서 그냥 읽으면 되므로 둘 다 피한다.
   *
   * 어느 경로의 진행도인지 열쇠로 함께 남긴다. 열쇠가 다르면 0부터 다시 센다 — 경로가 바뀔 때
   * 따로 지우지 않아도 지난 진행도가 새 경로에 섞이지 않는다.
   */
  const routeKey = [
    currentNodeId,
    targetNodeId,
    route,
    waypointNodeIds.join(','),
    /* 좌표도 경로를 바꾼다. 같은 출발 노드라도 좌표가 다르면 서버가 진입 노드를 다시 골라
       다른 경로가 오므로, 열쇠에 없으면 지난 경로의 진행 거리를 새 경로에 그대로 얹는다. */
    origin?.currentMapX ?? '',
    origin?.currentMapY ?? '',
  ].join('-');
  const pathNodes = routePathNodesOf(routeResult);
  const travelledM = progressKey === routeKey ? storedTravelledM : 0;
  const progress = routeProgressOf({
    pathNodes,
    steps: routeResult?.steps,
    currentLocation,
    travelledM,
  });

  useEffect(() => {
    if (progressKey !== routeKey || progress.travelledM > storedTravelledM) {
      setRouteProgress(routeKey, progress.travelledM);
    }
  }, [progressKey, routeKey, progress.travelledM, storedTravelledM, setRouteProgress]);

  /** 지금 안내할 구간. 예전에는 `steps[0]`에 고정돼 걸어도 안내가 넘어가지 않았다. */
  const activeStep =
    progress.currentStepIndex === null
      ? undefined
      : routeResult?.steps?.[progress.currentStepIndex];

  /**
   * 지금 걷고 있는 다리. **지나온 경유지 수가 곧 다리 번호다.**
   *
   * 지도가 이 값으로 다리마다 명도를 정한다 — 지나온 다리는 흐리게, 지금 다리는 진하게, 남은
   * 다리는 연하게. 예전에는 첫 다리를 늘 진하게 칠해서, 첫 경유지를 지나도 이미 지나온 구간이
   * 가장 눈에 띄고 정작 갈 길이 연했다.
   *
   * 경유지가 없으면 나눌 다리가 없고, 경로에서 벗어난 동안에는 어느 다리를 걷는지 말할 근거가
   * 없다. 둘 다 null이며 지도는 한 색으로 그린다.
   */
  const activeLeg =
    progress.offRoute || waypoints.length === 0
      ? null
      : waypointNodeIds.filter((nodeId) => progress.passedNodeIds.includes(nodeId)).length;

  /**
   * 카메라 화면의 큰 화살표가 가리킬 방향.
   *
   * **응답의 `steps[].turn`으로 대신할 수 없다.** 그 값은 앞 구간을 기준으로 한 네 방향이고
   * (S15P11A206-337) 여기 필요한 것은 **내가 지금 보고 있는 쪽**을 기준으로 몇 도 벌어졌는지다.
   * 서버는 사용자의 방향각을 모르므로 첫 단계의 `turn`은 아예 비어 있다. 그래서 경로 기하와 XR
   * 방향각으로 직접 구한다 — 다음 지점이 내가 보는 쪽에서 몇 도 벌어져 있는지다.
   *
   * 모르면 null이고, 그때는 화살표와 문구를 아예 그리지 않는다. 예전에는 위를 향한 화살표와
   * `정면 통로를 따라 직진하세요`가 **하드코딩**돼 있어, 좌회전해야 할 때도 계단을 타야 할 때도
   * 정면으로 걸으라고 말했다. 아래 카드는 실제 안내를 하고 있었으므로 한 화면에서 두 안내가
   * 서로 다른 말을 했다.
   */
  const bearing = routeBearingOf({
    pathNodes,
    currentLocation,
    headingDeg,
    travelledM: progress.travelledM,
  });
  /**
   * 층을 오르내리는 구간에서는 수평 방향을 그리지 않는다. 엘리베이터 앞에서 화살표가 통로를
   * 가리키면 그쪽으로 걷게 된다 — 가야 할 곳은 위층이다. 그 구간의 안내는 카드가 맡는다.
   */
  const verticalMove =
    activeStep?.moveType === 'elevator' ||
    activeStep?.moveType === 'stair' ||
    activeStep?.moveType === 'escalator';
  const camGuide =
    progress.offRoute || verticalMove || bearing === null
      ? null
      : {
          relativeDeg: bearing.relativeDeg,
          caption: t(`user.navigation.cameraDirection.${bearing.turn}`),
        };

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
  const exitsQuery = useStationFacilities(stationId ?? 0, { facilityType: 'exit' });
  const [pickedDestination, setPickedDestination] = useState<Facility | null>(null);
  const destinationFacility =
    pickedDestination ?? matchExitByName(exitsQuery.data ?? [], activeDestination);

  /**
   * 표시 층에 실제로 있는 시설 유형. 칩을 이걸로 추린다.
   *
   * 역 전체를 한 번 받아 층은 여기서 거른다. 지도 위젯이 유형 없이 그릴 때 쓰는 조회와 같은
   * 키라 요청은 한 번만 나가고, 층을 오갈 때 다시 받지 않아 칩이 깜빡이지 않는다.
   */
  const facilitiesQuery = useStationFacilities(stationId ?? 0);
  const facilitiesLoaded = facilitiesQuery.data !== undefined;
  const floorFacilityTypes = new Set(
    (facilitiesQuery.data ?? [])
      .filter((facility) => facility.floorId === displayedFloorId)
      .map((facility) => facility.facilityType),
  );
  const availableFilters = MAP_FILTERS.filter((filter) =>
    floorFacilityTypes.has(filter.facilityType),
  );

  /**
   * 실제로 적용할 표시 상태. 켜 둔 유형이 표시 층에 없으면 전체 표시로 친다.
   *
   * 고른 값 자체는 지우지 않는다. 계단을 켜 둔 채 계단이 없는 층을 잠깐 들렀다 돌아오면 다시
   * 계단이 켜진다 — 층을 넘길 때마다 고른 것이 사라지면 매번 다시 눌러야 한다.
   *
   * 숨김은 층과 무관하므로 그대로 둔다. 첫 조회가 끝나기 전에도 판단하지 않는다 — 빈 목록을
   * "그 층에 없다"로 읽으면 안 된다.
   */
  const effectiveView =
    facilityView !== 'all' &&
    facilityView !== 'none' &&
    facilitiesLoaded &&
    !floorFacilityTypes.has(facilityView)
      ? 'all'
      : facilityView;
  /** 위젯에 넘길 유형. 전부 보이거나 전부 감출 때는 유형이 없다. */
  const effectiveType = effectiveView === 'all' || effectiveView === 'none' ? null : effectiveView;

  /**
   * 안내 카드 문구.
   *
   * **경로를 모를 때 구체적인 지시를 쓰지 않는다.** 예전에는 조회를 걸 수 없는 상태에서
   * `직진 25m` · `개찰구를 지나 에스컬레이터 방향으로 이동`을 그대로 띄웠다. 프로토타입에서
   * 옮겨온 문구인데, 사용자는 그것을 실제 안내로 읽고 그 방향으로 걷는다.
   *
   * **`isPending`이 아니라 `isLoading`으로 로딩을 판단한다.** 출발·도착 노드가 없으면 훅이
   * 조회를 끄는데, 꺼진 쿼리는 `isPending`에 머무른다. 그것을 로딩으로 읽으면 카드가
   * `경로 계산 중`에서 영구히 멈춘다.
   */
  const instruction = ((): { eyebrow: string; title: string; meta: string } => {
    if (currentNodeId == null) {
      return {
        eyebrow: t('user.navigation.preparing'),
        title: t('user.navigation.confirmLocation'),
        meta: t('user.navigation.confirmLocationMeta'),
      };
    }
    if (targetNodeId == null) {
      return {
        eyebrow: t('user.navigation.preparing'),
        title: t('user.navigation.chooseDestination'),
        meta: t('user.navigation.chooseDestinationMeta'),
      };
    }
    if (routeQuery.isLoading) {
      return {
        eyebrow: t('user.navigation.calculating'),
        title: t('user.navigation.findingRoute'),
        meta: t('user.navigation.wait'),
      };
    }
    if (routeQuery.isError) {
      return {
        eyebrow: t('user.navigation.nextUnknown'),
        title: t('user.navigation.routeError'),
        meta: t('user.navigation.tryAgain'),
      };
    }
    if (routeResult && routeResult.available === false) {
      return {
        eyebrow: t('user.navigation.nextUnknown'),
        // 경유지를 넣은 뒤 막혔다면 원인은 그쪽일 가능성이 크다. 무엇을 되돌리면 되는지 알린다.
        title:
          waypoints.length > 0
            ? t('user.navigation.noWaypointRoute')
            : t('user.navigation.unavailableRoute'),
        meta:
          routeUnavailableText(
            (routeResult.unavailableReason ?? null) as RouteUnavailableReason | null,
            language,
          ) ??
          (waypoints.length > 0
            ? t('user.navigation.removeWaypointHint')
            : t('user.navigation.otherRouteHint')),
      };
    }
    if (!activeStep) {
      return {
        eyebrow: t('user.navigation.nextUnknown'),
        title: t('user.navigation.noSegment'),
        meta: t('user.navigation.samePoint'),
      };
    }

    const totalDistance = Math.round(routeResult?.totalDistanceM ?? 0);
    const totalMinutes = Math.max(1, Math.ceil((routeResult?.estimatedTimeSec ?? 0) / 60));
    /*
      현재 구간에서 **남은** 거리를 적는다. 구간 전체 길이를 적어 두면 그 구간을 절반 걸어도
      숫자가 그대로여서, 걷고 있는데 아무 일도 일어나지 않는 것처럼 보인다.

      위치를 모르거나 경로에서 벗어난 동안에는 구간 전체 길이로 돌아간다 — 진행도를 올리지
      않았으므로 남은 거리라고 말할 근거가 없다.
    */
    const nextDistance = progress.offRoute
      ? (activeStep.distanceM ?? 0)
      : (progress.stepRemainingM ?? activeStep.distanceM ?? 0);

    return {
      /*
        다시 계산하는 동안에만 그렇게 적는다. 예전에는 한 번 경유지를 건드리면 안내가 끝날
        때까지 `경로 업데이트 완료`에 머물러, 다음 지점까지 몇 미터인지가 영영 사라졌다.
      */
      eyebrow:
        recalculated && routeQuery.isFetching
          ? t('user.navigation.recalculating')
          : t('user.navigation.nextDistance', { distance: Math.round(nextDistance) }),
      title: activeStep.instruction ?? t('user.navigation.followRoute'),
      meta: t('user.navigation.total', { distance: totalDistance, minutes: totalMinutes }),
    };
  })();

  const destinationChanged = activeDestination !== exit;
  const selectedFacilityIsWaypoint = selectedFacility
    ? waypoints.some((waypoint) => waypoint.nodeId === selectedFacility.linkedNodeId)
    : false;
  const selectedFacilityIsDestination = selectedFacility
    ? selectedFacility.nameKo === activeDestination
    : false;
  const selectedFacilityName = selectedFacility
    ? language === 'en'
      ? selectedFacility.nameEn?.trim() || selectedFacility.nameKo
      : selectedFacility.nameKo
    : '';
  /**
   * 노드를 모르는 시설은 경유지가 될 수 없다.
   *
   * 경로는 노드로만 계산된다. 이름만 들고 추가하면 요청에 실을 것이 없어, 예전처럼 화면에만
   * 칩이 붙고 경로는 그대로인 상태로 돌아간다.
   */
  const selectedFacilityRoutable = selectedFacility?.linkedNodeId != null;

  useEffect(() => {
    if (routeResult) setRouteResult(routeResult);
  }, [routeResult, setRouteResult]);

  return (
    <PhoneFrame
      dark
      layout="flush"
      bodyClassName={styles.body}
      phoneClassName={styles.phone}
      reserveTopSpace={false}
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
            label={t('user.navigation.facilityRoute', { name: selectedFacilityName })}
            onDismiss={() => setSelectedFacility(null)}
          >
            <div className={styles.sheetHandle} aria-hidden />
            <div className={styles.sheetHead}>
              <span className={styles.sheetIcon}>
                <Icon name={facilityIconOf(selectedFacility.facilityType)} size={20} />
              </span>
              <div>
                <h2>{selectedFacilityName}</h2>
                {/* 목업이던 거리·층 설명 대신 응답에 있는 값을 쓴다. 거리는 경로 계산(297)이
                    붙으면 넣는다 — 지금 임의로 만들면 틀린 숫자를 보여주게 된다. */}
                <p>
                  {selectedFacility.isAccessible
                    ? t('user.navigation.accessible')
                    : t('user.navigation.mayHaveStairs')}
                </p>
              </div>
            </div>
            <p className={styles.sheetNote}>
              {t('user.navigation.waypointNote')}
            </p>
            <div className={styles.sheetActions}>
              <Button
                disabled={
                  waypoints.length >= 2 ||
                  selectedFacilityIsWaypoint ||
                  selectedFacilityIsDestination ||
                  !selectedFacilityRoutable
                }
                onClick={() => {
                  if (selectedFacilityIsWaypoint || selectedFacilityIsDestination) return;
                  if (selectedFacility.linkedNodeId == null) return;
                  addWaypoint({
                    nodeId: selectedFacility.linkedNodeId,
                    nameKo: selectedFacility.nameKo,
                  });
                  setRecalculated(true);
                  setSelectedFacility(null);
                }}
              >
                {selectedFacilityIsDestination
                  ? t('user.navigation.cannotAddDestination')
                  : selectedFacilityIsWaypoint
                    ? t('user.navigation.alreadyWaypoint')
                    : !selectedFacilityRoutable
                      ? t('user.navigation.notRoutable')
                      : waypoints.length >= 2
                        ? t('user.navigation.waypointLimit')
                        : t('user.navigation.addWaypoint')}
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
                  /**
                   * 도착 노드도 그 시설로 옮긴다.
                   *
                   * `setDestination`은 이름만 바꾸고 도착 노드를 비운다 — 이름과 노드가 다른
                   * 곳을 가리키는 것을 막기 위해서다. 여기서는 고른 시설의 노드를 알고 있으므로
                   * 곧바로 채워 경로를 다시 계산하게 한다. 비워 둔 채로 두면 안내 카드가
                   * "목적지를 선택해 주세요"로 돌아가 방금 고른 것이 무시된 것처럼 보인다.
                   */
                  if (selectedFacility.linkedNodeId != null) {
                    setTargetNode(selectedFacility.linkedNodeId, selectedFacility.nameKo);
                  }
                  setRecalculated(true);
                  setSelectedFacility(null);
                }}
              >
                {selectedFacilityIsWaypoint
                  ? t('user.navigation.registeredWaypoint')
                  : selectedFacilityIsDestination
                    ? t('user.navigation.currentDestination')
                    : t('user.navigation.setDestination')}
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
            aria-label={t('user.navigation.currentRoute')}
          >
            <div className={styles.routePoint}>
              <span className={styles.routeLabel}>
                <span className={styles.pointDot} aria-hidden />
                <small>{t('user.station.origin')}</small>
              </span>
              <strong>{displayedOrigin}</strong>
            </div>
            {waypoints.map((waypoint, index) => (
              <Fragment key={waypoint.nodeId}>
                <span className={styles.routeArrow} aria-hidden>
                  <Icon name="arrow-right" size={16} />
                </span>
                <div className={`${styles.routePoint} ${styles.waypointPoint}`}>
                  <button
                    type="button"
                    className={styles.removeWaypoint}
                    onClick={() => {
                      removeWaypoint(waypoint.nodeId);
                      setRecalculated(true);
                    }}
                    aria-label={t('user.navigation.removeWaypoint', { name: waypoint.nameKo })}
                    title={t('user.navigation.removeWaypoint', { name: waypoint.nameKo })}
                  >
                    ×
                  </button>
                  <span className={styles.routeLabel}>
                    <span className={`${styles.pointDot} ${styles.pointDotWaypoint}`} aria-hidden />
                    <small>{t('user.navigation.waypoint', { order: index + 1 })}</small>
                  </span>
                  <strong title={localizeUserLabel(waypoint.nameKo, language)}>
                    {localizeUserLabel(waypoint.nameKo, language)}
                  </strong>
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
                    // 처음 안내를 시작한 출구로 도착 노드도 함께 돌린다.
                    if (initialTarget.nodeId != null) {
                      setTargetNode(initialTarget.nodeId, initialTarget.label);
                    }
                    setRecalculated(true);
                  }}
                  aria-label={t('user.navigation.restoreDestination', { destination: exit })}
                  title={t('user.navigation.restoreDestinationTitle', { destination: exit })}
                >
                  <Icon name="refresh" size={10} />
                </button>
              )}
              <span className={styles.routeLabel}>
                <span className={`${styles.pointDot} ${styles.pointDotDestination}`} aria-hidden />
                <small>{t('user.station.destination')}</small>
              </span>
              <strong title={localizeUserLabel(activeDestination, language)}>
                {localizeUserLabel(activeDestination, language)}
              </strong>
            </div>
          </div>

          <div className={styles.instructionCard}>
            <span className={styles.instructionIcon}>
              <Icon name="arrow-right" size={16} className={styles.upArrow} />
            </span>
            <div className={styles.instructionBody}>
              <span className={styles.instructionEyebrow}>{instruction.eyebrow}</span>
              <strong className={styles.instructionTitle}>{instruction.title}</strong>
              <span className={styles.instructionMeta}>{instruction.meta}</span>
            </div>
          </div>
          {/* 방향을 알 때만 그린다. 모르는데 위를 향한 화살표를 두면 "정면"이라고 말하는 셈이다. */}
          {camGuide && (
            <>
              <div
                className={styles.arrow}
                style={{ transform: `rotate(${camGuide.relativeDeg}deg)` }}
                role="img"
                aria-label={camGuide.caption}
              >
                ↑
              </div>
              <div className={styles.camCaption}>{camGuide.caption}</div>
            </>
          )}
        </div>

        <div className={styles.lower}>
          <div className={styles.lowerBody}>
            <MapPreview className={styles.map}>
              {/* 실제 실내 지도(282). 목업 스키매틱 SVG가 있던 자리를 그대로 채운다.
                  현재 위치 마커는 이 컴포넌트가 그린다 — 296 훅이 준 캐노니컬 미터 좌표를
                  넘기면 프레임 변환(meterToPixel)은 그쪽이 한다. 여기서 좌표를 가공하지 않는다.

                  표시 층은 현재 위치를 따라가고, 층 버튼이 바꾼다.

                  목업을 끊었다. 도면 이미지는 목업·실제 모두 mapUrl이 null이라 같은 번들
                  평면도로 떨어지므로 보이는 그림은 그대로이고, 좌표 프레임만 응답의 것을
                  쓴다. 이 화면이 목업에 기대던 마지막 하나가 경로선이었다. */}
              <div className={styles.mapCanvas}>
                <IndoorMapView
                  stationId={stationId ?? 0}
                  floorId={displayedFloorId}
                  currentLocation={currentLocation}
                  currentHeadingDeg={headingDeg}
                  /* 길안내 화면이므로 시점이 내 위치를 따라간다. 밀거나 확대하면 풀리고
                     `내 위치` 버튼으로 돌아온다. */
                  followCamera
                  /* 층은 이 화면이 들고 있다. 시점만 되돌리면 다른 층을 보던 사용자는 그 층
                     지도가 자기 좌표로 옮겨진 것만 보고, 마커는 다른 층이라 그려지지 않는다. */
                  onRecenter={returnToMyFloor}
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
                    (effectiveType == null || effectiveType === 'exit') &&
                    destinationFacility !== null
                      ? localizeUserLabel(destinationFacility.nameKo, language)
                      : null
                  }
                  /* 실제로 안내 중인 경로를 그린다. 조회 전이거나 실패하면 빈 배열이라
                     선이 그려지지 않는다 — 예전에는 이 자리를 목업이 채워, 사용자가 가지도
                     않을 B3 승강장 → 3번출구 경로가 늘 그려져 있었다. */
                  pathNodes={routePathNodesOf(routeResult)}
                  /* 다리별 색과 번호 핀에 쓰인다. 겹치는 복도에서 순서를 알려주는 것이 이 번호다. */
                  waypointNodeIds={waypointNodeIds}
                  /* 지나온 다리는 흐리게, 지금 다리는 진하게, 남은 다리는 연하게 그린다. */
                  activeLeg={activeLeg}
                  /* 내 점과 경로 사이의 빈 자리를 잇는다.

                     **경로에서 벗어난 동안에도 잇는다.** 처음에는 이탈이면 끊었는데, 그러면 정작
                     필요한 자리에서 사라졌다 — 서버가 진입 노드를 목적지 기준으로 다시 고르면
                     (S15P11A206-337) 그 노드가 수십 m 떨어질 수 있고, 그 층에 남는 경로 노드가
                     그것 하나뿐이면 이탈로 판정되어 지도가 통째로 비었다. 역삼역 B3 복도(노드 209)
                     에서 2번 출구로 갈 때 실제로 그랬다.

                     벗어난 자리에서 가장 가까운 경로 지점으로 이어 주는 것이 필요한 안내다.
                     아무것도 그리지 않으면 사용자는 자기 층에 경로가 없다고 읽는다. */
                  connectCurrentToRoute
                  facilityType={effectiveType}
                  /* 유형을 고르기 전에는 그 층 시설을 모두 보여 준다. 숨김이면 둘 다 꺼져
                     아무 시설도 그리지 않는다. */
                  showAllFacilities={effectiveView === 'all'}
                  selectedFacilityId={selectedFacility?.facilityId}
                  onSelectFacility={setSelectedFacility}
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
                aria-label={t('user.navigation.relocalize')}
                onClick={() => {
                  beginRelocalize();
                  navigate(USER_ROUTES.CAPTURE_PORTRAIT);
                }}
              >
                <Icon name="refresh" size={14} />
                {t('user.navigation.relocalizeShort')}
              </button>

              <div className={styles.floorButtons} role="group" aria-label={t('user.navigation.floorSelect')}>
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

              {/* 표시 층에 있는 유형만 둔다. 눌러서 아무것도 안 나오는 칩은 두지 않는다. */}
              <div className={styles.facilityFilters} role="group" aria-label={t('user.navigation.facilityFilter')}>
                {availableFilters.map((filter) => {
                  const active = effectiveView === filter.facilityType;

                  return (
                    <button
                      key={filter.name}
                      type="button"
                      className={[styles.facilityFilter, active && styles.facilityFilterOn]
                        .filter(Boolean)
                        .join(' ')}
                      aria-label={t(active ? 'user.navigation.filterOff' : 'user.navigation.filterOn', { name: filter.name })}
                      aria-pressed={active}
                      title={filter.name}
                      onClick={() => {
                        // 켜 둔 것을 다시 누르면 전체 표시로 돌아간다.
                        setFacilityView(active ? 'all' : filter.facilityType);
                        // 다른 유형으로 넘어가면 이전에 고른 시설의 이름표가 남지 않게 한다.
                        setSelectedFacility(null);
                      }}
                    >
                      <Icon name={filter.icon} size={14} />
                    </button>
                  );
                })}

                {/*
                  전부 감추기.

                  유형 칩만으로는 시설을 하나도 없는 상태로 만들 수 없다. 다시 누르면 전체
                  표시로 돌아온다 — 켠 뒤 되돌릴 방법이 없으면 감추기를 누르기 망설이게 된다.

                  목적지·내 위치·경로는 그대로 둔다. 안내에 필요한 표시까지 사라지면 지도가
                  길을 알려 주지 못한다.
                */}
                <button
                  type="button"
                  className={[
                    styles.facilityFilter,
                    effectiveView === 'none' && styles.facilityFilterOn,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={
                    effectiveView === 'none' ? t('user.navigation.showFacilities') : t('user.navigation.hideFacilities')
                  }
                  aria-pressed={effectiveView === 'none'}
                  title={effectiveView === 'none' ? t('user.navigation.showFacilities') : t('user.navigation.hideFacilities')}
                  onClick={() => {
                    setFacilityView(effectiveView === 'none' ? 'all' : 'none');
                    setSelectedFacility(null);
                  }}
                >
                  <Icon name={effectiveView === 'none' ? 'eye' : 'eye-off'} size={14} />
                </button>
              </div>

              {/* 현재 위치·방향·목적지·시설은 모두 IndoorMapView가 실제 좌표로 그린다.
                  퍼센트로 고정돼 있던 마커들을 남겨 두면 표시가 둘이 되어 어느 쪽이 실제인지
                  구분할 수 없다. */}
            </MapPreview>

            <div className={styles.mapLegend}>
              <span>{t('user.navigation.mapHint')}</span>
              <strong>{waypoints.length}/2</strong>
            </div>

            {stepsOpen && (
              <div className={styles.steps}>
                {routeResult?.steps?.map((step, index) => {
                  /*
                    지나온 구간은 지우지 않고 흐리게 둔다. 지워 버리면 목록이 짧아지면서 남은
                    구간이 위로 튀어 올라, 방금 읽던 줄이 어디로 갔는지 알 수 없다. 흐린 줄로
                    남기면 어디까지 왔는지도 함께 보인다.

                    경로에서 벗어난 동안에는 아무 줄도 강조하지 않는다. 진행도를 올리지 않았으므로
                    어느 구간에 있다고 말할 근거가 없고, 틀린 줄을 강조하면 그것을 따라 걷는다.
                  */
                  const active = !progress.offRoute && index === progress.currentStepIndex;
                  const passed =
                    !progress.offRoute &&
                    progress.currentStepIndex !== null &&
                    index < progress.currentStepIndex;

                  return (
                    <div
                      key={`${step.order}-${step.fromNodeId}-${step.toNodeId}`}
                      className={[styles.step, passed && styles.stepPassed, active && styles.stepOn]
                        .filter(Boolean)
                        .join(' ')}
                      aria-current={active ? 'step' : undefined}
                    >
                      <span className={styles.stepIcon}>
                        {passed ? <Icon name="check" size={13} /> : '↑'}
                      </span>
                      <b>{step.instruction ?? step.moveType ?? t('user.navigation.move')}</b>
                      <span>
                        {t('user.navigation.stepMeta', {
                          distance: Math.round(step.distanceM ?? 0),
                          minutes: Math.max(1, Math.ceil((step.estimatedTimeSec ?? 0) / 60)),
                        })}
                      </span>
                    </div>
                  );
                })}
                {waypoints.map((waypoint, index) => {
                  // 지나온 경유지도 흐리게 둔다. 지도의 번호 핀과 같은 순서다.
                  const passed = progress.passedNodeIds.includes(waypoint.nodeId);

                  return (
                    <div
                      key={waypoint.nodeId}
                      className={[styles.step, passed && styles.stepPassed]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span className={styles.stepIcon}>
                        {passed ? <Icon name="check" size={13} /> : <Icon name="pin" size={14} />}
                      </span>
                      <b>{waypoint.nameKo}</b>
                      <span>{t('user.navigation.waypoint', { order: index + 1 })}</span>
                    </div>
                  );
                })}
                <div className={styles.step}>
                  <span className={styles.stepIcon}>
                    <Icon name="flag" size={14} />
                  </span>
                  <b>{t('user.navigation.arriveExit', { exit })}</b>
                  <span>{t('user.navigation.toward', { destination: displayedDestination })}</span>
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
                {t('user.navigation.details')}
              </Button>
              <ButtonLink to={USER_ROUTES.ARRIVAL} size="sm" className={styles.action}>
                {t('user.navigation.arrived')}
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
