import { useCallback, useEffect, useRef, useState } from 'react';

/** 지도 표시 상태. 배율·이동량(px)·회전(도)이다. */
export interface MapView {
  scale: number;
  x: number;
  y: number;
  /**
   * 지도를 돌린 각도. 진행 방향을 화면 위로 세우는 데 쓴다.
   *
   * 손 조작으로는 바뀌지 않는다 — 회전은 방향 정보에서만 나오고, 자유 보기로 풀린 뒤에도
   * 마지막 각도를 유지한다. 보던 방향이 갑자기 돌아가면 어디를 보고 있었는지 잃는다.
   */
  rotation: number;
}

const IDENTITY: MapView = { scale: 1, x: 0, y: 0, rotation: 0 };

/**
 * 확대 범위.
 *
 * 아래를 1로 두는 이유는 축소가 의미 없기 때문이다 — 도면은 이미 `contain`으로 박스에 맞춰져
 * 있어 더 줄이면 여백만 늘어난다. 위는 4배로 잡았다. 경로 안내 화면의 지도는 1m가 1.2px라
 * 시설 마커가 4px 간격까지 붙는데(역삼역 B2), 4배면 16px가 되어 손가락으로 구분해 누를 수 있다.
 */
const MIN_SCALE = 1;
/**
 * 시점 추종이 폭 60m를 담으려면 안내 화면 지도 박스에서 약 5.4배가 필요하다
 * (1m가 0.97화면px인 전체 조망 기준).
 *
 * **박스가 낮으면 5.4배로 모자란다.** `fit`이 폭이 아니라 높이로 정해지기 때문이다
 * (`computeFollowView`). 상세 경로를 펼치면 지도 박스가 낮아지는데, 실측하면 이렇다.
 *
 * ```
 * 390×844  상세 닫힘  박스 358×278  필요 5.38   ← 여유 있음
 * 390×844  상세 열림  박스 358×181  필요 6.21
 * 360×640  상세 열림  박스 328×115  필요 8.96   ← 6으로는 크게 모자람
 * ```
 *
 * 6으로 잘라 두었더니 360×640 기기에서 상세 경로를 펼치면 표시가 의도의 67%로 줄었다. 도면의
 * 얇은 선이 사라지고, `viewScale`로 화면상 크기를 맞추는 마커·이름표까지 같은 비율로 작아져
 * **화질이 깨진 것처럼 보였다.** 잘리지 않을 만큼 올린다. (S15P11A206-206)
 *
 * 손 조작의 상한도 함께 올라간다. 더 당길 수 있게 되는 것뿐이라 문제가 없고, 추종 배율과 상한을
 * 따로 두면 추종 시점을 손으로 이어받는 순간 `clamp`가 배율을 끌어내려 화면이 튄다.
 */
const MAX_SCALE = 12;

/** 탭과 끌기를 가르는 이동량. 이보다 작게 움직이면 탭으로 본다. */
const DRAG_THRESHOLD_PX = 4;

/**
 * 지도 팬·줌. (S15P11A206-283)
 *
 * 배율과 이동량만 돌려주고 실제 변환은 호출부가 적용한다. 도면 이미지와 좌표 오버레이가 같은
 * 박스를 공유하므로 **둘을 함께 감싼 요소에 적용해야** 마커가 도면에서 떨어지지 않는다.
 *
 * 포인터 이벤트로 구현한다. 마우스·터치·펜이 같은 경로를 타므로 분기가 없고, 두 손가락
 * 확대도 포인터 두 개를 추적해 처리한다.
 */
/** 시점 추종에 필요한 값. 넘기지 않으면 예전처럼 전체 조망에서 시작한다. */
export interface FollowOptions {
  /** 따라갈 지점. 표시 캔버스 픽셀 좌표다. 모르면 null이며 추종하지 않는다. */
  target: { px: number; py: number } | null;
  /** 표시 캔버스 크기. 화면 배치를 계산하는 데 쓴다. */
  canvas: { width: number; height: number };
  /** 화면 가로에 담을 캔버스 픽셀. 내비처럼 앞쪽을 보려면 좁게 잡는다. */
  spanPx: number;
  /**
   * 따라갈 지점을 화면 세로 어디에 둘지(0이 위, 1이 아래).
   *
   * 가운데가 아니라 아래쪽에 둔다. 걷는 사람에게 필요한 것은 지나온 뒤가 아니라 갈 앞쪽이라
   * 화면의 위쪽 3분의 2를 진행 방향에 내준다. 내비게이션의 통례다.
   */
  anchorY: number;
  /**
   * 지도를 돌릴 각도. 진행 방향이 화면 위를 향하게 하려면 `-90 - 방향각`이다.
   *
   * null이면 방향을 모르는 것이므로 돌리지 않는다. 0으로 대신 채우면 도면이 북쪽 고정인
   * 것과 구분되지 않는다.
   */
  rotationDeg: number | null;
}

export function useMapGestures(follow?: FollowOptions) {
  const [view, setView] = useState<MapView>(IDENTITY);
  /**
   * 시점이 내 위치를 따라가는 중인지.
   *
   * 손으로 밀거나 확대하면 풀린다 — 사용자가 다른 곳을 보려는 것이므로 시점을 도로 끌어오면
   * 안 된다. 풀린 뒤에는 전체 조망까지 자유롭게 볼 수 있고, 버튼으로 다시 붙인다.
   */
  const [following, setFollowing] = useState(true);
  /**
   * **지금** 화면에 그려지고 있는 추종 시점. 추종할 대상이 없으면 null 이다.
   *
   * 추종이 풀리는 순간 이 값을 이어받아야 화면이 튀지 않는다. **"마지막" 값이 아니라 "지금"
   * 값이어야 한다** — 예전에는 null 이 되어도 앞의 값을 남겨 두었고(`if (followView)`), 그래서
   * 자유 탐색처럼 추종 대상이 없는 상태에서 시점을 되돌린 뒤 지도를 밀면 한참 전의 확대된
   * 시점이 되살아났다. 화면이 갑자기 튀면서 확대되던 원인이다. (S15P11A206-89)
   */
  const followViewRef = useRef<MapView | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  /** 현재 눌려 있는 포인터들. 두 개가 되면 확대 제스처로 본다. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /** 확대 제스처 시작 시점의 두 손가락 거리와 배율. */
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  /** 끌기로 판정된 포인터. 탭과 구분해 캡처 시점을 늦추는 데 쓴다. */
  const dragged = useRef(new Set<number>());

  const reset = useCallback(() => {
    setView(IDENTITY);
    setFollowing(true);
  }, []);

  /**
   * 손으로 조작하면 추종이 풀린다. 풀리는 순간의 화면을 그대로 이어받아야 튀지 않는다.
   *
   * 이어받을 것은 **지금 보이는 것**뿐이다. 추종 중이어도 대상이 없으면(`followViewRef` 가 null)
   * 화면에 그려지던 것은 손으로 만든 `view` 이므로, 그대로 두는 것이 이어받는 것이다.
   *
   * **갱신 함수 안에서 다른 상태를 건드리지 않는다.** (S15P11A206-206)
   *
   * 예전에는 `setFollowing` 갱신 함수 안에서 `setView`를 불렀다. 갱신 함수는 렌더 때 실행되므로
   * 그 `setView`가 **같은 배치의 이동 갱신보다 나중에** 적용되어 델타를 덮어썼다. 그래서 문턱을
   * 넘겨 미는 첫 이벤트는 화면을 조금도 움직이지 못했다 — 손가락을 빠르게 움직이면 한 이벤트에
   * 수십 px이 실리는데 그것이 통째로 사라졌다.
   *
   * 이어받을 값을 먼저 큐에 넣어 두면 뒤따르는 이동 갱신이 그 값을 받는다. 이미 풀려 있으면
   * 아무것도 하지 않는다 — 이동 이벤트마다 불리므로 매번 상태를 다시 쓸 이유가 없다.
   */
  const releaseFollow = useCallback(() => {
    if (!following) return;

    setFollowing(false);
    if (followViewRef.current) setView(followViewRef.current);
  }, [following]);

  /**
   * 이동량을 화면 밖으로 나가지 않게 자른다.
   *
   * 확대하지 않았으면 이동을 허용하지 않는다. `contain`으로 맞춰진 도면을 밀면 빈 배경만
   * 보이고 되돌릴 방법이 화면에 없다.
   *
   * **이어받은 추종 시점은 이 한계를 넘어 있다.** 추종은 내 위치를 화면 아래쪽에 붙이는 것이
   * 목적이라 이동량을 일부러 자르지 않는다(`computeFollowView`). 그래서 손을 대는 순간 그 값이
   * 한계로 끌려오면 지도가 튄다 — 안내 화면 지도 박스(358×300)·추종 배율 5.38에서 도면 면적의
   * 18~32%가 그렇고, 지도가 방향에 따라 돌아 있으면 최대 476px 튀어 내 위치 마커가 화면 밖으로
   * 나간다. (S15P11A206-206)
   *
   * 넘어 있는 만큼은 그대로 허용하고, 대신 **더 밀려나지는 못하게** 한다. 안으로 미는 조작마다
   * 여유가 줄어들어 한계 안으로 들어오면 다시 나갈 수 없다.
   */
  const clamp = useCallback(
    (next: MapView, previous: MapView, box: { width: number; height: number }): MapView => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale));
      const limitX = ((scale - 1) * box.width) / 2;
      const limitY = ((scale - 1) * box.height) / 2;
      /**
       * 축소할 때는 여유를 주지 않는다.
       *
       * 배율이 1로 돌아가면 한계가 0인데 여유를 남기면 도면이 화면 밖에 놓인 채로 굳는다.
       * 그리고 축소는 전체를 보려는 조작이라, 그때 가운데로 돌아오는 것이 하려던 일에 맞다.
       */
      const shrinking = scale < previous.scale;
      const allowance = (limit: number, previousValue: number): number =>
        shrinking ? limit : Math.max(limit, Math.abs(previousValue));
      const allowX = allowance(limitX, previous.x);
      const allowY = allowance(limitY, previous.y);

      return {
        scale,
        x: Math.min(allowX, Math.max(-allowX, next.x)),
        y: Math.min(allowY, Math.max(-allowY, next.y)),
        // 회전은 손 조작이 건드리지 않는다. 들어온 값을 그대로 둔다.
        rotation: next.rotation,
      };
    },
    [],
  );

  /**
   * 포인터 하나를 추적에서 놓는다.
   *
   * 떼는 것은 지도 요소와 `window` 양쪽에서 받으므로(아래) 같은 포인터에 두 번 불릴 수 있다.
   * 두 번 지워도 결과는 같다.
   */
  const releasePointer = useCallback((pointerId: number) => {
    pointers.current.delete(pointerId);
    dragged.current.delete(pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }, []);

  /**
   * 지도 밖에서 손을 떼는 경우. (S15P11A206-79 리뷰)
   *
   * 요소 핸들러는 **지도 위에서** 뗀 것만 받는다. 밖에서 떼면 그 포인터가 `pointers`에 남고,
   * 스스로 빠지는 경로가 없다. 다음에 지도를 누르는 순간 포인터가 둘이 되어 끌기가 확대로
   * 처리된다 — 실측에서 미는 대신 배율이 1.46에서 2.36으로 뛰었고, 그 뒤로 조작이 계속
   * 어긋난 채였다. 지도가 안내 화면의 아래 절반이라 위로 쓸어 올리다 떼면 바로 걸린다.
   *
   * `window`에서 받으면 지도 위에서 뗀 것도 함께 올라오므로 이 경로 하나로 모두 처리된다.
   */
  useEffect(() => {
    const release = (event: PointerEvent): void => {
      releasePointer(event.pointerId);
    };

    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [releasePointer]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    /**
     * **`setPointerCapture`를 쓰지 않는다.** 두 가지가 깨진다 — 캡처한 뒤에는 `click`의 대상이
     * 캡처한 요소로 바뀌어 지도 위 시설 마커를 눌러도 탭이 마커까지 가지 않고, Chromium에서
     * 후속 `pointermove`가 전달되지 않아(실측: 7개 중 1개) 끌기가 첫 이동에서 멈춘다.
     *
     * 대신 지도 요소 위에서만 **움직임을** 추적한다. 손가락이 지도 밖으로 나가면 이동이
     * 멈추고, 다시 들어오면 이어진다. 지도가 화면 아래 절반을 채우므로 실사용에서 크게 걸리지
     * 않는다. 떼는 것은 밖에서도 받아야 하므로 `window`에서 함께 본다(위).
     */
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragged.current.delete(event.pointerId);

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
      const box = event.currentTarget.getBoundingClientRect();

      /** 손가락이 조금 흔들린 것은 탭이다. 문턱을 넘어야 끌기로 본다. */
      if (pointers.current.size < 2 && !dragged.current.has(event.pointerId)) {
        if (Math.hypot(current.x - previous.x, current.y - previous.y) < DRAG_THRESHOLD_PX) return;
        dragged.current.add(event.pointerId);
      }

      pointers.current.set(event.pointerId, current);
      // 사용자가 다른 곳을 보려는 것이므로 시점을 도로 끌어오지 않는다.
      releaseFollow();

      if (pointers.current.size >= 2 && pinch.current) {
        const [a, b] = [...pointers.current.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch.current.distance === 0) return;

        const ratio = distance / pinch.current.distance;
        pinch.current = { distance, scale: 0 };
        setView((v) => clamp({ ...v, scale: v.scale * ratio }, v, box));
        return;
      }

      setView((v) =>
        clamp(
          { ...v, x: v.x + (current.x - previous.x), y: v.y + (current.y - previous.y) },
          v,
          box,
        ),
      );
    },
    [clamp, releaseFollow],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      releasePointer(event.pointerId);
    },
    [releasePointer],
  );

  /** 데스크톱 확인용. 휠로 배율을 바꾼다. */
  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLElement>) => {
      const box = event.currentTarget.getBoundingClientRect();
      const ratio = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      releaseFollow();
      setView((v) => clamp({ ...v, scale: v.scale * ratio }, v, box));
    },
    [clamp, releaseFollow],
  );

  /**
   * 버튼으로 배율을 바꾼다. (S15P11A206-89)
   *
   * 휠과 손가락만으로는 확대할 수 없는 자리가 있다. 상담자 콘솔은 마우스뿐이라 휠이 유일한
   * 통로인데, 휠은 화면에 보이지 않아 있는 줄도 모른다. 한 번 누를 때의 배수는 휠보다 크게 둔다 —
   * 버튼은 여러 번 누르기 번거롭다.
   */
  const zoomBy = useCallback(
    (ratio: number) => {
      if (!box) return;

      releaseFollow();
      setView((v) => clamp({ ...v, scale: v.scale * ratio }, v, box));
    },
    [box, clamp, releaseFollow],
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
  /**
   * 관찰할 요소. **ref가 아니라 상태로 둔다.**
   *
   * ref로 두고 마운트 한 번(`[]`)만 재면, 호출부가 요소를 조건부로 렌더할 때 크기를 영원히
   * 모른다. 실제로 그랬다 — `IndoorMapView`는 층별 지도 조회가 끝나기 전에 로딩 문구만
   * 반환하므로 첫 렌더에 지도 요소가 없고, 응답이 온 뒤 요소가 생겨도 effect가 다시 돌지
   * 않았다. 그러면 `box`가 null로 굳어 추종이 조용히 꺼지고, ResizeObserver와
   * `beforexrselect` 차단도 걸리지 않는다.
   *
   * 콜백 ref로 받으면 요소가 붙는 순간 상태가 바뀌어 아래 effect가 그때 돈다. 호출부가
   * 어떻게 렌더하든 상관없어진다.
   */
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;

    const block = (event: Event): void => {
      event.preventDefault();
    };

    element.addEventListener('beforexrselect', block);

    /**
     * 휠로 확대하는 동안 페이지가 함께 스크롤되지 않게 막는다. (S15P11A206-89)
     *
     * 확대 자체는 아래 `onWheel` 이 한다. 그런데 **React 는 루트에 `wheel` 을 passive 로 달기
     * 때문에 그 핸들러에서 `preventDefault()` 를 불러도 통하지 않는다.** 그래서 상담자 콘솔에서
     * 휠을 굴리면 지도 배율은 바뀌는데 페이지가 같이 위아래로 밀려 조작을 이어 갈 수 없었다.
     * `touch-action: none` 은 손가락만 막고 휠은 막지 못한다.
     *
     * 여기서는 기본 동작만 막고 배율 계산에는 끼어들지 않는다 — 두 곳에서 배율을 바꾸면 한 번
     * 굴릴 때 두 번 확대된다.
     */
    element.addEventListener('wheel', block, { passive: false });

    /**
     * 시점 추종은 화면 크기를 알아야 계산된다.
     *
     * **먼저 한 번 직접 잰다.** ResizeObserver가 없거나(jsdom) 어떤 이유로 보고하지 않아도
     * 추종이 조용히 꺼지지 않게 하기 위해서다. 관찰은 회전·분할 화면 같은 이후 변화를 위한
     * 것이고, 첫 값까지 거기에 맡기면 관찰이 실패하는 환경에서 기능 전체가 사라진다.
     */
    const measure = (width: number, height: number): void => {
      setBox((previous) =>
        previous && previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    };

    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) measure(rect.width, rect.height);

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        element.removeEventListener('beforexrselect', block);
        element.removeEventListener('wheel', block);
      };
    }

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      measure(width, height);
    });
    observer.observe(element);

    return () => {
      element.removeEventListener('beforexrselect', block);
      element.removeEventListener('wheel', block);
      observer.disconnect();
    };
  }, [element]);

  const followView = computeFollowView(follow, box);

  /** null 도 그대로 반영한다. 추종 대상이 사라졌으면 이어받을 것도 없다. */
  useEffect(() => {
    followViewRef.current = followView;
  }, [followView]);

  const active = following && followView ? followView : view;

  return {
    ref,
    view: active,
    reset,
    /** 버튼으로 배율만 바꾼다. 1보다 크면 확대, 작으면 축소다. */
    zoomBy,
    /** 시점이 내 위치를 따라가는 중인지. 복귀 버튼을 보일지 판단하는 데 쓴다. */
    isFollowing: following && followView !== null,
    /** 추종이 없을 때 확대·이동된 상태인지. */
    isTransformed: active.scale !== 1 || active.x !== 0 || active.y !== 0 || active.rotation !== 0,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onWheel,
    },
  };
}

/**
 * 따라갈 지점이 화면 앵커에 오도록 이동량과 배율을 구한다.
 *
 * 도면은 `contain`으로 박스에 맞춰진 뒤 `translate(x, y) scale(s)`를 받는다. 변환 기준점이
 * 박스 중심이므로, 캔버스 점 p의 화면 위치는 `center + s·(fit(p) − center) + (x, y)`다.
 * 이것을 앵커와 같게 두고 x·y를 푼다.
 */
function computeFollowView(
  follow: FollowOptions | undefined,
  box: { width: number; height: number } | null,
): MapView | null {
  if (!follow?.target || !box) return null;
  if (box.width <= 0 || box.height <= 0) return null;

  const fit = Math.min(box.width / follow.canvas.width, box.height / follow.canvas.height);
  if (!(fit > 0)) return null;

  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, box.width / (follow.spanPx * fit)));
  const rotation = follow.rotationDeg ?? 0;
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  // 변환 기준점(박스 중심)에서 본 목표의 위치. 회전·확대가 이 벡터에 걸린다.
  const dx = box.width / 2 + (follow.target.px - follow.canvas.width / 2) * fit - box.width / 2;
  const dy = box.height / 2 + (follow.target.py - follow.canvas.height / 2) * fit - box.height / 2;
  const rotatedX = scale * (cos * dx - sin * dy);
  const rotatedY = scale * (sin * dx + cos * dy);

  return {
    scale,
    rotation,
    // 추종 중에는 이동량을 자르지 않는다. 내 위치를 화면 아래쪽에 붙이는 것이 목적이라
    // 도면 가장자리에서는 일부러 여백이 보여야 한다.
    x: box.width / 2 - rotatedX - box.width / 2,
    y: box.height * follow.anchorY - rotatedY - box.height / 2,
  };
}
