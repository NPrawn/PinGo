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
   * 보면 그 경계 위에서 흔들린다. 경계를 넘을 때 값을 그대로 쓰면 30° 회전이 330° 역회전으로
   * 그려져 지도가 반대로 크게 돈다.
   */
  it('경계를 넘어도 짧은 쪽으로 돈다', () => {
    const { result, rerender } = renderHook(({ deg }) => useSmoothedRotationDeg(deg, 180), {
      initialProps: { deg: 170 },
    });
    advance(16);

    rerender({ deg: -160 });

    const path: number[] = [];
    for (let index = 0; index < 120; index += 1) {
      advance(16);
      path.push(result.current!);
    }

    // 지나온 각도가 모두 170°와 200° 사이다. 반대쪽으로 돌았다면 0°를 지났을 것이다.
    path.forEach((deg) => {
      expect(deg).toBeGreaterThanOrEqual(170);
      expect(deg).toBeLessThanOrEqual(200);
    });
    // 200°는 -160°와 같은 방향이다. 한 바퀴를 더 감지 않고 그 자리에 선다.
    expect(result.current).toBeCloseTo(200, 1);
  });

  /**
   * 걷는 동안 손에 든 단말의 yaw는 걸음마다 좌우로 오간다. 그 폭에 지도가 반응하면 5.4배로
   * 당겨진 화면에서 도면이 계속 쓸린다. 시간 상수로는 갈라낼 수 없어(실제 회전과 시간 규모가
   * 겹친다) 크기로 가른다.
   */
  describe('걸음 흔들림', () => {
    it('문턱 안에서 오가는 동안은 지도를 잡아 둔다', () => {
      const { result, rerender } = renderHook(
        ({ deg }) => useSmoothedRotationDeg(deg, 250, 12),
        { initialProps: { deg: 0 } },
      );
      advance(16);

      for (let cycle = 0; cycle < 5; cycle += 1) {
        rerender({ deg: -5 });
        for (let index = 0; index < 30; index += 1) advance(16);
        rerender({ deg: 5 });
        for (let index = 0; index < 30; index += 1) advance(16);
      }

      expect(result.current).toBe(0);
    });

    it('문턱을 넘으면 따라간다', () => {
      const { result, rerender } = renderHook(
        ({ deg }) => useSmoothedRotationDeg(deg, 250, 12),
        { initialProps: { deg: 0 } },
      );
      advance(16);

      rerender({ deg: 90 });
      for (let index = 0; index < 120; index += 1) advance(16);

      expect(result.current).toBeCloseTo(90, 1);
    });

    /**
     * 한 번 돌기 시작하면 목표에 닿을 때까지 따라간다. 문턱에서 멈춰 서면 실제로 돈 뒤에도
     * 최대 12°가 어긋난 채로 남는다.
     */
    it('돌기 시작하면 문턱보다 작게 남은 차이도 마저 따라간다', () => {
      const { result, rerender } = renderHook(
        ({ deg }) => useSmoothedRotationDeg(deg, 250, 12),
        { initialProps: { deg: 0 } },
      );
      advance(16);

      rerender({ deg: 30 });
      for (let index = 0; index < 8; index += 1) advance(16);
      // 아직 가는 중이다. 남은 차이가 곧 문턱 아래로 내려간다.
      expect(result.current).toBeLessThan(30);

      // 문턱 아래로 내려가도 멈추지 않고 목표까지 간다.
      for (let index = 0; index < 120; index += 1) advance(16);
      expect(result.current).toBeCloseTo(30, 1);
    });
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
