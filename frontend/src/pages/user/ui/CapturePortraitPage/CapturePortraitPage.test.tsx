import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CapturePortraitPage } from './CapturePortraitPage';

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
});
