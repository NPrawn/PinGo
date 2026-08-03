import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { useUserSessionStore } from '@/entities/user-session';
import { USER_ROUTES } from '@/shared/config';
import { ConsultSessionPage } from './ConsultSessionPage';

const apiMocks = vi.hoisted(() => ({
  getConsultation: vi.fn(),
  endConsultationByUser: vi.fn(),
}));

vi.mock('@/shared/api', async (importOriginal) => ({
  // 실내 지도 위젯이 층별 지도 조회 키를 쓴다. 화면이 그것까지 가짜로 만들 이유는 없다.
  ...(await importOriginal<typeof import('@/shared/api')>()),
  getConsultation: apiMocks.getConsultation,
  endConsultationByUser: apiMocks.endConsultationByUser,
}));

/** WebRTC·음성 인식은 이 화면의 관심사가 아니다. 연결된 척만 한다. */
vi.mock('@/features/consult-signaling', () => ({
  // 번역은 이 화면의 관심사가 아니다. 옮기지 않은 것으로 둔다.
  useCaptionTranslation: () => '',
  releaseConsultMedia: vi.fn(),
  peekConsultCamera: vi.fn(() => null),
  useConsultSignaling: () => ({
    localVideoRef: { current: null },
    remoteVideoRef: { current: null },
    status: 'connected',
    error: null,
    localCaption: '',
    remoteCaption: '',
    captionsSupported: true,
    transcript: [],
    sendConsultEvent: vi.fn(() => true),
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[USER_ROUTES.CONSULT_SESSION]}>
        <Routes>
          <Route path={USER_ROUTES.CONSULT_SESSION} element={<ConsultSessionPage />} />
          <Route path={USER_ROUTES.CONSULT_ENDED} element={<div>상담 종료 화면</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ConsultSessionPage', () => {
  beforeEach(() => {
    useConsultStore.setState({
      consultationId: 'cs_1',
      signalingRoomId: 'room_cs_1',
      signalingAccessToken: 'token-1',
    });
    useUserSessionStore.setState({ userSessionId: 'session-1' });
  });

  afterEach(() => {
    useConsultStore.getState().reset();
    useUserSessionStore.setState({ userSessionId: null, expiresAt: undefined });
    vi.clearAllMocks();
  });

  /**
   * 상담자가 끊었는데 사용자 화면이 그대로 남으면, 이미 끝난 상담을 계속 기다리게 된다.
   * 평가도 남기지 못한다.
   */
  it('상담자가 먼저 끝내면 사용자도 종료 화면으로 넘어간다', async () => {
    apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'ENDED' });

    renderPage();

    expect(await screen.findByText('상담 종료 화면')).toBeInTheDocument();
  });

  it('상담이 진행 중이면 화면을 그대로 둔다', async () => {
    apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'IN_PROGRESS' });

    renderPage();

    expect(await screen.findByText('상담 연결됨 · 화면 공유 중')).toBeInTheDocument();
    expect(screen.queryByText('상담 종료 화면')).toBeNull();
  });
});
