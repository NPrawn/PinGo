import { useCallback, useEffect, useRef, useState } from 'react';

/** 지도 표시 상태. 배율과 이동량(px)이다. */
export interface MapView {
  scale: number;
  x: number;
  y: number;
}

const IDENTITY: MapView = { scale: 1, x: 0, y: 0 };

/**
 * 확대 범위.
 *
 * 아래를 1로 두는 이유는 축소가 의미 없기 때문이다 — 도면은 이미 `contain`으로 박스에 맞춰져
 * 있어 더 줄이면 여백만 늘어난다. 위는 4배로 잡았다. 경로 안내 화면의 지도는 1m가 1.2px라
 * 시설 마커가 4px 간격까지 붙는데(역삼역 B2), 4배면 16px가 되어 손가락으로 구분해 누를 수 있다.
 */
const MIN_SCALE = 1;
const MAX_SCALE = 4;

/**
 * 지도 팬·줌. (S15P11A206-283)
 *
 * 배율과 이동량만 돌려주고 실제 변환은 호출부가 적용한다. 도면 이미지와 좌표 오버레이가 같은
 * 박스를 공유하므로 **둘을 함께 감싼 요소에 적용해야** 마커가 도면에서 떨어지지 않는다.
 *
 * 포인터 이벤트로 구현한다. 마우스·터치·펜이 같은 경로를 타므로 분기가 없고, 두 손가락
 * 확대도 포인터 두 개를 추적해 처리한다.
 */
export function useMapGestures() {
  const [view, setView] = useState<MapView>(IDENTITY);
  /** 현재 눌려 있는 포인터들. 두 개가 되면 확대 제스처로 본다. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /** 확대 제스처 시작 시점의 두 손가락 거리와 배율. */
  const pinch = useRef<{ distance: number; scale: number } | null>(null);

  const reset = useCallback(() => {
    setView(IDENTITY);
  }, []);

  /**
   * 이동량을 화면 밖으로 나가지 않게 자른다.
   *
   * 확대하지 않았으면 이동을 허용하지 않는다. `contain`으로 맞춰진 도면을 밀면 빈 배경만
   * 보이고 되돌릴 방법이 화면에 없다.
   */
  const clamp = useCallback((next: MapView, box: { width: number; height: number }): MapView => {
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale));
    const limitX = ((scale - 1) * box.width) / 2;
    const limitY = ((scale - 1) * box.height) / 2;

    return {
      scale,
      x: Math.min(limitX, Math.max(-limitX, next.x)),
      y: Math.min(limitY, Math.max(-limitY, next.y)),
    };
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    // 캡처해 두면 손가락이 지도 밖으로 나가도 이동이 끊기지 않는다.
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale: 0 };
    }
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const previous = pointers.current.get(event.pointerId);
      if (!previous) return;

      const current = { x: event.clientX, y: event.clientY };
      pointers.current.set(event.pointerId, current);
      const box = event.currentTarget.getBoundingClientRect();

      if (pointers.current.size >= 2 && pinch.current) {
        const [a, b] = [...pointers.current.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch.current.distance === 0) return;

        const ratio = distance / pinch.current.distance;
        pinch.current = { distance, scale: 0 };
        setView((v) => clamp({ ...v, scale: v.scale * ratio }, box));
        return;
      }

      setView((v) =>
        clamp({ ...v, x: v.x + (current.x - previous.x), y: v.y + (current.y - previous.y) }, box),
      );
    },
    [clamp],
  );

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }, []);

  /** 데스크톱 확인용. 휠로 배율을 바꾼다. */
  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLElement>) => {
      const box = event.currentTarget.getBoundingClientRect();
      const ratio = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      setView((v) => clamp({ ...v, scale: v.scale * ratio }, box));
    },
    [clamp],
  );

  /**
   * XR 세션 안에서 이 요소를 만지는 동안 XR `select`가 함께 발생하는 것을 막는다.
   *
   * React에 이 이벤트의 prop이 없어 직접 붙인다. 막지 않으면 지도를 밀 때마다 세션이 선택
   * 이벤트를 받는다.
   *
   * TODO: 실기기에서 dom-overlay 안 제스처가 실제로 통과하는지 아직 확인하지 못했다
   * (`public/webxr-probe.html` 6장). 통과하지 않으면 조작은 세션 밖 화면에서만 쓸 수 있다.
   */
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const block = (event: Event): void => {
      event.preventDefault();
    };

    element.addEventListener('beforexrselect', block);

    return () => {
      element.removeEventListener('beforexrselect', block);
    };
  }, []);

  return {
    ref,
    view,
    reset,
    /** 확대·이동된 상태인지. 되돌리기 버튼을 보일지 판단하는 데 쓴다. */
    isTransformed: view.scale !== 1 || view.x !== 0 || view.y !== 0,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onWheel,
    },
  };
}
