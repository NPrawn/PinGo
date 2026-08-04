import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { i18n } from '@/shared/i18n';
import { useIndoorRouteOptions } from './useIndoorRouteOptions';
import type { RouteOptionsQuery } from '../model/types';

const OPTIONS = [
  {
    routeType: 'fastest',
    displayName: '빠른 경로',
    available: true,
    unavailableReason: null,
    totalDistanceM: 180,
    estimatedTimeSec: 240,
    hasStairsOrEscalator: true,
  },
  {
    routeType: 'elevator_only',
    displayName: '엘리베이터 이용 경로',
    available: false,
    unavailableReason: 'NO_ACCESSIBLE_ROUTE',
    totalDistanceM: null,
    estimatedTimeSec: null,
    hasStairsOrEscalator: false,
  },
];

/** 실제로 나간 요청 본문을 확인하기 위해 받아 둔다. */
let received: unknown = null;

function stubRouteOptions() {
  received = null;
  server.use(
    http.post('*/api/routes/indoor/options', async ({ request }) => {
      received = await request.json();
      return HttpResponse.json({ success: true, data: OPTIONS, message: null });
    }),
  );
}

function wrapper({ children }: { children: React.ReactNode }) {
  // 재시도를 끄지 않으면 실패 검사가 기본 재시도만큼 늘어진다.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const mount = (query: Partial<RouteOptionsQuery>) =>
  renderHook(() => useIndoorRouteOptions(query), { wrapper });

// 언어를 바꿔 둔 케이스가 뒤 테스트로 넘어가지 않게 되돌린다.
afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('useIndoorRouteOptions', () => {
  it('세 값이 모두 있으면 조회해서 옵션을 돌려준다', async () => {
    stubRouteOptions();

    const { result } = mount({ stationId: 1, startNodeId: 205, targetNodeId: 44 });

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(received).toEqual({ stationId: 1, startNodeId: 205, targetNodeId: 44, language: 'ko' });
    expect(result.current.data?.[0]).toMatchObject({
      routeType: 'fastest',
      totalDistanceM: 180,
      estimatedTimeSec: 240,
    });
  });

  /**
   * 도달 불가 옵션도 그대로 들어온다.
   *
   * 역삼역은 B1↔B2에 엘리베이터가 없어 B3 승강장에서 B1 출구로 가는 `elevator_only`가 실제로
   * 이 응답을 준다. 목록에서 걸러 내면 사용자는 그런 경로가 없다는 사실을 알 수 없다.
   */
  it('도달할 수 없는 옵션도 사유와 함께 그대로 들어온다', async () => {
    stubRouteOptions();

    const { result } = mount({ stationId: 1, startNodeId: 205, targetNodeId: 44 });

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data?.[1]).toMatchObject({
      available: false,
      unavailableReason: 'NO_ACCESSIBLE_ROUTE',
      totalDistanceM: null,
      estimatedTimeSec: null,
    });
  });

  /**
   * 출발 노드는 위치 인식에서, 도착 노드는 목적지 검색에서 온다. 둘 다 아직 없다.
   *
   * 없는 값을 0이나 null로 채워 부르면 서버가 400을 주고 화면에 오류가 뜬다. 아직 고를 것이
   * 없는 상태와 조회에 실패한 상태는 사용자에게 다른 화면이어야 한다.
   */
  it.each([
    ['출발 노드가 없으면', { stationId: 1, targetNodeId: 44 }],
    ['도착 노드가 없으면', { stationId: 1, startNodeId: 205 }],
    ['역을 모르면', { startNodeId: 205, targetNodeId: 44 }],
    ['노드가 0이면', { stationId: 1, startNodeId: 0, targetNodeId: 44 }],
  ])('%s 요청을 보내지 않는다', async (_label, query) => {
    stubRouteOptions();

    const { result } = mount(query);

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(received).toBeNull();
    expect(result.current.data).toBeUndefined();
  });

  /**
   * 선택한 언어가 요청에 실린다.
   *
   * 실리지 않으면 백엔드가 `Language.DEFAULT`(=EN)로 떨어져 한국어를 골라도 이용 불가 사유
   * 문구와 세부 안내가 영어로 나온다. 빠뜨린 쪽은 아무 오류도 보지 못하므로 여기서 붙잡는다.
   * (S15P11A206-339)
   */
  it('선택한 언어를 요청에 싣는다', async () => {
    stubRouteOptions();
    await i18n.changeLanguage('en');

    const { result } = mount({ stationId: 1, startNodeId: 205, targetNodeId: 44 });

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(received).toMatchObject({ language: 'en' });
  });

  /**
   * 언어가 바뀌면 다시 받는다.
   *
   * `unavailableMessage`는 서버가 요청 언어로 쓰는 문장이라, 이름처럼 두 언어를 함께 받는 값이
   * 아니다. 조회 키에 언어가 없으면 언어를 바꿔도 이전 언어의 문구가 그대로 보인다.
   */
  it('언어가 바뀌면 이전 언어의 응답을 그대로 쓰지 않는다', async () => {
    stubRouteOptions();

    const { result } = mount({ stationId: 1, startNodeId: 205, targetNodeId: 44 });
    await waitFor(() => expect(received).toMatchObject({ language: 'ko' }));

    await i18n.changeLanguage('en');

    await waitFor(() => expect(received).toMatchObject({ language: 'en' }));
    expect(result.current.data).toHaveLength(2);
  });

  it('출발지가 바뀌면 이전 경로를 그대로 쓰지 않는다', async () => {
    stubRouteOptions();

    const { result, rerender } = renderHook(
      ({ start }) => useIndoorRouteOptions({ stationId: 1, startNodeId: start, targetNodeId: 44 }),
      {
        wrapper,
        initialProps: { start: 205 },
      },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(2));

    // 재인식으로 출발 노드가 바뀐 상황. 키가 같으면 캐시된 이전 경로가 그대로 보인다.
    rerender({ start: 226 });

    await waitFor(() =>
      expect(received).toEqual({
        stationId: 1,
        startNodeId: 226,
        targetNodeId: 44,
        language: 'ko',
      }),
    );
  });
});
