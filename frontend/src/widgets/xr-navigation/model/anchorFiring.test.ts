import { act, renderHook } from '@testing-library/react';
import type { IndoorPoint } from '@/entities/navigation';
import type {
  XrPoseReading,
  XrPoseSnapshot,
  XrSessionController,
  XrSessionState,
} from '@/shared/lib/webxr';
import { useXrNavigationSession } from './useXrNavigationSession';

/**
 * 첫 위치 인식 발화 검증. (S15P11A206-141)
 *
 * 이 파일이 보는 것은 **141이 정한 발화 시점** — 추적이 잡히는 순간 앵커가 한 번 만들어지고,
 * 그 뒤 pose가 들어오면 표시 좌표가 갱신되는지다. 좌표가 지도 마커 픽셀로 옮겨지는 것은
 * `widgets/indoor-map/ui/IndoorMapView.xrPosition.test.tsx`(296)가 검사한다.
 *
 * 앵커 방향은 진입 전 VPS 응답으로 받은 실제 `forwardMap` fixture를 사용한다.
 */

/** 진입 시 확정 위치. 검산이 쉬운 미터 원점이다. */
const CONFIRMED: IndoorPoint = { floorId: 1, mapX: 0, mapY: 0 };

function createFakeController(initial: XrSessionState) {
  let state = initial;
  /** 세션 식별자. 세션이 다시 열릴 때마다 새 값이 부여된다. */
  let sessionId: number | null = 1;
  let latestReading: XrPoseReading | null = {
    position: { x: 0, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    yawDeg: 0,
    timestamp: 0,
  };
  const stateListeners = new Set<() => void>();
  const snapshotListeners = new Set<(snapshot: XrPoseSnapshot) => void>();
  const headingListeners = new Set<(yawDeg: number) => void>();

  const controller: XrSessionController = {
    getState: () => state,
    getSessionId: () => sessionId,
    getLatestReading: () => latestReading,
    subscribe(listener) {
      const notify = (): void => {
        listener(state);
      };

      stateListeners.add(notify);

      return () => {
        stateListeners.delete(notify);
      };
    },
    subscribeSnapshots(listener) {
      snapshotListeners.add(listener);

      return () => {
        snapshotListeners.delete(listener);
      };
    },
    subscribeHeading(listener) {
      headingListeners.add(listener);

      return () => {
        headingListeners.delete(listener);
      };
    },
    async start() {
      return state;
    },
    // 이 파일은 카메라 송출을 다루지 않는다. 켤 수 없는 컨트롤러로 둔다.
    startCameraStream: () => null,
    subscribeCameraStream: () => () => undefined,
    getCameraStreamState: () => 'idle' as const,
    getCameraSourceSize: () => null,
    captureStillFrame: () => Promise.resolve(null),

    async stop() {
      state = { status: 'ended' };
    },
  };

  return {
    controller,
    setState(next: XrSessionState) {
      state = next;
      stateListeners.forEach((listener) => {
        listener();
      });
    },
    /** 세션을 다시 연다. reference space 원점이 새로 잡히므로 식별자도 새 값이 된다. */
    restartSession(next: XrSessionState) {
      sessionId = sessionId === null ? 1 : sessionId + 1;
      state = next;
      stateListeners.forEach((listener) => {
        listener();
      });
    },
    /** warming-up 구간을 흉내낸다. 그 구간에는 읽을 pose가 없다. */
    clearReading() {
      latestReading = null;
    },
    setReading(next: XrPoseReading) {
      latestReading = next;
    },
    emitHeading(yawDeg: number) {
      headingListeners.forEach((listener) => {
        listener(yawDeg);
      });
    },
    emitSnapshot(x: number, z: number) {
      snapshotListeners.forEach((listener) => {
        listener({
          position: { x, y: 0, z },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
          yawDeg: 0,
          timestamp: 1000,
          trigger: 'move',
        });
      });
    },
  };
}

function renderSession(controller: XrSessionController) {
  return renderHook(() =>
    useXrNavigationSession({
      controller,
      currentIndoorLocation: CONFIRMED,
      anchorForwardMap: { x: 0.6, y: 0.8 },
    }),
  );
}

const TRACKING: XrSessionState = { status: 'tracking', referenceSpaceType: 'local' };
const WARMING_UP: XrSessionState = { status: 'warming-up', referenceSpaceType: 'local' };

/**
 * 앞뒤로 `pitchDeg`만큼 눕힌 자세의 pose. 회전축은 단말 X축이다.
 *
 * 그 자세에서 `cameraTiltSinOf`는 `sin θ`, `deviceUprightOf`는 `cos θ`가 된다. 150도면 sin이
 * 0.5로 기울임 한계(sin 65도 = 0.906)를 통과하지만 cos가 -0.866이라 뒤집힘 조건에 걸린다 —
 * 몸은 정면인데 들고 있던 손을 내려 카메라만 뒤를 보는 자세가 정확히 그것이다.
 */
function tiltedReading(pitchDeg: number): XrPoseReading {
  const half = (pitchDeg * Math.PI) / 360;

  return {
    position: { x: 0, y: 0, z: 0 },
    orientation: { x: Math.sin(half), y: 0, z: 0, w: Math.cos(half) },
    yawDeg: 0,
    timestamp: 0,
  };
}

describe('첫 위치 인식 발화', () => {
  it('추적이 잡히면 앵커를 만든다', () => {
    const fake = createFakeController(TRACKING);
    const { result } = renderSession(fake.controller);

    expect(result.current.anchorStatus).toBe('established');
  });

  it('VPS 방향이 없으면 임의 방향으로 앵커를 만들지 않는다', () => {
    const fake = createFakeController(TRACKING);
    const { result } = renderHook(() =>
      useXrNavigationSession({
        controller: fake.controller,
        currentIndoorLocation: CONFIRMED,
        anchorForwardMap: null,
      }),
    );

    expect(result.current.anchorStatus).toBe('none');
  });

  /**
   * 세션 시작 직후 0.96~1.54초는 pose가 없다. 이 구간에 발화하면 `setAnchor`가 컨트롤러에서
   * null을 받아 실패한다. 보류했다가 나중에 적용하는 대기 큐를 만들지 않는 것이 141의 결정이다 —
   * 앵커는 지도 좌표와 pose를 같은 순간의 값으로 묶어야 한다.
   */
  it('warming-up 구간에는 앵커를 만들지 않고 확정 위치만 표시한다', () => {
    const fake = createFakeController(WARMING_UP);

    fake.clearReading();

    const { result } = renderSession(fake.controller);

    expect(result.current.anchorStatus).toBe('none');
    expect(result.current.source).toBe('confirmed');
    expect(result.current.currentLocation).toEqual(CONFIRMED);
  });

  it('warming-up에서 tracking으로 넘어가면 그때 앵커를 만든다', () => {
    const fake = createFakeController(WARMING_UP);
    const { result } = renderSession(fake.controller);

    expect(result.current.anchorStatus).toBe('none');

    act(() => {
      fake.setState(TRACKING);
    });

    expect(result.current.anchorStatus).toBe('established');
  });

  /** 141의 완료 기준 — 사용자가 이동하면 지도 위 현재 위치가 갱신된다(FR-U-010). */
  it('앵커가 생긴 뒤 pose가 들어오면 표시 좌표가 움직인다', () => {
    const fake = createFakeController(TRACKING);
    const { result } = renderSession(fake.controller);

    expect(result.current.currentLocation).toEqual(CONFIRMED);

    act(() => {
      // 전방 10m. 목업 방향이 축에 정렬되지 않은 값이라 mapX·mapY가 모두 바뀐다.
      fake.emitSnapshot(0, -10);
    });

    expect(result.current.source).toBe('anchored');
    expect(result.current.currentLocation).not.toEqual(CONFIRMED);
  });

  it('확정 위치가 없으면 앵커를 만들지 않는다', () => {
    const fake = createFakeController(TRACKING);
    const { result } = renderHook(() =>
      useXrNavigationSession({ controller: fake.controller, currentIndoorLocation: null }),
    );

    // 지도 좌표가 없으면 XR 좌표를 놓을 기준을 만들 수 없다.
    expect(result.current.anchorStatus).toBe('none');
    expect(result.current.currentLocation).toBeNull();
  });

  /**
   * 확정 위치가 나중에 도착하는 경우. (S15P11A206-89)
   *
   * 안내 화면은 진입 시점에 위치를 늘 들고 있지만, 상담은 어느 화면에서도 시작된다. 그때 위치는
   * 상담자가 지도에서 짚어 주거나 위치 인식이 끝난 뒤에 도착한다. 그 시점에 앵커를 만들지 않으면
   * **방향과 이동이 영원히 잡히지 않는다** — `useXrMapPosition` 은 앵커가 없으면 pose 스냅샷과
   * heading 갱신을 둘 다 버린다.
   */
  it('추적 중에 확정 위치가 나중에 도착하면 그때 앵커를 만들고 방향도 잡는다', () => {
    const fake = createFakeController(TRACKING);
    const { result, rerender } = renderHook(
      ({ location }: { location: IndoorPoint | null }) =>
        useXrNavigationSession({
          controller: fake.controller,
          currentIndoorLocation: location,
          // 방향은 처음부터 있다. 여기서 보는 것은 **좌표가 늦게 도착하는** 경우다.
          anchorForwardMap: { x: 0.6, y: 0.8 },
        }),
      { initialProps: { location: null as IndoorPoint | null } },
    );

    expect(result.current.anchorStatus).toBe('none');

    // 앵커가 없는 동안 들어온 방향은 버려진다.
    act(() => {
      fake.emitHeading(30);
    });
    expect(result.current.headingDeg).toBeNull();

    rerender({ location: CONFIRMED });

    expect(result.current.anchorStatus).toBe('established');

    act(() => {
      fake.emitHeading(30);
    });
    expect(result.current.headingDeg).not.toBeNull();
  });

  /**
   * 추적이 끊겼다 복구될 때마다 앵커를 다시 만들면 진입 시점 좌표로 되돌아가, 사용자가 걸어온
   * 거리가 사라진다. 갱신은 재인식이 담당한다(11.2).
   */
  it('추적을 잃고 복구되어도 앵커를 다시 만들지 않는다', () => {
    const fake = createFakeController(TRACKING);
    const { result } = renderSession(fake.controller);

    act(() => {
      fake.emitSnapshot(0, -10);
    });

    const moved = result.current.currentLocation;

    act(() => {
      fake.setState({ status: 'lost' });
    });
    act(() => {
      fake.setState(TRACKING);
    });

    expect(result.current.anchorStatus).toBe('established');
    expect(result.current.currentLocation).toEqual(moved);
  });

  /**
   * 세션이 다시 열리면 reference space 원점이 새로 잡힌다. 옛 앵커로 새 세션의 pose를 변환하면
   * 오류 없이 조용히 틀린 위치가 나오므로, 앵커를 버리고 새로 만들어야 한다.
   */
  it('세션이 다시 열리면 앵커를 버리고 새로 만든다', () => {
    const fake = createFakeController(TRACKING);
    const { result } = renderSession(fake.controller);

    act(() => {
      fake.emitSnapshot(0, -10);
    });

    const moved = result.current.currentLocation;

    expect(moved).not.toEqual(CONFIRMED);

    // 세션 종료 → 재시작. 실제 흐름과 같은 순서를 밟는다.
    act(() => {
      fake.setState({ status: 'ended' });
    });
    act(() => {
      fake.restartSession(WARMING_UP);
    });
    act(() => {
      fake.setState(TRACKING);
    });

    /**
     * 새 세션의 앵커다. `established`(revision 0)이며 `refreshed`가 아니다 — 갱신이 아니라
     * 새로 만든 것이다. 좌표는 진입 확정 위치에서 다시 시작한다.
     */
    expect(result.current.anchorStatus).toBe('established');
    expect(result.current.currentLocation).toEqual(CONFIRMED);
  });

  /**
   * 자세가 나쁜 순간에 앵커를 구우면 뒤집힘이 **영구히** 남는다. (S15P11A206-382)
   *
   * 앵커는 `forwardXr`과 `forwardMap` 사이의 회전을 얼려 두고, 그 뒤 모든 방향각과 변위가 그
   * 회전을 지난다. 구울 때 yaw가 180도 틀어져 있었다면 화면 전체가 뒤집힌 좌표계에서 살고,
   * 자세가 정상으로 돌아와도 회복되지 않는다 — "방향이 한번 뒤집히면 본래 방향을 잃고 뒤집힌
   * 쪽을 정면으로 인지한다"는 보고의 정체다.
   *
   * 그래서 거절하는데, 거절하고 끝내면 그 세션은 앵커 없이 남는다. 다시 시도해야 한다.
   */
  it('자세가 나쁘면 앵커를 만들지 않고, 자세가 돌아올 때까지 다시 시도한다', () => {
    vi.useFakeTimers();

    try {
      const fake = createFakeController(TRACKING);

      // 위치 인식을 위해 주변을 훑은 직후의 자세. 첫 앵커가 만들어지는 순간이 바로 이때다.
      fake.setReading(tiltedReading(150));

      const { result } = renderSession(fake.controller);

      expect(result.current.anchorStatus).toBe('none');

      // 아직 붙지 않았으므로 계속 두드리고 있어야 한다.
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(result.current.anchorStatus).toBe('none');

      // 손을 다시 들어 앞을 보게 됐다.
      fake.setReading(tiltedReading(10));
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.anchorStatus).toBe('established');
      // 붙은 뒤에는 두드리기를 멈춘다.
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  /** 세션이 끝난 구간에서는 마지막 유효 위치를 그대로 보여준다(11.7). */
  it('세션이 끝나도 마지막 위치를 지우지 않는다', () => {
    const fake = createFakeController(TRACKING);
    const { result } = renderSession(fake.controller);

    act(() => {
      fake.emitSnapshot(0, -10);
    });

    const moved = result.current.currentLocation;

    act(() => {
      fake.setState({ status: 'ended' });
    });

    expect(result.current.currentLocation).toEqual(moved);
    expect(result.current.isStale).toBe(true);
  });
});
