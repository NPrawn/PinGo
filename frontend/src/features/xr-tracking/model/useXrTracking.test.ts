import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  XrPoseSnapshot,
  XrSessionController,
  XrSessionState,
  XrStartOptions,
} from '@/shared/lib/webxr';
import { useXrTracking } from './useXrTracking';

/**
 * 컨트롤러를 주입해 훅만 검사한다.
 *
 * 세션 생명주기 자체는 `shared/lib/webxr/session.test.ts`에서 검사했다. 여기서 보는 것은
 * 리렌더 조건, 언마운트 정리, 스냅샷 전달 경로다.
 */
interface FakeController {
  controller: XrSessionController;
  /** 컨트롤러가 상태를 바꾼 것처럼 구독자에게 알린다. */
  setState(next: XrSessionState): void;
  /** 확정 스냅샷이 나온 것처럼 구독자에게 흘린다. */
  emitSnapshot(snapshot: XrPoseSnapshot): void;
  startCalls(): XrStartOptions[];
  stopCalls(): number;
  stateListenerCount(): number;
  snapshotListenerCount(): number;
  /** 다른 화면이 새 세션을 연 것처럼 식별자만 바꾼다. */
  replaceSession(): void;
}

function createFakeController({ opensSession = true } = {}): FakeController {
  let state: XrSessionState = { status: 'idle' };
  const stateListeners = new Set<() => void>();
  const snapshotListeners = new Set<(snapshot: XrPoseSnapshot) => void>();
  const startCalls: XrStartOptions[] = [];
  let stopCalls = 0;
  let sessionId: number | null = null;
  let nextSessionId = 1;

  const controller: XrSessionController = {
    getState: () => state,
    getSessionId: () => sessionId,
    // 앵커 생성용 원시 pose는 useXrMapPosition에서 검사한다.
    getLatestReading: () => null,
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
    async start(options = {}) {
      startCalls.push(options);

      if (opensSession) {
        sessionId = nextSessionId;
        nextSessionId += 1;
      }

      return state;
    },
    async stop() {
      stopCalls += 1;
      sessionId = null;
    },
  };

  return {
    controller,
    replaceSession() {
      sessionId = nextSessionId;
      nextSessionId += 1;
    },
    setState(next) {
      state = next;
      stateListeners.forEach((listener) => {
        listener();
      });
    },
    emitSnapshot(snapshot) {
      snapshotListeners.forEach((listener) => {
        listener(snapshot);
      });
    },
    startCalls: () => startCalls,
    stopCalls: () => stopCalls,
    stateListenerCount: () => stateListeners.size,
    snapshotListenerCount: () => snapshotListeners.size,
  };
}

function snapshot(z: number, timestamp: number): XrPoseSnapshot {
  return {
    position: { x: 0, y: 0, z },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    yawDeg: 0,
    timestamp,
    trigger: 'move',
  };
}

describe('useXrTracking', () => {
  it('컨트롤러의 현재 상태를 그대로 노출한다', () => {
    const fake = createFakeController();
    const { result } = renderHook(() => useXrTracking({ controller: fake.controller }));

    expect(result.current.status).toBe('idle');
    expect(result.current.isTracking).toBe(false);
    expect(result.current.isPreparing).toBe(false);
  });

  it('상태가 바뀌면 다시 렌더한다', () => {
    const fake = createFakeController();
    const { result } = renderHook(() => useXrTracking({ controller: fake.controller }));

    act(() => {
      fake.setState({ status: 'tracking', referenceSpaceType: 'local' });
    });

    expect(result.current.status).toBe('tracking');
    expect(result.current.isTracking).toBe(true);
    expect(result.current.referenceSpaceType).toBe('local');
  });

  /**
   * 확정 스냅샷은 화면 상태로 올리지 않는다. 걸러도 보행 중 1.3~1.9초마다 하나씩 나오므로
   * 상태로 올리면 그때마다 화면이 다시 그려진다(11.4).
   */
  it('스냅샷은 콜백으로만 전달하고 리렌더를 일으키지 않는다', () => {
    const fake = createFakeController();
    const received: XrPoseSnapshot[] = [];
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;

      return useXrTracking({
        controller: fake.controller,
        onSnapshot: (value) => received.push(value),
      });
    });

    const rendersBefore = renders;

    act(() => {
      fake.emitSnapshot(snapshot(-2, 1500));
      fake.emitSnapshot(snapshot(-4, 3000));
    });

    expect(received).toHaveLength(2);
    expect(renders).toBe(rendersBefore);
    expect(result.current.status).toBe('idle');
  });

  it('콜백이 매 렌더마다 새 함수여도 구독을 다시 걸지 않는다', () => {
    const fake = createFakeController();
    const received: XrPoseSnapshot[] = [];
    const { rerender } = renderHook(() =>
      useXrTracking({
        controller: fake.controller,
        // 인라인 함수라 렌더마다 식별자가 달라진다.
        onSnapshot: (value) => received.push(value),
      }),
    );

    rerender();
    rerender();

    expect(fake.snapshotListenerCount()).toBe(1);

    act(() => {
      fake.emitSnapshot(snapshot(-2, 1500));
    });

    expect(received).toHaveLength(1);
  });

  it('가장 최근 콜백으로 스냅샷을 전달한다', () => {
    const fake = createFakeController();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ onSnapshot }: { onSnapshot: (snapshot: XrPoseSnapshot) => void }) =>
        useXrTracking({ controller: fake.controller, onSnapshot }),
      { initialProps: { onSnapshot: first } },
    );

    rerender({ onSnapshot: second });

    act(() => {
      fake.emitSnapshot(snapshot(-2, 1500));
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('start에 넘긴 옵션을 컨트롤러로 통과시킨다', async () => {
    const fake = createFakeController();
    const root = document.createElement('div');
    const releaseCamera = vi.fn();
    const { result } = renderHook(() => useXrTracking({ controller: fake.controller }));

    await act(async () => {
      await result.current.start({ domOverlayRoot: root, releaseCamera });
    });

    expect(fake.startCalls()).toEqual([{ domOverlayRoot: root, releaseCamera }]);
  });

  /**
   * 11.4 중단 조건: 경로 안내 화면을 벗어나면 세션과 추적을 중단한다.
   * 세션이 남아 있으면 카메라를 붙잡아 다음 화면의 getUserMedia가 실패한다(11.8).
   */
  it('언마운트 시 자기가 연 세션을 끊고 구독을 해제한다', async () => {
    const fake = createFakeController();
    const { result, unmount } = renderHook(() =>
      useXrTracking({ controller: fake.controller, onSnapshot: vi.fn() }),
    );

    expect(fake.stateListenerCount()).toBe(1);
    expect(fake.snapshotListenerCount()).toBe(1);

    await act(async () => {
      await result.current.start();
    });
    unmount();

    expect(fake.stopCalls()).toBe(1);
    expect(fake.stateListenerCount()).toBe(0);
    expect(fake.snapshotListenerCount()).toBe(0);
  });

  /**
   * 컨트롤러가 앱 공용 싱글턴이므로, 언마운트에서 무조건 stop을 부르면 세션을 열지도 않은
   * 화면이 다른 화면의 세션을 끊는다. 라우트 전환에서 새 화면이 먼저 마운트되고 옛 화면이
   * 나중에 언마운트되는 순서, 그리고 세션이 살아 있는 중의 재마운트가 그 경우다.
   */
  describe('세션 소유권', () => {
    it('세션을 열지 않은 화면의 언마운트는 아무 세션도 끊지 않는다', () => {
      const fake = createFakeController();
      const { unmount } = renderHook(() => useXrTracking({ controller: fake.controller }));

      // 다른 화면이 이미 세션을 열어 둔 상태다.
      fake.replaceSession();
      unmount();

      expect(fake.stopCalls()).toBe(0);
    });

    it('자기 세션이 이미 다른 세션으로 바뀌었으면 끊지 않는다', async () => {
      const fake = createFakeController();
      const { result, unmount } = renderHook(() => useXrTracking({ controller: fake.controller }));

      await act(async () => {
        await result.current.start();
      });

      // 옛 화면이 언마운트되기 전에 다른 화면이 새 세션을 열었다.
      fake.replaceSession();
      unmount();

      expect(fake.stopCalls()).toBe(0);
    });

    it('start가 실패했으면 소유권이 생기지 않는다', async () => {
      const fake = createFakeController({ opensSession: false });
      const { result, unmount } = renderHook(() => useXrTracking({ controller: fake.controller }));

      await act(async () => {
        await result.current.start();
      });
      unmount();

      expect(fake.stopCalls()).toBe(0);
    });

    it('직접 stop한 뒤의 언마운트는 다시 끊지 않는다', async () => {
      const fake = createFakeController();
      const { result, unmount } = renderHook(() => useXrTracking({ controller: fake.controller }));

      await act(async () => {
        await result.current.start();
        await result.current.stop();
      });
      unmount();

      expect(fake.stopCalls()).toBe(1);
    });
  });

  describe('11.7 상태 분류', () => {
    it('세션 준비 중을 isPreparing으로 구분한다', () => {
      const fake = createFakeController();
      const { result } = renderHook(() => useXrTracking({ controller: fake.controller }));

      act(() => {
        fake.setState({ status: 'starting' });
      });
      expect(result.current.isPreparing).toBe(true);

      // 첫 pose를 기다리는 구간도 준비 중이다. 이 구간에는 확정 위치가 없다.
      act(() => {
        fake.setState({ status: 'warming-up', referenceSpaceType: 'local' });
      });
      expect(result.current.isPreparing).toBe(true);
      expect(result.current.isTracking).toBe(false);
    });

    it('추적 상실은 사용 불가가 아니다', () => {
      const fake = createFakeController();
      const { result } = renderHook(() => useXrTracking({ controller: fake.controller }));

      act(() => {
        fake.setState({ status: 'lost', referenceSpaceType: 'local' });
      });

      expect(result.current.isUnavailable).toBe(false);
      expect(result.current.isTracking).toBe(false);
      expect(result.current.canRetry).toBe(false);
    });

    it('미지원과 권한 차단은 재시도 수단을 두지 않는다', () => {
      const fake = createFakeController();
      const { result } = renderHook(() => useXrTracking({ controller: fake.controller }));

      for (const reason of ['no-xr-object', 'unsupported', 'permission-blocked'] as const) {
        act(() => {
          fake.setState({ status: 'failed', reason });
        });

        expect(result.current.isUnavailable).toBe(true);
        expect(result.current.canRetry).toBe(false);
      }
    });

    it('이번 요청 거부는 재시도할 수 있다', () => {
      const fake = createFakeController();
      const { result } = renderHook(() => useXrTracking({ controller: fake.controller }));

      act(() => {
        fake.setState({ status: 'failed', reason: 'request-rejected' });
      });

      expect(result.current.canRetry).toBe(true);
    });
  });
});
