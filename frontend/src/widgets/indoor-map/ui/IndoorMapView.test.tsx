import { render, screen } from '@testing-library/react';
import { useStationFloorMaps, type FloorMap } from '@/entities/floor-map';
import { IndoorMapView } from './IndoorMapView';

// 렌더링 로직에만 집중하기 위해 데이터 조회 훅을 목으로 대체한다.
vi.mock('@/entities/floor-map', () => ({
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
  });
});
