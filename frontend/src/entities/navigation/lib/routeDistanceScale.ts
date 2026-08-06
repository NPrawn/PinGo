import type { RouteResponse } from '@/shared/api';
import { routePathNodesOf } from './routePathNodes';

const MIN_DISTANCE_SCALE = 0.25;
const MAX_DISTANCE_SCALE = 4;

/** XR 이동량을 실측 이동량에 맞추기 위한 임시 보정 배율. */
export const XR_DISTANCE_SCALE_MULTIPLIER = 1.5;

function edgeKey(fromNodeId: number, toNodeId: number): string {
  return `${fromNodeId}:${toNodeId}`;
}

/**
 * Returns map-coordinate units per physical meter for one floor.
 *
 * Route-node coordinate distance is the map-side measurement and each step's `distanceM` is the
 * physically measured/managed distance. Invalid or insufficient calibration data safely falls back to 1.
 */
export function routeDistanceScaleOf(
  route: RouteResponse | null | undefined,
  floorId: number | null | undefined,
): number {
  if (!route || floorId == null) return 1;

  const physicalByEdge = new Map<string, number>();
  for (const step of route.steps ?? []) {
    if (
      step.fromNodeId == null ||
      step.toNodeId == null ||
      step.distanceM == null ||
      !Number.isFinite(step.distanceM) ||
      step.distanceM <= 0
    ) {
      continue;
    }
    physicalByEdge.set(edgeKey(step.fromNodeId, step.toNodeId), step.distanceM);
  }

  const nodes = routePathNodesOf(route);
  let mapDistance = 0;
  let physicalDistance = 0;

  for (let index = 1; index < nodes.length; index += 1) {
    const from = nodes[index - 1];
    const to = nodes[index];
    if (from.floorId !== floorId || to.floorId !== floorId) continue;

    const physical = physicalByEdge.get(edgeKey(from.nodeId, to.nodeId));
    const mapped = Math.hypot(to.mapX - from.mapX, to.mapY - from.mapY);
    if (physical == null || !Number.isFinite(mapped) || mapped <= 0) continue;

    mapDistance += mapped;
    physicalDistance += physical;
  }

  if (physicalDistance <= 0) return 1;

  const scale = mapDistance / physicalDistance;
  return Number.isFinite(scale) && scale >= MIN_DISTANCE_SCALE && scale <= MAX_DISTANCE_SCALE
    ? scale
    : 1;
}

/** 경로 축척에 XR 실측 보정 배율을 적용한다. */
export function xrDistanceScaleOf(
  route: RouteResponse | null | undefined,
  floorId: number | null | undefined,
  multiplier = XR_DISTANCE_SCALE_MULTIPLIER,
): number {
  return routeDistanceScaleOf(route, floorId) * multiplier;
}
