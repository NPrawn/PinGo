import { act, render } from '@testing-library/react';
import { useMapGestures, type FollowOptions, type MapView } from './useMapGestures';

/**
 * 시점 추종. (S15P11A206-79)
 *
 * 훅이 화면 크기를 ResizeObserver로 읽으므로 **ref가 실제 요소에 붙어 있어야** 한다.
 * `renderHook`만으로는 붙일 곳이 없어 작은 하네스를 렌더한다.
 *
 * jsdom에는 ResizeObserver가 없어 크기를 알려주는 가짜를 심는다.
 */
const CANVAS = { width: 1699, height: 992 };
const BOX = { width: 314, height: 291 };
const SPAN_PX = 60 / 0.19;
const ANCHOR_Y = 0.68;

function stubResizeObserver({ width, height }: { width: number; height: number }) {
  class Stub {
    // 매개변수 프로퍼티는 erasableSyntaxOnly에서 쓸 수 없어 필드로 둔다.
    callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe() {
      this.callback(
        [{ contentRect: { width, height } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }

    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', Stub);
}

/** 검사에 쓰는 것만 노출한다. ref까지 넘기면 렌더 중 읽는 것으로 판정된다. */
type Gestures = Omit<ReturnType<typeof useMapGestures>, 'ref'>;

function Harness({ options, expose }: { options: FollowOptions; expose: (g: Gestures) => void }) {
  // 훅 반환값을 그대로 들고 다니면 ref 전달이 나머지 속성 접근까지 오염된 것으로 판정된다.
  const { ref, view, reset, zoomBy, isFollowing, isTransformed, handlers } =
    useMapGestures(options);
  expose({ view, reset, zoomBy, isFollowing, isTransformed, handlers });
  // 실제 사용처와 같이 ref를 요소에 붙인다. 붙지 않으면 크기를 관찰하지 못해 추종이 꺼진다.
  return <div ref={ref} {...handlers} />;
}

function mount(options: FollowOptions) {
  const state: { current: Gestures | null } = { current: null };
  const view = render(<Harness options={options} expose={(g) => (state.current = g)} />);
  const rerender = (next: FollowOptions) =>
    view.rerender(<Harness options={next} expose={(g) => (state.current = g)} />);
  return { state, rerender };
}

const followOptions = (
  target: { px: number; py: number } | null,
  rotationDeg: number | null = null,
): FollowOptions => ({
  target,
  canvas: CANVAS,
  spanPx: SPAN_PX,
  anchorY: ANCHOR_Y,
  rotationDeg,
});

/**
 * 변환을 거쳤을 때 캔버스 점이 화면 어디에 오는지.
 *
 * `translate(x, y) rotate(r) scale(s)`를 박스 중심 기준으로 푼 것이다. 컴포넌트가 stage에
 * 거는 것과 같은 식이어야 검사가 의미를 갖는다.
 */
function screenOf(view: MapView, target: { px: number; py: number }) {
  const fit = Math.min(BOX.width / CANVAS.width, BOX.height / CANVAS.height);
  const dx = BOX.width / 2 + (target.px - CANVAS.width / 2) * fit - BOX.width / 2;
  const dy = BOX.height / 2 + (target.py - CANVAS.height / 2) * fit - BOX.height / 2;
  const radians = (view.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: BOX.width / 2 + view.scale * (cos * dx - sin * dy) + view.x,
    y: BOX.height / 2 + view.scale * (sin * dx + cos * dy) + view.y,
  };
}

function pointer(pointerId: number, clientX: number, clientY: number) {
  return {
    pointerId,
    clientX,
    clientY,
    currentTarget: { getBoundingClientRect: () => BOX as DOMRect },
  } as unknown as React.PointerEvent<HTMLElement>;
}

describe('시점 추종', () => {
  beforeEach(() => {
    stubResizeObserver(BOX);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('내 위치를 화면 가운데 아래쪽 앵커에 붙인다', () => {
    const target = { px: 1200, py: 400 };
    const { state } = mount(followOptions(target));

    expect(state.current?.isFollowing).toBe(true);

    const screen = screenOf(state.current!.view, target);
    expect(screen.x).toBeCloseTo(BOX.width / 2, 0);
    expect(screen.y).toBeCloseTo(BOX.height * ANCHOR_Y, 0);
  });

  it('화면 가로에 지정한 만큼만 담는다', () => {
    // 전체 조망(약 320m)에서 60m로 좁히는 것이 걷기 안내의 핵심이다.
    const { state } = mount(followOptions({ px: 1200, py: 400 }));
    const fit = Math.min(BOX.width / CANVAS.width, BOX.height / CANVAS.height);
    const metresAcross = BOX.width / (state.current!.view.scale * fit) / (1 / 0.19);

    expect(metresAcross).toBeCloseTo(60, 0);
  });

  it('목표가 움직여도 앵커 자리는 그대로다', () => {
    const { state, rerender } = mount(followOptions({ px: 1200, py: 400 }));
    const before = state.current!.view.x;

    rerender(followOptions({ px: 1300, py: 400 }));

    expect(state.current!.view.x).not.toBeCloseTo(before, 1);
    const screen = screenOf(state.current!.view, { px: 1300, py: 400 });
    expect(screen.x).toBeCloseTo(BOX.width / 2, 0);
    expect(screen.y).toBeCloseTo(BOX.height * ANCHOR_Y, 0);
  });

  it('손으로 밀면 추종이 풀린다', () => {
    // 다른 곳을 보려는 조작이므로 시점을 도로 끌어오면 안 된다.
    const { state } = mount(followOptions({ px: 1200, py: 400 }));

    act(() => {
      state.current!.handlers.onPointerDown(pointer(1, 100, 100));
      state.current!.handlers.onPointerMove(pointer(1, 160, 130));
    });

    expect(state.current?.isFollowing).toBe(false);
  });

  it('풀리는 순간의 화면을 이어받는다', () => {
    // 추종 시점과 자유 시점이 다르면 손대는 순간 지도가 튄다.
    const { state } = mount(followOptions({ px: 1200, py: 400 }));
    const followed = state.current!.view;

    act(() => {
      state.current!.handlers.onPointerDown(pointer(1, 100, 100));
      // 문턱(4px) 아래로 움직여 추종만 풀고 이동은 일으키지 않는다.
      state.current!.handlers.onPointerMove(pointer(1, 101, 100));
    });

    expect(state.current!.view.scale).toBeCloseTo(followed.scale, 3);
  });

  it('되돌리면 다시 따라간다', () => {
    const { state } = mount(followOptions({ px: 1200, py: 400 }));

    act(() => {
      state.current!.handlers.onPointerDown(pointer(1, 100, 100));
      state.current!.handlers.onPointerMove(pointer(1, 160, 130));
    });
    act(() => {
      state.current!.reset();
    });

    expect(state.current?.isFollowing).toBe(true);
  });

  /**
   * 추종 대상이 사라진 뒤에는 이어받을 것이 없다. (S15P11A206-89)
   *
   * 예전에는 마지막 추종 시점을 계속 들고 있었다. 그래서 상담자 화면에서 `자유 탐색`으로 바꾼 뒤
   * (추종 대상이 없어진다) 시점을 되돌리고 지도를 밀면, 한참 전 사용자를 좇던 확대 시점이
   * 되살아나 화면이 갑자기 튀면서 확대됐다.
   */
  it('추종 대상이 없어진 뒤 되돌려 밀면 확대 시점이 되살아나지 않는다', () => {
    const { state, rerender } = mount(followOptions({ px: 1200, py: 400 }));

    // 사용자를 좇는 동안에는 확대돼 있다. 이 값이 되살아나면 안 되는 그 값이다.
    expect(state.current!.view.scale).toBeGreaterThan(1);

    // 자유 탐색으로 바꾼다. 추종할 대상이 없어진다.
    act(() => {
      rerender(followOptions(null));
    });
    // 새로고침 버튼. 시점을 되돌리고 추종 표시를 다시 세운다.
    act(() => {
      state.current!.reset();
    });

    expect(state.current!.view).toEqual({ scale: 1, x: 0, y: 0, rotation: 0 });

    act(() => {
      state.current!.handlers.onPointerDown(pointer(1, 100, 100));
      // 문턱을 넘겨 추종을 푼다. 여기서 옛 시점을 이어받으면 화면이 튄다.
      state.current!.handlers.onPointerMove(pointer(1, 160, 130));
    });

    expect(state.current!.view.scale).toBe(1);
  });

  /**
   * 이어받은 추종 시점을 밀 때 지도가 튀지 않는다. (S15P11A206-206)
   *
   * 추종은 내 위치를 화면 아래쪽에 붙이려고 이동량을 일부러 자르지 않는다. 그래서 도면
   * 가장자리를 좇는 시점은 손 조작의 이동 한계를 넘어 있는데, 예전에는 손을 대는 순간 그 값이
   * 한계로 끌려왔다. 6px 밀었는데 지도가 200px 움직여 내 위치 마커가 화면 밖으로 나갔다.
   *
   * 이 좌표는 한계를 194px 넘는다(박스 314×291, 추종 배율 5.38).
   */
  it('한계를 넘은 추종 시점을 이어받아 밀어도 끌은 만큼만 움직인다', () => {
    const target = { px: 1650, py: 950 };
    const { state } = mount(followOptions(target, -45));

    expect(screenOf(state.current!.view, target).x).toBeCloseTo(BOX.width / 2, 0);

    /*
      **이동 이벤트가 두 번 필요하다.** 문턱을 넘는 첫 이벤트는 추종을 풀고 그 시점을 그대로
      이어받는 데 쓰인다 — `releaseFollow`가 `setFollowing` 갱신 함수 안에서 `setView`를
      부르므로, 그 값이 같은 배치의 이동 갱신보다 나중에 적용되어 델타를 덮는다. 지도가 튀는 것은
      이어받은 시점에서 **실제로 미는** 그 다음 이벤트다.
    */
    act(() => {
      state.current!.handlers.onPointerDown(pointer(1, 100, 100));
      state.current!.handlers.onPointerMove(pointer(1, 106, 100));
    });

    expect(state.current?.isFollowing).toBe(false);
    const inherited = screenOf(state.current!.view, target);
    // 이어받은 직후에는 아직 앵커 자리다.
    expect(inherited.x).toBeCloseTo(BOX.width / 2, 0);

    const dragPx = 6;

    act(() => {
      state.current!.handlers.onPointerMove(pointer(1, 106 + dragPx, 100));
    });

    const after = screenOf(state.current!.view, target);
    expect(after.x).toBeCloseTo(inherited.x + dragPx, 0);
    expect(after.y).toBeCloseTo(inherited.y, 0);
  });

  /**
   * 넘어 있는 여유는 되돌아올 뿐 더 벌어지지 않는다.
   *
   * 한계를 넘은 값을 그대로 허용하기만 하면 그 방향으로 계속 밀 수 있게 되어, 도면을 화면 밖으로
   * 내보내고 되돌릴 방법이 없어진다. `clamp`가 애초에 있는 이유가 그것이다.
   */
  it('한계를 넘은 방향으로 더 밀리지는 않는다', () => {
    const target = { px: 1650, py: 950 };
    const { state } = mount(followOptions(target, -45));

    // 추종 시점의 x는 음수로 한계를 넘어 있다.
    const inherited = state.current!.view.x;
    expect(inherited).toBeLessThan(0);

    act(() => {
      state.current!.handlers.onPointerDown(pointer(1, 300, 100));
      // 첫 이동은 추종을 풀고 그 시점을 이어받는다(위 테스트 주석).
      state.current!.handlers.onPointerMove(pointer(1, 290, 100));
    });
    act(() => {
      // 넘어 있는 방향(왼쪽)으로 더 밀어 본다.
      state.current!.handlers.onPointerMove(pointer(1, 190, 100));
    });

    expect(state.current!.view.x).toBeCloseTo(inherited, 5);
  });

  it('목표를 모르면 추종하지 않는다', () => {
    // 위치 인식 전이다. 전체 조망을 그대로 보여준다.
    const { state } = mount(followOptions(null));

    expect(state.current?.isFollowing).toBe(false);
    expect(state.current?.view).toEqual({ scale: 1, x: 0, y: 0, rotation: 0 });
  });

  /** 진행 방향이 화면 위를 향하게 지도를 돌린다. */
  describe('진행 방향 회전', () => {
    it('돌려도 내 위치는 앵커에 그대로 있다', () => {
      // 회전축이 내 위치가 아니면 돌 때마다 내가 화면에서 미끄러진다.
      const target = { px: 1200, py: 400 };
      const { state } = mount(followOptions(target, -35));

      expect(state.current!.view.rotation).toBe(-35);
      const screen = screenOf(state.current!.view, target);
      expect(screen.x).toBeCloseTo(BOX.width / 2, 0);
      expect(screen.y).toBeCloseTo(BOX.height * ANCHOR_Y, 0);
    });

    it('내 앞쪽이 화면 위로 온다', () => {
      /*
       * 캔버스에서 0도는 오른쪽, 위는 -90도다. 방향각 φ를 위로 세우려면 -90 - φ만큼 돌린다.
       * 내 위치에서 진행 방향으로 20m 앞선 점이 화면에서 위쪽에 놓이는지로 확인한다.
       */
      const headingDeg = 30;
      const target = { px: 1200, py: 400 };
      const aheadPx = 20 / 0.19;
      const ahead = {
        px: target.px + aheadPx * Math.cos((headingDeg * Math.PI) / 180),
        py: target.py + aheadPx * Math.sin((headingDeg * Math.PI) / 180),
      };

      const { state } = mount(followOptions(target, -90 - headingDeg));
      const me = screenOf(state.current!.view, target);
      const front = screenOf(state.current!.view, ahead);

      // 화면 좌표는 아래로 갈수록 커진다. 앞쪽이 위에 있어야 하므로 y가 더 작다.
      expect(front.y).toBeLessThan(me.y);
      expect(front.x).toBeCloseTo(me.x, 0);
    });

    it('방향을 모르면 돌리지 않는다', () => {
      const { state } = mount(followOptions({ px: 1200, py: 400 }, null));

      expect(state.current!.view.rotation).toBe(0);
    });
  });
});
