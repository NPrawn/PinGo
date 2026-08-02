import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { useAdminRecords } from './useAdminRecords';

/**
 * 경로 조회는 `stationId` 없이 부르면 서버가 400을 낸다. OpenAPI 문서에는 선택 항목으로
 * 적혀 있으나 서비스가 null을 거절하기 때문이다(RouteService.requireStationId).
 * 그 호출이 실제로 역을 실어 보내는지, 실패하면 화면이 알 수 있는지를 고정한다.
 */

const STATIONS = [
  { stationId: 1, nameKo: '역삼역', nameEn: 'Yeoksam', lineInfo: '2호선' },
  { stationId: 2, nameKo: '강남역', nameEn: 'Gangnam', lineInfo: '2호선' },
];

function ok(data: unknown) {
  return HttpResponse.json({ success: true, data });
}

/** 서버가 필수 파라미터 누락을 거절하는 방식 그대로. */
function badRequest() {
  return HttpResponse.json(
    { success: false, code: 'INVALID_REQUEST', message: '요청 형식이 올바르지 않습니다.' },
    { status: 400 },
  );
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** 조회에 실린 쿼리 문자열을 순서대로 모은다. */
function recordRequestedStations(path: string, respond: () => Response) {
  const seen: (string | null)[] = [];
  server.use(
    http.get(`*/api/admin/${path}`, ({ request }) => {
      seen.push(new URL(request.url).searchParams.get('stationId'));
      return respond();
    }),
  );
  return seen;
}

describe('useAdminRecords', () => {
  beforeEach(() => {
    server.use(http.get('*/api/admin/stations', () => ok(STATIONS)));
  });

  it('경로 조회는 역마다 stationId를 실어 보낸다', async () => {
    const nodeCalls = recordRequestedStations('route-nodes', () => ok([]));
    const edgeCalls = recordRequestedStations('route-edges', () => ok([]));

    const { result } = renderHook(() => useAdminRecords('route'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // stationId 없이 부르면 400이므로, 모든 호출에 역이 실려 있어야 한다.
    expect(nodeCalls.sort()).toEqual(['1', '2']);
    expect(edgeCalls.sort()).toEqual(['1', '2']);
  });

  it('시설 조회도 역마다 stationId를 실어 보낸다', async () => {
    const facilityCalls = recordRequestedStations('facilities', () => ok([]));

    const { result } = renderHook(() => useAdminRecords('facility'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(facilityCalls.sort()).toEqual(['1', '2']);
  });

  it('조회가 실패하면 빈 목록이 아니라 서버 메시지를 올린다', async () => {
    server.use(http.get('*/api/admin/route-nodes', () => badRequest()));

    const { result } = renderHook(() => useAdminRecords('route'), { wrapper });

    await waitFor(() => expect(result.current.loadError).not.toBeNull());
    // 실패를 빈 배열로 흘려보내면 "등록된 항목 없음"과 구분되지 않는다.
    expect(result.current.loadError).toBe('요청 형식이 올바르지 않습니다.');
    expect(result.current.rows).toEqual([]);
  });
});
