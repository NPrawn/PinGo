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
});
