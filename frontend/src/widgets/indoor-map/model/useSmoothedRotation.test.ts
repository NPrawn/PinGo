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
 * 프레임을 직접 돌린다. 실제 rAF에 맡기면 몇 프레임이 언제 오는지 정할 수 없어
 * 수렴 과정을 검사할 수 없다.
 */
function createFrameDriver() {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId++;
    pending.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pending.delete(id);
  });

  /** 프레임 하나를 진행한다. 그 프레임이 예약한 다음 프레임은 다음 호출에서 돈다. */
  return function advance(ms: number) {
    now += ms;
    const due = [...pending.entries()];
    pending.clear();
    act(() => {
      due.forEach(([, callback]) => callback(now));
    });
  };
}

describe('useSmoothedRotationDeg', () => {
  let advance: (ms: number) => void;

  beforeEach(() => {
    advance = createFrameDriver();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('방향을 모르면 돌리지 않는다', () => {
    const { result } = renderHook(() => useSmoothedRotationDeg(null));

    advance(16);

    expect(result.current).toBeNull();
  });

  it('첫 방향은 붙여서 보여준다', () => {
    // 0°에서 애니메이션으로 들어오면 방향을 처음 잡는 순간 지도가 크게 도는 것으로 보인다.
    const { result } = renderHook(() => useSmoothedRotationDeg(-140));

    advance(16);

    expect(result.current).toBe(-140);
  });

  it('갱신을 한 프레임에 다 반영하지 않는다', () => {
    const { result, rerender } = renderHook(({ deg }) => useSmoothedRotationDeg(deg, 180), {
      initialProps: { deg: 0 },
    });
    advance(16); // 첫 방향을 붙인다

    rerender({ deg: 20 });
    advance(0); // 루프를 다시 걸면 첫 프레임은 시각만 잡는다
    advance(16);

    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(20);
  });

  it('결국 목표 방향에 닿는다', () => {
    const { result, rerender } = renderHook(({ deg }) => useSmoothedRotationDeg(deg, 180), {
      initialProps: { deg: 0 },
    });
    advance(16);

    rerender({ deg: 20 });
    for (let index = 0; index < 120; index += 1) advance(16);

    expect(result.current).toBeCloseTo(20, 3);
  });

  /**
   * 회전 표시의 핵심이다. 방향각은 `atan2`라 `(-180, 180]`을 도는데, 미터 프레임 +X 반대쪽을
   * 보면 그 경계 위에서 흔들린다. 경계를 넘을 때 값을 그대로 쓰면 2° 흔들림이 358° 회전으로
   * 그려져 지도가 한 바퀴 돈다.
   */
  it('경계를 넘어도 한 바퀴 돌지 않는다', () => {
    const { result, rerender } = renderHook(({ deg }) => useSmoothedRotationDeg(deg, 180), {
      initialProps: { deg: 179 },
    });
    advance(16);

    rerender({ deg: -179 });

    const path: number[] = [];
    for (let index = 0; index < 120; index += 1) {
      advance(16);
      path.push(result.current!);
    }

    // 지나온 각도가 모두 179°와 181° 사이다. 반대쪽으로 돌았다면 0°를 지났을 것이다.
    path.forEach((deg) => {
      expect(deg).toBeGreaterThanOrEqual(179);
      expect(deg).toBeLessThanOrEqual(181);
    });
    // 181°는 -179°와 같은 방향이다. 한 바퀴를 더 감지 않고 그 자리에 선다.
    expect(result.current).toBeCloseTo(181, 3);
  });

  it('방향을 잃으면 다시 잡을 때 그 각도에서 시작한다', () => {
    const { result, rerender } = renderHook(({ deg }) => useSmoothedRotationDeg(deg, 180), {
      initialProps: { deg: 0 as number | null },
    });

    advance(16);

    rerender({ deg: null });
    advance(16);
    expect(result.current).toBeNull();

    // 앵커가 다시 잡힌 것이다. 이전 각도에서 끌어오면 사용자가 돌지 않았는데 지도가 돈다.
    rerender({ deg: 150 });
    advance(16);
    expect(result.current).toBe(150);
  });
});
