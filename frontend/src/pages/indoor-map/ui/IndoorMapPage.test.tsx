import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IndoorMapPage } from './IndoorMapPage';

/**
 * 목업 모드에서는 층별 지도 조회를 건너뛰므로 네트워크가 필요 없다.
 * useQuery 자체는 호출되어 QueryClient만 있으면 된다.
 */
function renderAt(search: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/user/map${search}`]}>
        <IndoorMapPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function markerCenter(name: string): { cx: string | null; cy: string | null } {
  const circle = screen.getByRole('img', { name }).querySelector('circle');
  return { cx: circle?.getAttribute('cx') ?? null, cy: circle?.getAttribute('cy') ?? null };
}

describe('IndoorMapPage 현재 위치 파라미터', () => {
  it('x·y로 넘긴 좌표를 프레임 변환해 현재 위치로 찍는다', () => {
    // 미터 원점(0,0)은 B2 프레임의 originPx(622, 512)로 간다.
    renderAt('?mock=1&x=0&y=0');
    expect(markerCenter('현재 위치')).toEqual({ cx: '622', cy: '512' });
  });

  it('넘긴 좌표가 오버레이까지 그대로 전달된다', () => {
    // 목업 목적지(EV3)와 같은 좌표를 현재 위치로 넘기면 두 마커가 겹친다.
    // 하드코딩된 목업 위치가 아니라 파라미터 값이 쓰였다는 뜻이다.
    renderAt('?mock=1&x=-58.4&y=42.5');
    expect(markerCenter('현재 위치')).toEqual(markerCenter('목적지'));
  });

  it('음수·소수 좌표를 읽는다', () => {
    renderAt('?mock=1&x=-58.4&y=42.5');
    const { cx, cy } = markerCenter('현재 위치');
    // 원점보다 왼쪽·아래에 찍힌다.
    expect(Number(cx)).toBeLessThan(622);
    expect(Number(cy)).toBeGreaterThan(512);
  });

  it('floor로 다른 층을 지정할 수 있다', () => {
    renderAt('?mock=1&floorId=2&x=0&y=0');
    expect(screen.getByRole('img', { name: 'B3 실내 지도' })).toBeInTheDocument();
    // B3 프레임의 originPx(597, 497).
    expect(markerCenter('현재 위치')).toEqual({ cx: '597', cy: '497' });
  });

  it('표시 중인 층과 다른 층을 지정하면 마커가 나타나지 않는다', () => {
    renderAt('?mock=1&x=0&y=0&floor=2');
    expect(screen.getByRole('img', { name: 'B2 실내 지도' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '현재 위치' })).not.toBeInTheDocument();
  });

  describe('파라미터가 불완전하면 목업 위치를 그대로 쓴다', () => {
    it('x·y가 없으면 목업 위치(B3)라 B2 화면에는 안 보인다', () => {
      renderAt('?mock=1');
      expect(screen.queryByRole('img', { name: '현재 위치' })).not.toBeInTheDocument();
    });

    it('y가 빠지면 무시한다', () => {
      renderAt('?mock=1&x=-20');
      expect(screen.queryByRole('img', { name: '현재 위치' })).not.toBeInTheDocument();
    });

    it('숫자가 아니면 무시한다', () => {
      renderAt('?mock=1&x=abc&y=0');
      expect(screen.queryByRole('img', { name: '현재 위치' })).not.toBeInTheDocument();
    });
  });
});
