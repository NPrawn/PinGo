import {
  PROVISIONAL_HEADING_MAX_RATE_DPS,
  PROVISIONAL_HEADING_REJECT_LIMIT,
  acceptHeading,
  type HeadingFilterState,
} from './headingFilter';

/** 방향 채널의 최소 간격. 이 간격으로 표본이 온다고 보고 허용량을 계산한다. */
const INTERVAL_MS = 120;
/** 한 표본이 허용하는 변화. 240도/초 × 0.12초 = 28.8도. */
const ALLOWED_DEG = (PROVISIONAL_HEADING_MAX_RATE_DPS * INTERVAL_MS) / 1000;

function settled(deg: number, atMs = 0): HeadingFilterState {
  return { deg, atMs, rejected: 0 };
}

describe('acceptHeading', () => {
  it('첫 표본은 그대로 받아들인다', () => {
    const { state, rejected } = acceptHeading(null, 42, 1000);

    expect(rejected).toBe(false);
    expect(state.deg).toBe(42);
  });

  it('허용 속도 안이면 받아들인다', () => {
    const { state, rejected } = acceptHeading(settled(0), ALLOWED_DEG - 1, INTERVAL_MS);

    expect(rejected).toBe(false);
    expect(state.deg).toBeCloseTo(ALLOWED_DEG - 1);
  });

  /** 걸으며 흔들리는 폭(±12도 수준)은 그냥 통과해야 한다. 필터가 정상 보행을 막으면 안 된다. */
  it('걸음 흔들림 정도는 막지 않는다', () => {
    const { rejected } = acceptHeading(settled(0), 12, INTERVAL_MS);

    expect(rejected).toBe(false);
  });

  it('한 표본에서 물리적으로 불가능한 변화는 버린다', () => {
    const { state, rejected } = acceptHeading(settled(0), 180, INTERVAL_MS);

    expect(rejected).toBe(true);
    // 직전 값이 그대로 남는다.
    expect(state.deg).toBe(0);
  });

  /** 179도와 -179도는 2도 차이다. 그냥 빼면 358도로 읽혀 정상 회전이 버려진다. */
  it('부호가 뒤집히는 경계에서 최단 차이로 본다', () => {
    const { rejected } = acceptHeading(settled(179), -179, INTERVAL_MS);

    expect(rejected).toBe(false);
  });

  /**
   * 버린 표본은 시각을 갱신하지 않으므로, 시간이 지나면 같은 값이 허용량 안에 들어온다.
   * 정말 빠르게 돈 회전이 영구히 막히지 않는다.
   */
  it('시간이 지나면 큰 변화도 통과한다', () => {
    const first = acceptHeading(settled(0), 180, INTERVAL_MS);
    expect(first.rejected).toBe(true);

    // 마지막으로 받아들인 시각(0ms)에서 0.8초가 지나면 192도까지 허용된다.
    const later = acceptHeading(first.state, 180, 800);

    expect(later.rejected).toBe(false);
    expect(later.state.deg).toBe(180);
  });

  /**
   * 버리기만 하면 방향이 굳는다. 추적이 끊겼다 돌아온 뒤처럼 우리 기준이 낡은 경우에는
   * 새 값을 받아들여야 한다.
   */
  it('연속 한도를 넘으면 받아들인다', () => {
    let state = settled(0);

    for (let attempt = 1; attempt < PROVISIONAL_HEADING_REJECT_LIMIT; attempt += 1) {
      // 시각을 고정해 허용량이 늘어나지 않게 두고, 한도만 확인한다.
      const result = acceptHeading(state, 180, 1);
      expect(result.rejected).toBe(true);
      state = result.state;
    }

    const final = acceptHeading(state, 180, 1);

    expect(final.rejected).toBe(false);
    expect(final.state.deg).toBe(180);
    expect(final.state.rejected).toBe(0);
  });

  it('받아들이면 연속 카운터가 초기화된다', () => {
    const rejectedOnce = acceptHeading(settled(0), 180, 1);
    expect(rejectedOnce.state.rejected).toBe(1);

    const accepted = acceptHeading(rejectedOnce.state, 5, INTERVAL_MS);

    expect(accepted.rejected).toBe(false);
    expect(accepted.state.rejected).toBe(0);
  });

  it('숫자가 아닌 값은 직전 상태를 지킨다', () => {
    const { state, rejected } = acceptHeading(settled(30), Number.NaN, INTERVAL_MS);

    expect(rejected).toBe(true);
    expect(state.deg).toBe(30);
  });
});
