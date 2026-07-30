import { create } from 'zustand';
import type { RouteOptionId } from './routeOptions';
import type { RouteResponse } from '@/shared/api';

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
  currentNodeId: number | null;
  currentFloorId: number | null;
  currentLocationLabel: string | null;
  currentMapX: number | null;
  currentMapY: number | null;
  routeResult: RouteResponse | null;
  /** Chosen route strategy. */
  route: RouteOptionId;
  /** Whether the turn-by-turn step list is expanded over the camera view. */
  stepsOpen: boolean;
  /** Optional stops added from the indoor map while navigation is active. */
  waypoints: string[];
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
  setRoute: (route: RouteOptionId) => void;
  setRouteResult: (route: RouteResponse | null) => void;
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
  destinationId: null,
  destinationType: null,
  destinationLatitude: null,
  destinationLongitude: null,
  destinationAddress: null,
  externalOriginName: null,
  externalOriginLatitude: null,
  externalOriginLongitude: null,
  targetNodeId: null,
  currentNodeId: null,
  currentFloorId: null,
  currentLocationLabel: null,
  currentMapX: null,
  currentMapY: null,
  routeResult: null,
  route: 'fast',
  stepsOpen: false,
  waypoints: [],
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
      routeResult: null,
      waypoints: [],
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
}));
