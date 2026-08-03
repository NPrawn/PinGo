import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { useUserSessionStore } from '@/entities/user-session';
import { USER_ROUTES } from '@/shared/config';
import { i18n } from '@/shared/i18n';
import { ConsultSessionPage } from './ConsultSessionPage';

const apiMocks = vi.hoisted(() => ({
  getConsultation: vi.fn(),
  endConsultationByUser: vi.fn(),
  useCaptionTranslation: vi.fn(() => ''),
}));

/** 자막 상태만 테스트마다 갈아 끼운다. 나머지 연결 값은 붙어 있는 것으로 둔다. */
const signaling = vi.hoisted(() => ({
  state: {
    remoteCaption: '',
    remoteFinalCaption: '',
    remoteCaptionFinal: true,
    remoteCaptionError: null as string | null,
    captionError: null as string | null,
  },
}));

vi.mock('@/shared/api', async (importOriginal) => ({
  // 실내 지도 위젯이 층별 지도 조회 키를 쓴다. 화면이 그것까지 가짜로 만들 이유는 없다.
  ...(await importOriginal<typeof import('@/shared/api')>()),
  getConsultation: apiMocks.getConsultation,
  endConsultationByUser: apiMocks.endConsultationByUser,
}));

/** WebRTC·음성 인식은 이 화면의 관심사가 아니다. 연결된 척만 한다. */
vi.mock('@/features/consult-signaling', async (importOriginal) => ({
  // 번역은 이 화면의 관심사가 아니다. 옮기지 않은 것으로 둔다.
  useCaptionTranslation: apiMocks.useCaptionTranslation,
  useTranslatedSpeech: vi.fn(),
  // 안내 문구를 만드는 것은 순수 함수다. 가짜로 바꾸면 실제로 무슨 말이 뜨는지 못 본다.
  describeRemoteCaptionTrouble: (
    await importOriginal<typeof import('@/features/consult-signaling')>()
  ).describeRemoteCaptionTrouble,
  releaseConsultMedia: vi.fn(),
  peekConsultCamera: vi.fn(() => null),
  useConsultSignaling: () => ({
    localVideoRef: { current: null },
    remoteVideoRef: { current: null },
    status: 'connected',
    error: null,
    localCaption: '',
    captionsSupported: true,
    transcript: [],
    sendConsultEvent: vi.fn(() => true),
    ...signaling.state,
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
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useConsultStore.setState({
      consultationId: 'cs_1',
      signalingRoomId: 'room_cs_1',
      signalingAccessToken: 'token-1',
    });
    useUserSessionStore.setState({ userSessionId: 'session-1' });
    signaling.state = {
      remoteCaption: '',
      remoteFinalCaption: '',
      remoteCaptionFinal: true,
      remoteCaptionError: null,
      captionError: null,
    };
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

  it('상담원의 확정 발화를 영어 자막으로 번역한다', async () => {
    apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'IN_PROGRESS' });

    renderPage();

    await screen.findByText('상담 연결됨 · 화면 공유 중');
    expect(apiMocks.useCaptionTranslation).toHaveBeenCalledWith('cs_1', '', 'en');
  });

  /**
   * 번역은 말이 끝난 문장에만 걸린다. 옮긴 문장만 띄우면 상담원이 다음 말을 하는 내내
   * 화면이 지난 문장에서 멈춰 있어, 사용자는 자막이 죽은 것으로 본다.
   */
  it('상담원이 말하는 중에는 옮긴 지난 문장 아래로 지금 원문이 흘러간다', async () => {
    apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'IN_PROGRESS' });
    // 앞 문장은 옮겨 두었고, 상담원은 이미 다음 문장을 말하는 중이다.
    apiMocks.useCaptionTranslation.mockReturnValue('Go to exit 3');
    signaling.state = {
      ...signaling.state,
      remoteFinalCaption: '3번 출구로 가세요',
      remoteCaption: '그리고 왼쪽으로',
      remoteCaptionFinal: false,
    };

    renderPage();

    await screen.findByText('상담 연결됨 · 화면 공유 중');
    // 읽어야 하는 것은 자기 언어로 된 쪽이라 옮긴 문장이 큰 자리를 지킨다.
    expect(screen.getByText('Go to exit 3')).toBeInTheDocument();
    // 그 아래로 지금 들어오는 말이 흘러간다. 이것이 없으면 화면은 멈춰 보인다.
    expect(screen.getByText('그리고 왼쪽으로')).toBeInTheDocument();
  });

  /** 아직 옮기지 못한 원문이 큰 자리에 올라갔으면 같은 말을 아래에 또 쓰지 않는다. */
  it('옮기기 전에는 원문을 한 번만 띄운다', async () => {
    apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'IN_PROGRESS' });
    apiMocks.useCaptionTranslation.mockReturnValue('');
    signaling.state = { ...signaling.state, remoteCaption: '3번 출구로 가세요' };

    renderPage();

    await screen.findByText('상담 연결됨 · 화면 공유 중');
    expect(screen.getAllByText('3번 출구로 가세요')).toHaveLength(1);
  });

  /**
   * 상담원 브라우저가 음성 인식을 못 하면 자막은 영영 오지 않는다. 그 사실을 알리지 않으면
   * 화면은 "상담원이 조용한 것"과 똑같아 보여, 사용자는 오지 않을 자막을 계속 기다린다.
   */
  it('상담원 쪽 음성 인식이 죽으면 그 사실을 사용자에게 알린다', async () => {
    apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'IN_PROGRESS' });
    signaling.state = { ...signaling.state, remoteCaptionError: 'unsupported' };

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('상담원 쪽 브라우저가 음성 인식을 지원하지 않아');
    // 목소리까지 끊긴 것으로 오해해 상담을 끊으면 안 된다.
    expect(alert).toHaveTextContent('목소리는 그대로 들립니다');
  });

  /** 상담 도중에 인식이 멈춘 경우. 마지막 문장에 가려 경고가 묻히면 알아챌 방법이 없다. */
  it('자막이 이미 떠 있어도 상담원 자막이 죽으면 경고를 띄운다', async () => {
    apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'IN_PROGRESS' });
    apiMocks.useCaptionTranslation.mockReturnValue('Go to exit 3');
    signaling.state = {
      ...signaling.state,
      remoteFinalCaption: '3번 출구로 가세요',
      remoteCaption: '3번 출구로 가세요',
      remoteCaptionError: 'network',
    };

    renderPage();

    await screen.findByText('상담 연결됨 · 화면 공유 중');
    expect(screen.getByText('Go to exit 3')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '상담원 쪽 음성 인식 서버에 연결하지 못해',
    );
  });
});
