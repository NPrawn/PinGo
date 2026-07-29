import { act, render, screen } from '@testing-library/react';
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
});
