import { create } from 'zustand';
import type { RouteOptionId } from './routeOptions';

type NavigationStore = {
  /** Destination name the user picked from search. */
  destination: string | null;
  /** Chosen route strategy. */
  route: RouteOptionId;
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
  startNewJourney: (destination: string) => void;
  setDestination: (destination: string) => void;
  setRoute: (route: RouteOptionId) => void;
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
export const useNavigationStore = create<NavigationStore>((set) => ({
  destination: null,
  route: 'fast',
  stepsOpen: false,
  waypoints: [],
  relocalizing: false,
  // 새 여정은 재인식 중 상태를 물려받지 않는다.
  startNewJourney: (destination) => set({ destination, waypoints: [], relocalizing: false }),
  setDestination: (destination) => set({ destination }),
  setRoute: (route) => set({ route }),
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
}));
