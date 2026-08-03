import type { IndoorPoint, RoutePathNode } from '../model/types';

/**
 * 이 거리 안의 노드는 지나쳤다고 보고 그 다음을 가리킨다(m).
 *
 * 바로 앞 노드를 가리키면, 그 노드에 다가갈수록 방향이 급격히 흔들리고 밟는 순간 뒤를 가리킨다.
 * 조금 앞을 보게 두면 통로를 따라 걷는 동안 화살표가 안정적으로 앞을 향한다.
 */
const LOOKAHEAD_M = 3;

/**
 * 이보다 가까운 지점은 가리키지 않는다(m).
 *
 * 발밑을 가리키면 한 걸음에 방향이 180도 뒤집힌다. 층 전환 지점에 다 왔을 때가 그런 경우이고,
 * 그 순간의 안내는 카드가 맡는다(`엘리베이터를 이용해 이동하세요`).
 */
const MIN_TARGET_M = 0.8;

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
 * **층 전환 지점까지는 그 지점을 계속 가리킨다.** 다음 노드가 다른 층이면 방향이 없다고 보고
 * 끊었더니, 엘리베이터·계단 3m 앞에서 화살표가 갑자기 사라졌다. 실내에서 3m는 어느 쪽으로 가야
 * 하는지 잊기에 충분한 거리다. 지금 층에서 남은 마지막 지점이 곧 그 시설의 진입 지점이므로,
 * 거기 닿기 전까지는 그쪽을 가리킨다.
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

  const target = nodeAhead(pathNodes, travelledM, currentLocation.floorId);
  if (!target) return null;

  const dx = target.mapX - currentLocation.mapX;
  const dy = target.mapY - currentLocation.mapY;
  // 발밑을 가리키면 한 걸음에 방향이 뒤집힌다.
  if (Math.hypot(dx, dy) < MIN_TARGET_M) return null;

  const bearingDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const relativeDeg = normalizeDeg(bearingDeg - headingDeg);

  return { relativeDeg, turn: turnOf(relativeDeg) };
}

/**
 * 가리킬 노드. **지금 층에 있는 것만** 고른다.
 *
 * 충분히 앞에 있는 첫 노드를 쓰고, 그런 노드가 없으면 지금 층에서 남은 첫 노드를 쓴다. 후자가
 * 층 전환 직전의 상황이다 — 남은 것이 엘리베이터·계단 진입 지점 하나뿐이므로 그쪽을 가리킨다.
 *
 * 다른 층 노드를 걸러내는 이유는 수평 방향이 뜻을 잃기 때문이다. 위층 통로를 가리키면 지금 층
 * 벽을 향해 걷게 된다.
 */
function nodeAhead(
  nodes: readonly RoutePathNode[],
  travelledM: number,
  floorId: number,
): RoutePathNode | null {
  const ahead: { node: RoutePathNode; gapM: number }[] = [];
  let cumulative = 0;

  for (let index = 1; index < nodes.length; index += 1) {
    const from = nodes[index - 1];
    const to = nodes[index];
    cumulative += Math.hypot(to.mapX - from.mapX, to.mapY - from.mapY);

    if (cumulative > travelledM && to.floorId === floorId) {
      ahead.push({ node: to, gapM: cumulative - travelledM });
    }
  }

  if (ahead.length === 0) return null;

  return (ahead.find((item) => item.gapM > LOOKAHEAD_M) ?? ahead[0]).node;
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
