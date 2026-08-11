/**
 * 방향각 표본을 받아들일지 버릴지 정한다. (S15P11A206-382)
 *
 * **평활이 아니다.** 값을 섞지 않고 받아들이거나 버린다. 평활은 두 곳에서 따로 한다 — 지도
 * 회전은 표시 단계에서 시간 상수로 고르고(`useSmoothedRotationDeg`), 화살표는 CSS 전환으로
 * 잇는다. 여기서 하는 일은 그 앞에서 **말이 안 되는 표본을 흘려보내지 않는 것**이다.
 *
 * 왜 필요한가. QA에서 화살표가 튄다는 보고가 있었고, 원인을 따라가 보니 방향각이 원본 그대로
 * 화살표까지 갔다. 지도 회전만 걸러진 값을 쓰고 있어서 한 화면의 두 표시가 서로 다른 속도로
 * 움직였다. 표본을 출처에서 한 번 걸러 세 소비자(지도·화살표·방향 빔)가 같은 값을 쓰게 한다.
 *
 * **섞지 않고 버리는 이유.** 상한까지만 따라가게 두면(clamp) 엉뚱한 값이 들어와도 매 표본마다
 * 그쪽으로 조금씩 끌려간다. 버리면 끌려가지 않는다. 대신 정말 빠르게 돈 경우를 영구히 막지
 * 않도록 두 가지를 둔다 — 버린 표본은 시각을 갱신하지 않으므로 다음 표본에 허용량이 그만큼
 * 늘어나고, 그래도 계속 어긋나면 한도에서 받아들인다.
 */

/**
 * 사람이 낼 수 있는 회전 속도의 상한(도/초).
 *
 * **provisional이다.** 근거는 1차 실기기 실측이다 — 손에 들고 걸을 때 1초 창의 yaw 회전량
 * 중앙값이 23.5도였다(`docs/기술_의사결정_정리.md` 11.4). 걸으며 도는 정상값은 그보다 한참
 * 아래이므로, 이 상한은 제자리에서 빠르게 도는 것까지 통과시키면서 순간이동만 걸러낸다.
 *
 * 방향 채널의 최소 간격이 120ms이므로(`PROVISIONAL_HEADING_MIN_INTERVAL_MS`) 한 표본이 허용
 * 하는 변화는 약 29도다. 180도 뒤집힘은 0.75초를 채워야 통과한다.
 *
 * TODO: 실기기에서 확정한다. 빠르게 돌았을 때 따라오는 것이 늦으면 올리고, 튐이 남으면 내린다.
 */
export const PROVISIONAL_HEADING_MAX_RATE_DPS = 240;

/**
 * 연속으로 이만큼 버리면 그다음은 받아들인다.
 *
 * 버리기만 하면 방향이 굳는다. 우리가 모르는 사이에 실제로 방향이 크게 달라졌을 수 있고
 * (추적 상실 후 복귀가 그렇다) 그때 화면이 옛 방향을 영원히 가리키는 것이 가장 나쁘다.
 */
export const PROVISIONAL_HEADING_REJECT_LIMIT = 3;

/** 필터가 프레임 사이에 이어 가는 값. 부르는 쪽이 그대로 들고 있다가 다시 넘긴다. */
export interface HeadingFilterState {
  /** 마지막으로 받아들인 방향각(도). */
  deg: number;
  /** 그 값을 받아들인 시각(ms). 버린 표본은 이 값을 갱신하지 않는다. */
  atMs: number;
  /** 그 뒤로 연속해서 버린 표본 수. */
  rejected: number;
}

export interface HeadingFilterOptions {
  maxRateDps?: number;
  rejectLimit?: number;
}

export interface HeadingFilterResult {
  state: HeadingFilterState;
  /** 이번 표본을 버렸는지. 버렸으면 `state.deg`는 직전 값 그대로다. */
  rejected: boolean;
}

/**
 * 두 각도 사이의 최단 차이(도). 결과는 `[-180, 180)`이다.
 *
 * 각도를 그냥 빼면 179도와 -179도가 358도 떨어진 것으로 나온다. 실제로는 2도다.
 *
 * 지도 위젯에도 같은 함수가 있는데(`useSmoothedRotationDeg`) 그쪽을 가져다 쓰지 않는다. FSD
 * 에서 feature는 widget을 import할 수 없다. 여섯 줄을 공유하려고 층을 거스르는 대신 각자 둔다.
 */
function shortestAngleDeltaDeg(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/**
 * 방향각 표본 하나를 판정한다.
 *
 * 첫 표본은 그대로 받아들인다. 비교할 기준이 없고, 기준을 만들려고 버리면 방향이 한 표본 늦게
 * 붙는다.
 *
 * @param previous 직전 상태. 없으면 첫 표본이다.
 * @param degIn 들어온 방향각(도). 지도 프레임 기준이어야 한다 — 앵커가 갱신되면 XR 프레임 값은
 *   같아도 지도 프레임 값이 달라지므로, 부르는 쪽이 앵커 갱신 시 상태를 새로 세운다.
 * @param atMs 이 표본의 시각(ms).
 */
export function acceptHeading(
  previous: HeadingFilterState | null,
  degIn: number,
  atMs: number,
  options: HeadingFilterOptions = {},
): HeadingFilterResult {
  const {
    maxRateDps = PROVISIONAL_HEADING_MAX_RATE_DPS,
    rejectLimit = PROVISIONAL_HEADING_REJECT_LIMIT,
  } = options;

  // 값이 아니면 판정할 것이 없다. 직전 상태를 그대로 지킨다.
  if (!Number.isFinite(degIn)) {
    return previous
      ? { state: previous, rejected: true }
      : { state: { deg: 0, atMs, rejected: 0 }, rejected: true };
  }

  if (!previous) {
    return { state: { deg: degIn, atMs, rejected: 0 }, rejected: false };
  }

  /**
   * 같은 시각에 두 표본이 오면 허용량이 0이 되어 뒤엣것이 늘 버려진다. 최소 1ms로 둔다 —
   * 그래도 허용량이 0.24도라 사실상 버리지만, 0으로 나누는 자리를 만들지 않는다.
   */
  const elapsedMs = Math.max(atMs - previous.atMs, 1);
  const allowedDeg = (maxRateDps * elapsedMs) / 1000;
  const deltaDeg = shortestAngleDeltaDeg(previous.deg, degIn);

  if (Math.abs(deltaDeg) <= allowedDeg) {
    return { state: { deg: degIn, atMs, rejected: 0 }, rejected: false };
  }

  // 계속 어긋난다면 우리 기준이 낡은 것이다. 한도에서 새 값을 받아들인다.
  if (previous.rejected + 1 >= rejectLimit) {
    return { state: { deg: degIn, atMs, rejected: 0 }, rejected: false };
  }

  /**
   * 버린다. **시각을 갱신하지 않는다.**
   *
   * 마지막으로 받아들인 순간부터 얼마나 돌 수 있었는지가 판정 기준이므로, 버린 표본이 그
   * 기준을 앞당기면 안 된다. 그대로 두면 다음 표본의 허용량이 그만큼 늘어 정말 빠른 회전은
   * 곧 통과한다.
   */
  return {
    state: { deg: previous.deg, atMs: previous.atMs, rejected: previous.rejected + 1 },
    rejected: true,
  };
}
