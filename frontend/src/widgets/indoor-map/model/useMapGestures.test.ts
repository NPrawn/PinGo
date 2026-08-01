import { act, renderHook } from '@testing-library/react';
import { useMapGestures } from './useMapGestures';

/**
 * 지도 팬·줌. (S15P11A206-283)
 *
 * jsdom은 레이아웃을 계산하지 않아 `getBoundingClientRect`가 전부 0이다. 이동 한계가
 * 박스 크기에 비례하므로, 박스를 직접 준 가짜 이벤트로 검사한다.
 */
const BOX = { width: 400, height: 200 } as DOMRect;

function pointerEvent(pointerId: number, clientX: number, clientY: number) {
  return {
    pointerId,
    clientX,
    clientY,
    currentTarget: { getBoundingClientRect: () => BOX },
  } as unknown as React.PointerEvent<HTMLElement>;
}

function wheelEvent(deltaY: number) {
  return {
    deltaY,
    currentTarget: { getBoundingClientRect: () => BOX },
  } as unknown as React.WheelEvent<HTMLElement>;
}

describe('useMapGestures', () => {
  it('처음에는 변환이 없다', () => {
    const { result } = renderHook(() => useMapGestures());

    expect(result.current.view).toEqual({ scale: 1, x: 0, y: 0 });
    expect(result.current.isTransformed).toBe(false);
  });

  /**
   * 확대하지 않은 상태에서는 밀 수 없다. `contain`으로 박스에 맞춰진 도면을 밀면 빈 배경만
   * 보이고, 그 상태를 되돌릴 방법이 화면에 없다.
   */
  it('확대하지 않았으면 밀어도 움직이지 않는다', () => {
    const { result } = renderHook(() => useMapGestures());

    act(() => {
      result.current.handlers.onPointerDown(pointerEvent(1, 100, 100));
      result.current.handlers.onPointerMove(pointerEvent(1, 160, 130));
    });

    expect(result.current.view).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('휠로 확대한 뒤에는 밀 수 있다', () => {
    const { result } = renderHook(() => useMapGestures());

    act(() => {
      // 1.1^4 ≈ 1.46
      for (let i = 0; i < 4; i += 1) result.current.handlers.onWheel(wheelEvent(-1));
    });

    expect(result.current.view.scale).toBeCloseTo(1.4641, 3);

    act(() => {
      result.current.handlers.onPointerDown(pointerEvent(1, 100, 100));
      result.current.handlers.onPointerMove(pointerEvent(1, 140, 120));
    });

    expect(result.current.view.x).toBeCloseTo(40);
    expect(result.current.view.y).toBeCloseTo(20);
    expect(result.current.isTransformed).toBe(true);
  });

  /** 도면이 화면 밖으로 완전히 빠져나가면 되돌릴 방법이 없다. */
  it('이동량은 확대한 만큼만 허용한다', () => {
    const { result } = renderHook(() => useMapGestures());

    act(() => {
      for (let i = 0; i < 4; i += 1) result.current.handlers.onWheel(wheelEvent(-1));
      result.current.handlers.onPointerDown(pointerEvent(1, 0, 0));
      result.current.handlers.onPointerMove(pointerEvent(1, 5000, 5000));
    });

    // (scale - 1) * width / 2 = 0.4641 * 200 ≈ 92.8
    expect(result.current.view.x).toBeCloseTo(92.82, 1);
    expect(result.current.view.y).toBeCloseTo(46.41, 1);
  });

  it('축소 방향으로는 원래 크기보다 작아지지 않는다', () => {
    const { result } = renderHook(() => useMapGestures());

    act(() => {
      for (let i = 0; i < 10; i += 1) result.current.handlers.onWheel(wheelEvent(1));
    });

    expect(result.current.view.scale).toBe(1);
  });

  it('확대는 6배에서 멈춘다', () => {
    // 시점 추종이 폭 60m를 담으려면 약 5.4배가 필요하다. 손으로도 그만큼은 당길 수 있어야 한다.
    const { result } = renderHook(() => useMapGestures());

    act(() => {
      for (let i = 0; i < 40; i += 1) result.current.handlers.onWheel(wheelEvent(-1));
    });

    expect(result.current.view.scale).toBe(6);
  });

  it('두 손가락 간격이 벌어지면 확대된다', () => {
    const { result } = renderHook(() => useMapGestures());

    act(() => {
      result.current.handlers.onPointerDown(pointerEvent(1, 100, 100));
      result.current.handlers.onPointerDown(pointerEvent(2, 200, 100));
      // 간격 100 → 200
      result.current.handlers.onPointerMove(pointerEvent(2, 300, 100));
    });

    expect(result.current.view.scale).toBeCloseTo(2);
  });

  it('되돌리면 처음 상태로 간다', () => {
    const { result } = renderHook(() => useMapGestures());

    act(() => {
      for (let i = 0; i < 4; i += 1) result.current.handlers.onWheel(wheelEvent(-1));
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.view).toEqual({ scale: 1, x: 0, y: 0 });
    expect(result.current.isTransformed).toBe(false);
  });

  /** 손을 뗀 뒤 남은 포인터로 이동이 계속되면 지도가 튄다. */
  it('손을 떼면 그 포인터의 이동은 무시한다', () => {
    const { result } = renderHook(() => useMapGestures());

    act(() => {
      for (let i = 0; i < 4; i += 1) result.current.handlers.onWheel(wheelEvent(-1));
      result.current.handlers.onPointerDown(pointerEvent(1, 100, 100));
      result.current.handlers.onPointerUp(pointerEvent(1, 100, 100));
      result.current.handlers.onPointerMove(pointerEvent(1, 200, 200));
    });

    expect(result.current.view.x).toBe(0);
    expect(result.current.view.y).toBe(0);
  });
});
