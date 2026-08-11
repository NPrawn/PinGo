import { act, renderHook } from '@testing-library/react';
import { useUnwrappedDeg } from './useUnwrappedDeg';

/**
 * 프레임을 직접 돌린다. 실제 rAF에 맡기면 언제 도는지 정할 수 없어 값이 세워졌는지 확인할 수
 * 없다. 지도 회전 훅의 테스트와 같은 방식이다.
 */
function createFrameDriver() {
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

  return {
    /** 예약된 프레임을 모두 실행한다. */
    flush(): void {
      const callbacks = [...pending.entries()];
      pending.clear();
      for (const [, callback] of callbacks) callback(0);
    },
  };
}

describe('useUnwrappedDeg', () => {
  let frames: ReturnType<typeof createFrameDriver>;

  beforeEach(() => {
    frames = createFrameDriver();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function render(initial: number | null) {
    const view = renderHook(({ target }: { target: number | null }) => useUnwrappedDeg(target), {
      initialProps: { target: initial },
    });

    act(() => {
      frames.flush();
    });

    /**
     * 목표를 바꾸고 프레임을 돌린다. **두 단계를 나눈다.** 한 `act` 안에서 함께 하면 effect가
     * 아직 새 프레임을 예약하지 않은 상태에서 돌리게 되어 값이 갱신되지 않는다.
     */
    const set = (target: number | null) => {
      act(() => {
        view.rerender({ target });
      });
      act(() => {
        frames.flush();
      });
    };

    return { ...view, set };
  }

  it('첫 각도는 그대로 내놓는다', () => {
    const { result } = render(42);

    expect(result.current).toBeCloseTo(42, 6);
  });

  it('그릴 것이 없으면 null이다', () => {
    const { result } = render(null);

    expect(result.current).toBeNull();
  });

  /**
   * 이 훅의 존재 이유. 경계를 넘을 때 358도가 아니라 2도만 움직여야 한다 — 그래야 뒤를 보는
   * 동안 화살표가 한 바퀴 돌지 않고 뒤를 계속 가리킨다.
   */
  it('경계를 넘어도 조금씩만 움직인다', () => {
    const { result, set } = render(179);

    // 179 → -179 는 오른쪽으로 2도다. 358도가 아니다.
    set(-179);
    expect(result.current).toBeCloseTo(181, 6);

    // 181(= -179)에서 175로 돌아오는 것은 왼쪽으로 6도다.
    set(175);
    expect(result.current).toBeCloseTo(175, 6);
  });

  /** 뒤를 보며 좌우로 흔들어도 감긴 바퀴가 쌓이지 않아야 한다. */
  it('좌우로 흔들면 제자리에서 오간다', () => {
    const { result, set } = render(170);

    for (const target of [-170, 170, -170, 170]) set(target);

    // 네 번 흔든 뒤에도 처음 자리에서 20도 안쪽이다. 한 바퀴씩 감겼다면 720도가 쌓인다.
    expect(Math.abs((result.current ?? 0) - 170)).toBeLessThanOrEqual(20.000001);
  });

  /** 화살표가 사라진 뒤 다시 나타나면 새 각도에서 시작한다. 감아 둔 바퀴를 이어 붙이지 않는다. */
  it('null을 지나면 감아 둔 바퀴를 버린다', () => {
    const { result, set } = render(179);

    set(-179);
    expect(result.current).toBeCloseTo(181, 6);

    set(null);
    expect(result.current).toBeNull();

    set(-170);
    expect(result.current).toBeCloseTo(-170, 6);
  });
});
