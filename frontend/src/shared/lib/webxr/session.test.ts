import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createXrSessionController,
  PROVISIONAL_TRACKING_LOST_MS,
  type XrSessionControllerOptions,
  type XrSessionState,
} from './session';
import type { XrPoseSnapshot } from './types';

/**
 * 렌더 레이어 연결을 성공으로 고정한 컨트롤러.
 *
 * `XRWebGLLayer`가 없으면 immersive 세션은 프레임을 만들지 않으므로 컨트롤러가 이 레이어를
 * 반드시 붙인다(S15P11A206-141). jsdom에는 WebGL이 없어 실제 연결을 시험할 수 없고, 그것은
 * 실기기 검증 항목이다. 이 파일이 보는 것은 연결 성공·실패가 세션 흐름을 어떻게 가르는지다.
 */
function createController(options: XrSessionControllerOptions = {}) {
  return createXrSessionController({ attachRenderLayer: async () => true, ...options });
}

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

/** +Y축 기준으로 회전한 pose. 방향 채널 검증용이다. */
function poseYaw(yawDeg: number): XRViewerPose {
  const half = (yawDeg * Math.PI) / 360;

  return {
    transform: {
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) },
    },
  } as unknown as XRViewerPose;
}

describe('createXrSessionController', () => {
  it('처음 상태는 idle이다', () => {
    expect(createController({ xr: undefined }).getState()).toEqual({
      status: 'idle',
      reason: undefined,
      referenceSpaceType: undefined,
    });
  });

  describe('지원하지 않는 환경', () => {
    it('navigator.xr이 없으면 no-xr-object로 실패한다', async () => {
      const controller = createController({ xr: undefined });
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
      const controller = createController({
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
    /**
     * DOM Overlay 명세는 `domOverlay`가 없으면 `dom-overlay`를 지원되지 않는 기능으로 처리한다.
     * root 없이 요청하면 어차피 부여되지 않는데, 2차 검증에서 기능마다 각자 동의 프롬프트가
     * 떴으므로(11.7) 얻을 수 없는 기능 때문에 프롬프트를 하나 더 띄우게 된다.
     */
    it('domOverlayRoot가 없으면 dom-overlay를 요청하지 않는다', async () => {
      const fake = createFakeSession();
      const xr = fakeXr(async () => fake.session);
      const controller = createController({ xr });

      await controller.start();

      expect(xr.requestSession).toHaveBeenCalledWith('immersive-ar', {
        optionalFeatures: ['camera-access'],
      });
    });

    it('domOverlayRoot를 넘기면 domOverlay로 전달한다', async () => {
      const fake = createFakeSession();
      const xr = fakeXr(async () => fake.session);
      const controller = createController({ xr });
      const root = document.createElement('div');

      await controller.start({ domOverlayRoot: root });

      expect(xr.requestSession).toHaveBeenCalledWith('immersive-ar', {
        optionalFeatures: ['dom-overlay', 'camera-access'],
        domOverlay: { root },
      });
    });

    it('camera-access는 root와 무관하게 항상 요청한다', async () => {
      const fake = createFakeSession();
      const xr = fakeXr(async () => fake.session);
      const controller = createController({ xr });

      await controller.start();
      const [, init] = vi.mocked(xr.requestSession).mock.calls[0];

      expect(init?.optionalFeatures).toContain('camera-access');
    });

    /**
     * 11.8: getUserMedia와 세션은 공존하지 못한다. 순서가 뒤집히면 세션은 오류 없이 열리는데
     * pose가 하나도 나오지 않는다.
     */
    it('requestSession 전에 카메라를 반납한다', async () => {
      const order: string[] = [];
      const fake = createFakeSession();
      const controller = createController({
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
      const controller = createController({
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
      const controller = createController({ xr: fakeXr(async () => fake.session) });

      await expect(controller.start()).resolves.toMatchObject({
        status: 'warming-up',
        referenceSpaceType: 'local',
      });
      expect(fake.hasPendingFrame()).toBe(true);
    });

    it('local이 없으면 local-floor로 넘어간다', async () => {
      const fake = createFakeSession(['local-floor']);
      const controller = createController({ xr: fakeXr(async () => fake.session) });

      await expect(controller.start()).resolves.toMatchObject({
        referenceSpaceType: 'local-floor',
      });
    });

    /**
     * `viewer` 공간에서 getViewerPose는 항상 원점을 돌려준다. 뷰어 자신을 기준으로 한 뷰어의
     * pose이므로 위치가 영원히 (0,0,0)이다. 그대로 쓰면 pose가 있으니 tracking으로 보이는데
     * 이동은 한 번도 감지되지 않아, 조용히 틀린 위치를 내보내게 된다.
     *
     * 11.7의 원칙은 추적 없이도 안내가 완결되어야 한다는 것이다. 쓸 수 없는 공간이면 실패로
     * 알리고 fallback 경로를 타는 편이 맞다.
     */
    it('viewer 공간만 있으면 상대 위치를 못 구하므로 실패로 처리한다', async () => {
      const fake = createFakeSession(['viewer']);
      const controller = createController({ xr: fakeXr(async () => fake.session) });

      await expect(controller.start()).resolves.toMatchObject({
        status: 'failed',
        reason: 'no-reference-space',
      });
      expect(fake.endCalls()).toBe(1);
    });

    it('쓸 수 있는 reference space가 없으면 세션을 닫고 실패한다', async () => {
      const fake = createFakeSession([]);
      const controller = createController({ xr: fakeXr(async () => fake.session) });

      await expect(controller.start()).resolves.toMatchObject({
        status: 'failed',
        reason: 'no-reference-space',
      });
      expect(fake.endCalls()).toBe(1);
    });

    /**
     * `XRWebGLLayer`가 없으면 immersive 세션은 프레임을 만들지 않는다. `requestSession`과
     * `requestReferenceSpace`가 모두 성공해도 `requestAnimationFrame` 콜백이 오지 않아 pose가
     * 영원히 없고 카메라 영상도 나오지 않는다.
     *
     * **오류도 이벤트도 없이 조용히 실패하는 종류다.** 11.8의 카메라 자원 충돌과 증상이 같아
     * 세션을 열어 둔 채로는 원인을 구분할 수 없다. 실패로 알려 fallback 경로를 타게 한다.
     */
    it('렌더 레이어를 붙이지 못하면 세션을 닫고 실패한다', async () => {
      const fake = createFakeSession();
      const controller = createController({
        xr: fakeXr(async () => fake.session),
        attachRenderLayer: async () => false,
      });

      await expect(controller.start()).resolves.toMatchObject({
        status: 'failed',
        reason: 'no-render-layer',
      });
      expect(fake.endCalls()).toBe(1);
      // reference space를 구하기 전에 닫는다. 레이어가 없으면 공간을 구해도 쓸 데가 없다.
      expect(fake.hasPendingFrame()).toBe(false);
    });
  });

  /**
   * 11.7: 오류 name으로 판별하지 않는다. 실측에서 권한 거부가 NotSupportedError로 나타났다.
   * 판별은 실패까지 걸린 시간으로 한다. 실측값은 차단 10ms, 프롬프트 2.0~25.3초였다.
   */
  describe('세션 시작 실패 판별', () => {
    function controllerWithFailure(elapsedMs: number) {
      let calls = 0;

      return createController({
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
      const controller = createController({ xr });

      await Promise.all([controller.start(), controller.start(), controller.start()]);

      expect(xr.requestSession).toHaveBeenCalledTimes(1);
    });

    it('이미 열려 있으면 현재 상태를 그대로 돌려준다', async () => {
      const fake = createFakeSession();
      const xr = fakeXr(async () => fake.session);
      const controller = createController({ xr });

      const first = await controller.start();
      const second = await controller.start();

      expect(xr.requestSession).toHaveBeenCalledTimes(1);
      expect(second).toEqual(first);
    });

    /**
     * 권한 프롬프트는 실측에서 2.04~25.29초 걸렸다. 그 사이에 사용자가 화면을 벗어나면
     * 언마운트 훅이 stop()을 부르는데, 그 시점에는 아직 세션 객체가 없다. 이 경우를 처리하지
     * 않으면 뒤늦게 세션이 열리고 아무도 닫지 않는다.
     */
    it('start 도중에 stop이 호출되면 열린 세션을 즉시 닫는다', async () => {
      const fake = createFakeSession();
      let openSession: ((session: XRSession) => void) | null = null;
      const controller = createController({
        xr: fakeXr(
          () =>
            new Promise<XRSession>((resolve) => {
              openSession = resolve;
            }),
        ),
      });

      const starting = controller.start();
      const stopping = controller.stop();

      await vi.waitFor(() => {
        expect(openSession).not.toBeNull();
      });
      openSession!(fake.session);
      await starting;
      await stopping;

      expect(fake.endCalls()).toBe(1);
      expect(fake.hasPendingFrame()).toBe(false);
      expect(fake.listenerCount()).toBe(0);
      expect(controller.getState().status).toBe('ended');
    });

    it('종료한 뒤에는 다시 시작할 수 있다', async () => {
      const xr = fakeXr(async () => createFakeSession().session);
      const controller = createController({ xr });

      await controller.start();
      await controller.stop();
      await controller.start();

      expect(xr.requestSession).toHaveBeenCalledTimes(2);
    });

    /**
     * stop이 진행 중인 start를 기다리는 동안 새 start가 시작된 경우.
     * 그 세션은 이 stop이 끊으려던 대상이 아니다.
     */
    it('stop이 기다리는 동안 새로 시작된 세션은 끊지 않는다', async () => {
      const abandoned = createFakeSession();
      const fresh = createFakeSession();
      let openFirst: ((session: XRSession) => void) | null = null;
      const sessions = [
        () =>
          new Promise<XRSession>((resolve) => {
            openFirst = resolve;
          }),
        async () => fresh.session,
      ];
      let call = 0;
      const controller = createController({
        xr: fakeXr(() => sessions[call++]()),
      });

      const firstStart = controller.start();
      const stopping = controller.stop();

      await vi.waitFor(() => {
        expect(openFirst).not.toBeNull();
      });
      openFirst!(abandoned.session);
      await firstStart;

      // stop이 재개되기 전에 새 start가 들어온다.
      const secondStart = controller.start();
      await Promise.all([stopping, secondStart]);

      expect(abandoned.endCalls()).toBe(1);
      expect(fresh.endCalls()).toBe(0);
      expect(controller.getState().status).toBe('warming-up');
    });
  });

  describe('세션 식별자', () => {
    it('열려 있지 않으면 null이다', () => {
      expect(createController({ xr: undefined }).getSessionId()).toBeNull();
    });

    it('세션이 열리면 값을 부여하고 종료하면 null로 되돌린다', async () => {
      const fake = createFakeSession();
      const controller = createController({ xr: fakeXr(async () => fake.session) });

      await controller.start();
      expect(controller.getSessionId()).not.toBeNull();

      await controller.stop();
      expect(controller.getSessionId()).toBeNull();
    });

    /**
     * 화면이 "지금 열려 있는 것이 내가 연 그 세션인지"를 판별할 수 있어야 한다.
     * 값이 재사용되면 옛 화면이 새 세션을 자기 것으로 오인한다.
     */
    it('다시 시작하면 다른 값을 부여한다', async () => {
      const xr = fakeXr(async () => createFakeSession().session);
      const controller = createController({ xr });

      await controller.start();
      const first = controller.getSessionId();
      await controller.stop();
      await controller.start();

      expect(controller.getSessionId()).not.toBe(first);
    });

    it('시작에 실패하면 값을 부여하지 않는다', async () => {
      const controller = createController({
        xr: fakeXr(async () => {
          throw new Error('NotSupportedError');
        }),
      });

      await controller.start();

      expect(controller.getSessionId()).toBeNull();
    });
  });

  describe('추적 루프', () => {
    async function startedController(trackingLostAfterMs?: number) {
      const fake = createFakeSession();
      const snapshots: XrPoseSnapshot[] = [];
      const states: XrSessionState[] = [];
      const controller = createController({
        xr: fakeXr(async () => fake.session),
        ...(trackingLostAfterMs === undefined ? {} : { trackingLostAfterMs }),
      });

      const headings: number[] = [];

      controller.subscribe((state) => states.push(state));
      controller.subscribeSnapshots((snapshot) => snapshots.push(snapshot));
      controller.subscribeHeading((yawDeg) => headings.push(yawDeg));
      await controller.start();

      /**
       * 시작 과정의 전이(starting → warming-up)는 세션 시작 테스트에서 이미 확인했다.
       * 이 그룹은 프레임이 들어온 뒤의 상태 변화만 세므로 여기서 비운다.
       */
      states.length = 0;

      return { controller, fake, snapshots, states, headings };
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

    /**
     * 방향 표시는 위치 확정과 **별도 주기**다. (S15P11A206-141)
     *
     * 11.4가 회전을 위치 확정 트리거에서 뺀 대신 "표시 갱신 기준을 따로 정한다"로 남긴 자리다.
     * 위치 주기(정지 시 5초 heartbeat)로 방향을 갱신하면 제자리에서 몸만 돌렸을 때 최대 5초
     * 늦는다. 이 채널은 각도만 흘리므로 위치 확정 주기에 영향이 없다.
     */
    describe('방향 채널', () => {
      it('첫 pose의 방향을 기준점으로 내보낸다', async () => {
        const { fake, headings } = await startedController();

        fake.emitFrame(1200, poseYaw(0));

        expect(headings).toHaveLength(1);
      });

      it('데드밴드 미만 회전은 내보내지 않는다', async () => {
        const { fake, headings } = await startedController();

        fake.emitFrame(1200, poseYaw(0));
        // 기본 데드밴드는 5도다. 간격은 충분히 벌린다.
        fake.emitFrame(1600, poseYaw(3));

        expect(headings).toHaveLength(1);
      });

      it('데드밴드 이상 회전하면 내보낸다', async () => {
        const { fake, headings } = await startedController();

        fake.emitFrame(1200, poseYaw(0));
        fake.emitFrame(1600, poseYaw(20));

        expect(headings).toHaveLength(2);
      });

      /** 매 프레임 리렌더는 11.4가 제거한 것이므로 큰 회전에도 상한을 둔다. */
      it('최소 간격 안에서는 큰 회전도 내보내지 않는다', async () => {
        const { fake, headings } = await startedController();

        fake.emitFrame(1200, poseYaw(0));
        // 기본 최소 간격은 120ms다. 30fps 프레임 하나(16ms) 뒤에 90도를 돌아도 참지 않는다.
        fake.emitFrame(1216, poseYaw(90));

        expect(headings).toHaveLength(1);
      });

      /** 방향 채널이 위치 확정을 늘리지 않아야 한다. 그게 이 분리의 목적이다. */
      it('제자리 회전은 위치 스냅샷을 만들지 않는다', async () => {
        const { fake, snapshots, headings } = await startedController();

        fake.emitFrame(1200, poseYaw(0));

        const positionCount = snapshots.length;

        for (let index = 1; index <= 10; index += 1) {
          fake.emitFrame(1200 + index * 200, poseYaw(index * 20));
        }

        expect(headings.length).toBeGreaterThan(positionCount);
        expect(snapshots).toHaveLength(positionCount);
      });

      it('주입한 기준값을 쓴다', async () => {
        const fake = createFakeSession();
        const headings: number[] = [];
        const controller = createController({
          xr: fakeXr(async () => fake.session),
          headingRule: { deadbandDeg: 30, minIntervalMs: 0 },
        });

        controller.subscribeHeading((yawDeg) => headings.push(yawDeg));
        await controller.start();

        fake.emitFrame(1200, poseYaw(0));
        fake.emitFrame(1216, poseYaw(20));
        fake.emitFrame(1232, poseYaw(40));

        expect(headings).toHaveLength(2);
      });
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

    /**
     * 상실 구간 동안 상대 좌표의 연속성이 끊긴다. 초기화하지 않으면 복구 첫 프레임이 상실
     * 이전의 확정과 비교되어 `move`가 붙는데, 엘리베이터로 실려 간 경우 그 라벨의 의미가
     * 틀린다. `first`로 나가야 "이전 확정과의 차이를 이동으로 해석하지 말라"가 전달된다.
     */
    it('추적 상실에서 복구되면 첫 스냅샷이 first로 나간다', async () => {
      const { controller, fake, snapshots } = await startedController(1500);

      fake.emitFrame(1000, pose(0, 0));
      expect(snapshots.map((snapshot) => snapshot.trigger)).toEqual(['first']);

      fake.emitFrame(3000, null);
      expect(controller.getState().status).toBe('lost');

      // 상실 구간 동안 8m 떨어진 곳에서 복구됐다. move로 해석해서는 안 된다.
      fake.emitFrame(10000, pose(0, -8));

      expect(controller.getState().status).toBe('tracking');
      expect(snapshots.map((snapshot) => snapshot.trigger)).toEqual(['first', 'first']);
      expect(snapshots[1].position.z).toBe(-8);
    });

    it('복구 이후의 확정은 복구 지점을 기준으로 삼는다', async () => {
      const { fake, snapshots } = await startedController(1500);

      fake.emitFrame(1000, pose(0, 0));
      fake.emitFrame(3000, null);
      fake.emitFrame(10000, pose(0, -8));

      // 복구 지점(-8)에서 0.1m만 움직였으므로 확정되지 않는다.
      expect(fake.hasPendingFrame()).toBe(true);
      fake.emitFrame(12000, pose(0, -8.1));
      expect(snapshots).toHaveLength(2);

      // 복구 지점 대비 갱신 거리를 넘으면 move로 확정된다.
      fake.emitFrame(13000, pose(0, -8.4));
      expect(snapshots.map((snapshot) => snapshot.trigger)).toEqual(['first', 'first', 'move']);
    });

    it('추적 상실 임계값의 기본값은 임시 확정값이다', () => {
      expect(PROVISIONAL_TRACKING_LOST_MS).toBe(1500);
    });

    /**
     * 앵커 생성용 원시 pose 조회(S15P11A206-296).
     *
     * 앵커는 지도 좌표와 XR 좌표를 같은 순간의 값으로 묶어야 한다. 스냅샷은 확정 주기로
     * 걸러지므로 그 순간을 잡을 수 없다(11.4).
     */
    describe('getLatestReading', () => {
      it('추적 전에는 null이다', async () => {
        const { controller, fake } = await startedController();

        fake.emitFrame(0, null);

        expect(controller.getLatestReading()).toBeNull();
      });

      /**
       * 이 테스트가 296의 존재 이유다. 확정 주기를 통과하지 않은 프레임에서도 최신 pose를
       * 읽을 수 있어야 한다. 스냅샷만 쓰면 여기서 (0, 0)이 잡혀 앵커가 1.2m 어긋난다.
       */
      it('확정 주기를 통과하지 않은 프레임의 pose도 돌려준다', async () => {
        const { controller, fake, snapshots } = await startedController();

        fake.emitFrame(1200, pose(0, 0));
        fake.emitFrame(1250, pose(0.5, -1.1));

        // 1.2m를 갔지만 0.05초라 확정 주기의 최소 간격을 통과하지 못한다.
        expect(snapshots).toHaveLength(1);
        expect(controller.getLatestReading()?.position).toEqual({ x: 0.5, y: 0, z: -1.1 });
      });

      it('세션이 끝나면 null로 돌아간다', async () => {
        const { controller, fake } = await startedController();

        fake.emitFrame(1200, pose(1, -2));
        expect(controller.getLatestReading()).not.toBeNull();

        await controller.stop();

        expect(controller.getLatestReading()).toBeNull();
      });

      /**
       * 상실 구간에는 직전 값이 남는다. 그 값으로 앵커를 만들지 않는 판단은 쓰는 쪽이
       * status를 보고 한다 — 실측에서 blackout 사이 pose는 값 자체가 틀렸다(11.2).
       */
      it('추적 상실 중에는 직전 값이 남고 상태로 구분한다', async () => {
        const { controller, fake } = await startedController();

        fake.emitFrame(1000, pose(3, -4));
        fake.emitFrame(3000, null);

        expect(controller.getState().status).toBe('lost');
        expect(controller.getLatestReading()?.position).toEqual({ x: 3, y: 0, z: -4 });
      });
    });
  });

  describe('자원 정리', () => {
    it('stop이 세션을 끝내고 프레임 루프와 리스너를 정리한다', async () => {
      const fake = createFakeSession();
      const controller = createController({ xr: fakeXr(async () => fake.session) });

      await controller.start();
      fake.emitFrame(1200, pose(0, 0));
      await controller.stop();

      expect(controller.getState().status).toBe('ended');
      expect(fake.endCalls()).toBe(1);
      expect(fake.listenerCount()).toBe(0);
      expect(fake.hasPendingFrame()).toBe(false);
    });

    it('열려 있지 않으면 stop은 아무 일도 하지 않는다', async () => {
      const controller = createController({
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
      const controller = createController({ xr: fakeXr(async () => fake.session) });

      await controller.start();
      fake.fireEnd();

      expect(controller.getState().status).toBe('ended');
      expect(fake.cancelCalls()).toBe(1);
      expect(fake.listenerCount()).toBe(0);
    });

    it('화면을 벗어나면(pagehide) 세션을 끝낸다', async () => {
      const fake = createFakeSession();
      const controller = createController({ xr: fakeXr(async () => fake.session) });

      await controller.start();
      window.dispatchEvent(new Event('pagehide'));
      await vi.waitFor(() => {
        expect(controller.getState().status).toBe('ended');
      });

      expect(fake.endCalls()).toBe(1);
    });

    it('정리 후에는 pagehide가 세션을 다시 끊지 않는다', async () => {
      const fake = createFakeSession();
      const controller = createController({ xr: fakeXr(async () => fake.session) });

      await controller.start();
      await controller.stop();
      window.dispatchEvent(new Event('pagehide'));

      expect(fake.endCalls()).toBe(1);
    });

    it('구독은 해제할 수 있다', async () => {
      const fake = createFakeSession();
      const controller = createController({ xr: fakeXr(async () => fake.session) });
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
