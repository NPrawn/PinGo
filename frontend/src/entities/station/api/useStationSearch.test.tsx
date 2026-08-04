import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { i18n } from '@/shared/i18n';
import { useNearbyStations, useRegisteredStations, useStationSearch } from './useStationSearch';

const STATIONS = [
  {
    stationId: 1,
    nameKo: '역삼역',
    nameEn: 'Yeoksam',
    lineInfo: '2호선',
    address: '서울 강남구',
    serviceReady: true,
    distanceM: 120,
  },
];

/** 요청이 몇 번 나갔는지 센다. 언어를 바꿀 때 다시 받지 않는 것이 이 변경의 목적이다. */
let calls = 0;

beforeEach(() => {
  calls = 0;
  server.use(
    http.get('*/api/stations/search', () => {
      calls += 1;
      return HttpResponse.json({ success: true, data: STATIONS, message: null });
    }),
    http.get('*/api/stations/nearby', () => {
      calls += 1;
      return HttpResponse.json({ success: true, data: STATIONS, message: null });
    }),
  );
});

// 언어를 바꿔 둔 케이스가 뒤 테스트로 넘어가지 않게 되돌린다.
afterEach(async () => {
  await i18n.changeLanguage('ko');
});

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        /*
          캐시가 살아 있는 상태를 만든다. staleTime 이 0 이면 마운트마다 다시 받아 언어가
          우연히 맞아 버리고, 그러면 이 테스트가 아무것도 잡지 못한다. 실제 앱에서도 언어를
          바꾸는 것만으로는 재조회가 일어나지 않는다.
        */
        staleTime: 60_000,
      },
    },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/**
 * 언어를 바꾸면 화면의 역 이름도 바뀌어야 한다.
 *
 * 조회 키에 언어를 넣지 않은 이유는 서버가 두 언어 이름을 함께 주므로 다시 받을 필요가 없기
 * 때문이다. 그런데 이름을 고르는 일을 `queryFn` 안에서 하면 그 결과가 캐시에 박혀, 언어를
 * 바꿔도 리액트 쿼리가 `queryFn` 을 다시 부르지 않아 이전 언어 이름이 그대로 남는다.
 * 이름 선택은 `select` 에서 해야 한다 — 렌더 시점에 돌아가므로 언어에 반응한다.
 * (S15P11A206-339 리뷰)
 */
describe('언어를 바꾸면 역 이름이 따라 바뀐다', () => {
  it('useStationSearch', async () => {
    const { result } = renderHook(() => useStationSearch('역삼', true), { wrapper });

    await waitFor(() => expect(result.current.data?.[0].name).toBe('역삼역'));

    await i18n.changeLanguage('en');

    await waitFor(() => expect(result.current.data?.[0].name).toBe('Yeoksam'));
    // 언어만 바꿨을 뿐이므로 다시 받지 않는다.
    expect(calls).toBe(1);
  });

  it('useRegisteredStations', async () => {
    const { result } = renderHook(() => useRegisteredStations(true), { wrapper });

    await waitFor(() => expect(result.current.data?.[0].name).toBe('역삼역'));

    await i18n.changeLanguage('en');

    await waitFor(() => expect(result.current.data?.[0].name).toBe('Yeoksam'));
    expect(calls).toBe(1);
  });

  it('useNearbyStations', async () => {
    const { result } = renderHook(() => useNearbyStations(37.5, 127.03), { wrapper });

    await waitFor(() => expect(result.current.data?.[0].name).toBe('역삼역'));

    await i18n.changeLanguage('en');

    await waitFor(() => expect(result.current.data?.[0].name).toBe('Yeoksam'));
    expect(calls).toBe(1);
  });
});

/** 이름 말고 나머지 매핑도 그대로여야 한다. `select` 로 옮기면서 빠뜨리기 쉽다. */
describe('이름 외 필드', () => {
  it('검색 결과는 주소를, 등록 역 목록은 안내 가능 표시를 넣는다', async () => {
    const search = renderHook(() => useStationSearch('역삼', true), { wrapper });
    await waitFor(() => expect(search.result.current.data?.[0].dist).toBe('서울 강남구'));
    expect(search.result.current.data?.[0].line).toBe('2호선');
    expect(search.result.current.data?.[0].stationId).toBe(1);

    const registered = renderHook(() => useRegisteredStations(true), { wrapper });
    await waitFor(() => expect(registered.result.current.data?.[0].dist).toBe('실내 안내 가능'));
  });

  it('주변 역은 거리를 사람이 읽는 단위로 적고 첫 역을 현재 위치로 표시한다', async () => {
    const { result } = renderHook(() => useNearbyStations(37.5, 127.03), { wrapper });

    await waitFor(() => expect(result.current.data?.[0].dist).toBe('120m'));
    expect(result.current.data?.[0].here).toBe(true);
  });
});
