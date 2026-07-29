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
  setDestination: (destination: string) => void;
  setRoute: (route: RouteOptionId) => void;
  addWaypoint: (waypoint: string) => void;
  removeWaypoint: (waypoint: string) => void;
  clearWaypoints: () => void;
  toggleSteps: () => void;
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
}));
