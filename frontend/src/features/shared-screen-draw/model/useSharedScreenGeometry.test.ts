import { renderHook } from '@testing-library/react';
import { useSharedScreenGeometry } from './useSharedScreenGeometry';

/** 크기를 지정한 요소. jsdom 은 배치를 하지 않아 실제 사각형을 직접 물려 준다. */
function elementSized(left: number, top: number, width: number, height: number): HTMLElement {
  const element = document.createElement('div');

  element.getBoundingClientRect = () =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;

  return element;
}

/**
 * 화면 배치를 재서 보내는 이유는 하나다 — 기기마다 다르기 때문이다. (S15P11A206-89)
 *
 * 상담자 화면은 이 값으로 사용자 화면의 거울을 만든다. 상수로 대신하면 어느 기기에서는 맞고
 * 어느 기기에서는 어긋나는데, 어긋나는 쪽에서는 상담자가 짚어 준 자리가 사용자 화면의 다른
 * 곳에 찍힌다.
 */
describe('useSharedScreenGeometry', () => {
  /**
   * 세로 844px 기기. 카메라와 지도가 나뉘는 자리가 52%가 아니라 54.5%다 — CSS 비율에 상단
   * 여백 보정(`+22.08px`)이 더해져 있어서다. 이것이 상수로 둘 수 없는 이유 그 자체다.
   */
  function targetsOf() {
    return {
      screen: { current: elementSized(0, 0, 390, 844) },
      lower: { current: elementSized(0, 460, 390, 384) },
      map: { current: elementSized(16, 474, 358, 300) },
    };
  }

  it('화면 안의 실제 자리를 0~1 값으로 재서 알려준다', () => {
    const { result } = renderHook(() =>
      useSharedScreenGeometry(targetsOf(), { width: 1920, height: 1080 }),
    );

    expect(result.current).toEqual({
      width: 390,
      height: 844,
      // 52%가 아니다. 상단 여백 보정이 더해진 실제 값이다.
      lower: { x: 0, y: 0.545, width: 1, height: 0.455 },
      map: { x: 0.041, y: 0.5616, width: 0.9179, height: 0.3555 },
      cameraSource: { width: 1920, height: 1080 },
    });
  });

  /**
   * 카메라 원본 규격도 함께 보낸다. 트랙은 320×240 고정이라 원본이 16:9인 기기에서는 늘어난
   * 채로 도착하는데, 받는 쪽이 그것을 되돌리려면 원본이 몇 대 몇이었는지 알아야 한다.
   * 아직 프레임을 한 장도 잡지 못했으면 null 이며, 그때는 되돌리지 않는다.
   */
  it('카메라 원본 규격을 모르면 null 로 둔다', () => {
    const { result } = renderHook(() => useSharedScreenGeometry(targetsOf(), null));

    expect(result.current?.cameraSource).toBeNull();
  });

  /**
   * 배치가 그대로면 같은 객체를 돌려준다.
   *
   * 이 값은 지도 동기화 effect 의 의존성이다. 렌더마다 새 객체를 내면 화면이 조금도 바뀌지
   * 않았는데 스냅숏이 계속 상담자에게 나간다.
   */
  it('배치가 바뀌지 않으면 같은 참조를 유지한다', () => {
    const targets = targetsOf();
    const { result, rerender } = renderHook(() => useSharedScreenGeometry(targets, null));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  /** 아직 배치되지 않은 화면. 0으로 나눈 NaN 이 상담자 화면까지 건너가면 안 된다. */
  it('크기를 재지 못하면 아무것도 알리지 않는다', () => {
    const { result } = renderHook(() =>
      useSharedScreenGeometry(
        {
          screen: { current: elementSized(0, 0, 0, 0) },
          lower: { current: elementSized(0, 0, 0, 0) },
          map: { current: elementSized(0, 0, 0, 0) },
        },
        null,
      ),
    );

    expect(result.current).toBeNull();
  });
});
