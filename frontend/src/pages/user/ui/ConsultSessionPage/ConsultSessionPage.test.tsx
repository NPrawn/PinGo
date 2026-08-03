import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { useUserSessionStore } from '@/entities/user-session';
import { peekConsultCamera, releaseConsultMedia } from '@/features/consult-signaling';
import { usePermissionsRevoked } from '@/features/permissions';
import { USER_ROUTES } from '@/shared/config';
import { ConsultSessionPage } from './ConsultSessionPage';

const apiMocks = vi.hoisted(() => ({
  getConsultation: vi.fn(),
  endConsultationByUser: vi.fn(),
}));

/** 권한 조회는 이 화면의 관심사가 아니다. 사라졌는지 여부만 테스트가 정한다. */
vi.mock('@/features/permissions', () => ({ usePermissionsRevoked: vi.fn(() => false) }));

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
    // `clearAllMocks` 는 호출 기록만 지운다. 앞 테스트가 세운 반환값은 여기서 되돌린다.
    vi.mocked(usePermissionsRevoked).mockReturnValue(false);
    vi.mocked(peekConsultCamera).mockReturnValue(null);
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

    expect(await screen.findByText('상담 연결됨 · 음성만')).toBeInTheDocument();
    expect(screen.queryByText('상담 종료 화면')).toBeNull();
  });

  /**
   * 카메라를 끄고 상담을 시작한 사용자에게 공유 중이라고 적으면 안 된다.
   *
   * 화면 공유가 있던 시절에는 무엇을 보내든 `화면 공유 중`이라고만 적혀 있었다. 지금은 카메라가
   * 유일한 영상이라, 껐는지 켰는지가 그대로 적혀야 무엇이 건너가는지 알 수 있다.
   */
  it('카메라를 잡아 두었으면 카메라 공유 중이라고 알린다', async () => {
    apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'IN_PROGRESS' });
    vi.mocked(peekConsultCamera).mockReturnValue({} as MediaStream);

    renderPage();

    expect(await screen.findByText('상담 연결됨 · 카메라 공유 중')).toBeInTheDocument();
  });

  /**
   * 상담 도중 권한이 사라진 경우.
   *
   * 경로 가드에 맡기면 권한 화면으로 튕겨 나가면서 잡아 둔 카메라·마이크가 그대로 남고, 서버의
   * 상담도 진행 중으로 남는다. 상담자는 연결돼 있다고 믿은 채 빈 화면에 대고 안내를 이어 간다.
   */
  it('상담 도중 권한이 사라지면 장치를 놓고 상담을 끝낸다', async () => {
    apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'IN_PROGRESS' });
    apiMocks.endConsultationByUser.mockResolvedValue(undefined);
    vi.mocked(usePermissionsRevoked).mockReturnValue(true);

    renderPage();

    expect(await screen.findByText('상담 종료 화면')).toBeInTheDocument();
    expect(releaseConsultMedia).toHaveBeenCalled();
    expect(apiMocks.endConsultationByUser).toHaveBeenCalledWith('cs_1', 'session-1');
  });

  /** 서버가 종료를 받아 주지 않아도 장치는 이미 놓았고 화면은 넘어가야 한다. */
  it('종료 요청이 실패해도 종료 화면으로 넘어간다', async () => {
    apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'IN_PROGRESS' });
    apiMocks.endConsultationByUser.mockRejectedValue(new Error('boom'));
    vi.mocked(usePermissionsRevoked).mockReturnValue(true);

    renderPage();

    expect(await screen.findByText('상담 종료 화면')).toBeInTheDocument();
    expect(releaseConsultMedia).toHaveBeenCalled();
  });
});
