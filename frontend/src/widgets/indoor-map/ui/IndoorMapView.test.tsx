import { render, screen } from '@testing-library/react';
import { useStationFloorMaps, type FloorMap } from '@/entities/floor-map';
import { IndoorMapView } from './IndoorMapView';

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
    const image = screen.getByRole('img', { name: 'B1 실내 지도' });
    expect(image).toHaveAttribute('src', 'http://localhost:8080/uploads/maps/3f2a1b.png');
    // 원본 width/height를 고유 비율로 유지한다. (CSS로 뷰포트에 맞춰 축소되어도 비율 보존)
    expect(image).toHaveAttribute('width', '1200');
    expect(image).toHaveAttribute('height', '800');
  });
});

/** 좌표 프레임이 등록된 층. 프레임이 없으면 좌표를 찍을 수 없어 오버레이가 생략된다. */
const framedMap: FloorMap = { ...sampleMap, floorId: 1, floorCode: 'B2' };

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

  it('좌표 프레임이 없는 층에서는 오버레이를 생략한다', () => {
    // sampleMap의 B1은 프레임 미등록 층이다.
    mockedHook.mockReturnValue(hookState({ isPending: false, isError: false, data: [sampleMap] }));
    render(<IndoorMapView stationId={1} currentLocation={{ floorId: 1, mapX: 0, mapY: 0 }} />);

    expect(screen.queryByRole('img', { name: '현재 위치' })).not.toBeInTheDocument();
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

    expect(mockedHook).toHaveBeenCalledWith(0);
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
      <IndoorMapView stationId={1} useMockData currentLocation={{ floorId: 1, mapX: 0, mapY: 0 }} />,
    );

    // B2 지도인데도 현재 위치가 보인다 = 목업(B3) 대신 넘겨받은 값을 썼다.
    expect(screen.getByRole('img', { name: '현재 위치' })).toBeInTheDocument();
  });
});
