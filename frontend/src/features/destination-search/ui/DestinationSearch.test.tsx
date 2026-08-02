import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { DestinationSearch } from './DestinationSearch';

const apiMocks = vi.hoisted(() => ({
  getFacility: vi.fn(),
  getRecommendedExits: vi.fn(),
  findNearestExit: vi.fn(),
  updateUserSession: vi.fn(),
}));

vi.mock('@/shared/api', () => apiMocks);

/** 검색 결과는 훅을 그대로 대신한다. 이 테스트가 볼 것은 선택 이후의 흐름이다. */
const searchMocks = vi.hoisted(() => ({ useDestinationSearch: vi.fn() }));

vi.mock('@/entities/poi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/poi')>()),
  useDestinationSearch: searchMocks.useDestinationSearch,
}));

const RESULTS = [
  {
    id: 11,
    name: '코엑스몰',
    icon: 'store' as const,
    meta: '쇼핑',
    kind: 'facility' as const,
    destinationType: 'facility',
    latitude: 37.5,
    longitude: 127.03,
    address: null,
  },
  {
    id: 22,
    name: 'GS25 역삼역점',
    icon: 'store' as const,
    meta: '편의점',
    kind: 'facility' as const,
    destinationType: 'facility',
    latitude: 37.501,
    longitude: 127.036,
    address: null,
  },
];

function renderSearch() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DestinationSearch deferNavigation />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DestinationSearch', () => {
  beforeEach(() => {
    useStationStore.setState({ stationId: 1 });
    useNavigationStore.setState({ destination: null, targetNodeId: null });
    searchMocks.useDestinationSearch.mockReturnValue({
      data: RESULTS,
      isPending: false,
      isError: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * 목적지 하나를 고르면 도착 노드를 구하는 동안 여러 요청이 오간다. 그 사이에 다른 항목을
   * 누를 수 있으면 두 흐름이 스토어를 번갈아 덮어써 이름과 도착 노드가 어긋난다.
   */
  it('한 목적지를 처리하는 동안에는 다른 목적지를 고를 수 없다', async () => {
    let resolveFirst: ((value: { linkedNodeId: number }) => void) | undefined;
    apiMocks.getFacility.mockImplementationOnce(
      () =>
        new Promise<{ linkedNodeId: number }>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    renderSearch();
    fireEvent.click(screen.getByRole('button', { name: '검색' }));

    const first = await screen.findByRole('button', { name: /코엑스몰/ });
    fireEvent.click(first);

    // 처리 중임을 화면이 알린다. 눌러도 아무 일이 없는 것처럼 보이면 사용자가 다시 누른다.
    expect(await screen.findByText('경로를 준비하고 있어요…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GS25 역삼역점/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /GS25 역삼역점/ }));
    // 두 번째 목적지의 조회는 시작조차 하지 않는다.
    expect(apiMocks.getFacility).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst?.({ linkedNodeId: 325 });
      await Promise.resolve();
    });

    await waitFor(() => expect(useNavigationStore.getState().destination).toBe('코엑스몰'));
    expect(useNavigationStore.getState().targetNodeId).toBe(325);
  });

  /** 처리가 끝나면(화면을 떠나지 않는 경우) 다시 고를 수 있어야 한다. */
  it('처리가 끝나면 목록이 다시 열린다', async () => {
    apiMocks.getFacility.mockResolvedValue({ linkedNodeId: 325 });

    renderSearch();
    fireEvent.click(screen.getByRole('button', { name: '검색' }));

    fireEvent.click(await screen.findByRole('button', { name: /코엑스몰/ }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /GS25 역삼역점/ })).toBeEnabled(),
    );
    expect(screen.queryByText('경로를 준비하고 있어요…')).toBeNull();
  });
});
