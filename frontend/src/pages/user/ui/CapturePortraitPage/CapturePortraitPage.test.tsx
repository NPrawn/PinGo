import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useUserSessionStore } from '@/entities/user-session';
import { CapturePortraitPage } from './CapturePortraitPage';

const apiMocks = vi.hoisted(() => ({
  getStationMaps: vi.fn(),
  localize: vi.fn(),
  updateUserSession: vi.fn(),
}));

vi.mock('@/shared/api', () => apiMocks);

/**
 * 카메라는 위젯이 소유한다. 이 화면이 검증할 것은 촬영 루프와 15초 마감이므로
 * 스트림 획득은 위젯 층에서 대신한다.
 *
 * `videoRef`에 실제 요소 대신 크기만 있는 객체를 둔다. 화면은 프레임을 뜰 수 있는지
 * 판단할 때 `videoWidth`만 보고, 실제 캡처는 `capture()`가 한다.
 */
const cameraMocks = vi.hoisted(() => ({
  capture: vi.fn(),
  status: { value: 'live' as string },
  videoRef: { current: { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement },
}));

vi.mock('@/widgets/camera-preview', () => ({
  useCameraPreview: () => ({
    videoRef: cameraMocks.videoRef,
    stream: null,
    status: cameraMocks.status.value,
    isLive: cameraMocks.status.value === 'live',
    capture: cameraMocks.capture,
  }),
  CameraFeed: () => null,
  CameraFallbackNotice: () => null,
  stopCamera: vi.fn(),
}));

describe('CapturePortraitPage', () => {
  it('shows the location matching exception only after 15 seconds', () => {
    vi.useFakeTimers();

    try {
      render(
        <MemoryRouter>
          <CapturePortraitPage />
        </MemoryRouter>,
      );

      expect(screen.queryByRole('dialog', { name: '현재 위치를 찾지 못했어요' })).toBeNull();

      act(() => {
        vi.advanceTimersByTime(15_000);
      });

      expect(screen.getByRole('dialog', { name: '현재 위치를 찾지 못했어요' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '다시 촬영하기' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '상담 연결' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('restarts the direction guide after manual selection and stops it on timeout', () => {
    vi.useFakeTimers();

    try {
      render(
        <MemoryRouter>
          <CapturePortraitPage />
        </MemoryRouter>,
      );

      act(() => {
        vi.advanceTimersByTime(2400);
      });
      fireEvent.click(screen.getByRole('button', { name: /왼쪽/ }));

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByRole('button', { name: /왼쪽/ })).toHaveAttribute('aria-pressed', 'true');

      act(() => {
        vi.advanceTimersByTime(2300);
      });
      expect(screen.getByRole('button', { name: /정면/ })).toHaveAttribute('aria-pressed', 'true');

      act(() => {
        vi.advanceTimersByTime(10_100);
      });
      expect(screen.getByRole('dialog', { name: '현재 위치를 찾지 못했어요' })).toBeInTheDocument();

      const directionAtTimeout = screen
        .getAllByRole('button')
        .find((button) => button.getAttribute('aria-pressed') === 'true')?.textContent;

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      const directionAfterTimeout = screen
        .getAllByRole('button')
        .find((button) => button.getAttribute('aria-pressed') === 'true')?.textContent;

      expect(directionAfterTimeout).toBe(directionAtTimeout);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps capturing after an early no-match response and opens the modal at 15 seconds', async () => {
    vi.useFakeTimers();

    cameraMocks.capture.mockResolvedValue(new Blob(['frame'], { type: 'image/jpeg' }));
    apiMocks.getStationMaps.mockResolvedValue([{ version: 'map-v1' }]);
    apiMocks.localize.mockResolvedValue({ resultStatus: 'no_match', position: null });
    useUserSessionStore.setState({ userSessionId: 'session-1' });

    try {
      render(
        <MemoryRouter>
          <CapturePortraitPage />
        </MemoryRouter>,
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1200);
      });

      // 카메라가 준비되면 곧바로 첫 장을 보낸다. 첫 1초를 흘려보내지 않는다.
      expect(apiMocks.localize.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByRole('dialog', { name: '현재 위치를 찾지 못했어요' })).toBeNull();
      const earlyCalls = apiMocks.localize.mock.calls.length;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(13_700);
      });
      // no_match 한 번으로 멈추지 않고 마감까지 계속 다시 찍는다.
      expect(apiMocks.localize.mock.calls.length).toBeGreaterThan(earlyCalls);
      expect(screen.queryByRole('dialog', { name: '현재 위치를 찾지 못했어요' })).toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(screen.getByRole('dialog', { name: '현재 위치를 찾지 못했어요' })).toBeInTheDocument();
    } finally {
      useUserSessionStore.setState({ userSessionId: null, expiresAt: undefined });
      cameraMocks.capture.mockReset();
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });
});
