import { fireEvent, render, screen } from '@testing-library/react';
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

vi.mock('@/shared/api', () => ({
  ApiError: apiMocks.ApiError,
  rateConsultation: apiMocks.rateConsultation,
}));

vi.mock('@/features/consult-signaling', () => ({ releaseConsultMedia: vi.fn() }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[USER_ROUTES.CONSULT_ENDED]}>
      <Routes>
        <Route path={USER_ROUTES.CONSULT_ENDED} element={<ConsultEndedPage />} />
        <Route path={USER_ROUTES.STATION} element={<div>역 선택 화면</div>} />
        <Route path={USER_ROUTES.NAVIGATION} element={<div>경로 안내 화면</div>} />
      </Routes>
    </MemoryRouter>,
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
});
