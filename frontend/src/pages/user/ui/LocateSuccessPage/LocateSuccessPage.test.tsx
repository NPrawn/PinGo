import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { LocateSuccessPage } from './LocateSuccessPage';

vi.mock('@/widgets/camera-preview', () => ({
  useCameraPreview: () => ({ status: 'live', isLive: true }),
  CameraFeed: () => null,
  CameraFallbackNotice: () => null,
}));

describe('LocateSuccessPage', () => {
  beforeEach(() => {
    useStationStore.setState({ station: '역삼역', floor: 'B3' });
    useNavigationStore.setState({
      currentLocationLabel: 'B3_R006',
      currentConfidenceScore: 0.87,
      currentAccuracyM: 1.095,
      relocalizing: false,
    });
  });

  it('shows real VPS metrics with station and floor but hides internal and fixed labels', () => {
    render(
      <MemoryRouter>
        <LocateSuccessPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('역삼역 · B3')).toHaveLength(2);
    expect(screen.getByText('신뢰도 87%')).toBeInTheDocument();
    expect(screen.getByText('오차 범위 약 1.1m')).toBeInTheDocument();
    expect(screen.queryByText('B3_R006')).toBeNull();
    expect(screen.queryByText('3번 출구 방면 · 12번 기둥 부근')).toBeNull();
    expect(screen.queryByText('2호선 · 출구 1–8')).toBeNull();
  });
});
