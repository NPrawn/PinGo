import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  XrPoseReading,
  XrPoseSnapshot,
  XrSessionController,
  XrSessionState,
} from '@/shared/lib/webxr';
import { MOCK_ANCHOR_FORWARD_MAP } from './anchorForward';
import { useXrMapPosition } from './useXrMapPosition';

/**
 * 앵커 상태 분기와 좌표 산출 경로 검증. (S15P11A206-296)
 *
 * **Fixture 기반이다.** 방향(`forwardMap`)은 테스트가 직접 넣는 값이고 실제 위치 인식
 * 응답과는 아직 연결되지 않았다. 실제 데이터 검증은 API 통합 후 좌표 스펙 8.5의 판정
 * 기준으로 한다.
 */

interface FakeController {
  controller: XrSessionController;
  setState(next: XrSessionState): void;
  setReading(reading: XrPoseReading | null): void;
  emitSnapshot(snapshot: XrPoseSnapshot): void;
  /** 방향 전용 채널. 컨트롤러가 데드밴드·간격을 통과시킨 값만 흘려준다. */
  emitHeading(yawDeg: number): void;
}

function createFakeController(): FakeController {
  let state: XrSessionState = { status: 'idle' };
  let latestReading: XrPoseReading | null = null;
  const stateListeners = new Set<() => void>();
  const snapshotListeners = new Set<(snapshot: XrPoseSnapshot) => void>();
  const headingListeners = new Set<(yawDeg: number) => void>();

  const controller: XrSessionController = {
    getState: () => state,
    getSessionId: () => 1,
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

    async stop() {
      state = { status: 'ended' };
    },
  };

  return {
    controller,
    setState(next) {
      state = next;
      stateListeners.forEach((listener) => {
        listener();
      });
    },
    setReading(reading) {
      latestReading = reading;
    },
    emitSnapshot(snapshot) {
      snapshotListeners.forEach((listener) => {
        listener(snapshot);
      });
    },
    emitHeading(yawDeg) {
      headingListeners.forEach((listener) => {
        listener(yawDeg);
      });
    },
  };
}

function reading(x: number, z: number, yawDeg = 0): XrPoseReading {
  return {
    position: { x, y: 0, z },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    yawDeg,
    timestamp: 0,
  };
}

function snapshot(x: number, z: number, timestamp = 1000): XrPoseSnapshot {
  return { ...reading(x, z), timestamp, trigger: 'move' };
}

const CONFIRMED = { floorId: 2, mapX: 100, mapY: 200 };

/** 전방(XR -z)이 지도 -Y와 같아 회전이 항등이 되는 방향. 좌표를 손으로 검산하기 쉽다. */
const FORWARD_IDENTITY = { x: 0, y: -1 };

/** 평활을 끄고 변환 결과를 그대로 본다. 평활 자체는 displaySmoothing.test.ts가 검사한다. */
const NO_SMOOTHING = { deadbandM: 0, followRatio: 1 };

function renderTracking(fake: FakeController, currentIndoorLocation = CONFIRMED) {
  return renderHook(() =>
    useXrMapPosition({
      controller: fake.controller,
      currentIndoorLocation,
      smoothing: NO_SMOOTHING,
    }),
  );
}

/** 추적이 잡힌 상태로 만든다. 앵커를 만들려면 tracking이어야 한다. */
function startTracking(fake: FakeController, at = reading(0, 0)): void {
  fake.setReading(at);
  act(() => {
    fake.setState({ status: 'tracking', referenceSpaceType: 'local' });
  });
}

describe('useXrMapPosition', () => {
  describe('앵커 없음', () => {
    it('확정 위치를 그대로 표시한다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      expect(result.current.currentLocation).toEqual(CONFIRMED);
      expect(result.current.source).toBe('confirmed');
      expect(result.current.anchorStatus).toBe('none');
      expect(result.current.anchorRevision).toBeNull();
    });

    /** 11.2: 앵커가 없으면 추적하지 않고 확정 위치만 표시한다. */
    it('스냅샷이 들어와도 위치를 바꾸지 않는다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake);
      act(() => {
        fake.emitSnapshot(snapshot(0, -10));
      });

      expect(result.current.currentLocation).toEqual(CONFIRMED);
      expect(result.current.source).toBe('confirmed');
    });

    it('확정 위치도 없으면 null이다', () => {
      const fake = createFakeController();
      const { result } = renderHook(() =>
        useXrMapPosition({ controller: fake.controller, currentIndoorLocation: null }),
      );

      expect(result.current.currentLocation).toBeNull();
    });

    it('앵커가 없는 동안에는 확정 위치 변경이 그대로 반영된다', () => {
      const fake = createFakeController();
      const moved = { floorId: 2, mapX: 500, mapY: 600 };
      const { result, rerender } = renderHook(
        ({ location }) =>
          useXrMapPosition({ controller: fake.controller, currentIndoorLocation: location }),
        { initialProps: { location: CONFIRMED } },
      );

      rerender({ location: moved });

      expect(result.current.currentLocation).toEqual(moved);
    });
  });

  /**
   * `currentIndoorLocation`은 안내 화면 진입 시점에 고정되는 입력이다.
   *
   * 앵커가 생긴 뒤 이 값이 바뀌어도 표시에 반영되지 않는 것은 **의도된 동작**이며,
   * 이 테스트가 그것을 고정한다. 근거는 11.2가 사전 확정과 세션 안 VPS를 분리했다는 점,
   * 그리고 화면 정의서 U-07의 진입 경로가 위치 인식 실패와 카메라 권한 거부뿐이라
   * 안내 중에는 열리지 않는다는 점이다.
   *
   * 안내 중 절대 위치가 다시 확정되는 흐름이 생기면(12장 3번 확정 후) 이 테스트를 바꾸고
   * 무효화 규칙을 함께 정한다. 그때 `trackedLocation`만 지우면 안 된다 — 앵커가 남아
   * 있으면 다음 스냅샷이 낡은 앵커로 좌표를 다시 만든다. 마지막 단언이 그 함정을 보여준다.
   */
  describe('앵커가 있을 때의 확정 위치 변경', () => {
    function renderWithLocation(fake: FakeController) {
      return renderHook(
        ({ location }) =>
          useXrMapPosition({
            controller: fake.controller,
            currentIndoorLocation: location,
            smoothing: NO_SMOOTHING,
          }),
        { initialProps: { location: CONFIRMED } },
      );
    }

    it('앵커가 있으면 확정 위치가 바뀌어도 추적 좌표를 유지한다', () => {
      const fake = createFakeController();
      const { result, rerender } = renderWithLocation(fake);

      startTracking(fake);
      act(() => {
        result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });
      act(() => {
        fake.emitSnapshot(snapshot(0, -10));
      });

      rerender({ location: { floorId: 2, mapX: 500, mapY: 600 } });

      expect(result.current.currentLocation?.mapY).toBeCloseTo(190, 6);
      expect(result.current.source).toBe('anchored');
    });

    /** 안내 중 위치 갱신은 setAnchor가 담당한다. 이 경로는 즉시 반영된다. */
    it('setAnchor로 넘기면 즉시 반영된다', () => {
      const fake = createFakeController();
      const { result } = renderWithLocation(fake);

      startTracking(fake);
      act(() => {
        result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });
      act(() => {
        fake.emitSnapshot(snapshot(0, -10));
      });

      fake.setReading(reading(0, -10));
      act(() => {
        result.current.setAnchor({ floorId: 2, mapX: 500, mapY: 600 }, FORWARD_IDENTITY);
      });

      expect(result.current.currentLocation).toEqual({ floorId: 2, mapX: 500, mapY: 600 });
    });

    /**
     * 앵커를 버리면 확정 위치 표시로 돌아가고, 그 뒤로는 변경이 다시 반영된다.
     * 무효화 규칙이 필요해질 때 쓸 수 있는 경로가 이미 있다는 뜻이다.
     */
    it('clearAnchor 후에는 확정 위치 변경이 다시 반영된다', () => {
      const fake = createFakeController();
      const moved = { floorId: 2, mapX: 500, mapY: 600 };
      const { result, rerender } = renderWithLocation(fake);

      startTracking(fake);
      act(() => {
        result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });
      act(() => {
        fake.emitSnapshot(snapshot(0, -10));
      });
      act(() => {
        result.current.clearAnchor();
      });

      rerender({ location: moved });

      expect(result.current.currentLocation).toEqual(moved);
      expect(result.current.source).toBe('confirmed');

      // clearAnchor가 앵커까지 지우므로 이후 스냅샷이 옛 좌표를 되살리지 않는다.
      act(() => {
        fake.emitSnapshot(snapshot(0, -20));
      });

      expect(result.current.currentLocation).toEqual(moved);
    });
  });

  describe('앵커 생성', () => {
    it('추적 중이 아니면 앵커를 만들지 않는다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      fake.setReading(reading(0, 0));
      act(() => {
        fake.setState({ status: 'warming-up' });
      });

      let created = true;
      act(() => {
        created = result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });

      expect(created).toBe(false);
      expect(result.current.anchorStatus).toBe('none');
    });

    /**
     * 11.2: 실측에서 blackout 사이에 반환된 pose는 값 자체가 틀렸다. 상실 중에는 직전
     * reading이 남아 있어도 앵커를 만들지 않는다.
     */
    it('추적 상실 중에는 직전 pose가 남아 있어도 앵커를 만들지 않는다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake, reading(3, -4));
      act(() => {
        fake.setState({ status: 'lost' });
      });

      let created = true;
      act(() => {
        created = result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });

      expect(created).toBe(false);
    });

    /** 8.5: 방향을 모르면 회전을 정할 수 없다. 항등으로 가정하지 않고 앵커를 만들지 않는다. */
    it('방향이 null이면 앵커를 만들지 않는다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake);

      let created = true;
      act(() => {
        created = result.current.setAnchor(CONFIRMED, null);
      });

      expect(created).toBe(false);
      expect(result.current.anchorStatus).toBe('none');
      expect(result.current.currentLocation).toEqual(CONFIRMED);
    });

    it('앵커를 만들면 established가 되고 확정 좌표를 표시한다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake);

      let created = false;
      act(() => {
        created = result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });

      expect(created).toBe(true);
      expect(result.current.anchorStatus).toBe('established');
      expect(result.current.anchorRevision).toBe(0);
      expect(result.current.currentLocation).toEqual(CONFIRMED);
      expect(result.current.source).toBe('anchored');
    });
  });

  describe('좌표 갱신', () => {
    it('앵커 이후 스냅샷을 지도 좌표로 옮긴다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake);
      act(() => {
        result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });
      act(() => {
        fake.emitSnapshot(snapshot(0, -10));
      });

      // 회전이 항등인 앵커이므로 XR -z 10m가 지도 y 10m 감소로 나온다.
      expect(result.current.currentLocation?.mapX).toBeCloseTo(100, 6);
      expect(result.current.currentLocation?.mapY).toBeCloseTo(190, 6);
      expect(result.current.source).toBe('anchored');
    });

    /**
     * 앵커 시점 pose가 원점이 아닌 경우. 상대 이동량만 반영돼야 한다.
     * 이 단언이 앵커 pose를 빼지 않는 구현을 잡는다.
     */
    it('앵커 시점 pose를 기준으로 상대 이동만 반영한다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake, reading(50, -70));
      act(() => {
        result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });
      act(() => {
        fake.emitSnapshot(snapshot(50, -80));
      });

      expect(result.current.currentLocation?.mapX).toBeCloseTo(100, 6);
      expect(result.current.currentLocation?.mapY).toBeCloseTo(190, 6);
    });

    /**
     * 목업 방향은 항등이 아니다. 회전을 적용하지 않는 배선 오류가 있으면 여기서 드러난다.
     * (0.6, 0.8) 방향으로 10m면 지도에서 (+6, +8)이다.
     */
    it('목업 방향에서는 회전이 적용된 좌표가 나온다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake);
      act(() => {
        result.current.setAnchor(CONFIRMED, MOCK_ANCHOR_FORWARD_MAP);
      });
      act(() => {
        fake.emitSnapshot(snapshot(0, -10));
      });

      expect(result.current.currentLocation?.mapX).toBeCloseTo(106, 6);
      expect(result.current.currentLocation?.mapY).toBeCloseTo(208, 6);
    });

    it('floorId는 앵커의 층을 유지한다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake);
      act(() => {
        result.current.setAnchor({ floorId: 3, mapX: 0, mapY: 0 }, FORWARD_IDENTITY);
      });
      act(() => {
        fake.emitSnapshot(snapshot(1, -1));
      });

      expect(result.current.currentLocation?.floorId).toBe(3);
    });
  });

  describe('앵커 갱신', () => {
    /** 11.2: 재인식이 성공하면 앵커를 갱신해 누적 오차를 초기화한다. */
    it('갱신하면 refreshed가 되고 revision이 증가한다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake);
      act(() => {
        result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });

      fake.setReading(reading(0, -30));
      act(() => {
        result.current.setAnchor({ floorId: 2, mapX: 300, mapY: 400 }, FORWARD_IDENTITY);
      });

      expect(result.current.anchorStatus).toBe('refreshed');
      expect(result.current.anchorRevision).toBe(1);
    });

    /**
     * 갱신의 목적이 누적 오차 초기화다. 새 앵커 좌표가 즉시 표시돼야 하고, 이후 이동도
     * 새 기준에서 계산돼야 한다.
     */
    it('갱신 후에는 새 앵커 기준으로 좌표를 만든다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake);
      act(() => {
        result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });
      act(() => {
        fake.emitSnapshot(snapshot(0, -30));
      });

      // 드리프트가 쌓인 상태에서 재인식이 실제 위치를 (300, 400)으로 확정했다.
      fake.setReading(reading(0, -30));
      act(() => {
        result.current.setAnchor({ floorId: 2, mapX: 300, mapY: 400 }, FORWARD_IDENTITY);
      });

      expect(result.current.currentLocation).toEqual({ floorId: 2, mapX: 300, mapY: 400 });

      act(() => {
        fake.emitSnapshot(snapshot(0, -35));
      });

      expect(result.current.currentLocation?.mapY).toBeCloseTo(395, 6);
    });

    it('clearAnchor는 확정 위치 표시로 되돌린다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake);
      act(() => {
        result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });
      act(() => {
        fake.emitSnapshot(snapshot(0, -10));
      });
      act(() => {
        result.current.clearAnchor();
      });

      expect(result.current.anchorStatus).toBe('none');
      expect(result.current.source).toBe('confirmed');
      expect(result.current.currentLocation).toEqual(CONFIRMED);
    });
  });

  describe('추적 종료', () => {
    /** 11.7: 추적 상실 시 위치 갱신을 멈춘다. 화면이 비지 않도록 마지막 값은 유지한다. */
    it('추적을 잃으면 마지막 유효 위치를 last-known으로 유지한다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake);
      act(() => {
        result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });
      act(() => {
        fake.emitSnapshot(snapshot(0, -10));
      });
      act(() => {
        fake.setState({ status: 'lost' });
      });

      expect(result.current.currentLocation?.mapY).toBeCloseTo(190, 6);
      expect(result.current.source).toBe('last-known');
      expect(result.current.isStale).toBe(true);
    });

    it('세션이 끝나도 마지막 유효 위치를 유지한다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake);
      act(() => {
        result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });
      act(() => {
        fake.emitSnapshot(snapshot(0, -10));
      });
      act(() => {
        fake.setState({ status: 'ended' });
      });

      expect(result.current.currentLocation?.mapY).toBeCloseTo(190, 6);
      expect(result.current.isStale).toBe(true);
    });

    /** 11.7: 복구되면 자동 재개한다. 상태가 돌아오면 다시 anchored여야 한다. */
    it('추적이 복구되면 다시 anchored가 된다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake);
      act(() => {
        result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });
      act(() => {
        fake.setState({ status: 'lost' });
      });
      act(() => {
        fake.setState({ status: 'tracking', referenceSpaceType: 'local' });
      });

      expect(result.current.source).toBe('anchored');
      expect(result.current.isStale).toBe(false);
    });

    /** 추적을 아예 쓸 수 없으면 확정 위치가 그대로 남아야 한다. */
    it('세션이 실패하면 확정 위치를 계속 표시한다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      act(() => {
        fake.setState({ status: 'failed', reason: 'unsupported' });
      });

      expect(result.current.currentLocation).toEqual(CONFIRMED);
      expect(result.current.source).toBe('confirmed');
      expect(result.current.isUnavailable).toBe(true);
    });
  });

  describe('표시 평활', () => {
    /** 11.4: 확정 주기는 295가 끝냈다. 여기서 하는 것은 표시 흔들림 억제뿐이다. */
    it('정지 상태 지터로는 마커가 움직이지 않는다', () => {
      const fake = createFakeController();
      const { result } = renderHook(() =>
        useXrMapPosition({ controller: fake.controller, currentIndoorLocation: CONFIRMED }),
      );

      startTracking(fake);
      act(() => {
        result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });
      act(() => {
        // 정지 상태 지터 수준(실측 0.01~0.03m)의 heartbeat 스냅샷.
        fake.emitSnapshot(snapshot(0.02, -0.01));
      });

      expect(result.current.currentLocation).toEqual(CONFIRMED);
    });

    it('의미 있는 이동은 반영한다', () => {
      const fake = createFakeController();
      const { result } = renderHook(() =>
        useXrMapPosition({ controller: fake.controller, currentIndoorLocation: CONFIRMED }),
      );

      startTracking(fake);
      act(() => {
        result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });
      act(() => {
        fake.emitSnapshot(snapshot(0, -2));
      });

      expect(result.current.currentLocation?.mapY).toBeLessThan(200);
    });
  });

  /**
   * 방향은 위치와 별도 채널로 온다. (S15P11A206-141)
   *
   * 위치 스냅샷에 묶으면 제자리에서 몸만 돌렸을 때 최대 5초 늦는다 — 11.4가 회전을 위치 확정
   * 트리거에서 뺐기 때문이다. 데드밴드·최소 간격은 컨트롤러가 적용하므로 여기서는 통과한 값이
   * 어떻게 지도 각도로 옮겨지는지만 본다.
   */
  describe('방향', () => {
    it('앵커가 없으면 방향이 없다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake);
      act(() => {
        fake.emitHeading(90);
      });

      expect(result.current.headingDeg).toBeNull();
    });

    it('앵커 시점에는 앵커 방향의 각도를 낸다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake);
      act(() => {
        result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });

      // FORWARD_IDENTITY는 지도 (0, -1)이므로 -90도다.
      expect(result.current.headingDeg).toBeCloseTo(-90, 6);
    });

    /** 위치 스냅샷 없이도 방향만 갱신돼야 한다. 그것이 이 채널을 만든 이유다. */
    it('위치 스냅샷 없이 방향만 갱신된다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake);
      act(() => {
        result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });

      const before = result.current.currentLocation;

      act(() => {
        fake.emitHeading(90);
      });

      expect(result.current.headingDeg).not.toBeCloseTo(-90, 3);
      // 위치는 그대로다. 방향 채널이 위치를 건드리지 않는다.
      expect(result.current.currentLocation).toEqual(before);
    });

    it('앵커를 버리면 방향도 사라진다', () => {
      const fake = createFakeController();
      const { result } = renderTracking(fake);

      startTracking(fake);
      act(() => {
        result.current.setAnchor(CONFIRMED, FORWARD_IDENTITY);
      });
      act(() => {
        result.current.clearAnchor();
      });

      expect(result.current.headingDeg).toBeNull();
    });
  });

  it('추적 상태 API를 그대로 이어서 노출한다', () => {
    const fake = createFakeController();
    const { result } = renderTracking(fake);

    act(() => {
      fake.setState({ status: 'tracking', referenceSpaceType: 'local' });
    });

    expect(result.current.isTracking).toBe(true);
    expect(typeof result.current.start).toBe('function');
    expect(typeof result.current.stop).toBe('function');
  });
});
