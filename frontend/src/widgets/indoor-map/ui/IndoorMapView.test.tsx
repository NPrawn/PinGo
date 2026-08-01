import { render, screen } from '@testing-library/react';
import { useStationFloorMaps, type FloorMap } from '@/entities/floor-map';
import { IndoorMapView } from './IndoorMapView';

/**
 * 시설 조회는 이 테스트의 관심사가 아니다. QueryClient 없이 렌더하므로 훅만 비워 둔다.
 * 시설 마커 렌더링은 IndoorMapOverlay 테스트가 검사한다.
 */
vi.mock('@/entities/facility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/facility')>()),
  useStationFacilities: vi.fn(() => ({ data: undefined })),
}));

// 렌더링 로직에만 집중하기 위해 데이터 조회 훅만 목으로 대체하고,
// 좌표 변환·프레임·목업 지도는 실제 구현을 그대로 쓴다.
vi.mock('@/entities/floor-map', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/floor-map')>()),
  useStationFloorMaps: vi.fn(),
}));

const mockedHook = vi.mocked(useStationFloorMaps);

type HookResult = ReturnType<typeof useStationFloorMaps>;

function hookState(partial: Partial<HookResult>): HookResult {
  return partial as unknown as HookResult;
}

const sampleMap: FloorMap = {
  mapId: 1,
  floorId: 1,
  floorCode: 'B1',
  mapType: 'image',
  mapUrl: '/uploads/maps/3f2a1b.png',
  width: 1200,
  height: 800,
  originPxX: 600,
  originPxY: 400,
  frameAngleDeg: 0,
  scaleMPerPx: 0.05,
  version: 'v1',
};

describe('IndoorMapView', () => {
  it('로딩 중에는 로딩 메시지를 보여준다', () => {
    mockedHook.mockReturnValue(hookState({ isPending: true, isError: false }));
    render(<IndoorMapView stationId={1} />);
    expect(screen.getByText('지도를 불러오는 중입니다')).toBeInTheDocument();
  });

  it('조회 실패 시 에러 메시지를 alert 역할로 보여준다', () => {
    mockedHook.mockReturnValue(hookState({ isPending: false, isError: true }));
    render(<IndoorMapView stationId={1} />);
    expect(screen.getByRole('alert')).toHaveTextContent('지도를 불러오지 못했습니다');
  });

  it('등록된 지도가 없으면 빈 상태 메시지를 보여준다', () => {
    mockedHook.mockReturnValue(hookState({ isPending: false, isError: false, data: [] }));
    render(<IndoorMapView stationId={1} />);
    expect(screen.getByText('등록된 지도가 없습니다')).toBeInTheDocument();
  });

  it('지정한 층의 지도가 없으면 안내 메시지를 보여준다', () => {
    mockedHook.mockReturnValue(hookState({ isPending: false, isError: false, data: [sampleMap] }));
    render(<IndoorMapView stationId={1} floorId={999} />);
    expect(screen.getByText('해당 층의 지도가 없습니다')).toBeInTheDocument();
  });

  it('지도 이미지를 절대 URL과 층 정보로 렌더링한다', () => {
    mockedHook.mockReturnValue(hookState({ isPending: false, isError: false, data: [sampleMap] }));
    render(<IndoorMapView stationId={1} />);

    // 도면은 기준 캔버스 SVG 안에 놓인다. 층마다 캔버스가 달라지면 층 전환 때 지도가 튄다.
    const plan = screen.getByRole('img', { name: 'B1 실내 지도' });
    // 기준 층(1624×969)이 아니라 세 층을 모두 담는 캔버스다. 좁게 잡으면 B1·B3가 잘린다.
    expect(plan).toHaveAttribute('viewBox', '0 0 1699 992');

    const image = plan.querySelector('image');
    expect(image).toHaveAttribute('href', 'http://localhost:8080/uploads/maps/3f2a1b.png');
    expect(image).toHaveAttribute('opacity', '1');
    // 원본 width/height를 고유 비율로 유지한다. 기준 캔버스로 옮기는 일은 transform이 맡는다.
    expect(image).toHaveAttribute('width', '1200');
    expect(image).toHaveAttribute('height', '800');
    expect(image?.getAttribute('transform')).toContain('translate(622 512)');
  });
});

/**
 * 역삼역 B2의 실제 프레임 값을 가진 층. (층별 지도 조회 응답 그대로)
 *
 * 프레임은 응답에 담겨 오므로 층 코드로 찾지 않는다. 값이 온전하지 않은 층은 좌표를 이미지
 * 어디에 놓아야 할지 알 수 없어 오버레이가 생략된다.
 */
const framedMap: FloorMap = {
  ...sampleMap,
  floorId: 1,
  floorCode: 'B2',
  originPxX: 622,
  originPxY: 512,
  frameAngleDeg: -21.28,
  scaleMPerPx: 0.19,
};

describe('IndoorMapView 오버레이 연결', () => {
  beforeEach(() => {
    mockedHook.mockReturnValue(hookState({ isPending: false, isError: false, data: [framedMap] }));
  });

  it('현재 위치·목적지·경로를 오버레이로 넘긴다', () => {
    render(
      <IndoorMapView
        stationId={1}
        currentLocation={{ floorId: 1, mapX: 0, mapY: 0 }}
        destination={{ floorId: 1, mapX: -58.4, mapY: 42.5 }}
        pathNodes={[
          { nodeId: 1, floorId: 1, mapX: 0, mapY: 0 },
          { nodeId: 2, floorId: 1, mapX: -12.4, mapY: 15.6 },
        ]}
      />,
    );

    expect(screen.getByRole('img', { name: '현재 위치' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '목적지' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '이동 경로' })).toBeInTheDocument();
  });

  it('오버레이 데이터가 없으면 지도만 그린다', () => {
    render(<IndoorMapView stationId={1} />);

    expect(screen.getByRole('img', { name: 'B2 실내 지도' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '현재 위치' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '이동 경로' })).not.toBeInTheDocument();
  });

  /**
   * 프레임 값은 백엔드 BigDecimal에서 내려오므로 JSON 파싱 결과가 null·NaN일 수 있다.
   * 0으로 채워 그리면 마커가 이미지 좌상단에 붙어 조용히 틀린 위치를 보여준다.
   */
  it('좌표 프레임 값이 온전하지 않으면 오버레이를 생략한다', () => {
    const brokenFrame: FloorMap = { ...framedMap, originPxX: Number.NaN };

    mockedHook.mockReturnValue(
      hookState({ isPending: false, isError: false, data: [brokenFrame] }),
    );
    render(<IndoorMapView stationId={1} currentLocation={{ floorId: 1, mapX: 0, mapY: 0 }} />);

    expect(screen.queryByRole('img', { name: '현재 위치' })).not.toBeInTheDocument();
  });

  /** 백엔드에 도면이 없으면 FE가 들고 있는 평면도로 떨어진다(localPlans). */
  it('mapUrl이 없으면 자체 평면도로 떨어진다', () => {
    const withoutImage: FloorMap = { ...framedMap, mapUrl: null };

    mockedHook.mockReturnValue(
      hookState({ isPending: false, isError: false, data: [withoutImage] }),
    );
    render(<IndoorMapView stationId={1} currentLocation={{ floorId: 1, mapX: 0, mapY: 0 }} />);

    const image = screen.getByRole('img', { name: 'B2 실내 지도' }).querySelector('image');
    expect(image?.getAttribute('href')).toContain('/maps/yeoksam_B2.png');
  });

  /**
   * 층 전환이 스냅으로 보이지 않게 모든 층을 올려 두고 표시 층만 드러낸다.
   * 실제로 바뀌는 것은 층 구조라 없앨 수 없지만, 짧게 겹쳐 넘기면 디졸브로 읽힌다.
   */
  it('모든 층의 도면을 올려 두고 표시 층만 드러낸다', () => {
    const b2: FloorMap = { ...framedMap, mapUrl: null };
    const b3: FloorMap = { ...framedMap, mapId: 9, floorId: 2, floorCode: 'B3', mapUrl: null };

    mockedHook.mockReturnValue(hookState({ isPending: false, isError: false, data: [b2, b3] }));
    render(<IndoorMapView stationId={1} floorId={2} />);

    const images = [...screen.getByRole('img', { name: 'B3 실내 지도' }).querySelectorAll('image')];
    expect(images).toHaveLength(2);

    const shown = images.filter((image) => image.getAttribute('opacity') === '1');
    expect(shown).toHaveLength(1);
    expect(shown[0].getAttribute('href')).toContain('/maps/yeoksam_B3.png');
  });

  /**
   * 자체 평면도가 없는 층. 빈 src로 img를 만들면 깨진 이미지가 보이므로 만들지 않는다.
   * 좌표는 프레임만으로 정해지므로 오버레이는 그대로 남는다.
   */
  it('도면 이미지가 어느 쪽에도 없으면 오버레이만 그린다', () => {
    const noPlan: FloorMap = { ...framedMap, mapUrl: null, floorCode: '1F' };

    mockedHook.mockReturnValue(hookState({ isPending: false, isError: false, data: [noPlan] }));
    render(<IndoorMapView stationId={1} currentLocation={{ floorId: 1, mapX: 0, mapY: 0 }} />);

    expect(screen.queryByRole('img', { name: '1F 실내 지도' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: '현재 위치' })).toBeInTheDocument();
  });

  /**
   * 미터 프레임 각도를 이미지 각도로 옮긴다. `meterToPixel`이 미터 벡터를 `angleDeg`만큼
   * 회전시키므로 방향에도 같은 회전을 적용해야 점과 부채꼴이 같은 좌표계를 가리킨다.
   */
  it('방향각에 프레임 회전을 더해 오버레이에 넘긴다', () => {
    render(
      <IndoorMapView
        stationId={1}
        currentLocation={{ floorId: 1, mapX: 0, mapY: 0 }}
        currentHeadingDeg={30}
      />,
    );

    const beam = screen.getByRole('img', { name: '현재 위치' }).querySelector('path');
    const rotated = /rotate\((-?[\d.]+) (-?[\d.]+) (-?[\d.]+)\)/.exec(
      beam?.getAttribute('transform') ?? '',
    );

    // B2 프레임은 -21.28도다. 30 + (-21.28) = 8.72
    expect(Number(rotated?.[1])).toBeCloseTo(8.72, 6);
    // 회전 중심은 마커 위치, 즉 미터 원점의 픽셀 좌표다.
    expect(Number(rotated?.[2])).toBeCloseTo(622, 6);
    expect(Number(rotated?.[3])).toBeCloseTo(512, 6);
  });

  it('방향각이 없으면 부채꼴을 그리지 않는다', () => {
    render(<IndoorMapView stationId={1} currentLocation={{ floorId: 1, mapX: 0, mapY: 0 }} />);

    expect(screen.getByRole('img', { name: '현재 위치' }).querySelector('path')).toBeNull();
  });

  it('현재 위치의 좌표를 프레임 원점 기준으로 변환해 찍는다', () => {
    // 미터 원점(0,0)은 B2 프레임의 originPx(622, 512)로 간다.
    render(<IndoorMapView stationId={1} currentLocation={{ floorId: 1, mapX: 0, mapY: 0 }} />);

    const marker = screen.getByRole('img', { name: '현재 위치' });
    expect(marker.querySelector('circle')).toHaveAttribute('cx', '622');
    expect(marker.querySelector('circle')).toHaveAttribute('cy', '512');
  });
});

describe('IndoorMapView 목업 모드', () => {
  it('목업 모드에서는 조회를 건너뛰고 목업 지도와 오버레이를 그린다', () => {
    // 조회는 비활성이라 pending 상태로 남지만 목업 모드는 그 상태를 보지 않는다.
    mockedHook.mockReturnValue(hookState({ isPending: true, isError: false }));
    render(<IndoorMapView stationId={1} useMockData />);

    // stationId를 조작하는 대신 enabled로 조회를 명시적으로 끈다.
    expect(mockedHook).toHaveBeenCalledWith(1, { enabled: false });
    expect(screen.getByRole('img', { name: 'B2 실내 지도' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '목적지' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '이동 경로' })).toBeInTheDocument();
  });

  it('목업 경로는 표시 중인 층 구간만 그린다', () => {
    mockedHook.mockReturnValue(hookState({ isPending: true, isError: false }));
    render(<IndoorMapView stationId={1} useMockData />);

    // 목업 현재 위치는 B3에 있으므로 B2 지도에는 나타나지 않는다.
    expect(screen.queryByRole('img', { name: '현재 위치' })).not.toBeInTheDocument();
  });

  /**
   * 실제 응답은 `mapUrl`이 null이다. (S15P11A206-281 연동 확인)
   *
   * 백엔드는 **좌표 프레임만** 준다. 도면 이미지는 관리자 업로드 전까지 FE 자산으로 간다.
   * 배포 서버 `GET /api/stations/1/maps`가 지금 세 층 모두 `mapUrl: null`을 돌려준다.
   *
   * 지금까지 이 경로를 검사한 테스트가 없었다. 기존 테스트는 전부 `useMockData`를 켜거나
   * `mapUrl`이 채워진 표본을 썼다. 연동 담당이 크래시를 우려한 지점이라 실제 응답 모양으로
   * 고정해 둔다.
   */
  it('mapUrl이 null이어도 FE 도면으로 그린다', () => {
    mockedHook.mockReturnValue(
      hookState({
        isPending: false,
        isError: false,
        // 배포 서버 응답 그대로다. floorId는 B1=3·B2=1·B3=2로 내려온다.
        data: [
          {
            mapId: 2,
            floorId: 1,
            floorCode: 'B2',
            mapType: 'image',
            mapUrl: null,
            width: 1624,
            height: 969,
            scaleMPerPx: 0.19,
            originPxX: 622,
            originPxY: 512,
            frameAngleDeg: -21.28,
            version: 'v1',
          },
        ],
      }),
    );

    render(<IndoorMapView stationId={1} floorId={1} />);

    const plan = screen.getByRole('img', { name: 'B2 실내 지도' });
    const image = plan.querySelector('image');

    // 서버 URL이 아니라 FE 자산으로 떨어진다. 빈 화면도, 크래시도 아니다.
    expect(image).toBeInTheDocument();
    expect(image?.getAttribute('href')).toMatch(/B2/);
    expect(image?.getAttribute('href')).not.toContain('null');
  });

  it('목업 모드에서 B3 층을 지정하면 현재 위치가 나타난다', () => {
    mockedHook.mockReturnValue(hookState({ isPending: true, isError: false }));
    render(<IndoorMapView stationId={1} floorId={2} useMockData />);

    expect(screen.getByRole('img', { name: 'B3 실내 지도' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '현재 위치' })).toBeInTheDocument();
    // 목적지는 B2에 있으므로 B3에서는 보이지 않는다.
    expect(screen.queryByRole('img', { name: '목적지' })).not.toBeInTheDocument();
  });

  it('목업 모드에서도 넘겨받은 데이터가 있으면 그것을 우선한다', () => {
    mockedHook.mockReturnValue(hookState({ isPending: true, isError: false }));
    render(
      <IndoorMapView
        stationId={1}
        useMockData
        currentLocation={{ floorId: 1, mapX: 0, mapY: 0 }}
      />,
    );

    // B2 지도인데도 현재 위치가 보인다 = 목업(B3) 대신 넘겨받은 값을 썼다.
    expect(screen.getByRole('img', { name: '현재 위치' })).toBeInTheDocument();
  });
});

/**
 * 조회가 끝난 뒤에 시점 추종이 켜지는지. (S15P11A206-79 리뷰)
 *
 * 실제 경로에서는 첫 렌더가 `isPending`이라 지도 요소를 만들지 않는다. 훅이 화면 크기를
 * 마운트 한 번에만 재면 그때는 붙을 요소가 없고, 응답이 와서 요소가 생겨도 다시 재지 않는다.
 * 그러면 크기를 영원히 모르므로 추종이 조용히 꺼지고 복귀 버튼이 상시 노출된다.
 *
 * 기존 추종 테스트는 요소를 항상 렌더하는 하네스를 쓰고, 이 파일의 다른 테스트는 조회 상태를
 * 고정해 둔다. 그래서 **pending → loaded 전이를 태우는 테스트가 없었다.**
 */
describe('IndoorMapView 시점 추종', () => {
  /** jsdom에는 ResizeObserver가 없다. 관찰 즉시 크기를 알려주는 가짜를 심는다. */
  function stubResizeObserver(box: { width: number; height: number }) {
    class Stub {
      callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe() {
        this.callback(
          [{ contentRect: box } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }

      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal('ResizeObserver', Stub);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('조회가 끝나고 지도가 생긴 뒤에도 화면 크기를 재서 추종을 켠다', () => {
    stubResizeObserver({ width: 314, height: 291 });
    mockedHook.mockReturnValue(hookState({ isPending: true, isError: false }));

    const view = render(
      <IndoorMapView
        stationId={1}
        followCamera
        currentLocation={{ floorId: 1, mapX: 0, mapY: 0 }}
      />,
    );

    // 조회 중에는 지도 요소가 없다. 여기서 크기를 잴 방법이 없는 것이 정상이다.
    expect(screen.getByText('지도를 불러오는 중입니다')).toBeInTheDocument();

    mockedHook.mockReturnValue(hookState({ isPending: false, isError: false, data: [framedMap] }));
    view.rerender(
      <IndoorMapView
        stationId={1}
        followCamera
        currentLocation={{ floorId: 1, mapX: 0, mapY: 0 }}
      />,
    );

    // 추종 중이면 복귀 버튼을 보이지 않는다. 버튼이 있으면 추종이 꺼진 것이다.
    expect(screen.queryByRole('button', { name: '내 위치' })).not.toBeInTheDocument();
  });
});
