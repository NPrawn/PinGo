import { act, renderHook, waitFor } from '@testing-library/react';
import type { XrSessionController, XrSessionState, XrStartOptions } from '@/shared/lib/webxr';
import { useXrNavigationSession } from './useXrNavigationSession';

/**
 * 세션 게이트 검증. (S15P11A206-141)
 *
 * 11.7이 확정한 순서 — **자동으로 열지 않고, 안내 후 사용자가 확인하면 연다** — 를 고정한다.
 * pose 수집·좌표 변환은 295·296의 테스트가 검사하므로 여기서 다루지 않는다.
 */

/** `detectXrSupport`가 읽는 전역. 기본은 지원 기기다. */
function stubXr(isSupported: boolean | 'throw') {
  const xr = {
    isSessionSupported: vi.fn(async () => {
      if (isSupported === 'throw') throw new Error('not implemented');
      return isSupported;
    }),
  };

  Object.defineProperty(navigator, 'xr', { value: xr, configurable: true, writable: true });

  return xr;
}

function createFakeController() {
  let state: XrSessionState = { status: 'idle' };
  const listeners = new Set<() => void>();
  const startCalls: XrStartOptions[] = [];
  /** start가 어떤 상태로 끝날지. 실패 경로를 시험하려면 바꿔 넣는다. */
  let startResult: XrSessionState = { status: 'warming-up', referenceSpaceType: 'local' };

  const notify = (): void => {
    listeners.forEach((listener) => {
      listener();
    });
  };

  const controller: XrSessionController = {
    getState: () => state,
    getSessionId: () => (state.status === 'warming-up' || state.status === 'tracking' ? 1 : null),
    getLatestReading: () => null,
    subscribe(listener) {
      const wrapped = (): void => {
        listener(state);
      };

      listeners.add(wrapped);

      return () => {
        listeners.delete(wrapped);
      };
    },
    subscribeSnapshots() {
      // 이 훅은 스냅샷을 296이 처리하므로 게이트 검증에서는 발화시키지 않는다.
      return () => undefined;
    },
    subscribeHeading() {
      return () => undefined;
    },
    async start(options = {}) {
      startCalls.push(options);
      state = startResult;
      notify();

      return state;
    },
    // 이 파일은 카메라 송출을 다루지 않는다. 켤 수 없는 컨트롤러로 둔다.
    startCameraStream: () => null,

    async stop() {
      state = { status: 'ended' };
      notify();
    },
  };

  return {
    controller,
    startCalls,
    setStartResult(next: XrSessionState) {
      startResult = next;
    },
    setState(next: XrSessionState) {
      state = next;
      notify();
    },
  };
}

describe('useXrNavigationSession', () => {
  beforeEach(() => {
    stubXr(true);
  });

  it('진입 시 세션을 열지 않고 안내를 표시한다', async () => {
    const fake = createFakeController();
    const { result } = renderHook(() => useXrNavigationSession({ controller: fake.controller }));

    await waitFor(() => {
      expect(result.current.support).toBe('supported');
    });

    // 11.7 확정 1항: 자동으로 열지 않는다.
    expect(fake.startCalls).toHaveLength(0);
    expect(result.current.isNoticeOpen).toBe(true);
    expect(result.current.isSessionOpen).toBe(false);
  });

  it('확인을 누르면 세션을 열고 안내를 닫는다', async () => {
    const fake = createFakeController();
    const { result } = renderHook(() => useXrNavigationSession({ controller: fake.controller }));

    await act(async () => {
      result.current.confirm();
    });

    expect(fake.startCalls).toHaveLength(1);
    expect(result.current.isNoticeOpen).toBe(false);
    expect(result.current.isSessionOpen).toBe(true);
  });

  it('추적 없이 계속하면 세션을 열지 않고 안내만 닫는다', async () => {
    const fake = createFakeController();
    const { result } = renderHook(() => useXrNavigationSession({ controller: fake.controller }));

    await act(async () => {
      result.current.continueWithoutTracking();
    });

    // 11.7: 추적 없이도 안내가 완결되어야 한다. 세션은 열리지 않는다.
    expect(fake.startCalls).toHaveLength(0);
    expect(result.current.isNoticeOpen).toBe(false);
    expect(result.current.isSessionOpen).toBe(false);
  });

  it('세션 시작이 실패하면 안내를 다시 표시한다', async () => {
    const fake = createFakeController();

    fake.setStartResult({ status: 'failed', reason: 'request-rejected' });

    const { result } = renderHook(() => useXrNavigationSession({ controller: fake.controller }));

    await act(async () => {
      result.current.confirm();
    });

    expect(result.current.isNoticeOpen).toBe(true);
    expect(result.current.isSessionOpen).toBe(false);
    // request-rejected는 재시도해도 결과가 달라질 수 있다(11.7).
    expect(result.current.canRetry).toBe(true);
  });

  it('권한이 차단된 실패에는 재시도 수단을 두지 않는다', async () => {
    const fake = createFakeController();

    fake.setStartResult({ status: 'failed', reason: 'permission-blocked' });

    const { result } = renderHook(() => useXrNavigationSession({ controller: fake.controller }));

    await act(async () => {
      result.current.confirm();
    });

    expect(result.current.isNoticeOpen).toBe(true);
    // 한 번 거부하면 앱 안에서 되돌릴 수 없다(11.7).
    expect(result.current.canRetry).toBe(false);
  });

  it('미지원 기기를 지원 탐지로 구분한다', async () => {
    stubXr(false);

    const fake = createFakeController();
    const { result } = renderHook(() => useXrNavigationSession({ controller: fake.controller }));

    await waitFor(() => {
      expect(result.current.support).toBe('unsupported');
    });

    expect(fake.startCalls).toHaveLength(0);
  });

  it('추적을 잃어도 세션은 열린 상태로 둔다', async () => {
    const fake = createFakeController();
    const { result } = renderHook(() => useXrNavigationSession({ controller: fake.controller }));

    await act(async () => {
      result.current.confirm();
    });

    act(() => {
      fake.setState({ status: 'lost' });
    });

    /**
     * 추적이 끊겨도 카메라 영상은 계속 나온다. 여기서 배경을 되돌리면 화면이 깜빡인다.
     * 위치 갱신이 멈춘 것은 배지가 알린다(11.7).
     */
    expect(result.current.isSessionOpen).toBe(true);
    expect(result.current.isNoticeOpen).toBe(false);
  });

  it('dom-overlay root가 붙어 있으면 세션 시작에 넘긴다', async () => {
    const fake = createFakeController();
    const { result } = renderHook(() => useXrNavigationSession({ controller: fake.controller }));
    const root = document.createElement('div');

    result.current.overlayRef.current = root;

    await act(async () => {
      result.current.confirm();
    });

    expect(fake.startCalls[0]?.domOverlayRoot).toBe(root);
  });

  it('root가 없으면 dom-overlay 없이 연다', async () => {
    const fake = createFakeController();
    const { result } = renderHook(() => useXrNavigationSession({ controller: fake.controller }));

    await act(async () => {
      result.current.confirm();
    });

    /**
     * root 없이 dom-overlay를 요청하면 부여되지 않으면서 동의 프롬프트만 하나 더 뜬다(11.7).
     * 컨트롤러가 root 유무로 요청 기능을 가르므로 여기서는 넘기지 않는 것으로 충분하다.
     */
    expect(fake.startCalls[0]?.domOverlayRoot).toBeUndefined();
  });
});
