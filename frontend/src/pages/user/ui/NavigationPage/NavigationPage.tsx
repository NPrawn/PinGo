import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FACILITY_MAP_FILTERS,
  destinationFacilityOf,
  facilityAtNodeMatchingLabel,
  facilityIconOf,
  localizedFacilityNameAtNode,
  localizedFacilityNameOf,
  useStationFacilities,
  type Facility,
} from '@/entities/facility';
import {
  floorCodeAfterDelta,
  floorCodeOf,
  floorIdOf,
  useStationFloorMaps,
} from '@/entities/floor-map';
import {
  carriesDistance,
  instructionAt,
  routeBearingOf,
  xrDistanceScaleOf,
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
import { localizedLocationLabelOf } from '@/shared/lib/localizedLocationLabel';
import { localizeUserLabel } from '@/shared/lib/localizeUserLabel';
import { localizedNameOf, useApiLanguage } from '@/shared/i18n';
import type { FloorId, RouteUnavailableReason } from '@/shared/types';
import { Button, ButtonLink, Icon, MapPreview, Sheet, Toggle } from '@/shared/ui';
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
 * 초를 분으로. **모르면 `null`이고, 모른다고 말한다.**
 *
 * 예전에는 `Math.max(1, Math.ceil((sec ?? 0) / 60))`으로 적어 두어서, 시간을 모르는 경우가
 * 자신 있는 `약 1분`이 됐다. 서버는 경로상 간선 하나라도 예상 시간이 없으면 그 구간과 총
 * 시간을 null로 내려보내므로(`RoutePath`), 간선 하나가 비어 있을 뿐인데 전체 경로가 1분으로
 * 보였다. 안내에서 시간을 짧게 말하는 것은 사용자가 열차를 놓치게 만든다. (S15P11A206-339)
 *
 * 0초는 0분이 아니라 1분으로 올린다. `약 0분`은 도착했다는 뜻으로 읽힌다.
 */
function minutesOf(seconds: number | null | undefined): number | null {
  if (seconds == null) return null;
  return Math.max(1, Math.ceil(seconds / 60));
}

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
  const { t } = useTranslation();
  const language = useApiLanguage();
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
  const destinationNameKo = useNavigationStore((state) => state.destinationNameKo);
  const destinationNameEn = useNavigationStore((state) => state.destinationNameEn);
  const destinationId = useNavigationStore((state) => state.destinationId);
  const destinationType = useNavigationStore((state) => state.destinationType);
  const route = useNavigationStore((state) => state.route);
  const currentNodeId = useNavigationStore((state) => state.currentNodeId);
  const targetNodeId = useNavigationStore((state) => state.targetNodeId);
  const targetExitLabel = useNavigationStore((state) => state.targetExitLabel);
  const currentLocationLabel = useNavigationStore((state) => state.currentLocationLabel);
  const currentLocationLabelEn = useNavigationStore((state) => state.currentLocationLabelEn);
  const currentFloorId = useNavigationStore((state) => state.currentFloorId);
  const currentMapX = useNavigationStore((state) => state.currentMapX);
  const currentMapY = useNavigationStore((state) => state.currentMapY);
  const currentForwardMap = useNavigationStore((state) => state.currentForwardMap);
  const setTargetNode = useNavigationStore((state) => state.setTargetNode);
  const setCurrentLocation = useNavigationStore((state) => state.setCurrentLocation);
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
  const initialDestination = useRef({
    label: destination,
    nameKo: destinationNameKo,
    nameEn: destinationNameEn,
    id: useNavigationStore.getState().destinationId,
    type: useNavigationStore.getState().destinationType,
  });
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
  /**
   * 세부 안내 문장을 쓸 언어.
   *
   * `instruction`은 서버가 조립하는 문장이라(`RouteInstructionWriter`) 이 값이 곧 안내 언어다.
   * 보내지 않으면 백엔드가 `Language.DEFAULT`(=EN)로 떨어져, 한국어를 골라도 "Go straight"가
   * 나온다. 조회 키에도 넣어야 언어를 바꿀 때 새로 받는다. (S15P11A206-339)
   */
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
   * **좌표가 같은 동안 같은 객체여야 한다.** 296 훅이 이 값을 앵커 발화 effect의 입력으로 쓰므로,
   * 렌더마다 새 객체를 만들면 좌표가 그대로인데도 effect가 다시 돈다. 그것을 막는 것이 목적이다.
   *
   * 값 자체를 첫 렌더에 **고정하지는 않는다.** 예전에는 `useState`로 얼려 뒀는데 그럴 이유가 없다 —
   * 앵커가 생긴 뒤에는 훅이 이 값의 변화를 어차피 무시하고(그래서 실기기 동작은 같다), 앵커가 없는
   * 동안에는 훅이 이 값을 그대로 현재 위치로 돌려주므로 얼려 두면 스토어와 화면이 어긋난다.
   * 얼려 둔 탓에 개발 도구로 위치를 옮겨도 마커가 그 자리에 남아 새로고침해야 했다.
   *
   * 안내 중에 이 값이 바뀌는 경로는 실기기에 없다. 재인식은 U-04·U-05를 거쳐 오므로 이 화면이
   * 다시 마운트된다.
   *
   * 좌표 정합이 없는 층(역삼역 B1)은 위치 인식이 좌표를 주지 못해 null이다. 그때는 XR 앵커링
   * 없이 안내만 한다 — 훅이 null을 그대로 받는다.
   */
  const confirmedLocation = useMemo<IndoorPoint | null>(
    () =>
      currentFloorId != null && currentMapX != null && currentMapY != null
        ? { floorId: currentFloorId, mapX: currentMapX, mapY: currentMapY }
        : null,
    [currentFloorId, currentMapX, currentMapY],
  );
  const [confirmedForwardMap] = useState(() => currentForwardMap);
  const xrDistanceScale = xrDistanceScaleOf(routeResult, confirmedLocation?.floorId);

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
    anchorForwardMap: confirmedForwardMap,
    distanceScale: xrDistanceScale,
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
  const [snapToRoute, setSnapToRoute] = useState(true);
  const progress = routeProgressOf({
    pathNodes,
    steps: routeResult?.steps,
    currentLocation,
    travelledM,
    snapToRoute,
  });

  useEffect(() => {
    if (progressKey !== routeKey || progress.travelledM > storedTravelledM) {
      setRouteProgress(routeKey, progress.travelledM);
    }
  }, [progressKey, routeKey, progress.travelledM, storedTravelledM, setRouteProgress]);

  /** 상세 경로의 스크롤 칸과 지금 걷는 줄. 아래 effect가 둘을 맞춰 놓는다. */
  const stepsListRef = useRef<HTMLDivElement | null>(null);
  const activeStepRef = useRef<HTMLDivElement | null>(null);

  /**
   * 지금 걷는 구간을 보이는 칸의 맨 위로 올린다. (S15P11A206-206)
   *
   * 칸이 150px이라 두 줄 반만 보인다. 걸어가면 강조된 줄이 아래로 내려가다 칸 밖으로 나가고,
   * 그러면 목록에 남는 것은 이미 지나온 구간뿐이다 — 정작 지금 무엇을 해야 하는지가 화면에서
   * 사라진다. 사용자는 목록을 직접 굴려 찾아야 했다.
   *
   * **맨 위에 붙인다.** 가운데에 두면 위쪽 절반을 지나온 구간이 차지하는데, 걷는 사람에게 필요한
   * 것은 앞으로 갈 구간이다. 지도의 시점 추종이 내 위치를 화면 아래쪽에 두는 것과 같은 이유다.
   *
   * 부드럽게 움직이는 것은 CSS(`scroll-behavior`)에 맡긴다. 여기서 `scrollTo`에 옵션을 주면
   * jsdom이 구현하지 않아 테스트마다 경고가 쌓인다.
   */
  useEffect(() => {
    const list = stepsListRef.current;
    const active = activeStepRef.current;

    /*
      경로에서 벗어난 동안에는 강조된 줄이 없다. 그때 옛 줄로 끌어당기면, 이탈해서 아무 줄도
      강조되지 않은 목록이 엉뚱한 자리에 멈춰 선다.
    */
    if (!list || !active || progress.offRoute) return;

    // `.steps`가 `position: relative`라 이 값이 곧 스크롤 좌표다.
    list.scrollTop = active.offsetTop;
  }, [progress.currentStepIndex, progress.offRoute, stepsOpen]);

  /** 지금 안내할 구간. 예전에는 `steps[0]`에 고정돼 걸어도 안내가 넘어가지 않았다. */
  const activeStep =
    progress.currentStepIndex === null
      ? undefined
      : routeResult?.steps?.[progress.currentStepIndex];
  const floorTransitionPreview = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('floor-transition')
    : null;
  const previewTransition =
    floorTransitionPreview === 'up'
      ? {
          key: 'preview-up',
          floorDelta: 1,
          floorCode: 'B1',
        }
      : floorTransitionPreview === 'down'
        ? {
            key: 'preview-down',
            floorDelta: -1,
            floorCode: 'B3',
          }
        : null;
  const verticalStepKey =
    previewTransition?.key ??
    (activeStep?.floorDelta != null && activeStep.floorDelta !== 0
      ? `${progress.currentStepIndex}-${activeStep.fromNodeId}-${activeStep.toNodeId}`
      : null);
  const [completedVerticalStepKey, setCompletedVerticalStepKey] = useState<string | null>(null);
  const [previousVerticalStepKey, setPreviousVerticalStepKey] = useState(verticalStepKey);

  if (previousVerticalStepKey !== verticalStepKey) {
    setPreviousVerticalStepKey(verticalStepKey);
    if (verticalStepKey === null && completedVerticalStepKey !== null) {
      setCompletedVerticalStepKey(null);
    }
  }

  const verticalDestination =
    verticalStepKey === null
      ? null
      : (pathNodes.find((node) => node.nodeId === activeStep?.toNodeId) ?? null);
  const verticalDestinationFloorCode = verticalDestination
    ? floorCodeOf(floorMaps, verticalDestination.floorId)
    : null;
  const transitionFloorDelta = previewTransition?.floorDelta ?? activeStep?.floorDelta ?? 0;
  const transitionFloorCode =
    previewTransition?.floorCode ??
    verticalDestinationFloorCode ??
    ((currentLocation?.floorId ?? currentFloorId) == null
      ? undefined
      : floorCodeAfterDelta(
          floorMaps,
          currentLocation?.floorId ?? currentFloorId ?? 0,
          transitionFloorDelta,
        ));
  const transitionInstruction = transitionFloorCode
    ? t(
        transitionFloorDelta > 0
          ? 'user.navigation.floorTransition.moveUp'
          : 'user.navigation.floorTransition.moveDown',
        { floor: transitionFloorCode },
      )
    : activeStep?.instruction;

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
  const showFloorTransition =
    !isNoticeOpen &&
    (previewTransition !== null || verticalMove) &&
    verticalStepKey !== null &&
    completedVerticalStepKey !== verticalStepKey;
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
   * TODO(297): 이름 대조는 **라벨에만** 남았다. 마커 좌표는 `destinationPoint`가 경로 응답에서
   * 가져온다. 응답이 목적지 이름을 함께 실어 주면 이 조회를 지울 수 있다.
   */
  const exitsQuery = useStationFacilities(stationId ?? 0, { facilityType: 'exit' });
  const [pickedDestination, setPickedDestination] = useState<Facility | null>(null);
  const matchedExitDestination = matchExitByName(exitsQuery.data ?? [], activeDestination);

  /**
   * 표시 층에 실제로 있는 시설 유형. 칩을 이걸로 추린다.
   *
   * 역 전체를 한 번 받아 층은 여기서 거른다. 지도 위젯이 유형 없이 그릴 때 쓰는 조회와 같은
   * 키라 요청은 한 번만 나가고, 층을 오갈 때 다시 받지 않아 칩이 깜빡이지 않는다.
   */
  const facilitiesQuery = useStationFacilities(stationId ?? 0);
  const facilitiesLoaded = facilitiesQuery.data !== undefined;
  const nodeDestinationFacility = destinationFacilityOf(
    facilitiesQuery.data,
    destinationType?.toLowerCase() === 'facility' ? destinationId : null,
    targetNodeId,
    activeDestination,
    destinationNameKo,
    destinationNameEn,
  );
  const storedDestinationFacility = pickedDestination ?? nodeDestinationFacility;
  const destinationFacility = storedDestinationFacility ?? matchedExitDestination ?? null;

  /**
   * 목적지 시설이 경로 응답의 도착 노드와 다를 때만 실제 경로 끝에 마커를 둔다.
   * 시설이 선언된 뒤 계산해야 목적지 좌표와 경로 끝의 불일치를 처리할 수 있다.
   */
  const arrivedAtAnotherNode =
    routeResult?.targetNodeId != null &&
    destinationFacility?.linkedNodeId != null &&
    routeResult.targetNodeId !== destinationFacility.linkedNodeId;
  const lastPathNode = pathNodes.length > 0 ? pathNodes[pathNodes.length - 1] : null;
  const destinationPoint: IndoorPoint | null =
    arrivedAtAnotherNode && lastPathNode
      ? { floorId: lastPathNode.floorId, mapX: lastPathNode.mapX, mapY: lastPathNode.mapY }
      : destinationFacility
        ? {
            floorId: destinationFacility.floorId,
            mapX: destinationFacility.mapX,
            mapY: destinationFacility.mapY,
          }
        : null;
  const facilityOrigin = localizedFacilityNameAtNode(
    facilitiesQuery.data,
    currentNodeId,
    language,
    currentLocationLabel ?? station,
  );
  const displayedOrigin = localizedLocationLabelOf(
    currentLocationLabel,
    currentLocationLabelEn,
    language,
    facilityOrigin,
  );
  const displayedDestination = storedDestinationFacility
    ? localizedFacilityNameOf(storedDestinationFacility, language)
    : (localizedNameOf(language, destinationNameKo, destinationNameEn) ??
      localizeUserLabel(destination, language));
  const initialDestinationFacility = facilityAtNodeMatchingLabel(
    facilitiesQuery.data,
    initialTarget.nodeId,
    exit,
  );
  const initialDestinationLabel = initialDestinationFacility
    ? localizedFacilityNameOf(initialDestinationFacility, language)
    : localizeUserLabel(exit, language);
  const activeDestinationLabel =
    language === 'en' && destinationFacility
      ? localizedFacilityNameOf(destinationFacility, language)
      : localizeUserLabel(activeDestination, language);
  const waypointName = (waypoint: (typeof waypoints)[number]) => {
    if (language !== 'en') return waypoint.nameKo;

    const facilityNameEn = (facilitiesQuery.data ?? []).find(
      (facility) => facility.linkedNodeId === waypoint.nodeId,
    )?.nameEn;
    return facilityNameEn?.trim() || localizeUserLabel(waypoint.nameKo, language);
  };
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
  const instruction = ((): { eyebrow?: string; title: string; meta: string } => {
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
            language === 'en' ? 'en' : 'ko',
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
    /*
      시간을 모르면 말하지 않는다.

      `?? 0`으로 채우면 `Math.max(1, 0)`이 되어 **모르는 것이 "약 1분"으로 단언된다.** 서버는
      경로상 간선 하나라도 예상 시간이 없으면 총 시간을 null로 내려보내므로(`RoutePath`),
      간선 하나가 비어 있을 뿐인데 전체 경로가 1분으로 보였다.
    */
    const totalMinutes = minutesOf(routeResult?.estimatedTimeSec);
    /*
      현재 구간에서 **남은** 거리를 적는다. 구간 전체 길이를 적어 두면 그 구간을 절반 걸어도
      숫자가 그대로여서, 걷고 있는데 아무 일도 일어나지 않는 것처럼 보인다.

      위치를 모르거나 경로에서 벗어난 동안에는 구간 전체 길이로 돌아간다 — 진행도를 올리지
      않았으므로 남은 거리라고 말할 근거가 없다.
    */
    const nextDistance = progress.offRoute
      ? (activeStep.distanceM ?? 0)
      : (progress.stepRemainingM ?? activeStep.distanceM ?? 0);
    /** 보여줄 문장이 있는지. 없으면 거리를 채울 것도 없다. */
    const hasInstruction = activeStep.instructionTemplate != null || activeStep.instruction != null;

    return {
      /*
        다시 계산하는 동안에만 그렇게 적는다. 예전에는 한 번 경유지를 건드리면 안내가 끝날
        때까지 `경로 업데이트 완료`에 머물러, 다음 지점까지 몇 미터인지가 영영 사라졌다.

        **문장이 거리를 품으면 이 줄을 두지 않는다.** (S15P11A206-206)

        `24m 직진하세요` 위에 `다음 안내 · 24m`이 붙어 같은 숫자가 두 번 나왔다. 상세 경로는
        이미 같은 규칙으로 그린다 — 문장이 거리를 품는 구간은 문장 안에만, 품지 않는 구간
        (층 이동·개찰구)은 따로 적는다(`carriesDistance`). 카드에는 따로 적을 칸이 없으므로
        그 자리를 이 줄이 맡는다.

        그래서 엘리베이터·계단 구간에서는 남는다. 거기서는 중복이 아니라 카드의 유일한 거리
        표시다 — 지우면 몇 m 뒤에 타야 하는지가 화면에서 사라진다.
      */
      eyebrow:
        recalculated && routeQuery.isFetching
          ? t('user.navigation.recalculating')
          : carriesDistance(activeStep)
            ? undefined
            : t('user.navigation.nextDistance', { distance: Math.round(nextDistance) }),
      /*
        **문장에 남은 거리를 채워 넣는다.** (S15P11A206-206)

        예전에는 `activeStep.instruction`을 그대로 썼다. 그 문장에는 구간 전체 길이가 박혀 있어
        (`instructionAt` 주석) 아래 상세 경로가 같은 구간을 남은 거리로 다시 쓰는 것과 어긋났다 —
        한 화면에서 카드는 `32m 직진하세요`, 목록은 `24m 직진하세요`였다. 어느 쪽을 믿어야 하는지
        알 수 없고, 카드 쪽 숫자는 걸어도 줄지 않으므로 틀린 쪽이 카드다.

        위 `nextDistance`를 그대로 넘긴다. 상세 경로의 강조된 줄도 같은 값을 쓰므로 둘이 반드시
        같은 문장이 된다.

        문장이 아예 없을 때만 번역된 대체 문구로 간다. `instructionAt`의 마지막 수단은
        `moveType`(`walkway` 같은 원본 코드)이라 사용자에게 보일 말이 아니다.
      */
      title: hasInstruction
        ? instructionAt(activeStep, nextDistance)
        : t('user.navigation.followRoute'),
      meta:
        totalMinutes === null
          ? t('user.navigation.totalDistance', { distance: totalDistance })
          : t('user.navigation.total', { distance: totalDistance, minutes: totalMinutes }),
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
                    aria-label={t('user.navigation.removeWaypoint', {
                      name: waypointName(waypoint),
                    })}
                    title={t('user.navigation.removeWaypoint', {
                      name: waypointName(waypoint),
                    })}
                  >
                    ×
                  </button>
                  <span className={styles.routeLabel}>
                    <span className={`${styles.pointDot} ${styles.pointDotWaypoint}`} aria-hidden />
                    <small>{t('user.navigation.waypoint', { order: index + 1 })}</small>
                  </span>
                  <strong title={waypointName(waypoint)}>{waypointName(waypoint)}</strong>
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
                    setDestination(initialDestination.current.label, {
                      destinationId: initialDestination.current.id ?? undefined,
                      destinationType: initialDestination.current.type ?? undefined,
                      targetNodeId: initialTarget.nodeId ?? undefined,
                      destinationNameKo: initialDestination.current.nameKo ?? undefined,
                      destinationNameEn: initialDestination.current.nameEn,
                    });
                    setActiveDestination(exit);
                    setPickedDestination(null);
                    // 처음 안내를 시작한 출구로 도착 노드도 함께 돌린다.
                    if (initialTarget.nodeId != null) {
                      setTargetNode(initialTarget.nodeId, initialTarget.label);
                    }
                    setRecalculated(true);
                  }}
                  aria-label={t('user.navigation.restoreDestination', {
                    destination: initialDestinationLabel,
                  })}
                  title={t('user.navigation.restoreDestinationTitle', {
                    destination: initialDestinationLabel,
                  })}
                >
                  <Icon name="refresh" size={10} />
                </button>
              )}
              <span className={styles.routeLabel}>
                <span className={`${styles.pointDot} ${styles.pointDotDestination}`} aria-hidden />
                <small>{t('user.station.destination')}</small>
              </span>
              <strong title={activeDestinationLabel}>{activeDestinationLabel}</strong>
            </div>
          </div>

          {/*
            U-10의 "현재 위치 다시 촬영". 주변을 다시 촬영해 위치를 새로 확정하는 흐름이므로
            U-04로 나간다(화면 정의서 U-10 사용자 액션).

            **지도가 아니라 카메라 화면 아래쪽에 둔다.** 지도 위에 있으면 도면을 가리고
            `내 위치`·시설 숨기기와 같은 모서리를 다툰다. 상단 바에 두면 뒤로·추적 배지·상담과
            네 개가 한 줄에 몰려 좁은 화면에서 서로 붙는다. (S15P11A206-206)

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

          <div className={styles.instructionCard}>
            <span className={styles.instructionIcon}>
              <Icon name="arrow-right" size={16} className={styles.upArrow} />
            </span>
            <div className={styles.instructionBody}>
              {/* 문장이 이미 거리를 말하는 구간에는 이 줄이 없다. 빈 span을 남기면 그만큼 자리를
                  차지해 제목이 아래로 밀린다. */}
              {instruction.eyebrow !== undefined && (
                <span className={styles.instructionEyebrow}>{instruction.eyebrow}</span>
              )}
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
                <div className={styles.routeSnapControl}>
                  <span>{snapToRoute ? '경로 위 표시' : '원본 위치 표시'}</span>
                  <Toggle
                    checked={snapToRoute}
                    label="경로 위 위치 표시"
                    onCheckedChange={setSnapToRoute}
                  />
                </div>
                <IndoorMapView
                  stationId={stationId ?? 0}
                  floorId={displayedFloorId}
                  /* 경로 위에 얹은 자리로 그린다.

                     측위 오차는 복도 폭과 비슷한 규모라(B2 0.5m·B3 1.1m, 최대 2.9m) 날것의
                     좌표를 그대로 찍으면 내 점이 늘 경로선 옆에 떨어져 앉는다. 거기에 경로까지
                     잇는 선이 붙으면 한 점에서 선이 둘로 갈라져 갈림길처럼 읽힌다.

                     얹을 수 없을 만큼 멀면 `snappedLocation`이 null이고, 그때는 날것의 좌표를
                     그대로 그린다 — 정말 벗어난 경우까지 경로에 붙여 놓으면 사용자가 자기가
                     잘못 걷고 있다는 것을 알 수 없다. */
                  currentLocation={progress.snappedLocation ?? currentLocation}
                  currentHeadingDeg={headingDeg}
                  /* 길안내 화면이므로 시점이 내 위치를 따라간다. 밀거나 확대하면 풀리고
                     `내 위치` 버튼으로 돌아온다. */
                  followCamera
                  /* 층은 이 화면이 들고 있다. 시점만 되돌리면 다른 층을 보던 사용자는 그 층
                     지도가 자기 좌표로 옮겨진 것만 보고, 마커는 다른 층이라 그려지지 않는다. */
                  onRecenter={returnToMyFloor}
                  /* 경로가 끝나는 자리에 찍는다. 이름으로 찾은 시설이 아니다 — 경로 유형에 따라
                     도착 노드가 달라진다(`destinationPoint`). 다른 층의 목적지는 오버레이가
                     걸러낸다. */
                  destination={destinationPoint}
                  /* 이름은 응답의 것을 쓴다. 마커와 같은 좌표계에서 그려야 둘이 붙어 있다.
                     시설 필터가 걸리면 원본과 같이 출구 표시를 감춘다. */
                  destinationLabel={
                    selectedFacility === null &&
                    (effectiveType == null || effectiveType === 'exit') &&
                    destinationFacility !== null
                      ? localizedFacilityNameOf(destinationFacility, language)
                      : null
                  }
                  /* 목적지 시설의 아이콘에 도착지 표시를 붙인다. 지도에서 시설을 새 목적지로
                     지정했을 때, 어느 아이콘이 목적지가 되었는지 알 방법이 이것뿐이다. */
                  /* **서버가 안내한 노드**를 넘긴다. 요청한 노드가 아니다 — `elevator_only` 는
                     출구 노드가 아니라 그 출구의 엘리베이터로 안내한다(S15P11A206-345). 요청한
                     노드를 넘기면 도착지 표시가 출구 아이콘에 붙고 경로는 엘리베이터에서 끝나,
                     `destinationPoint` 에서 고친 것과 같은 어긋남이 아이콘 쪽에 남는다.
                     경로가 없으면 요청한 노드로 떨어진다. */
                  destinationNodeId={routeResult?.targetNodeId ?? targetNodeId}
                  /* 실제로 안내 중인 경로를 그린다. 조회 전이거나 실패하면 빈 배열이라
                     선이 그려지지 않는다 — 예전에는 이 자리를 목업이 채워, 사용자가 가지도
                     않을 B3 승강장 → 3번출구 경로가 늘 그려져 있었다. */
                  pathNodes={routePathNodesOf(routeResult)}
                  /* 다리별 색과 번호 핀에 쓰인다. 겹치는 복도에서 순서를 알려주는 것이 이 번호다. */
                  waypointNodeIds={waypointNodeIds}
                  /* 지나온 다리는 흐리게, 지금 다리는 진하게, 남은 다리는 연하게 그린다. */
                  activeLeg={activeLeg}
                  /* 내 점과 경로 사이의 빈 자리를 잇는다. **얹지 못했을 때만 잇는다.**

                     얹었으면 내 점이 이미 경로선 위에 있어 이을 자리가 없다. 그런데도 그리면
                     길이 0인 선이 남아 마커 안에서 지저분해진다.

                     **경로에서 벗어난 동안에는 계속 잇는다.** 처음에는 이탈이면 끊었는데, 그러면
                     정작 필요한 자리에서 사라졌다 — 서버가 진입 노드를 목적지 기준으로 다시 고르면
                     (S15P11A206-337) 그 노드가 수십 m 떨어질 수 있고, 그 층에 남는 경로 노드가
                     그것 하나뿐이면 이탈로 판정되어 지도가 통째로 비었다. 역삼역 B3 복도(노드 209)
                     에서 2번 출구로 갈 때 실제로 그랬다.

                     벗어난 자리에서 가장 가까운 경로 지점으로 이어 주는 것이 필요한 안내다.
                     아무것도 그리지 않으면 사용자는 자기 층에 경로가 없다고 읽는다. */
                  connectCurrentToRoute={!snapToRoute || progress.snappedLocation === null}
                  facilityType={effectiveType}
                  /* 유형을 고르기 전에는 그 층 시설을 모두 보여 준다. 숨김이면 둘 다 꺼져
                     아무 시설도 그리지 않는다. */
                  showAllFacilities={effectiveView === 'all'}
                  selectedFacilityId={selectedFacility?.facilityId}
                  onSelectFacility={setSelectedFacility}
                />
              </div>

              <div
                className={styles.floorButtons}
                role="group"
                aria-label={t('user.navigation.floorSelect')}
              >
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
              <div
                className={styles.facilityFilters}
                role="group"
                aria-label={t('user.navigation.facilityFilter')}
              >
                {availableFilters.map((filter) => {
                  const active = effectiveView === filter.facilityType;

                  return (
                    <button
                      key={filter.name}
                      type="button"
                      className={[styles.facilityFilter, active && styles.facilityFilterOn]
                        .filter(Boolean)
                        .join(' ')}
                      aria-label={t(
                        active ? 'user.navigation.filterOff' : 'user.navigation.filterOn',
                        { name: filter.name },
                      )}
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
                  유형 칩과 감추기 사이의 구분선. (S15P11A206-206)

                  유형을 고르는 조작과 표시 자체를 끄는 조작은 성격이 다르다. 나란히 두면 감추기가
                  칩 하나처럼 보여 또 하나의 유형으로 읽힌다. 줄을 하나 그어 두 갈래임을 알린다.

                  표시 층에 유형 칩이 하나도 없으면 가를 것이 없어 그리지 않는다.
                */}
                {availableFilters.length > 0 && (
                  <span className={styles.facilityDivider} aria-hidden />
                )}

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
                    effectiveView === 'none'
                      ? t('user.navigation.showFacilities')
                      : t('user.navigation.hideFacilities')
                  }
                  aria-pressed={effectiveView === 'none'}
                  title={
                    effectiveView === 'none'
                      ? t('user.navigation.showFacilities')
                      : t('user.navigation.hideFacilities')
                  }
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
              <div className={styles.steps} ref={stepsListRef}>
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

                  /*
                    지금 걷는 줄만 **남은** 거리를 적는다. 지나온 줄과 앞으로 올 줄은 구간 전체
                    길이다 — 지나온 구간에 "197m 걸었다"가 남는 것이 정보이고, 앞으로 올 구간은
                    아직 걷지 않았으므로 남은 거리라고 말할 것이 없다.

                    숫자는 한 줄에 한 번만 보인다. 문장이 거리를 품는 구간(직진·회전)은 문장 안에
                    적고, 품지 않는 구간(층 이동·개찰구)은 오른쪽 칸에 적는다. 둘 다 적으면 같은
                    줄에 197m 와 42m 가 나란히 놓인다.
                  */
                  const shownDistanceM = active
                    ? (progress.stepRemainingM ?? step.distanceM ?? 0)
                    : (step.distanceM ?? 0);

                  return (
                    <div
                      key={`${step.order}-${step.fromNodeId}-${step.toNodeId}`}
                      /* 지금 걷는 줄만 표시해 둔다. 위 effect가 이 줄을 칸 맨 위로 올린다. */
                      ref={active ? activeStepRef : null}
                      className={[styles.step, passed && styles.stepPassed, active && styles.stepOn]
                        .filter(Boolean)
                        .join(' ')}
                      aria-current={active ? 'step' : undefined}
                    >
                      <span className={styles.stepIcon}>
                        {passed ? <Icon name="check" size={13} /> : '↑'}
                      </span>
                      <b>{instructionAt(step, shownDistanceM)}</b>
                      <span>{carriesDistance(step) ? null : `${Math.round(shownDistanceM)}m`}</span>
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
                      <b>{waypointName(waypoint)}</b>
                      <span>{t('user.navigation.waypoint', { order: index + 1 })}</span>
                    </div>
                  );
                })}
                <div className={styles.step}>
                  <span className={styles.stepIcon}>
                    <Icon name="flag" size={14} />
                  </span>
                  <b>{t('user.navigation.arriveExit', { exit: activeDestinationLabel })}</b>
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

        {/*
          시설 시트. **`dom-overlay` 루트 안에 둔다.** (S15P11A206-206)

          예전에는 `PhoneFrame` 의 `overlay` 로 넘겼는데, 그쪽은 `children` 의 형제로 그려지므로
          이 화면이 세션에 넘긴 루트(`overlayRoot`) **밖**이다. XR 세션이 열리면 컴포지터는 그 루트
          아래만 카메라 위에 합성하므로, 시트는 열려 있어도 화면에 나타나지 않았다 — 세션 전에는
          시설을 눌러 경유지를 추가할 수 있는데 세션에 들어가면 아무 일도 일어나지 않던 이유다.

          세션 안내는 그대로 `overlay` 에 둔다. 그것이 뜨는 구간에는 세션이 떠 있지 않아 일반 DOM
          이 그대로 보이고, 안내가 시트보다 앞서야 한다는 순서도 아래 조건으로 유지된다.
        */}
        {showFloorTransition && (
          <section
            className={styles.floorTransitionGuide}
            role="dialog"
            aria-modal="true"
            aria-labelledby="floor-transition-instruction"
          >
            <div
              className={[
                styles.floorTransitionChevrons,
                transitionFloorDelta > 0 && styles.floorTransitionChevronsUp,
              ]
                .filter(Boolean)
                .join(' ')}
              aria-hidden
            >
              {[0, 1].map((index) => (
                <svg key={index} viewBox="0 0 112 64" focusable="false">
                  <defs>
                    <linearGradient
                      id={`floor-chevron-gradient-${index}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="var(--color-mint-highlight)" />
                      <stop offset="52%" stopColor="var(--color-mint)" />
                      <stop offset="100%" stopColor="#15936d" />
                    </linearGradient>
                  </defs>
                  <polyline
                    className={styles.floorTransitionChevronDepth}
                    points={transitionFloorDelta > 0 ? '12,47 56,12 100,47' : '12,15 56,50 100,15'}
                  />
                  <polyline
                    className={styles.floorTransitionChevronFace}
                    points={transitionFloorDelta > 0 ? '12,50 56,15 100,50' : '12,12 56,47 100,12'}
                    stroke={`url(#floor-chevron-gradient-${index})`}
                  />
                </svg>
              ))}
            </div>
            <p id="floor-transition-instruction" className={styles.floorTransitionInstruction}>
              {transitionInstruction}
            </p>
            <p className={styles.floorTransitionDescription}>
              {t('user.navigation.floorTransition.description')}
            </p>
            <button
              type="button"
              className={styles.floorTransitionGuideButton}
              onClick={() => {
                setCompletedVerticalStepKey(verticalStepKey);
                if (!previewTransition && verticalDestinationFloorCode) {
                  setPickedFloorCode(verticalDestinationFloorCode);
                  setFloor(verticalDestinationFloorCode as FloorId);
                }
                if (!previewTransition && verticalDestination) {
                  setCurrentLocation({
                    nodeId: verticalDestination.nodeId,
                    floorId: verticalDestination.floorId,
                    mapX: verticalDestination.mapX,
                    mapY: verticalDestination.mapY,
                  });
                }
              }}
            >
              {t('user.navigation.floorTransition.confirm')}
            </button>
          </section>
        )}

        {!isNoticeOpen && selectedFacility && (
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
            <p className={styles.sheetNote}>{t('user.navigation.waypointNote')}</p>
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
                  setDestination(selectedFacility.nameKo, {
                    destinationId: selectedFacility.facilityId,
                    destinationType: 'facility',
                    targetNodeId: selectedFacility.linkedNodeId ?? undefined,
                    destinationNameKo: selectedFacility.nameKo,
                    destinationNameEn: selectedFacility.nameEn,
                  });
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
        )}
      </div>
    </PhoneFrame>
  );
}
