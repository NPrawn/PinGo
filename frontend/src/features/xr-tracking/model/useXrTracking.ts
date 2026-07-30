import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  canRetryXrSession,
  xrSessionController,
  type XrFailureReason,
  type XrPoseSnapshot,
  type XrSessionController,
  type XrSessionState,
  type XrStartOptions,
  type XrTrackingStatus,
} from '@/shared/lib/webxr';

export interface UseXrTrackingOptions {
  /**
   * 확정된 pose 스냅샷을 받는다.
   *
   * 이 콜백은 리렌더를 일으키지 않는다. 스냅샷은 걸러도 보행 중 1.3~1.9초마다 하나씩
   * 나오므로, 화면 상태로 올리면 그때마다 컴포넌트가 다시 그려진다(11.4의 "상태 확정과
   * 화면 표시를 분리한다").
   *
   * 매 렌더마다 새 함수를 넘겨도 구독을 다시 걸지 않는다.
   */
  onSnapshot?: (snapshot: XrPoseSnapshot) => void;
  /** 테스트에서 가짜 컨트롤러를 주입한다. 기본값은 앱 공용 싱글턴이다. */
  controller?: XrSessionController;
}

export interface UseXrTrackingValue {
  /** 현재 추적 상태. */
  status: XrTrackingStatus;
  /** status가 failed일 때의 사유. */
  reason?: XrFailureReason;
  /** 확보된 reference space 종류. */
  referenceSpaceType?: XRReferenceSpaceType;
  /** pose가 들어오고 있다. */
  isTracking: boolean;
  /** 세션을 여는 중이거나 첫 pose를 기다리는 중이다. 이 구간에는 확정 위치가 없다. */
  isPreparing: boolean;
  /** 추적을 쓸 수 없다. 추적 없이 안내를 이어가야 한다. */
  isUnavailable: boolean;
  /** 화면에 재시도 수단을 둘 수 있는지. 11.7 기준이다. */
  canRetry: boolean;
  /** 세션을 시작한다. 이미 열려 있으면 새로 열지 않는다. */
  start: (options?: XrStartOptions) => Promise<XrSessionState>;
  /** 세션을 끝낸다. */
  stop: () => Promise<void>;
}

/**
 * WebXR 추적을 React 화면에서 쓰기 위한 훅.
 *
 * 화면은 이 훅만 쓰고 XRSession을 직접 다루지 않는다. 훅이 하는 일은 세 가지다.
 *
 * 1. 컨트롤러의 상태 변화를 리렌더로 잇는다. **상태 문자열이 바뀔 때만** 다시 그려진다.
 * 2. 컴포넌트가 사라질 때 세션을 끊는다. 세션이 남아 있으면 카메라를 계속 붙잡아, 위치
 *    재인식 화면 등에서 `getUserMedia`가 실패한다(11.8).
 * 3. 확정 스냅샷을 콜백으로 흘린다. 화면 상태로 올리지 않는다.
 *
 * **한 화면에서만 쓴다.** 컨트롤러가 앱 공용 싱글턴이므로, 두 컴포넌트가 동시에 이 훅을
 * 쓰면 한쪽이 사라질 때 다른 쪽의 세션까지 끊긴다.
 */
export function useXrTracking({
  onSnapshot,
  controller = xrSessionController,
}: UseXrTrackingOptions = {}): UseXrTrackingValue {
  /**
   * 상태 구독.
   *
   * getState는 상태가 바뀌지 않는 한 같은 객체를 돌려주므로, 매 프레임 pose가 들어와도
   * useSyncExternalStore가 리렌더를 일으키지 않는다.
   */
  const state = useSyncExternalStore(
    useCallback((onStoreChange: () => void) => controller.subscribe(onStoreChange), [controller]),
    useCallback(() => controller.getState(), [controller]),
  );

  /**
   * 콜백을 ref에 담아 구독과 분리한다.
   *
   * 화면이 인라인 함수를 넘기면 렌더마다 함수 식별자가 달라진다. 그것을 그대로 의존성에
   * 쓰면 렌더마다 구독을 끊고 다시 걸게 되고, 그 사이에 확정된 스냅샷이 유실될 수 있다.
   */
  const onSnapshotRef = useRef(onSnapshot);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  useEffect(
    () =>
      controller.subscribeSnapshots((snapshot) => {
        onSnapshotRef.current?.(snapshot);
      }),
    [controller],
  );

  /**
   * 화면을 떠날 때 세션과 추적을 중단한다(11.4 중단 조건).
   *
   * 세션이 열려 있지 않으면 stop은 아무 일도 하지 않으므로, 세션을 열지 않은 화면에서
   * 훅을 써도 안전하다.
   */
  useEffect(
    () => () => {
      void controller.stop();
    },
    [controller],
  );

  const start = useCallback((options?: XrStartOptions) => controller.start(options), [controller]);

  const stop = useCallback(() => controller.stop(), [controller]);

  return {
    status: state.status,
    reason: state.reason,
    referenceSpaceType: state.referenceSpaceType,
    isTracking: state.status === 'tracking',
    isPreparing: state.status === 'starting' || state.status === 'warming-up',
    isUnavailable: state.status === 'failed',
    canRetry: state.status === 'failed' && canRetryXrSession(state.reason),
    start,
    stop,
  };
}
