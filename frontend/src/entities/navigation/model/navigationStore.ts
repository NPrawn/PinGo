import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { RouteResponse } from '@/shared/api';
import type { RouteType } from '@/shared/types';
import type { MapDirection } from './types';

/**
 * 안내 도중 들르기로 한 곳.
 *
 * **노드 id를 함께 들고 있어야 한다.** 예전에는 이름만 저장해서 경로 요청에 실을 것이 없었고,
 * 경유지를 추가해도 서버는 그대로 최단 경로를 돌려줬다. 화면만 "경로 업데이트 완료"라고
 * 적혀 있었을 뿐 지도의 선은 하나도 바뀌지 않았다.
 *
 * 이름으로 시설을 되찾는 방법은 쓰지 않는다. 표기가 조금만 달라도 다른 곳을 가리키는데,
 * 목적지 마커에서 이미 같은 문제를 겪었다(`matchExitByName`).
 */
export interface Waypoint {
  /** 경로 요청에 싣는 `waypointNodeIds` 항목. */
  nodeId: number;
  /** 화면에 쓰는 이름. */
  nameKo: string;
}

/**
 * 한 번에 들를 수 있는 곳의 수.
 *
 * 백엔드는 10개까지 받지만(`RouteCreateRequest`) 화면은 2개로 둔다. 안내 헤더가 출발지·경유지·
 * 목적지를 한 줄에 늘어놓는 구조라, 셋을 넘기면 좁은 화면에서 이름이 읽을 수 없게 눌린다.
 * 늘리려면 헤더를 먼저 다시 짜야 한다.
 */
const MAX_WAYPOINTS = 2;

type NavigationStore = {
  /** Destination name the user picked from search. */
  destination: string | null;
  destinationNameKo: string | null;
  destinationNameEn: string | null;
  destinationId: number | null;
  destinationType: string | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  destinationAddress: string | null;
  targetNodeId: number | null;
  /** 도착 출구의 표시 이름. 안내·도착 화면이 목적지 자리에 쓴다. */
  targetExitLabel: string | null;
  currentNodeId: number | null;
  currentFloorId: number | null;
  currentLocationLabel: string | null;
  currentMapX: number | null;
  currentMapY: number | null;
  currentForwardMap: MapDirection | null;
  /** 마지막 VPS 인식의 AI 기하 품질 점수(0~1). 수동 위치 지정이면 null이다. */
  currentConfidenceScore: number | null;
  /** VPS 좌표를 평면도에 표시할 때 사용하는 층별 좌표 정합 평균 오차(m). */
  currentAccuracyM: number | null;
  routeResult: RouteResponse | null;
  /**
   * 사용자가 고른 경로 유형.
   *
   * 값은 백엔드 `RouteType`과 같다. 예전에는 프로토타입 어휘(`fast`·`elev`)를 따로 들고 있어
   * 응답을 그대로 저장할 수 없었다.
   */
  route: RouteType;
  /** Whether the turn-by-turn step list is expanded over the camera view. */
  stepsOpen: boolean;
  /** Optional stops added from the indoor map while navigation is active. */
  waypoints: Waypoint[];
  /**
   * 어느 경로의 진행도인지. 출발·도착·유형·경유지를 묶은 문자열이며 화면이 만든다.
   *
   * 값만 두면 경로가 바뀌었을 때 지난 경로의 진행도를 그대로 쓰게 된다. 어느 경로의 것인지
   * 함께 들고 있으면, 열쇠가 다른 순간 읽는 쪽이 0부터 다시 세면 된다 — 따로 지울 필요가 없다.
   */
  progressKey: string | null;
  /**
   * 경로를 따라 진행한 거리(m). 뒤로 가지 않는다.
   *
   * XR 위치는 흔들린다. 매 위치마다 다시 계산하면 진행도가 앞뒤로 오가며 안내가 깜빡이므로,
   * 지금까지의 최대값만 남긴다(`routeProgressOf`).
   */
  travelledM: number;
  /**
   * 안내 중 위치 재인식으로 U-04에 다녀오는 중인지. (S15P11A206-141)
   *
   * **쿼리 파라미터로 넘기지 않는 이유.** 재인식은 U-10 → U-04(촬영·매칭) → U-05(위치 확인) →
   * U-10으로 세 화면을 거치는데, 중간 화면들은 자기 흐름의 링크를 그대로 쓴다. 파라미터로
   * 실어 보내면 거쳐 가는 모든 링크가 그것을 이어 붙여야 하고, 한 곳만 빠뜨려도 사용자가
   * 안내로 돌아오지 못한다.
   *
   * 이 표시가 없으면 U-05의 기본 CTA가 경로 옵션 선택이므로, 안내 중 재인식을 하고 나면
   * 목적지를 다시 고르는 화면부터 밟게 된다.
   */
  relocalizing: boolean;
  /** Starts a fresh journey and discards stops from the previous journey. */
  startNewJourney: (
    destination: string,
    details?: {
      destinationId?: number;
      destinationType?: string;
      targetNodeId?: number;
      destinationLatitude?: number;
      destinationLongitude?: number;
      destinationAddress?: string;
      destinationNameKo?: string;
      destinationNameEn?: string;
    },
  ) => void;
  setDestination: (destination: string) => void;
  setCurrentLocation: (location: {
    nodeId: number;
    floorId: number;
    label?: string;
    mapX?: number;
    mapY?: number;
    forwardMap?: MapDirection | null;
    confidenceScore?: number | null;
    accuracyM?: number | null;
  }) => void;
  setRoute: (route: RouteType) => void;
  /**
   * 고른 경로가 도착할 실내 노드와 그 출구 이름.
   *
   * 경로 유형마다 나가는 출구가 다르다 — 최단은 목적지에서 가장 가까운 출구로, 엘리베이터
   * 우선은 계단 없이 닿는 출구 중 가장 가까운 곳으로 나간다. 목적지 검색이 넣어 둔 값은
   * 최단 기준이므로, 유형을 고른 뒤 그 유형의 도착점으로 덮어써야 안내·도착 화면이 같은
   * 곳을 가리킨다.
   */
  setTargetNode: (targetNodeId: number, exitLabel: string | null) => void;
  setRouteResult: (route: RouteResponse | null) => void;
  /** 진행도를 기록한다. 어느 경로의 것인지 함께 남긴다. */
  setRouteProgress: (progressKey: string, travelledM: number) => void;
  addWaypoint: (waypoint: Waypoint) => void;
  /** 노드로 지운다. 같은 이름의 시설이 여러 개인 역(안내센터 A·B)에서 이름은 열쇠가 못 된다. */
  removeWaypoint: (nodeId: number) => void;
  clearWaypoints: () => void;
  toggleSteps: () => void;
  /** 안내 중 재인식을 시작한다. U-04로 떠나기 직전에 부른다. */
  beginRelocalize: () => void;
  /** 재인식을 마친다. 안내 화면으로 돌아갈 때 부른다. */
  endRelocalize: () => void;
};

/**
 * The active navigation session.
 *
 * Crosses pages: destination search sets the target, the route screen picks a
 * strategy, and the navigation and arrival screens read both.
 */
export const useNavigationStore = create<NavigationStore>()(
  persist(
    (set) => ({
      destination: null,
      destinationNameKo: null,
      destinationNameEn: null,
      destinationId: null,
      destinationType: null,
      destinationLatitude: null,
      destinationLongitude: null,
      destinationAddress: null,
      targetNodeId: null,
      targetExitLabel: null,
      currentNodeId: null,
      currentFloorId: null,
      currentLocationLabel: null,
      currentMapX: null,
      currentMapY: null,
      currentForwardMap: null,
      currentConfidenceScore: null,
      currentAccuracyM: null,
      routeResult: null,
      route: 'fastest',
      stepsOpen: false,
      waypoints: [],
      progressKey: null,
      travelledM: 0,
      relocalizing: false,
      // 새 여정은 재인식 중 상태를 물려받지 않는다.
      startNewJourney: (destination, details) =>
        set({
          destination,
          destinationNameKo: details?.destinationNameKo ?? null,
          destinationNameEn: details?.destinationNameEn ?? null,
          destinationId: details?.destinationId ?? null,
          destinationType: details?.destinationType ?? null,
          destinationLatitude: details?.destinationLatitude ?? null,
          destinationLongitude: details?.destinationLongitude ?? null,
          destinationAddress: details?.destinationAddress ?? null,
          targetNodeId: details?.targetNodeId ?? null,
          targetExitLabel: null,
          routeResult: null,
          waypoints: [],
          relocalizing: false,
        }),
      setDestination: (destination) =>
        set({
          destination,
          destinationNameKo: null,
          destinationNameEn: null,
          destinationId: null,
          destinationType: null,
          destinationLatitude: null,
          destinationLongitude: null,
          destinationAddress: null,
          targetNodeId: null,
          targetExitLabel: null,
          routeResult: null,
        }),
      setCurrentLocation: (location) =>
        set((state) => ({
          currentNodeId: location.nodeId,
          currentFloorId: location.floorId,
          currentLocationLabel: location.label ?? null,
          currentMapX: location.mapX ?? null,
          currentMapY: location.mapY ?? null,
          currentConfidenceScore: location.confidenceScore ?? null,
          currentAccuracyM: location.accuracyM ?? null,
          /**
           * 방향은 넘기지 않으면 그대로 둔다. **위치를 옮기는 것이 방향을 지우는 일은 아니다.**
           *
           * `forwardMap` 은 위치가 아니라 기기가 향한 쪽이다. 사용자가 서 있는 자리를 고쳐도
           * 몸을 돌린 것은 아니므로 그 방향은 그대로 유효하다.
           *
           * 예전에는 `?? null` 로 지웠다. 그래서 상담자가 `CURRENT_LOCATION_CORRECTED` 로 위치를
           * 바로잡으면 방향이 함께 사라지고, 방향이 없으면 앵커를 만들지 않으므로(`343`) 그때부터
           * 추적이 통째로 죽었다 — 위치도 방향도 갱신되지 않는다. 위치를 고쳐 준 것이 추적을
           * 끄는 결과가 됐다. (S15P11A206-89)
           *
           * 지우려면 `null` 을 명시한다. 다시 인식해서 방향이 실제로 달라진 경우다.
           */
          currentForwardMap:
            location.forwardMap === undefined ? state.currentForwardMap : location.forwardMap,
          routeResult: null,
        })),
      setRoute: (route) => set({ route }),
      // 도착점이 바뀌면 이전 유형으로 받아 둔 상세 경로는 더 이상 그 경로가 아니다.
      setTargetNode: (targetNodeId, exitLabel) =>
        set((state) =>
          state.targetNodeId === targetNodeId && state.targetExitLabel === exitLabel
            ? state
            : { targetNodeId, targetExitLabel: exitLabel, routeResult: null },
        ),
      setRouteResult: (routeResult) => set({ routeResult }),
      setRouteProgress: (progressKey, travelledM) => set({ progressKey, travelledM }),
      addWaypoint: (waypoint) =>
        set((state) => {
          const already = state.waypoints.some((item) => item.nodeId === waypoint.nodeId);
          if (already || state.waypoints.length >= MAX_WAYPOINTS) {
            return state;
          }

          return { waypoints: [...state.waypoints, waypoint] };
        }),
      removeWaypoint: (nodeId) =>
        set((state) => ({ waypoints: state.waypoints.filter((item) => item.nodeId !== nodeId) })),
      clearWaypoints: () => set({ waypoints: [] }),
      toggleSteps: () => set((state) => ({ stepsOpen: !state.stepsOpen })),
      beginRelocalize: () => set({ relocalizing: true }),
      endRelocalize: () => set({ relocalizing: false }),
    }),
    {
      name: 'pingo.navigation',
      storage: createJSONStorage(() => sessionStorage),
      /**
       * 1 — 경유지가 이름 문자열에서 `Waypoint`(노드 + 이름)로 바뀌었다.
       *
       * 지난 세션이 남긴 이름만으로는 노드를 되찾을 수 없다. 그대로 두면 문자열이 `Waypoint`인
       * 척 섞여 들어와 `waypoint.nodeId`가 undefined가 되고, 경로 요청에 `null`이 실린다.
       * 되살릴 수 없으니 비운다 — 안내 중 새로고침한 사용자는 경유지를 다시 골라야 하지만,
       * 있지도 않은 노드로 계산된 경로를 따라가는 것보다 낫다.
       */
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as Partial<NavigationStore> | undefined;
        if (version >= 1 || !state) return state;

        return { ...state, waypoints: [] };
      },
    },
  ),
);
