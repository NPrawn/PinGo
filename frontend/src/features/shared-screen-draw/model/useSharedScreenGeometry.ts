import { useCallback, useEffect, useState } from 'react';
import type { NormalizedRect, ScreenGeometryPayload } from '@/shared/types';

/**
 * 공유 중인 화면이 어떻게 나뉘어 있는지 재서 알려준다. (S15P11A206-89)
 *
 * **상담자 화면이 이 값으로 거울을 만든다.** 그림 좌표는 화면 기준 0~1 이라 두 화면의 배치가
 * 같기만 하면 어느 기기에서도 같은 자리에 찍힌다. 그런데 그 배치를 상담자 쪽에 상수로 박아
 * 두면 어긋난다 — 카메라와 지도가 나뉘는 자리는 화면 높이에 따라 달라지고, 카메라 원본 규격도
 * 기기마다 다르다. 그래서 계산하지 않고 실제로 잰 값을 보낸다.
 *
 * 재는 대상은 세 곳이다. `screen` 이 0~1 의 기준이고, `lower` 는 카메라가 끝나는 자리,
 * `map` 은 도면이 그려지는 자리다.
 */
export interface SharedScreenTargets {
  /** 그리기 좌표(0~1)의 기준. 화면 전체를 덮는 요소여야 한다. */
  screen: HTMLElement | null;
  /** 카메라 아래 영역. 이 위쪽이 카메라가 보이는 부분이다. */
  lower: HTMLElement | null;
  /** 도면이 그려지는 자리. */
  map: HTMLElement | null;
}

/**
 * 소수점 자리.
 *
 * 픽셀 하나가 화면의 0.0002 쯤이라 이보다 잘게 남길 이유가 없다. 자르지 않으면 같은 배치인데도
 * 부동소수 끝자리가 흔들려 스냅숏이 계속 새 값으로 판정되고, 그때마다 지도 동기화가 다시 나간다.
 */
const PRECISION = 4;

function round(value: number): number {
  return Number(value.toFixed(PRECISION));
}

/** 화면 사각형을 기준 사각형 안의 0~1 값으로 옮긴다. */
function normalize(rect: DOMRect, screen: DOMRect): NormalizedRect {
  return {
    x: round((rect.left - screen.left) / screen.width),
    y: round((rect.top - screen.top) / screen.height),
    width: round(rect.width / screen.width),
    height: round(rect.height / screen.height),
  };
}

export interface SharedScreenGeometry {
  /** 잰 배치. 아직 재지 못했으면 null. */
  geometry: ScreenGeometryPayload | null;
  /**
   * 재야 할 요소에 붙이는 콜백 ref 세 개.
   *
   * **`useRef` 대신 콜백 ref 를 쓴다.** `RefObject` 는 렌더가 반복돼도 같은 객체라
   * `.current` 가 채워지는 것을 의존성 배열이 알아채지 못한다. 요소가 조건부로 렌더되거나
   * 늦게 마운트되면 관찰이 붙지 않은 채로 굳고, **아무 오류도 없이 배치가 영원히 null 로**
   * 남는다. 상담자 화면은 그동안 어림 비율로 그리므로 화면상으로도 티가 나지 않는다.
   *
   * 콜백 ref 로 받으면 요소가 붙는 순간 상태가 바뀌어 관찰 effect 가 그때 돈다. 호출부가
   * 어떻게 렌더하든 상관없어진다 — `useMapGestures` 가 같은 이유로 이미 이 방식이다.
   * (S15P11A206-89 리뷰)
   */
  screenRef: (node: HTMLElement | null) => void;
  lowerRef: (node: HTMLElement | null) => void;
  mapRef: (node: HTMLElement | null) => void;
}

export function useSharedScreenGeometry(
  /** XR 카메라 원본 크기. 아직 모르면 null 을 넘긴다. */
  cameraSource: { width: number; height: number } | null,
): SharedScreenGeometry {
  const [targets, setTargets] = useState<SharedScreenTargets>({
    screen: null,
    lower: null,
    map: null,
  });
  const [geometry, setGeometry] = useState<ScreenGeometryPayload | null>(null);

  const screenRef = useCallback((node: HTMLElement | null) => {
    setTargets((previous) => (previous.screen === node ? previous : { ...previous, screen: node }));
  }, []);
  const lowerRef = useCallback((node: HTMLElement | null) => {
    setTargets((previous) => (previous.lower === node ? previous : { ...previous, lower: node }));
  }, []);
  const mapRef = useCallback((node: HTMLElement | null) => {
    setTargets((previous) => (previous.map === node ? previous : { ...previous, map: node }));
  }, []);

  const { screen, lower, map } = targets;

  useEffect(() => {
    // 셋 다 붙어야 잴 수 있다. 하나라도 빠지면 기준이나 대상이 없다.
    if (!screen || !lower || !map) return;

    const measure = (): void => {
      const box = screen.getBoundingClientRect();

      // 아직 배치되지 않았다. 0으로 나누면 NaN 이 상담자 화면까지 건너간다.
      if (!(box.width > 0) || !(box.height > 0)) return;

      const next: ScreenGeometryPayload = {
        width: round(box.width),
        height: round(box.height),
        lower: normalize(lower.getBoundingClientRect(), box),
        map: normalize(map.getBoundingClientRect(), box),
        cameraSource,
      };

      /**
       * 값이 같으면 참조를 그대로 둔다.
       *
       * 이 값은 지도 동기화 effect 의 의존성이다. 매번 새 객체를 내면 화면이 조금도 바뀌지
       * 않았는데 스냅숏이 계속 나간다.
       */
      setGeometry((previous) =>
        previous && JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    };

    /**
     * 배치가 바뀔 때마다 다시 잰다.
     *
     * `window` 의 `resize` 만으로는 부족하다. 아래 영역의 글자가 한 줄 늘어나면 지도 자리가
     * 바뀌는데 창 크기는 그대로다. 반대로 ResizeObserver 는 `observe` 직후 현재 크기로 한 번
     * 불러 주므로 첫 측정을 따로 하지 않아도 된다.
     */
    if (typeof ResizeObserver === 'undefined') {
      // 관찰이 없는 환경(jsdom). 관찰이 없다고 기능 전체가 사라지면 안 되므로 직접 잰다.
      measure();
      window.addEventListener('resize', measure);

      return () => {
        window.removeEventListener('resize', measure);
      };
    }

    const observer = new ResizeObserver(measure);

    [screen, lower, map].forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
    };
  }, [cameraSource, lower, map, screen]);

  return { geometry, screenRef, lowerRef, mapRef };
}
