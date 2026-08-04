import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { i18n } from '@/shared/i18n';
import { useDestinationSearch } from './useDestinationSearch';

const DESTINATIONS = [
  {
    destinationId: 11,
    nameKo: '올리브영 역삼중앙점',
    nameEn: 'Olive Young Yeoksam',
    category: '카페',
    destinationType: 'facility',
    latitude: 37.5,
    longitude: 127.03,
    address: '서울 강남구',
  },
];

let calls = 0;

beforeEach(() => {
  calls = 0;
  server.use(
    http.get('*/api/destinations/search', () => {
      calls += 1;
      return HttpResponse.json({ success: true, data: DESTINATIONS, message: null });
    }),
  );
});

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        /* 캐시가 살아 있는 상태를 만든다. 0 이면 마운트마다 다시 받아 언어가 우연히 맞는다. */
        staleTime: 60_000,
      },
    },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/**
 * 언어를 바꾸면 목적지 이름도 바뀌어야 한다. 이름 고르기가 `queryFn` 안에 있으면 그 결과가
 * 캐시에 박혀 이전 언어로 남는다 — 조회 키에 언어가 없으므로 `queryFn` 이 다시 돌지 않는다.
 * (S15P11A206-339 리뷰)
 */
it('언어를 바꾸면 목적지 이름이 따라 바뀌고 다시 받지는 않는다', async () => {
  const { result } = renderHook(() => useDestinationSearch(1, '올리브영', true), { wrapper });

  await waitFor(() => expect(result.current.data?.[0].name).toBe('올리브영 역삼중앙점'));

  await i18n.changeLanguage('en');

  await waitFor(() => expect(result.current.data?.[0].name).toBe('Olive Young Yeoksam'));
  expect(calls).toBe(1);
});

/** 이름 말고 나머지 매핑도 그대로여야 한다. `select` 로 옮기면서 빠뜨리기 쉽다. */
it('아이콘·종류·좌표를 그대로 옮긴다', async () => {
  const { result } = renderHook(() => useDestinationSearch(1, '올리브영', true), { wrapper });

  await waitFor(() => expect(result.current.data).toHaveLength(1));

  const poi = result.current.data![0];
  expect(poi.id).toBe(11);
  expect(poi.icon).toBe('coffee');
  expect(poi.meta).toBe('카페');
  expect(poi.kind).toBe('facility');
  expect(poi.latitude).toBe(37.5);
  expect(poi.address).toBe('서울 강남구');
});
