import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { useUserSessionStore } from '@/entities/user-session';
import { USER_ROUTES } from '@/shared/config';
import { ConsultEndedPage } from './ConsultEndedPage';

const apiMocks = vi.hoisted(() => {
  class ApiError extends Error {
    readonly code?: string;
    readonly status?: number;

    constructor(message: string, options: { code?: string; status?: number } = {}) {
      super(message);
      this.code = options.code;
      this.status = options.status;
    }
  }

  return { ApiError, rateConsultation: vi.fn() };
});

/**
 * 평가 API 만 가짜로 바꾼다. **모듈 전체를 대체하지 않는다.** (S15P11A206-382)
 *
 * 모달 뒤 배경이 실제 지도를 그리면서 `queryKeys` 를 함께 쓰게 됐다. 통째로 대체하면 그 export
 * 가 사라져 지도 위젯이 렌더 중에 죽는다 — 이 화면이 무엇을 대체했는지 명시하지 않았기 때문에
 * 생기는 문제라, 필요한 것만 덮어쓴다.
 */
vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api')>()),
  ApiError: apiMocks.ApiError,
  rateConsultation: apiMocks.rateConsultation,
}));

vi.mock('@/features/consult-signaling', () => ({ releaseConsultMedia: vi.fn() }));

/**
 * 모달 뒤 배경이 실제 지도를 그리므로 조회 컨텍스트가 필요하다. (S15P11A206-382)
 *
 * 역을 고르지 않은 상태라 `stationId` 가 0 으로 들어가고, 그러면 층 지도 조회 자체가 꺼진다
 * (`hasValidStationId`). 요청은 나가지 않지만 `useQuery` 는 provider 없이 살 수 없다.
 */
function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[USER_ROUTES.CONSULT_ENDED]}>
        <Routes>
          <Route path={USER_ROUTES.CONSULT_ENDED} element={<ConsultEndedPage />} />
          <Route path={USER_ROUTES.STATION} element={<div>역 선택 화면</div>} />
          <Route path={USER_ROUTES.NAVIGATION} element={<div>경로 안내 화면</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ConsultEndedPage', () => {
  beforeEach(() => {
    useConsultStore.setState({ consultationId: 'consultation-1', satisfaction: 0 });
    useUserSessionStore.setState({ userSessionId: 'session-1' });
    apiMocks.rateConsultation.mockResolvedValue({ consultationId: 'consultation-1', score: 5 });
  });

  afterEach(() => {
    useConsultStore.getState().reset();
    useUserSessionStore.setState({ userSessionId: null, expiresAt: undefined });
    vi.clearAllMocks();
  });

  it('별점을 서버에 남기고 목적지 검색으로 돌아간다', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '5점' }));

    expect(await screen.findByText('역 선택 화면')).toBeInTheDocument();
    expect(apiMocks.rateConsultation).toHaveBeenCalledWith('consultation-1', 'session-1', 5);
  });

  /** 저장되지 않은 점수를 저장된 것처럼 보여 주고 넘어가면 사용자는 평가를 남겼다고 믿는다. */
  it('평가를 저장하지 못하면 화면을 넘기지 않고 다시 시도하게 한다', async () => {
    apiMocks.rateConsultation.mockRejectedValue(new apiMocks.ApiError('서버 오류'));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '4점' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '평가를 저장하지 못했어요. 다시 눌러 주세요.',
    );
    expect(screen.queryByText('역 선택 화면')).toBeNull();
  });

  /** 이미 평가한 상담은 서버가 거절한다. 점수는 남아 있으니 실패로 알릴 일이 아니다. */
  it('이미 평가한 상담이면 오류 대신 그대로 넘어간다', async () => {
    apiMocks.rateConsultation.mockRejectedValue(
      new apiMocks.ApiError('이미 평가한 상담입니다.', { code: 'CONSULTATION_ALREADY_RATED' }),
    );

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '3점' }));

    expect(await screen.findByText('역 선택 화면')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  /**
   * 상담자가 먼저 끊었을 때는 사용자가 별점을 남기지 않을 수도 있다. 그래도 이 화면에
   * 들어온 시점에 방 번호가 곧바로 비워져야 sessionStorage에 끝난 상담이 남지 않는다.
   * (평가 자체는 비워지기 전에 붙잡아 둔 ID로 여전히 매길 수 있다 — 위 테스트로 확인됨.)
   */
  it('별점을 남기지 않아도 화면에 들어오면 곧바로 상담 정보를 비운다', () => {
    renderPage();

    expect(useConsultStore.getState().consultationId).toBeNull();
    expect(useConsultStore.getState().signalingRoomId).toBeNull();
  });

  /**
   * 상담을 어디서 시작했는지에 따라 돌아갈 자리가 다르다. (S15P11A206-89)
   *
   * 경로 안내 중에 상담을 받은 사용자를 역 선택으로 보내면, 걷던 사람이 역 고르기부터 목적지
   * 고르기까지 다시 밟아야 한다. 상담은 안내를 잠시 멈춘 것이지 처음으로 되돌린 것이 아니다.
   */
  describe('돌아갈 자리', () => {
    it('경로 안내에서 시작한 상담은 안내로 돌아간다', async () => {
      useConsultStore.setState({ entryRoute: USER_ROUTES.NAVIGATION });

      renderPage();
      fireEvent.click(screen.getByRole('button', { name: '5점' }));

      expect(await screen.findByText('경로 안내 화면')).toBeInTheDocument();
    });

    it('안내로 돌아갈 때는 안내 문구도 그렇게 적는다', () => {
      useConsultStore.setState({ entryRoute: USER_ROUTES.NAVIGATION });

      renderPage();

      expect(screen.getByText('별점을 남기면 경로 안내로 돌아가요')).toBeInTheDocument();
    });

    it('다른 화면에서 시작했으면 역 선택으로 간다', async () => {
      useConsultStore.setState({ entryRoute: USER_ROUTES.ROUTE_OPTIONS });

      renderPage();
      fireEvent.click(screen.getByRole('button', { name: '5점' }));

      expect(await screen.findByText('역 선택 화면')).toBeInTheDocument();
    });

    /**
     * CTA 를 거치지 않고 상담 화면에 닿은 경우다. 돌아갈 자리를 모르는 채 안내로 보내면
     * 목적지도 경로도 없는 빈 안내가 뜬다.
     */
    it('진입 지점을 모르면 역 선택으로 간다', async () => {
      useConsultStore.setState({ entryRoute: null });

      renderPage();
      fireEvent.click(screen.getByRole('button', { name: '5점' }));

      expect(await screen.findByText('역 선택 화면')).toBeInTheDocument();
    });
  });

  /**
   * 모달 뒤 배경. **프로토타입 목업이 남아 있던 자리다.** (S15P11A206-382)
   *
   * 퍼센트로 고정한 가짜 마커, `['1F','B1','B2']` 로 박아 둔 층 버튼, 카메라 자리의 하드코딩
   * `↑` 화살표였다. 안내 화면은 그 셋을 이미 걷어냈는데 이 화면만 남아 있어, 상담을 끝내면
   * 옛 UI 가 다시 나타났다.
   *
   * 층 목록이 특히 틀렸다 — 역삼역에 등록된 지도는 B1·B2·B3 이고 `1F` 지도는 없다.
   */
  describe('모달 뒤 배경', () => {
    it('프로토타입 층 버튼과 하드코딩 화살표를 그리지 않는다', () => {
      renderPage();

      expect(screen.queryByText('1F')).toBeNull();
      expect(screen.queryByText('↑')).toBeNull();
    });
  });
});
