import { create } from 'zustand';
import type { RouteOptionId } from './routeOptions';

type NavigationStore = {
  /** Destination name the user picked from search. */
  destination: string | null;
  /** Chosen route strategy. */
  route: RouteOptionId;
  /** Whether the turn-by-turn step list is expanded over the camera view. */
  stepsOpen: boolean;
  setDestination: (destination: string) => void;
  setRoute: (route: RouteOptionId) => void;
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
  setDestination: (destination) => set({ destination }),
  setRoute: (route) => set({ route }),
  toggleSteps: () => set((state) => ({ stepsOpen: !state.stepsOpen })),
}));
