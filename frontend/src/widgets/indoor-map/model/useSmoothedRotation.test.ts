import { act, renderHook } from '@testing-library/react';
import { shortestAngleDeltaDeg, useSmoothedRotationDeg } from './useSmoothedRotation';

describe('shortestAngleDeltaDeg', () => {
  it('경계를 넘어도 짧은 쪽으로 잰다', () => {
    // 그냥 빼면 -358°다. 실제로는 오른쪽으로 2° 돈 것이다.
    expect(shortestAngleDeltaDeg(179, -179)).toBeCloseTo(2, 6);
    expect(shortestAngleDeltaDeg(-179, 179)).toBeCloseTo(-2, 6);
  });

  it('한 바퀴 차이는 0으로 본다', () => {
    expect(shortestAngleDeltaDeg(30, 390)).toBeCloseTo(0, 6);
    expect(shortestAngleDeltaDeg(-250, 110)).toBeCloseTo(0, 6);
  });

  it('같은 방향이면 0이다', () => {
    expect(shortestAngleDeltaDeg(-68.72, -68.72)).toBe(0);
  });
});

/**
 * 프레임을 직접 돌린다. 실제 rAF에 맡기면 몇 프레임이 언제 오는지 정할 수 없어 수렴 과정을
 * 검사할 수 없다. 예약 횟수도 센다 — 흔들리는 동안 루프가 멈추지 않으면 발열로 이어지므로
 * 그것 자체가 검사 대상이다.
 */
function createFrameDriver() {
  let clock = 0;
  let nextId = 1;
  let requested = 0;
  const pending = new Map<number, FrameRequestCallback>();

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    requested += 1;
    const id = nextId++;
    pending.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pending.delete(id);
  });

  return {
    /** 프레임 하나를 진행한다. 그 프레임이 예약한 다음 프레임은 다음 호출에서 돈다. */
    advance(ms: number) {
      clock += ms;
      const due = [...pending.values()];
      pending.clear();
      act(() => {
        due.forEach((callback) => callback(clock));
      });
    },
    get requested() {
      return requested;
    },
    resetCount() {
      requested = 0;
    },
    get running() {
      return pending.size > 0;
    },
  };
}

describe('useSmoothedRotationDeg', () => {
  let driver: ReturnType<typeof createFrameDriver>;

  beforeEach(() => {
    driver = createFrameDriver();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mount = (deg: number | null) =>
    renderHook(({ target }) => useSmoothedRotationDeg(target, { inputTauMs: 500, holdDeg: 8 }), {
      initialProps: { target: deg },
    });

  it('방향을 모르면 돌리지 않는다', () => {
    const { result } = mount(null);

    driver.advance(16);

    expect(result.current).toBeNull();
  });

  it('첫 방향은 붙여서 보여준다', () => {
    // 0°에서 애니메이션으로 들어오면 방향을 처음 잡는 순간 지도가 크게 도는 것으로 보인다.
    const { result } = mount(-140);

    driver.advance(16);

    expect(result.current).toBe(-140);
  });

  it('방향을 잃으면 다시 잡을 때 그 각도에서 시작한다', () => {
    const { result, rerender } = mount(0);
    driver.advance(16);

    rerender({ target: null });
    driver.advance(16);
    expect(result.current).toBeNull();

    // 앵커가 다시 잡힌 것이다. 이전 각도에서 끌어오면 사용자가 돌지 않았는데 지도가 돈다.
    rerender({ target: 150 });
    driver.advance(16);
    expect(result.current).toBe(150);
  });

  /**
   * 방향이 멈춘 뒤에도 수렴해야 한다. 갱신이 끊긴 자리에 서면 지도가 실제 방향에 크게 못 미친다.
   *
   * 정확히 닿지는 않는다 — 따라가기는 차이가 `RELEASE_DEG` 안에 들면 놓아 주고 그 뒤로는
   * 문턱이 잡으므로, 놓는 순간 고르기가 덜 따라온 만큼이 남는다. 보장되는 상한은 문턱(8°)이고
   * 실제로는 몇 도다. 지도에서 구분되지 않는 크기다.
   */
  it('실제 회전을 끝까지 따라간다', () => {
    const { result, rerender } = mount(0);
    driver.advance(16);

    rerender({ target: 90 });
    for (let index = 0; index < 400; index += 1) driver.advance(16);

    expect(Math.abs(shortestAngleDeltaDeg(result.current!, 90))).toBeLessThan(4);
  });

  it('경계를 넘어도 짧은 쪽으로 돈다', () => {
    const { result, rerender } = mount(170);
    driver.advance(16);

    rerender({ target: -160 });

    const path: number[] = [];
    for (let index = 0; index < 400; index += 1) {
      driver.advance(16);
      path.push(result.current!);
    }

    // 170°와 200° 사이만 지난다. 반대쪽으로 돌았다면 0°를 지났을 것이다.
    path.forEach((deg) => {
      expect(deg).toBeGreaterThanOrEqual(169);
      expect(deg).toBeLessThanOrEqual(201);
    });
    // 200°는 -160°와 같은 방향이다.
    expect(Math.abs(shortestAngleDeltaDeg(result.current!, 200))).toBeLessThan(4);
  });

  /**
   * 걸음 흔들림. (S15P11A206-79)
   *
   * 1차 실기기 검증에서 손에 들고 걸을 때 1초 창의 yaw 회전량 중앙값이 23.5°였다(11.4).
   * 그 폭을 ±12°·1.5Hz로 흘려 넣고, 지도가 반응하지 않는지와 **루프가 화면을 다시 그리지
   * 않는지**를 함께 본다. 둘째가 발열의 원인이었다.
   */
  describe('걸음 흔들림', () => {
    const WOBBLE_DEG = 12;
    const WOBBLE_HZ = 1.5;
    /** 방향 채널의 최소 간격(`PROVISIONAL_HEADING_MIN_INTERVAL_MS`)과 같다. */
    const EVENT_MS = 120;

    function walk(rerender: (props: { target: number | null }) => void, seconds: number) {
      const samples: number[] = [];
      const events = Math.round((seconds * 1000) / EVENT_MS);

      for (let index = 0; index < events; index += 1) {
        const at = (index * EVENT_MS) / 1000;
        rerender({ target: WOBBLE_DEG * Math.sin(2 * Math.PI * WOBBLE_HZ * at) });
        // 한 이벤트 사이를 여러 프레임으로 나눠 진행한다.
        for (let f = 0; f < 8; f += 1) driver.advance(15);
        samples.push(at);
      }

      return { events };
    }

    it('흔들리는 동안 지도가 돌지 않는다', () => {
      const { result, rerender } = mount(0);
      driver.advance(16);

      const seen: number[] = [];
      for (let index = 0; index < 40; index += 1) {
        const at = (index * EVENT_MS) / 1000;
        rerender({ target: WOBBLE_DEG * Math.sin(2 * Math.PI * WOBBLE_HZ * at) });
        for (let f = 0; f < 8; f += 1) driver.advance(15);
        if (index > 10) seen.push(result.current!);
      }

      // 고르기가 ±12°를 ±2.5° 아래로 줄이고 8° 문턱이 나머지를 막는다.
      const swing = Math.max(...seen) - Math.min(...seen);
      expect(swing).toBeLessThan(3);
    });

    it('흔들리는 동안 화면을 다시 그리지 않는다', () => {
      const { result, rerender } = mount(0);
      driver.advance(16);

      const before = result.current;
      let renders = 0;
      for (let index = 0; index < 40; index += 1) {
        const at = (index * EVENT_MS) / 1000;
        rerender({ target: WOBBLE_DEG * Math.sin(2 * Math.PI * WOBBLE_HZ * at) });
        for (let f = 0; f < 8; f += 1) {
          const previous = result.current;
          driver.advance(15);
          if (result.current !== previous) renders += 1;
        }
      }

      // 표시 각도가 문턱 안이면 상태를 바꾸지 않는다. 프레임은 돌지만 지도는 다시 그려지지 않는다.
      expect(renders).toBe(0);
      expect(result.current).toBe(before);
    });

    it('흔들림이 멎으면 프레임 루프도 멈춘다', () => {
      const { rerender } = mount(30);
      driver.advance(16);

      // 방향이 더 오지 않는 상태. 고르기가 목표에 닿으면 루프를 놓아야 한다.
      rerender({ target: 30 });
      for (let index = 0; index < 400; index += 1) driver.advance(16);

      expect(driver.running).toBe(false);
    });

    it('흔들림 중에도 실제 회전은 통과시킨다', () => {
      const { result, rerender } = mount(0);
      driver.advance(16);

      walk(rerender, 2);
      // 흔들림을 얹은 채로 90° 방향을 바꾼다.
      for (let index = 0; index < 40; index += 1) {
        const at = (index * EVENT_MS) / 1000;
        rerender({ target: 90 + WOBBLE_DEG * Math.sin(2 * Math.PI * WOBBLE_HZ * at) });
        for (let f = 0; f < 8; f += 1) driver.advance(15);
      }

      expect(Math.abs(shortestAngleDeltaDeg(result.current!, 90))).toBeLessThan(8);
    });
  });
});
