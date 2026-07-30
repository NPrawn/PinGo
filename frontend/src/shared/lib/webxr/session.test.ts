import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createXrSessionController,
  PROVISIONAL_TRACKING_LOST_MS,
  type XrSessionState,
} from './session';
import type { XrPoseSnapshot } from './types';

/**
 * jsdom에는 WebXR이 없으므로 XRSystem·XRSession·XRFrame을 흉내낸 객체를 주입한다.
 *
 * 실기기 동작은 S15P11A206-294에서 확인했다(`docs/WebXR_검증_결과.md` 3장).
 * 여기서는 11.4·11.7·11.8이 정한 분기와 자원 정리가 코드에 반영됐는지만 본다.
 */
interface FakeSession {
  session: XRSession;
  /** 대기 중인 프레임 콜백에 pose를 하나 흘려보낸다. */
  emitFrame(time: number, pose: XRViewerPose | null): void;
  /** 브라우저가 세션을 끊은 경우. */
  fireEnd(): void;
  hasPendingFrame(): boolean;
  endCalls(): number;
  cancelCalls(): number;
  listenerCount(): number;
}

function createFakeSession(supportedSpaces: XRReferenceSpaceType[] = ['local']): FakeSession {
  const endListeners = new Set<() => void>();
  let pending: XRFrameRequestCallback | null = null;
  let nextHandle = 1;
  let endCalls = 0;
  let cancelCalls = 0;

  const fireEnd = (): void => {
    endListeners.forEach((listener) => {
      listener();
    });
  };

  const session = {
    requestReferenceSpace: vi.fn(async (type: XRReferenceSpaceType) => {
      if (!supportedSpaces.includes(type)) {
        throw new Error('NotSupportedError');
      }

      return { type } as unknown as XRReferenceSpace;
    }),
    requestAnimationFrame: vi.fn((callback: XRFrameRequestCallback) => {
      pending = callback;

      return nextHandle++;
    }),
    cancelAnimationFrame: vi.fn(() => {
      cancelCalls += 1;
      pending = null;
    }),
    addEventListener: vi.fn((type: string, listener: () => void) => {
      if (type === 'end') {
        endListeners.add(listener);
      }
    }),
    removeEventListener: vi.fn((type: string, listener: () => void) => {
      if (type === 'end') {
        endListeners.delete(listener);
      }
    }),
    end: vi.fn(async () => {
      endCalls += 1;
      fireEnd();
    }),
  };

  return {
    session: session as unknown as XRSession,
    emitFrame(time, pose) {
      const callback = pending;

      if (!callback) {
        throw new Error('대기 중인 프레임 콜백이 없다');
      }

      pending = null;
      callback(time, { getViewerPose: () => pose } as unknown as XRFrame);
    },
    fireEnd,
    hasPendingFrame: () => pending !== null,
    endCalls: () => endCalls,
    cancelCalls: () => cancelCalls,
    listenerCount: () => endListeners.size,
  };
}

function fakeXr(
  requestSession: (mode: string, init?: XRSessionInit) => Promise<XRSession>,
  supported = true,
): XRSystem {
  return {
    isSessionSupported: vi.fn().mockResolvedValue(supported),
    requestSession: vi.fn(requestSession),
  } as unknown as XRSystem;
}

function pose(x: number, z: number, y = 0): XRViewerPose {
  return {
    transform: {
      position: { x, y, z },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
    },
  } as unknown as XRViewerPose;
}

describe('createXrSessionController', () => {
  it('처음 상태는 idle이다', () => {
    expect(createXrSessionController({ xr: undefined }).getState()).toEqual({
      status: 'idle',
      reason: undefined,
      referenceSpaceType: undefined,
    });
  });

  describe('지원하지 않는 환경', () => {
    it('navigator.xr이 없으면 no-xr-object로 실패한다', async () => {
      const controller = createXrSessionController({ xr: undefined });
      const originalXr = navigator.xr;

      // jsdom에는 애초에 navigator.xr이 없지만, 값이 남아 있을 가능성을 지운다.
      Object.defineProperty(navigator, 'xr', { value: undefined, configurable: true });

      await expect(controller.start()).resolves.toMatchObject({
        status: 'failed',
        reason: 'no-xr-object',
      });

      Object.defineProperty(navigator, 'xr', { value: originalXr, configurable: true });
    });

    it('immersive-ar 미지원이면 unsupported로 실패한다', async () => {
      const requestSession = vi.fn();
      const controller = createXrSessionController({
        xr: fakeXr(requestSession, false),
      });

      await expect(controller.start()).resolves.toMatchObject({
        status: 'failed',
        reason: 'unsupported',
      });
      expect(requestSession).not.toHaveBeenCalled();
    });
  });

  describe('세션 시작', () => {
    it('dom-overlay와 camera-access를 optionalFeatures로 함께 요청한다', async () => {
      const fake = createFakeSession();
      const xr = fakeXr(async () => fake.session);
      const controller = createXrSessionController({ xr });

      await controller.start();

      expect(xr.requestSession).toHaveBeenCalledWith('immersive-ar', {
        optionalFeatures: ['dom-overlay', 'camera-access'],
      });
    });

    it('domOverlayRoot를 넘기면 domOverlay로 전달한다', async () => {
      const fake = createFakeSession();
      const xr = fakeXr(async () => fake.session);
      const controller = createXrSessionController({ xr });
      const root = document.createElement('div');

      await controller.start({ domOverlayRoot: root });

      expect(xr.requestSession).toHaveBeenCalledWith('immersive-ar', {
        optionalFeatures: ['dom-overlay', 'camera-access'],
        domOverlay: { root },
      });
    });

    /**
     * 11.8: getUserMedia와 세션은 공존하지 못한다. 순서가 뒤집히면 세션은 오류 없이 열리는데
     * pose가 하나도 나오지 않는다.
     */
    it('requestSession 전에 카메라를 반납한다', async () => {
      const order: string[] = [];
      const fake = createFakeSession();
      const controller = createXrSessionController({
        xr: fakeXr(async () => {
          order.push('requestSession');

          return fake.session;
        }),
      });

      await controller.start({
        releaseCamera: async () => {
          order.push('releaseCamera');
        },
      });

      expect(order).toEqual(['releaseCamera', 'requestSession']);
    });

    it('카메라 반납이 실패해도 세션 시작을 막지 않는다', async () => {
      const fake = createFakeSession();
      const controller = createXrSessionController({
        xr: fakeXr(async () => fake.session),
      });

      await expect(
        controller.start({
          releaseCamera: () => {
            throw new Error('트랙 정지 실패');
          },
        }),
      ).resolves.toMatchObject({ status: 'warming-up' });
    });

    it('local reference space로 시작하고 warming-up이 된다', async () => {
      const fake = createFakeSession();
      const controller = createXrSessionController({ xr: fakeXr(async () => fake.session) });

      await expect(controller.start()).resolves.toMatchObject({
        status: 'warming-up',
        referenceSpaceType: 'local',
      });
      expect(fake.hasPendingFrame()).toBe(true);
    });

    it('local이 없으면 local-floor로 넘어간다', async () => {
      const fake = createFakeSession(['local-floor']);
      const controller = createXrSessionController({ xr: fakeXr(async () => fake.session) });

      await expect(controller.start()).resolves.toMatchObject({
        referenceSpaceType: 'local-floor',
      });
    });

    it('쓸 수 있는 reference space가 없으면 세션을 닫고 실패한다', async () => {
      const fake = createFakeSession([]);
      const controller = createXrSessionController({ xr: fakeXr(async () => fake.session) });

      await expect(controller.start()).resolves.toMatchObject({
        status: 'failed',
        reason: 'no-reference-space',
      });
      expect(fake.endCalls()).toBe(1);
    });
  });

  /**
   * 11.7: 오류 name으로 판별하지 않는다. 실측에서 권한 거부가 NotSupportedError로 나타났다.
   * 판별은 실패까지 걸린 시간으로 한다. 실측값은 차단 10ms, 프롬프트 2.0~25.3초였다.
   */
  describe('세션 시작 실패 판별', () => {
    function controllerWithFailure(elapsedMs: number) {
      let calls = 0;

      return createXrSessionController({
        now: () => {
          calls += 1;

          return calls === 1 ? 0 : elapsedMs;
        },
        xr: fakeXr(async () => {
          throw new Error('NotSupportedError');
        }),
      });
    }

    it('500ms 미만에 실패하면 이미 차단된 권한으로 본다', async () => {
      await expect(controllerWithFailure(10).start()).resolves.toMatchObject({
        status: 'failed',
        reason: 'permission-blocked',
      });
    });

    it('500ms 이상 걸려 실패하면 재시도 가능한 거부로 본다', async () => {
      await expect(controllerWithFailure(2140).start()).resolves.toMatchObject({
        status: 'failed',
        reason: 'request-rejected',
      });
    });
  });

  describe('중복 세션 방지', () => {
    it('진행 중인 start가 있으면 세션을 두 번 만들지 않는다', async () => {
      const fake = createFakeSession();
      const xr = fakeXr(async () => fake.session);
      const controller = createXrSessionController({ xr });

      await Promise.all([controller.start(), controller.start(), controller.start()]);

      expect(xr.requestSession).toHaveBeenCalledTimes(1);
    });

    it('이미 열려 있으면 현재 상태를 그대로 돌려준다', async () => {
      const fake = createFakeSession();
      const xr = fakeXr(async () => fake.session);
      const controller = createXrSessionController({ xr });

      const first = await controller.start();
      const second = await controller.start();

      expect(xr.requestSession).toHaveBeenCalledTimes(1);
      expect(second).toEqual(first);
    });

    it('종료한 뒤에는 다시 시작할 수 있다', async () => {
      const xr = fakeXr(async () => createFakeSession().session);
      const controller = createXrSessionController({ xr });

      await controller.start();
      await controller.stop();
      await controller.start();

      expect(xr.requestSession).toHaveBeenCalledTimes(2);
    });
  });

  describe('추적 루프', () => {
    async function startedController(trackingLostAfterMs?: number) {
      const fake = createFakeSession();
      const snapshots: XrPoseSnapshot[] = [];
      const states: XrSessionState[] = [];
      const controller = createXrSessionController({
        xr: fakeXr(async () => fake.session),
        ...(trackingLostAfterMs === undefined ? {} : { trackingLostAfterMs }),
      });

      controller.subscribe((state) => states.push(state));
      controller.subscribeSnapshots((snapshot) => snapshots.push(snapshot));
      await controller.start();

      /**
       * 시작 과정의 전이(starting → warming-up)는 세션 시작 테스트에서 이미 확인했다.
       * 이 그룹은 프레임이 들어온 뒤의 상태 변화만 세므로 여기서 비운다.
       */
      states.length = 0;

      return { controller, fake, snapshots, states };
    }

    /**
     * 11.4: 세션 시작 직후 0.96~1.54초 동안 pose가 없다. 이 구간에 확정 위치를 만들지 않는다.
     */
    it('warming-up 구간의 pose 없는 프레임은 확정을 만들지 않는다', async () => {
      const { controller, fake, snapshots, states } = await startedController();

      fake.emitFrame(0, null);
      fake.emitFrame(16, null);
      fake.emitFrame(1000, null);

      expect(snapshots).toHaveLength(0);
      expect(controller.getState().status).toBe('warming-up');
      expect(states).toHaveLength(0);
    });

    it('첫 pose에서 tracking으로 바뀌고 first 스냅샷이 나온다', async () => {
      const { controller, fake, snapshots } = await startedController();

      fake.emitFrame(1200, pose(0, 0));

      expect(controller.getState().status).toBe('tracking');
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].trigger).toBe('first');
    });

    /**
     * 매 프레임 전역 상태나 UI를 갱신하지 않는 구조여야 한다. 상태 구독은 상태가 바뀔 때만
     * 호출되고, 스냅샷 구독은 확정 주기를 통과할 때만 호출된다.
     */
    it('상태가 바뀌지 않는 프레임에서는 상태 구독을 호출하지 않는다', async () => {
      const { fake, states, snapshots } = await startedController();

      fake.emitFrame(1200, pose(0, 0));
      expect(states).toHaveLength(1);

      // 이후 30프레임은 tracking 상태 그대로이고 확정 주기도 통과하지 않는다.
      for (let index = 1; index <= 30; index += 1) {
        fake.emitFrame(1200 + index * 16, pose(0, 0));
      }

      expect(states).toHaveLength(1);
      expect(snapshots).toHaveLength(1);
    });

    it('2m 이상 이동하면 move 스냅샷이 나온다', async () => {
      const { fake, snapshots } = await startedController();

      fake.emitFrame(1200, pose(0, 0));
      fake.emitFrame(2700, pose(0, -2.5));

      expect(snapshots.map((snapshot) => snapshot.trigger)).toEqual(['first', 'move']);
    });

    it('pose가 임계 시간 이상 없으면 lost가 되고 복구되면 tracking으로 돌아온다', async () => {
      const { controller, fake } = await startedController(1500);

      fake.emitFrame(1000, pose(0, 0));
      expect(controller.getState().status).toBe('tracking');

      // 계단에서 관측된 약 1초 결손은 상실로 보지 않는다.
      fake.emitFrame(2000, null);
      expect(controller.getState().status).toBe('tracking');

      // 엘리베이터에서 관측된 7초 결손은 상실로 본다.
      fake.emitFrame(2500, null);
      expect(controller.getState().status).toBe('lost');

      fake.emitFrame(9000, pose(0, -1));
      expect(controller.getState().status).toBe('tracking');
    });

    it('추적 상실 임계값의 기본값은 임시 확정값이다', () => {
      expect(PROVISIONAL_TRACKING_LOST_MS).toBe(1500);
    });
  });

  describe('자원 정리', () => {
    it('stop이 세션을 끝내고 프레임 루프와 리스너를 정리한다', async () => {
      const fake = createFakeSession();
      const controller = createXrSessionController({ xr: fakeXr(async () => fake.session) });

      await controller.start();
      fake.emitFrame(1200, pose(0, 0));
      await controller.stop();

      expect(controller.getState().status).toBe('ended');
      expect(fake.endCalls()).toBe(1);
      expect(fake.listenerCount()).toBe(0);
      expect(fake.hasPendingFrame()).toBe(false);
    });

    it('열려 있지 않으면 stop은 아무 일도 하지 않는다', async () => {
      const controller = createXrSessionController({
        xr: fakeXr(async () => createFakeSession().session),
      });

      await controller.stop();

      expect(controller.getState().status).toBe('idle');
    });

    /**
     * 11.7: 세션 중단은 end 이벤트로 드러난다. 재시작은 사용자 조작으로만 한다.
     */
    it('브라우저가 세션을 끊으면 ended가 되고 자원을 정리한다', async () => {
      const fake = createFakeSession();
      const controller = createXrSessionController({ xr: fakeXr(async () => fake.session) });

      await controller.start();
      fake.fireEnd();

      expect(controller.getState().status).toBe('ended');
      expect(fake.cancelCalls()).toBe(1);
      expect(fake.listenerCount()).toBe(0);
    });

    it('화면을 벗어나면(pagehide) 세션을 끝낸다', async () => {
      const fake = createFakeSession();
      const controller = createXrSessionController({ xr: fakeXr(async () => fake.session) });

      await controller.start();
      window.dispatchEvent(new Event('pagehide'));
      await vi.waitFor(() => {
        expect(controller.getState().status).toBe('ended');
      });

      expect(fake.endCalls()).toBe(1);
    });

    it('정리 후에는 pagehide가 세션을 다시 끊지 않는다', async () => {
      const fake = createFakeSession();
      const controller = createXrSessionController({ xr: fakeXr(async () => fake.session) });

      await controller.start();
      await controller.stop();
      window.dispatchEvent(new Event('pagehide'));

      expect(fake.endCalls()).toBe(1);
    });

    it('구독은 해제할 수 있다', async () => {
      const fake = createFakeSession();
      const controller = createXrSessionController({ xr: fakeXr(async () => fake.session) });
      const snapshots: XrPoseSnapshot[] = [];
      const unsubscribe = controller.subscribeSnapshots((snapshot) => snapshots.push(snapshot));

      await controller.start();
      unsubscribe();
      fake.emitFrame(1200, pose(0, 0));

      expect(snapshots).toHaveLength(0);
    });
  });
});

describe('xrSessionController 싱글턴', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  /**
   * XR 세션은 한 번에 하나만 열 수 있으므로 앱이 공유하는 인스턴스도 하나여야 한다.
   * 화면마다 컨트롤러를 만들면 중복 세션 방지가 컨트롤러 단위로만 걸린다.
   */
  it('같은 인스턴스를 돌려준다', async () => {
    const first = await import('./session');
    const second = await import('./session');

    expect(first.xrSessionController).toBe(second.xrSessionController);
  });
});
