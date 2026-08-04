import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { MOCK_FLOOR_ID, useStationFloorMaps } from '@/entities/floor-map';
import type { IndoorPoint } from '@/entities/navigation';
import { useXrMapPosition, type PlanarVector } from '@/features/xr-tracking';
import type {
  XrPoseReading,
  XrPoseSnapshot,
  XrSessionController,
  XrSessionState,
} from '@/shared/lib/webxr';
import { IndoorMapView } from './IndoorMapView';

/**
 * 시설 조회는 이 테스트의 관심사가 아니다. QueryClient 없이 렌더하므로 훅만 비워 둔다.
 * 시설 마커 렌더링은 IndoorMapOverlay 테스트가 검사한다.
 */
vi.mock('@/entities/facility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/facility')>()),
  useStationFacilities: vi.fn(() => ({ data: undefined })),
}));

/**
 * WebXR 위치 훅과 282 지도 오버레이의 연동 검증. (S15P11A206-296)
 *
 * 두 조각이 실제로 맞물리는지만 본다 — 훅이 내는 좌표가 `IndoorMapView`의 `currentLocation`
 * 계약에 그대로 들어맞고, 마커가 pose에 따라 움직이는지다. 변환식 정확도는
 * `features/xr-tracking/lib/mapAlignment.test.ts`가 검사한다.
 *
 * **`IndoorMapOverlay`·`IndoorMapView`는 수정하지 않았다.** 두 컴포넌트는 입력 데이터만 받는
 * 표현 컴포넌트로 남아 있고 WebXR을 알지 못한다. 이 테스트가 그 사실을 고정한다.
 *
 * **Fixture 기반이다.** 방향 값은 테스트가 직접 넣으며 실제 위치 인식 응답과 연결되지 않았다.
 */

// 목업 지도를 쓰므로 조회는 하지 않지만 훅 자체는 호출되어 QueryClient를 요구한다.
// 좌표 변환·프레임은 실제 구현을 그대로 쓴다. (IndoorMapView.test.tsx와 같은 방식)
vi.mock('@/entities/floor-map', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/floor-map')>()),
  useStationFloorMaps: vi.fn(),
}));

vi.mocked(useStationFloorMaps).mockReturnValue({
  isPending: false,
  isError: false,
  data: [],
} as unknown as ReturnType<typeof useStationFloorMaps>);

function createFakeController() {
  let state: XrSessionState = { status: 'tracking', referenceSpaceType: 'local' };
  let latestReading: XrPoseReading | null = {
    position: { x: 0, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    yawDeg: 0,
    timestamp: 0,
  };
  const stateListeners = new Set<() => void>();
  const snapshotListeners = new Set<(snapshot: XrPoseSnapshot) => void>();

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
    subscribeHeading() {
      // 이 파일은 좌표 배선만 본다. 방향은 useXrMapPosition.test.ts가 검사한다.
      return () => undefined;
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
    setState(next: XrSessionState) {
      state = next;
      stateListeners.forEach((listener) => {
        listener();
      });
    },
    setReading(reading: XrPoseReading | null) {
      latestReading = reading;
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

/**
 * 훅의 출력을 그대로 `IndoorMapView`에 넘기는 화면.
 *
 * 실제 경로 안내 화면 구조는 S15P11A206-141이 만든다. 여기서는 배선만 확인한다.
 */
function TrackedMap({
  controller,
  anchor,
  forwardMap,
}: {
  controller: XrSessionController;
  anchor: IndoorPoint;
  forwardMap: PlanarVector | null;
}) {
  const { currentLocation, setAnchor } = useXrMapPosition({
    controller,
    currentIndoorLocation: anchor,
    // 평활을 끄고 변환 결과를 그대로 그린다. 평활은 displaySmoothing.test.ts가 검사한다.
    smoothing: { deadbandM: 0, followRatio: 1 },
  });

  useEffect(() => {
    setAnchor(anchor, forwardMap);
  }, [setAnchor, anchor, forwardMap]);

  return (
    <IndoorMapView
      stationId={1}
      floorId={anchor.floorId}
      useMockData
      currentLocation={currentLocation}
    />
  );
}

/** B2 프레임의 미터 원점. 여기서는 변환 결과가 originPx와 같아 검산이 쉽다. */
const ORIGIN_ON_B2: IndoorPoint = { floorId: MOCK_FLOOR_ID.B2, mapX: 0, mapY: 0 };

/** 전방(XR -z)이 지도 -Y와 같아 회전이 항등이 되는 방향. */
const FORWARD_IDENTITY: PlanarVector = { x: 0, y: -1 };

function currentMarker(): SVGCircleElement {
  const group = screen.getByRole('img', { name: '현재 위치' });
  const dot = group.querySelector('circle:last-of-type');

  if (!dot) throw new Error('현재 위치 마커를 찾지 못했다');

  return dot as SVGCircleElement;
}

describe('IndoorMapView + useXrMapPosition', () => {
  it('앵커 지점에서는 확정 좌표 위치에 마커를 그린다', () => {
    const fake = createFakeController();

    render(
      <TrackedMap
        controller={fake.controller}
        anchor={ORIGIN_ON_B2}
        forwardMap={FORWARD_IDENTITY}
      />,
    );

    // 미터 (0, 0)은 B2 프레임의 originPx [622, 512]로 간다.
    expect(Number(currentMarker().getAttribute('cx'))).toBeCloseTo(622, 6);
    expect(Number(currentMarker().getAttribute('cy'))).toBeCloseTo(512, 6);
  });

  /** 296의 핵심 동작 — pose가 들어오면 마커가 움직인다. */
  it('XR pose가 들어오면 마커가 움직인다', () => {
    const fake = createFakeController();

    render(
      <TrackedMap
        controller={fake.controller}
        anchor={ORIGIN_ON_B2}
        forwardMap={FORWARD_IDENTITY}
      />,
    );

    const before = Number(currentMarker().getAttribute('cy'));

    act(() => {
      fake.emitSnapshot(0, -10);
    });

    expect(Number(currentMarker().getAttribute('cy'))).not.toBeCloseTo(before, 3);
  });

  /**
   * 전방 10m 이동은 지도 미터 (0, -10)이고, 이를 B2 프레임으로 픽셀 변환하면
   * `meterToPixel(0, -10)` = originPx + 회전(-21.28°)·축척(0.19) 적용값이다.
   * 훅과 오버레이가 같은 프레임을 쓰는지 확인한다.
   */
  it('마커 픽셀 좌표가 프레임 변환 결과와 일치한다', () => {
    const fake = createFakeController();

    render(
      <TrackedMap
        controller={fake.controller}
        anchor={ORIGIN_ON_B2}
        forwardMap={FORWARD_IDENTITY}
      />,
    );

    act(() => {
      fake.emitSnapshot(0, -10);
    });

    const radians = (-21.28 * Math.PI) / 180;
    const expectedPx = 622 + (Math.cos(radians) * 0 - Math.sin(radians) * -10) / 0.19;
    const expectedPy = 512 + (Math.sin(radians) * 0 + Math.cos(radians) * -10) / 0.19;

    expect(Number(currentMarker().getAttribute('cx'))).toBeCloseTo(expectedPx, 3);
    expect(Number(currentMarker().getAttribute('cy'))).toBeCloseTo(expectedPy, 3);
  });

  /** 앵커를 만들 수 없으면 사전 확정 위치가 그대로 그려진다(11.2). */
  it('방향이 없으면 확정 위치에 마커가 머문다', () => {
    const fake = createFakeController();

    render(<TrackedMap controller={fake.controller} anchor={ORIGIN_ON_B2} forwardMap={null} />);

    act(() => {
      fake.emitSnapshot(0, -10);
    });

    expect(Number(currentMarker().getAttribute('cx'))).toBeCloseTo(622, 6);
    expect(Number(currentMarker().getAttribute('cy'))).toBeCloseTo(512, 6);
  });

  /** 11.7: 추적을 잃어도 화면이 비지 않는다. 마지막 위치가 남는다. */
  it('추적을 잃어도 마지막 위치의 마커가 남는다', () => {
    const fake = createFakeController();

    render(
      <TrackedMap
        controller={fake.controller}
        anchor={ORIGIN_ON_B2}
        forwardMap={FORWARD_IDENTITY}
      />,
    );

    act(() => {
      fake.emitSnapshot(0, -10);
    });

    const cx = currentMarker().getAttribute('cx');
    const cy = currentMarker().getAttribute('cy');

    act(() => {
      fake.setState({ status: 'lost' });
    });

    expect(currentMarker().getAttribute('cx')).toBe(cx);
    expect(currentMarker().getAttribute('cy')).toBe(cy);
  });
});
