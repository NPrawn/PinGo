import { useCallback } from 'react';
import { render } from '@testing-library/react';
import type { ScreenGeometryPayload } from '@/shared/types';
import { useSharedScreenGeometry } from './useSharedScreenGeometry';

/** jsdom 은 배치를 하지 않아 실제 사각형을 요소에 직접 물려 준다. */
function stubRect(node: HTMLElement, left: number, top: number, width: number, height: number) {
  node.getBoundingClientRect = () =>
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
}

/**
 * 세로 844px 기기. 카메라와 지도가 나뉘는 자리가 52%가 아니라 54.5%다 — CSS 비율에 상단
 * 여백 보정(`+22.08px`)이 더해져 있어서다. 이것이 상수로 둘 수 없는 이유 그 자체다.
 */
const SCREEN = [0, 0, 390, 844] as const;
const LOWER = [0, 460, 390, 384] as const;
const MAP = [16, 474, 358, 300] as const;

interface HarnessProps {
  cameraSource?: { width: number; height: number } | null;
  /** 도면 요소를 늦게 붙이는 경우를 만든다. */
  mapMounted?: boolean;
  expose: (geometry: ScreenGeometryPayload | null) => void;
}

/**
 * 실제 사용처와 같이 콜백 ref 를 요소에 붙인다.
 *
 * ref 를 `useCallback` 으로 감싸는 것이 중요하다. 렌더마다 새 함수를 넘기면 React 가 옛 것에
 * null 을, 새 것에 노드를 전달해 붙였다 뗐다를 반복한다.
 */
function Harness({ cameraSource = null, mapMounted = true, expose }: HarnessProps) {
  const { geometry, screenRef, lowerRef, mapRef } = useSharedScreenGeometry(cameraSource);

  expose(geometry);

  const attachScreen = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) stubRect(node, ...SCREEN);
      screenRef(node);
    },
    [screenRef],
  );
  const attachLower = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) stubRect(node, ...LOWER);
      lowerRef(node);
    },
    [lowerRef],
  );
  const attachMap = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) stubRect(node, ...MAP);
      mapRef(node);
    },
    [mapRef],
  );

  return (
    <div ref={attachScreen}>
      <div ref={attachLower} />
      {mapMounted && <div ref={attachMap} />}
    </div>
  );
}

function mount(props: Omit<HarnessProps, 'expose'> = {}) {
  const state: { current: ScreenGeometryPayload | null } = { current: null };
  const expose = (geometry: ScreenGeometryPayload | null) => {
    state.current = geometry;
  };
  const view = render(<Harness {...props} expose={expose} />);

  return {
    state,
    rerender: (next: Omit<HarnessProps, 'expose'> = {}) =>
      view.rerender(<Harness {...next} expose={expose} />),
  };
}

/**
 * 화면 배치를 재서 보내는 이유는 하나다 — 기기마다 다르기 때문이다. (S15P11A206-89)
 *
 * 상담자 화면은 이 값으로 사용자 화면의 거울을 만든다. 상수로 대신하면 어느 기기에서는 맞고
 * 어느 기기에서는 어긋나는데, 어긋나는 쪽에서는 상담자가 짚어 준 자리가 사용자 화면의 다른
 * 곳에 찍힌다.
 */
describe('useSharedScreenGeometry', () => {
  it('화면 안의 실제 자리를 0~1 값으로 재서 알려준다', () => {
    const { state } = mount({ cameraSource: { width: 1920, height: 1080 } });

    expect(state.current).toEqual({
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
    const { state } = mount();

    expect(state.current?.cameraSource).toBeNull();
  });

  /**
   * 배치가 그대로면 같은 객체를 돌려준다.
   *
   * 이 값은 지도 동기화 effect 의 의존성이다. 렌더마다 새 객체를 내면 화면이 조금도 바뀌지
   * 않았는데 스냅숏이 계속 상담자에게 나간다.
   */
  it('배치가 바뀌지 않으면 같은 참조를 유지한다', () => {
    const { state, rerender } = mount();
    const first = state.current;

    rerender();

    expect(state.current).toBe(first);
  });

  /**
   * 요소가 늦게 붙어도 잰다. (S15P11A206-89 리뷰)
   *
   * 예전에는 `RefObject` 를 받아 effect 안에서 `.current` 를 읽었다. `RefObject` 는 렌더가
   * 반복돼도 같은 객체라, 첫 effect 때 `.current` 가 null 이면 나중에 요소가 채워져도 effect 가
   * 다시 돌지 않는다. 그러면 관찰이 붙지 않은 채로 굳고 **아무 오류 없이 배치가 영원히 null**
   * 이다 — 상담자 화면은 그동안 어림 비율로 그리므로 화면상으로도 티가 나지 않는다.
   */
  it('도면 요소가 나중에 붙어도 그때 재기 시작한다', () => {
    const { state, rerender } = mount({ mapMounted: false });

    // 기준과 대상이 다 있어야 잴 수 있다. 하나가 없으면 아직 알리지 않는다.
    expect(state.current).toBeNull();

    rerender({ mapMounted: true });

    expect(state.current?.map).toEqual({ x: 0.041, y: 0.5616, width: 0.9179, height: 0.3555 });
  });
});
