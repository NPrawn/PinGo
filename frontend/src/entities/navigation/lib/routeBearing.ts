import type { IndoorPoint, RoutePathNode } from '../model/types';

/**
 * 이 거리 안의 노드는 지나쳤다고 보고 그 다음을 가리킨다(m).
 *
 * 바로 앞 노드를 가리키면, 그 노드에 다가갈수록 방향이 급격히 흔들리고 밟는 순간 뒤를 가리킨다.
 * 조금 앞을 보게 두면 통로를 따라 걷는 동안 화살표가 안정적으로 앞을 향한다.
 */
const LOOKAHEAD_M = 3;

/** 이 각도 안쪽은 직진으로 본다. 통로를 걷다 보면 몇 도씩은 늘 흔들린다. */
const STRAIGHT_DEG = 25;

/** 이 각도를 넘으면 되돌아가는 것으로 본다. */
const AROUND_DEG = 135;

export type RouteTurn = 'straight' | 'left' | 'right' | 'around';

export interface RouteBearing {
  /**
   * 사용자가 보는 방향을 기준으로 다음 지점이 놓인 각도(도).
   *
   * 0이 정면, 양수가 오른쪽, 음수가 왼쪽이다. 화면에서 위를 향한 화살표를 이 각도만큼 돌리면
   * 그 지점을 가리킨다.
   */
  relativeDeg: number;
  turn: RouteTurn;
}

/**
 * 다음 지점이 어느 쪽인지. 카메라 화면의 화살표와 문구가 쓴다.
 *
 * **방향각을 모르면 null이다.** XR 추적 없이 안내만 할 때가 그렇다. 그때 화살표를 위로 고정하면
 * "정면"이라고 말하는 셈이라, 사용자가 엉뚱한 쪽으로 걷는다. 모르면 그리지 않는 편이 맞다.
 *
 * 다음 지점이 다른 층이면 null이다. 층을 오르내리는 구간에서 수평 방향은 뜻이 없다 — 그 구간의
 * 안내는 `moveType`이 담당한다(`엘리베이터를 이용해 이동하세요`).
 *
 * 각도는 미터 프레임 기준이며 y가 아래로 증가한다(`meterToPixel`). 그래서 각도가 커지는 쪽이
 * 시계 방향이고, 화면 회전과 부호가 그대로 맞는다.
 */
export function routeBearingOf(options: {
  pathNodes: readonly RoutePathNode[];
  currentLocation: IndoorPoint | null;
  /** 사용자가 보는 방향(도). 미터 프레임 기준. 모르면 null. */
  headingDeg: number | null | undefined;
  /** 지금까지 진행한 거리(m). `routeProgressOf`가 준 값. */
  travelledM: number;
}): RouteBearing | null {
  const { pathNodes, currentLocation, headingDeg, travelledM } = options;
  if (!currentLocation || typeof headingDeg !== 'number' || !Number.isFinite(headingDeg)) {
    return null;
  }

  const target = nodeAhead(pathNodes, travelledM);
  if (!target || target.floorId !== currentLocation.floorId) return null;

  const dx = target.mapX - currentLocation.mapX;
  const dy = target.mapY - currentLocation.mapY;
  // 같은 자리면 가리킬 방향이 없다.
  if (Math.hypot(dx, dy) < 0.01) return null;

  const bearingDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const relativeDeg = normalizeDeg(bearingDeg - headingDeg);

  return { relativeDeg, turn: turnOf(relativeDeg) };
}

/** 진행 거리보다 충분히 앞에 있는 첫 노드. 없으면 마지막 노드다. */
function nodeAhead(nodes: readonly RoutePathNode[], travelledM: number): RoutePathNode | null {
  if (nodes.length === 0) return null;

  let cumulative = 0;
  for (let index = 1; index < nodes.length; index += 1) {
    const from = nodes[index - 1];
    const to = nodes[index];
    cumulative += Math.hypot(to.mapX - from.mapX, to.mapY - from.mapY);

    if (cumulative > travelledM + LOOKAHEAD_M) return to;
  }

  return nodes[nodes.length - 1];
}

function turnOf(relativeDeg: number): RouteTurn {
  const magnitude = Math.abs(relativeDeg);
  if (magnitude <= STRAIGHT_DEG) return 'straight';
  if (magnitude >= AROUND_DEG) return 'around';

  return relativeDeg > 0 ? 'right' : 'left';
}

/** -180 초과 180 이하로 접는다. 179도와 -181도는 같은 방향이다. */
function normalizeDeg(degrees: number): number {
  const wrapped = ((degrees % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}
