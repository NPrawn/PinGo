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
    const originalMediaDevices = navigator.mediaDevices;
    const stop = vi.fn();

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop }],
        }),
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640);
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(480);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['frame'], { type: 'image/jpeg' }));
    });
    apiMocks.getStationMaps.mockResolvedValue([{ version: 'map-v1' }]);
    apiMocks.localize.mockResolvedValue({ resultStatus: 'no_match', candidates: [] });
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

      expect(apiMocks.localize).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog', { name: '현재 위치를 찾지 못했어요' })).toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(13_700);
      });
      expect(apiMocks.localize.mock.calls.length).toBeGreaterThan(1);
      expect(screen.queryByRole('dialog', { name: '현재 위치를 찾지 못했어요' })).toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(screen.getByRole('dialog', { name: '현재 위치를 찾지 못했어요' })).toBeInTheDocument();
      expect(stop).toHaveBeenCalled();
    } finally {
      useUserSessionStore.setState({ userSessionId: null, expiresAt: undefined });
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: originalMediaDevices,
      });
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });
});
