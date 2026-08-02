import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { RouteResponse } from '@/shared/api';
import type { RouteType } from '@/shared/types';

type NavigationStore = {
  /** Destination name the user picked from search. */
  destination: string | null;
  destinationId: number | null;
  destinationType: string | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  destinationAddress: string | null;
  externalOriginName: string | null;
  externalOriginLatitude: number | null;
  externalOriginLongitude: number | null;
  targetNodeId: number | null;
  /** 도착 출구의 표시 이름. 안내·도착 화면이 목적지 자리에 쓴다. */
  targetExitLabel: string | null;
  currentNodeId: number | null;
  currentFloorId: number | null;
  currentLocationLabel: string | null;
  currentMapX: number | null;
  currentMapY: number | null;
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
  waypoints: string[];
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
      externalOriginName?: string;
      externalOriginLatitude?: number;
      externalOriginLongitude?: number;
    },
  ) => void;
  setDestination: (destination: string) => void;
  setCurrentLocation: (location: {
    nodeId: number;
    floorId: number;
    label?: string;
    mapX?: number;
    mapY?: number;
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
  addWaypoint: (waypoint: string) => void;
  removeWaypoint: (waypoint: string) => void;
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
      destinationId: null,
      destinationType: null,
      destinationLatitude: null,
      destinationLongitude: null,
      destinationAddress: null,
      externalOriginName: null,
      externalOriginLatitude: null,
      externalOriginLongitude: null,
      targetNodeId: null,
      targetExitLabel: null,
      currentNodeId: null,
      currentFloorId: null,
      currentLocationLabel: null,
      currentMapX: null,
      currentMapY: null,
      routeResult: null,
      route: 'fastest',
      stepsOpen: false,
      waypoints: [],
      relocalizing: false,
      // 새 여정은 재인식 중 상태를 물려받지 않는다.
      startNewJourney: (destination, details) =>
        set({
          destination,
          destinationId: details?.destinationId ?? null,
          destinationType: details?.destinationType ?? null,
          destinationLatitude: details?.destinationLatitude ?? null,
          destinationLongitude: details?.destinationLongitude ?? null,
          destinationAddress: details?.destinationAddress ?? null,
          externalOriginName: details?.externalOriginName ?? null,
          externalOriginLatitude: details?.externalOriginLatitude ?? null,
          externalOriginLongitude: details?.externalOriginLongitude ?? null,
          targetNodeId: details?.targetNodeId ?? null,
          targetExitLabel: null,
          routeResult: null,
          waypoints: [],
          relocalizing: false,
        }),
      setDestination: (destination) =>
        set({
          destination,
          destinationId: null,
          destinationType: null,
          destinationLatitude: null,
          destinationLongitude: null,
          destinationAddress: null,
          externalOriginName: null,
          externalOriginLatitude: null,
          externalOriginLongitude: null,
          targetNodeId: null,
          targetExitLabel: null,
          routeResult: null,
        }),
      setCurrentLocation: (location) =>
        set({
          currentNodeId: location.nodeId,
          currentFloorId: location.floorId,
          currentLocationLabel: location.label ?? null,
          currentMapX: location.mapX ?? null,
          currentMapY: location.mapY ?? null,
          routeResult: null,
        }),
      setRoute: (route) => set({ route }),
      // 도착점이 바뀌면 이전 유형으로 받아 둔 상세 경로는 더 이상 그 경로가 아니다.
      setTargetNode: (targetNodeId, exitLabel) =>
        set((state) =>
          state.targetNodeId === targetNodeId && state.targetExitLabel === exitLabel
            ? state
            : { targetNodeId, targetExitLabel: exitLabel, routeResult: null },
        ),
      setRouteResult: (routeResult) => set({ routeResult }),
      addWaypoint: (waypoint) =>
        set((state) => {
          if (state.waypoints.includes(waypoint) || state.waypoints.length >= 2) {
            return state;
          }

          return { waypoints: [...state.waypoints, waypoint] };
        }),
      removeWaypoint: (waypoint) =>
        set((state) => ({ waypoints: state.waypoints.filter((item) => item !== waypoint) })),
      clearWaypoints: () => set({ waypoints: [] }),
      toggleSteps: () => set((state) => ({ stepsOpen: !state.stepsOpen })),
      beginRelocalize: () => set({ relocalizing: true }),
      endRelocalize: () => set({ relocalizing: false }),
    }),
    {
      name: 'pingo.navigation',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
