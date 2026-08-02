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
 * **앵커 좌표와 방향은 목업이다.** 세션 안 위치 인식 엔드포인트가 미정이라(12장 4번) 진입 시
 * 확정 위치와 `MOCK_ANCHOR_FORWARD_MAP`을 쓴다. 실제 위치 인식 연동이 아니다.
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
  return renderHook(() => useXrNavigationSession({ controller, currentIndoorLocation: CONFIRMED }));
}

const TRACKING: XrSessionState = { status: 'tracking', referenceSpaceType: 'local' };
const WARMING_UP: XrSessionState = { status: 'warming-up', referenceSpaceType: 'local' };

describe('첫 위치 인식 발화', () => {
  it('추적이 잡히면 앵커를 만든다', () => {
    const fake = createFakeController(TRACKING);
    const { result } = renderSession(fake.controller);

    expect(result.current.anchorStatus).toBe('established');
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
