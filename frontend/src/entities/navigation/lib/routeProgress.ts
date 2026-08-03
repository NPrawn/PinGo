import type { IndoorPoint, RoutePathNode } from '../model/types';

/**
 * 경로에서 벗어났다고 보는 거리(m).
 *
 * 이보다 멀면 진행도를 올리지 않는다. 다른 복도를 걷고 있는데 경로를 따라간 것으로 세면, 지나지도
 * 않은 구간이 완료로 표시되고 안내는 앞질러 간다.
 *
 * 역삼역 복도 폭이 10m 안쪽이고 XR 앵커 오차가 몇 m 있으므로, 옆 복도로 넘어간 경우만 걸러낼
 * 만큼 넉넉하게 둔다.
 */
const OFF_ROUTE_M = 15;

/** 노드에 서 있는 것을 지난 것으로 볼 여유(m). 정확히 노드 위에 서기를 기대할 수 없다. */
const NODE_PASS_TOLERANCE_M = 1;

/** 경로상 어디까지 왔는지. */
export interface RouteProgress {
  /** 경로를 따라 진행한 거리(m). 뒤로 가지 않는다. */
  travelledM: number;
  /** 지금 진행 중인 `steps` 인덱스. 구간 정보가 없으면 null. */
  currentStepIndex: number | null;
  /** 현재 구간에서 남은 거리(m). 구간 정보가 없으면 null. */
  stepRemainingM: number | null;
  /** 이미 지난 노드. 출발 노드도 포함한다. */
  passedNodeIds: number[];
  /** 경로에서 벗어났는지. 참이면 진행도를 올리지 않았다. */
  offRoute: boolean;
}

interface PathSegment {
  from: RoutePathNode;
  to: RoutePathNode;
  /** 경로 시작부터 이 구간이 시작되는 지점까지의 거리(m). */
  startM: number;
  lengthM: number;
}

/** 진행도 계산에 필요한 구간 정보. `RouteStep`에서 거리만 쓴다. */
interface StepDistance {
  distanceM?: number;
}

/**
 * 내 위치가 경로상 어디인지 계산한다.
 *
 * **미터끼리만 비교한다.** 도면 좌표 프레임(원점·축척·회전)은 그릴 때만 쓰이므로, 도면이 몇 m
 * 밀려 보이는 것과 이 판정은 무관하다. 정확도를 정하는 것은 XR pose와 앵커 품질이다.
 *
 * 노드 근접(반경 안에 들어오면 통과)으로 판정하지 않는다. 역삼역 노드 간격이 3m에서 30m까지
 * 들쭉날쭉해 반경을 하나로 정할 수 없고, 지나치지 않고 옆을 스쳐도 통과로 찍힌다. 경로에 수직
 * 투영해 누적 거리를 구하면 간격과 무관하고, 현재 구간·지난 노드가 같은 계산에서 나온다.
 */
export function routeProgressOf(options: {
  pathNodes: readonly RoutePathNode[];
  /** 경로 응답의 `steps`. 거리로 현재 구간을 찾는다. */
  steps?: readonly StepDistance[];
  currentLocation: IndoorPoint | null;
  /** 지금까지의 최대 진행 거리. 부르는 쪽이 들고 있다가 그대로 넘긴다. */
  travelledM?: number;
}): RouteProgress {
  const { pathNodes, steps = [], currentLocation, travelledM = 0 } = options;
  const segments = pathSegments(pathNodes);
  const pathLengthM = segments.reduce((sum, segment) => sum + segment.lengthM, 0);
  const boundaries = stepBoundaries(steps, pathLengthM);

  if (segments.length === 0) {
    return {
      travelledM: 0,
      currentStepIndex: stepIndexAt(boundaries, 0),
      stepRemainingM: boundaries.length > 0 ? boundaries[0] : null,
      passedNodeIds: [],
      offRoute: false,
    };
  }

  const nearest = currentLocation ? nearestOnRoute(currentLocation, segments) : null;
  const offRoute = nearest === null || nearest.offsetM > OFF_ROUTE_M;
  /*
    되돌아가지 않는다.

    XR 위치는 흔들린다. 진행도가 뒤로 갔다 앞으로 오면 안내 카드와 상세 경로가 두 구간 사이를
    깜빡이고, 사용자는 자기가 잘못 걷고 있다고 읽는다. 경로가 바뀌면 부르는 쪽이 0으로 되돌린다.
  */
  const advancedM = offRoute ? travelledM : Math.max(travelledM, nearest.travelledM);
  const stepIndex = stepIndexAt(boundaries, advancedM);

  return {
    travelledM: advancedM,
    currentStepIndex: stepIndex,
    stepRemainingM: stepIndex === null ? null : Math.max(0, boundaries[stepIndex] - advancedM),
    passedNodeIds: passedNodesAt(pathNodes, advancedM),
    offRoute,
  };
}

/** 노드를 이은 구간들. 누적 거리를 함께 들고 있어야 투영 결과를 경로 거리로 옮길 수 있다. */
function pathSegments(nodes: readonly RoutePathNode[]): PathSegment[] {
  const segments: PathSegment[] = [];
  let startM = 0;

  for (let index = 1; index < nodes.length; index += 1) {
    const from = nodes[index - 1];
    const to = nodes[index];
    const lengthM = Math.hypot(to.mapX - from.mapX, to.mapY - from.mapY);

    segments.push({ from, to, startM, lengthM });
    startM += lengthM;
  }

  return segments;
}

/**
 * 내 위치에서 가장 가까운 경로 지점.
 *
 * **표시 층으로 먼저 걸러낸다.** 역삼역 B2와 B3는 x·y가 거의 겹쳐 있어서, 층을 보지 않고 투영하면
 * B3 승강장에 서 있는데 바로 위 B2 대합실 구간에 붙는다. 그러면 아직 올라가지도 않은 층의 구간이
 * 진행 중으로 표시된다.
 *
 * 층이 다른 두 노드를 잇는 구간(엘리베이터·계단)은 어느 층에도 넣지 않는다. 수평 거리가 0이라
 * 투영해 봐야 얻을 것이 없고, 층을 옮기면 그 층 구간에 붙어 진행도가 자연히 넘어간다.
 */
function nearestOnRoute(
  location: IndoorPoint,
  segments: readonly PathSegment[],
): { travelledM: number; offsetM: number } | null {
  let nearest: { travelledM: number; offsetM: number } | null = null;

  for (const segment of segments) {
    if (segment.from.floorId !== location.floorId) continue;
    if (segment.to.floorId !== location.floorId) continue;

    const projected = projectOnSegment(location, segment);
    if (nearest === null || projected.offsetM < nearest.offsetM) nearest = projected;
  }

  return nearest;
}

/** 한 구간에 수직 투영한다. 구간 밖으로 나가면 양 끝으로 잘라낸다. */
function projectOnSegment(
  location: IndoorPoint,
  segment: PathSegment,
): { travelledM: number; offsetM: number } {
  const dx = segment.to.mapX - segment.from.mapX;
  const dy = segment.to.mapY - segment.from.mapY;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return {
      travelledM: segment.startM,
      offsetM: Math.hypot(location.mapX - segment.from.mapX, location.mapY - segment.from.mapY),
    };
  }

  const raw =
    ((location.mapX - segment.from.mapX) * dx + (location.mapY - segment.from.mapY) * dy) /
    lengthSq;
  const ratio = Math.min(1, Math.max(0, raw));
  const px = segment.from.mapX + dx * ratio;
  const py = segment.from.mapY + dy * ratio;

  return {
    travelledM: segment.startM + segment.lengthM * ratio,
    offsetM: Math.hypot(location.mapX - px, location.mapY - py),
  };
}

/**
 * 각 구간이 끝나는 경로 거리(m).
 *
 * **구간 거리 합을 경로 길이에 맞춰 늘린다.** 둘은 같지 않다 — 엘리베이터·계단 구간은 거리가
 * 있는데(6m) 수평 경로에서는 길이가 0이다. 그대로 누적하면 경로 끝에 서 있어도 마지막 구간에
 * 그만큼 남은 것으로 나온다.
 *
 * 늘리면 층 전환 구간도 짧게나마 자리를 갖는다. 그래야 엘리베이터 앞에 섰을 때 `엘리베이터를
 * 타고 B2로 이동하세요`가 뜬다 — 길이를 0으로 두면 그 안내는 한 번도 보이지 않는다.
 *
 * 수직 거리를 수평에 섞는 근사다. 걷기 안내에서 층 전환은 전체의 몇 %라 구간 경계가 몇 m
 * 어긋나는 정도이고, 어느 구간을 안내할지 고르는 데는 영향이 없다.
 */
function stepBoundaries(steps: readonly StepDistance[], pathLengthM: number): number[] {
  const total = steps.reduce((sum, step) => sum + (step.distanceM ?? 0), 0);
  const scale = total > 0 && pathLengthM > 0 ? pathLengthM / total : 1;

  const boundaries: number[] = [];
  let end = 0;
  for (const step of steps) {
    end += (step.distanceM ?? 0) * scale;
    boundaries.push(end);
  }

  return boundaries;
}

/**
 * 진행 거리에 해당하는 구간 인덱스.
 *
 * 노드 쌍으로 맞추지 않는다. 백엔드가 같은 방향의 간선 여러 개를 한 구간으로 묶어 내려줄 수 있어
 * `steps`와 `pathNodes`의 개수가 항상 같다고 볼 수 없다.
 *
 * 마지막 구간을 넘어서도 마지막에 머문다. 도착 판정은 이 함수의 일이 아니다.
 */
function stepIndexAt(boundaries: readonly number[], travelledM: number): number | null {
  if (boundaries.length === 0) return null;

  for (let index = 0; index < boundaries.length; index += 1) {
    if (travelledM < boundaries[index]) return index;
  }

  return boundaries.length - 1;
}

/** 진행 거리까지 지나온 노드. 출발 노드는 언제나 포함된다. */
function passedNodesAt(nodes: readonly RoutePathNode[], travelledM: number): number[] {
  const passed: number[] = [];
  let cumulative = 0;

  for (let index = 0; index < nodes.length; index += 1) {
    if (index > 0) {
      const from = nodes[index - 1];
      const to = nodes[index];
      cumulative += Math.hypot(to.mapX - from.mapX, to.mapY - from.mapY);
    }

    if (cumulative <= travelledM + NODE_PASS_TOLERANCE_M) passed.push(nodes[index].nodeId);
  }

  return passed;
}
