import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IndoorPoint } from '@/entities/navigation';
import { xrSessionController, type XrSessionController } from '@/shared/lib/webxr';
import {
  createXrMapAnchor,
  mapHeadingDegOf,
  xrToMapPoint,
  type PlanarVector,
  type XrAnchorStatus,
  type XrMapAnchor,
} from '../lib/mapAlignment';
import { smoothMapPoint, type DisplaySmoothingOptions } from '../lib/displaySmoothing';
import { useXrTracking, type UseXrTrackingValue } from './useXrTracking';

/** 지도에 그리는 좌표가 어디서 왔는지. */
export type XrMapPositionSource =
  /** 사전 위치 확정값. 앵커가 없거나 아직 추적 좌표가 없을 때다. */
  | 'confirmed'
  /** 앵커 + XR 상대 이동으로 산출한 값. 추적이 살아 있다. */
  | 'anchored'
  /** 추적이 끊기기 전 마지막 유효 좌표. 더 이상 갱신되지 않는다. */
  | 'last-known';

export interface UseXrMapPositionOptions {
  /**
   * 사전에 확정된 실내 위치. U-05 VPS 또는 U-07 수동 선택 결과다.
   *
   * **앵커가 아니다.** 이 시점에는 XR 세션이 없어 짝지을 pose가 없다(11.2). 표시용으로만
   * 쓰이며, 앵커가 생기기 전과 추적을 쓸 수 없을 때 지도에 그려진다.
   *
   * **안내 화면 진입 시점에 고정되는 입력이다.** 앵커가 생긴 뒤 이 값을 바꾸면 표시에
   * 반영되지 않고 조용히 무시된다. 안내 중 위치 갱신은 `setAnchor`로 한다 — 11.2가
   * 사전 확정과 세션 안 VPS를 분리했고, 화면 정의서 U-07(지도 수동 위치 선택)도 진입
   * 경로가 위치 인식 실패와 카메라 권한 거부뿐이라 안내 중에는 열리지 않는다.
   *
   * 무시하는 대신 앵커를 무효화하지 않는 이유는, 그러려면 "안내 중 절대 위치가 다시
   * 확정되는 흐름"이 있어야 하는데 그 흐름이 아직 없기 때문이다. 안내 중 재인식의 화면
   * 처리가 미결이다(`docs/기술_의사결정_정리.md` 12장 3번). 화면을 벗어나는 쪽으로
   * 정해지면 이 훅이 언마운트되어 상태가 통째로 초기화되므로 무효화 규칙 자체가 필요 없다.
   *
   * 그 흐름이 생기면 무효화 규칙을 함께 정한다. 그때 `trackedLocation`만 지우면 안 된다 —
   * 앵커가 남아 있으면 다음 스냅샷이 낡은 앵커로 좌표를 다시 만들어 옛 위치로 돌아간다.
   */
  currentIndoorLocation?: IndoorPoint | null;
  /** 표시 평활 기준값. 생략하면 provisional 기본값을 쓴다. */
  smoothing?: DisplaySmoothingOptions;
  /** Map-coordinate units per physical XR meter. Defaults to 1 when calibration is unavailable. */
  distanceScale?: number;
  /** 테스트에서 가짜 컨트롤러를 주입한다. */
  controller?: XrSessionController;
}

export interface UseXrMapPositionValue extends UseXrTrackingValue {
  /**
   * 지도에 그릴 현재 위치. 캐노니컬 미터다.
   *
   * `IndoorMapView`·`IndoorMapOverlay`의 `currentLocation`에 그대로 넘긴다. 픽셀 변환은
   * 그쪽의 `meterToPixel`이 한다(좌표 스펙 7장).
   */
  currentLocation: IndoorPoint | null;
  /** 위 좌표의 출처. 화면에서 표시를 달리하려면 이 값을 본다. */
  source: XrMapPositionSource;
  /** 좌표가 더 이상 갱신되지 않는 상태인지. `source === 'last-known'`과 같다. */
  isStale: boolean;
  /**
   * 지도 프레임 기준으로 사용자가 바라보는 방향(도). 앵커가 없으면 null이다.
   *
   * 각도 기준은 지도 `+X`축, 증가 방향은 `+Y`쪽이다. 이미지 위에 그릴 때는 좌표 프레임의
   * `angleDeg`를 더한다(`mapHeadingDegOf` 주석).
   *
   * **위치와 다른 주기로 갱신된다.** 11.4가 회전을 위치 확정 트리거에서 제외했으므로 위치
   * 스냅샷에 방향을 묶으면 제자리에서 몸만 돌렸을 때 최대 5초 늦는다. 컨트롤러의
   * `subscribeHeading`이 회전 전용 데드밴드·최소 간격으로 각도만 흘려준다. 그 기준값은
   * 아직 provisional이며 실기기 확정 항목이다(`PROVISIONAL_HEADING_DEADBAND_DEG`).
   *
   * 평활을 걸지 않는다. 표시 평활은 위치의 데드밴드·추종 비율로 정의돼 있고(296) 각도에는
   * 그 규칙을 그대로 쓸 수 없다 — 179°와 -179°가 이웃이라 선형 보간이 한 바퀴 돌아간다.
   */
  headingDeg: number | null;
  /** 앵커 상태. 없으면 확정 위치만 표시된다(11.2). */
  anchorStatus: XrAnchorStatus;
  /** 앵커가 몇 번 갱신됐는지. 앵커가 없으면 null. */
  anchorRevision: number | null;
  /**
   * 앵커를 만들거나 갱신한다. 세션 안 VPS가 위치를 확정했을 때 부른다.
   *
   * `forwardMap`이 null이거나 지금 pose를 읽을 수 없으면 앵커를 만들지 않고 false를
   * 돌려준다. 그 경우 확정 위치만 계속 표시된다.
   *
   * **누가 언제 부르는지는 여기서 정하지 않는다.** 세션 안 VPS를 자동 1회로 돌릴지 재인식
   * 버튼으로 할지가 미결이고(기술 의사결정 12장 2번), 화면 흐름은 141·298의 범위다.
   */
  setAnchor: (map: IndoorPoint, forwardMap: PlanarVector | null) => boolean;
  /** 앵커를 버린다. 추적 좌표를 멈추고 확정 위치 표시로 돌아간다. */
  clearAnchor: () => void;
}

/**
 * 확정된 실내 위치와 WebXR 상대 pose를 합쳐 지도 위 현재 위치를 갱신한다. (S15P11A206-296)
 *
 * 흐름은 이렇다.
 *
 * ```
 * 사전 확정 위치 ─────────────────────────▶ 표시용 (앵커 없을 때)
 *
 * 세션 안 VPS 좌표 + 그 순간 pose + 방향 ─▶ 앵커 ─┐
 *                                                  ├─▶ xrToMapPoint ─▶ 평활 ─▶ 마커
 * 확정 스냅샷 (295의 11.4 확정 주기) ──────────────┘
 * ```
 *
 * **확정 주기를 다시 걸지 않는다.** 295가 이미 11.4대로 걸러 스냅샷을 준다. 여기서 하는
 * 것은 좌표계 변환과 표시 평활뿐이다.
 *
 * **XR 객체를 상태에 담지 않는다.** 컨트롤러가 숫자만 돌려주고 이 훅도 숫자만 들고 있다
 * (`frontend/AGENTS.md`).
 */
export function useXrMapPosition({
  currentIndoorLocation = null,
  smoothing,
  distanceScale = 1,
  controller = xrSessionController,
}: UseXrMapPositionOptions = {}): UseXrMapPositionValue {
  /**
   * 앵커는 ref에 둔다.
   *
   * 스냅샷 콜백이 앵커를 읽는데, 상태로 두면 콜백이 앵커가 바뀔 때마다 새로 만들어져야 한다.
   * 화면이 앵커의 존재 여부를 알아야 하므로 렌더에 필요한 최소 정보만 따로 상태로 올린다.
   */
  const anchorRef = useRef<XrMapAnchor | null>(null);
  const [anchorRevision, setAnchorRevision] = useState<number | null>(null);

  /** 마지막으로 산출한 추적 좌표. 추적이 끊겨도 남아 마지막 유효 위치가 된다. */
  const [trackedLocation, setTrackedLocation] = useState<IndoorPoint | null>(null);

  /** 마지막으로 산출한 지도 프레임 방향각. 좌표와 같은 스냅샷에서 나온다. */
  const [headingDeg, setHeadingDeg] = useState<number | null>(null);

  /**
   * 평활의 기준점.
   *
   * 상태와 별도로 ref에 두는 이유는 스냅샷 콜백이 동기적으로 직전 값을 읽어야 하기
   * 때문이다. 상태 갱신은 비동기라 같은 틱에 두 스냅샷이 오면 기준점이 밀린다.
   */
  const smoothedRef = useRef<IndoorPoint | null>(null);

  /**
   * 평활 옵션을 콜백 의존성에서 떼어낸다.
   *
   * 화면이 인라인 객체를 넘기면 렌더마다 식별자가 달라진다. 그것을 스냅샷 콜백의 의존성에
   * 두면 렌더마다 구독을 다시 걸게 되고, 그 사이 확정된 스냅샷이 유실될 수 있다.
   */
  const smoothingRef = useRef(smoothing);
  const distanceScaleRef = useRef(distanceScale);

  useEffect(() => {
    smoothingRef.current = smoothing;
  }, [smoothing]);

  useEffect(() => {
    distanceScaleRef.current = distanceScale;
  }, [distanceScale]);

  const tracking = useXrTracking({
    controller,
    onSnapshot: useCallback((snapshot) => {
      const anchor = anchorRef.current;

      // 앵커가 없으면 XR 좌표를 지도에 놓을 기준이 없다. 확정 위치만 표시된다(11.2).
      if (!anchor) return;

      const mapped = xrToMapPoint(snapshot.position, anchor, distanceScaleRef.current);

      if (!mapped) return;

      const smoothed = smoothMapPoint(smoothedRef.current, mapped, smoothingRef.current);

      smoothedRef.current = smoothed;
      setTrackedLocation(smoothed);
    }, []),
  });

  /**
   * 방향은 위치와 별도 채널로 받는다.
   *
   * 위치 스냅샷 주기로 갱신하면 제자리에서 몸만 돌렸을 때 화면이 최대 5초 늦는다 — 11.4가
   * 회전을 위치 확정 트리거에서 뺐기 때문이다. 컨트롤러가 회전 전용 데드밴드·최소 간격을
   * 적용해 각도만 흘려주므로, 위치 확정 주기는 그대로 두고 방향만 자주 갱신할 수 있다.
   *
   * 앵커가 없으면 각도를 지도 프레임으로 옮길 기준이 없어 그냥 버린다.
   */
  useEffect(
    () =>
      controller.subscribeHeading((yawDeg) => {
        const anchor = anchorRef.current;

        if (!anchor) return;

        setHeadingDeg(mapHeadingDegOf(yawDeg, anchor));
      }),
    [controller],
  );

  const setAnchor = useCallback(
    (map: IndoorPoint, forwardMap: PlanarVector | null) => {
      /**
       * 앵커에는 확정 주기를 거치지 않은 지금 pose를 쓴다. 스냅샷은 정지 상태에서 최대 5초
       * 뒤에 오므로(11.4) VPS가 좌표를 확정한 순간과 짝이 맞지 않는다.
       */
      const reading = controller.getLatestReading();

      /**
       * 추적 중이 아니면 앵커를 만들지 않는다.
       *
       * 상실 구간에도 직전 reading이 남아 있지만, 실측에서 blackout 사이에 반환된 pose는
       * 값 자체가 틀렸다(11.2). 그 값으로 앵커를 만들면 이후 전체가 어긋난다.
       */
      if (!reading || controller.getState().status !== 'tracking') return false;

      const nextRevision = anchorRef.current ? anchorRef.current.revision + 1 : 0;
      const anchor = createXrMapAnchor({ map, reading, forwardMap }, nextRevision);

      if (!anchor) return false;

      anchorRef.current = anchor;
      setAnchorRevision(anchor.revision);

      /**
       * 앵커 지점이 곧 확정된 위치다. 평활 기준점을 그 값으로 새로 잡는다.
       *
       * 이전 앵커 기준으로 평활하던 값을 이어 쓰면, 재인식으로 오차를 초기화했는데 화면이
       * 옛 위치에서 천천히 끌려오는 모양이 된다. 갱신의 목적이 누적 오차 초기화이므로
       * (11.2) 표시도 즉시 새 기준으로 옮긴다.
       */
      smoothedRef.current = map;
      setTrackedLocation(map);

      /**
       * 방향도 앵커 시점 값으로 새로 잡는다. 앵커 지점에서는 `forwardMap`의 각도와 같다.
       *
       * 여기서 세우지 않으면 다음 스냅샷까지(정지 상태에서 최대 5초) 이전 앵커 기준의 방향이
       * 남는다. 재인식으로 방향까지 다시 확정한 뒤인데 화면이 옛 방향을 가리키게 된다.
       */
      setHeadingDeg(mapHeadingDegOf(reading.yawDeg, anchor));

      return true;
    },
    [controller],
  );

  const clearAnchor = useCallback(() => {
    anchorRef.current = null;
    smoothedRef.current = null;
    setAnchorRevision(null);
    setTrackedLocation(null);
    setHeadingDeg(null);
  }, []);

  const anchorStatus: XrAnchorStatus =
    anchorRevision === null ? 'none' : anchorRevision === 0 ? 'established' : 'refreshed';

  /**
   * 추적 좌표를 아직 믿을 수 있는지.
   *
   * `tracking`과 `warming-up`은 갱신이 이어진다. 그 외(lost·ended·failed)는 좌표가 멈춘
   * 상태이므로 마지막 유효 위치로 표시하고 화면이 이를 구분할 수 있게 한다(11.7).
   */
  const isLive = tracking.status === 'tracking' || tracking.status === 'warming-up';

  /**
   * 추적 좌표가 있으면 그것이 사전 확정 좌표보다 우선한다.
   *
   * 앵커가 생긴 뒤에는 `currentIndoorLocation`이 바뀌어도 반영되지 않는다. 그 값은 안내
   * 화면 진입 시점에 고정되는 입력이며, 안내 중 위치 갱신은 `setAnchor`가 담당한다.
   * 배경과 조건은 `UseXrMapPositionOptions.currentIndoorLocation` 주석에 있다.
   */
  const { currentLocation, source } = useMemo(() => {
    if (!trackedLocation) {
      return { currentLocation: currentIndoorLocation, source: 'confirmed' as const };
    }

    return {
      currentLocation: trackedLocation,
      source: (isLive ? 'anchored' : 'last-known') as XrMapPositionSource,
    };
  }, [trackedLocation, currentIndoorLocation, isLive]);

  return {
    ...tracking,
    currentLocation,
    source,
    isStale: source === 'last-known',
    headingDeg,
    anchorStatus,
    anchorRevision,
    setAnchor,
    clearAnchor,
  };
}
