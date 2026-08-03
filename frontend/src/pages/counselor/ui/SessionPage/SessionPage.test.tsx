import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { COUNSELOR_ROUTES } from '@/shared/config';
import { SessionPage } from './SessionPage';

const apiMocks = vi.hoisted(() => ({
  getCounselorConsultations: vi.fn(),
  getCounselorConsultation: vi.fn(),
  endConsultation: vi.fn().mockResolvedValue({}),
  submitConsultationTranscript: vi.fn().mockResolvedValue({}),
}));

const signalingMocks = vi.hoisted(() => ({
  transcript: [
    { seq: 1, speaker: 'USER' as const, content: '3번 출구가 어디예요' },
    { seq: 2, speaker: 'COUNSELOR' as const, content: '왼쪽으로 가시면 됩니다' },
  ],
}));

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api')>()),
  getCounselorConsultations: apiMocks.getCounselorConsultations,
  getCounselorConsultation: apiMocks.getCounselorConsultation,
  endConsultation: apiMocks.endConsultation,
  submitConsultationTranscript: apiMocks.submitConsultationTranscript,
}));

/** WebRTC·음성 인식은 이 화면의 관심사가 아니다. 쌓인 전문만 넘겨준다. */
vi.mock('@/features/consult-signaling', () => ({
  // 번역은 이 화면의 관심사가 아니다. 옮기지 않은 것으로 둔다.
  useCaptionTranslation: () => '',
  useConsultSignaling: () => ({
    localVideoRef: { current: null },
    remoteVideoRef: { current: null },
    status: 'connected',
    error: null,
    localCaption: '',
    remoteCaption: '',
    captionsSupported: true,
    transcript: signalingMocks.transcript,
    screenShareBlocked: false,
    shareScreen: vi.fn(),
    sendConsultEvent: vi.fn(() => true),
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[COUNSELOR_ROUTES.SESSION]}>
        <Routes>
          <Route path={COUNSELOR_ROUTES.SESSION} element={<SessionPage />} />
          <Route path={COUNSELOR_ROUTES.REQUESTS} element={<div>상담 요청 목록</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SessionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConsultStore.setState({
      consultationId: 'cs_1',
      signalingRoomId: 'room_cs_1',
      signalingAccessToken: 'token-1',
    });
  });

  /**
   * 사용자가 먼저 끊는 일이 더 잦다. 그때 전문을 남기지 않으면 방금 나눈 대화가 통째로
   * 사라지고, 상담 내역에는 '저장된 상담 내용이 없습니다'만 남는다.
   */
  it('사용자가 먼저 끝내도 상담 전문을 저장한 뒤 목록으로 나간다', async () => {
    apiMocks.getCounselorConsultations.mockResolvedValue([
      { consultationId: 'cs_1', status: 'ENDED', requestedAt: '2026-08-03T00:00:00Z' },
    ]);

    renderPage();

    await waitFor(() =>
      expect(apiMocks.submitConsultationTranscript).toHaveBeenCalledWith('cs_1', {
        transcript: signalingMocks.transcript,
      }),
    );
    // 종료는 사용자가 이미 했다. 상담자가 다시 종료를 부르면 409로 거절된다.
    expect(apiMocks.endConsultation).not.toHaveBeenCalled();
    await screen.findByText('상담 요청 목록');
  });

  /**
   * 사용자 정보는 상담 요청에 실제로 담겨 온 값이어야 한다. 예전에는 `역삼역 2번 개찰구 →
   * 3번 출구`가 고정으로 적혀 있어, 상담자가 사용자와 무관한 경로를 읽고 안내를 시작했다.
   */
  it('출발지·목적지를 상담 데이터에서 읽고, 없으면 지어내지 않는다', async () => {
    apiMocks.getCounselorConsultations.mockResolvedValue([
      {
        consultationId: 'cs_1',
        status: 'ACCEPTED',
        requestedAt: '2026-08-03T00:00:00Z',
        currentLocationLabel: '역삼역 3번 개찰구',
        problemType: 'CANNOT_FIND_EXIT',
      },
    ]);

    renderPage();

    expect(await screen.findByText(/역삼역 3번 개찰구/)).toBeInTheDocument();
    // 목적지를 아직 안 골랐으면 빈 자리로 두지 말고 모른다고 적는다.
    expect(screen.getByText(/목적지 미지정/)).toBeInTheDocument();
    expect(screen.getByText('출구를 못 찾겠어요')).toBeInTheDocument();
    expect(screen.queryByText(/2번 개찰구/)).not.toBeInTheDocument();
  });

  /**
   * 예전에는 버튼이 켜지기만 하고 아무 일도 일어나지 않았다. 상담자는 자기가 목적지를
   * 바꾼 줄 알고 안내를 이어 갔는데, 사용자 화면은 그대로였다.
   */
  it('목적지 재지정을 켜면 지도에서 무엇을 눌러야 하는지 알려 준다', async () => {
    apiMocks.getCounselorConsultations.mockResolvedValue([
      { consultationId: 'cs_1', status: 'ACCEPTED', requestedAt: '2026-08-03T00:00:00Z' },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /목적지 재지정/ }));

    expect(screen.getByRole('status')).toHaveTextContent('지도에서 새 목적지를 누르세요');
  });

  /** 사용자 지도가 오기 전에 아무 지도나 띄우면 상담자가 엉뚱한 곳을 짚는다. */
  it('사용자 지도를 받기 전에는 대기 문구를 보여 준다', async () => {
    apiMocks.getCounselorConsultations.mockResolvedValue([
      { consultationId: 'cs_1', status: 'ACCEPTED', requestedAt: '2026-08-03T00:00:00Z' },
    ]);

    renderPage();

    expect(await screen.findByText('사용자 화면의 지도를 기다리는 중입니다.')).toBeInTheDocument();
  });
});
