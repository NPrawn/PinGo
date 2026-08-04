import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { ApiError } from '@/shared/api';
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
  /** 화면이 등록한 이벤트 수신 함수. 사용자가 보낸 것처럼 흘려 넣는 데 쓴다. */
  onEvent: null as ((event: unknown) => void) | null,
}));

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api')>()),
  getCounselorConsultations: apiMocks.getCounselorConsultations,
  getCounselorConsultation: apiMocks.getCounselorConsultation,
  endConsultation: apiMocks.endConsultation,
  submitConsultationTranscript: apiMocks.submitConsultationTranscript,
}));

/** WebRTC·음성 인식은 이 화면의 관심사가 아니다. 쌓인 전문만 넘겨준다. */
vi.mock('@/features/consult-signaling', async (importOriginal) => ({
  // 번역은 이 화면의 관심사가 아니다. 옮기지 않은 것으로 둔다.
  useCaptionTranslation: () => '',
  useTranslatedSpeech: vi.fn(),
  // 안내 문구를 만드는 것은 순수 함수다. 가짜로 바꾸면 실제로 무슨 말이 뜨는지 못 본다.
  describeRemoteCaptionTrouble: (
    await importOriginal<typeof import('@/features/consult-signaling')>()
  ).describeRemoteCaptionTrouble,
  useConsultSignaling: (
    _room: unknown,
    _role: unknown,
    _token: unknown,
    onEvent: (event: unknown) => void,
  ) => {
    /* 사용자가 보내오는 이벤트를 테스트가 직접 흘려 넣을 수 있게 붙잡아 둔다. */
    signalingMocks.onEvent = onEvent;

    return {
      localVideoRef: { current: null },
      remoteVideoRef: { current: null },
      status: 'connected',
      error: null,
      localCaption: '',
      remoteCaption: '',
      remoteFinalCaption: '',
      remoteCaptionFinal: true,
      remoteCaptionError: null,
      captionsSupported: true,
      transcript: signalingMocks.transcript,
      sendConsultEvent: vi.fn(() => true),
    };
  },
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
   * 종료가 서버에 닿지 않았는데 화면만 넘어가면, 상담자는 끝냈다고 믿지만 서버에는 상담이
   * 계속 진행 중으로 남는다. 그 상담은 요청 목록에서 사라지지 않고 상담자 상태도 '상담 중'에
   * 묶여 다음 요청을 받지 못한다. 예전에는 실패를 통째로 삼키고 그대로 나가 버렸다.
   */
  it('종료가 서버에 거절당하면 화면을 넘기지 않고 이유를 알린다', async () => {
    apiMocks.getCounselorConsultations.mockResolvedValue([
      { consultationId: 'cs_1', status: 'IN_PROGRESS', requestedAt: '2026-08-03T00:00:00Z' },
    ]);
    apiMocks.endConsultation.mockRejectedValue(
      new ApiError('담당 상담자가 아닙니다.', { status: 409 }),
    );

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '상담 종료' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('담당 상담자가 아닙니다.');
    expect(alert).toHaveTextContent('상담은 아직 진행 중입니다');
    // 목록으로 나가 버리면 상담자는 이 상담을 다시 끝낼 방법이 없다. 화면에 남아 다시
    // 누를 수 있어야 한다. (좌측 내비게이션에도 '상담 요청 목록'이 있어 종료 버튼으로 본다.)
    expect(screen.getByRole('button', { name: '상담 종료' })).toBeEnabled();
    // 종료되지 않았으므로 전문도 보내지 않는다. 서버가 409로 거절한다.
    expect(apiMocks.submitConsultationTranscript).not.toHaveBeenCalled();
  });

  /** 종료가 받아들여지면 전문을 남기고 목록으로 나간다. */
  it('종료에 성공하면 전문을 저장하고 목록으로 나간다', async () => {
    apiMocks.getCounselorConsultations.mockResolvedValue([
      { consultationId: 'cs_1', status: 'IN_PROGRESS', requestedAt: '2026-08-03T00:00:00Z' },
    ]);
    apiMocks.endConsultation.mockResolvedValue({});

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '상담 종료' }));

    await waitFor(() => expect(apiMocks.endConsultation).toHaveBeenCalledWith('cs_1'));
    await waitFor(() =>
      expect(apiMocks.submitConsultationTranscript).toHaveBeenCalledWith('cs_1', {
        transcript: signalingMocks.transcript,
      }),
    );
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

  /**
   * 오른쪽 거울은 사용자 화면을 **사용자가 잰 비율로** 비춘다. (S15P11A206-89)
   *
   * 여기에 52:48 같은 숫자를 박아 두면 어긋난다 — 카메라와 지도가 나뉘는 자리에 상단 여백
   * 보정이 더해져 화면 높이마다 실제 값이 다르고, 카메라 원본 규격도 기기마다 다르다. 어긋나면
   * 상담자가 짚어 준 자리가 사용자 화면의 다른 곳에 찍힌다.
   */
  it('거울의 비율과 지도 자리를 사용자가 보내온 값으로 잡는다', async () => {
    apiMocks.getCounselorConsultations.mockResolvedValue([
      { consultationId: 'cs_1', status: 'ACCEPTED', requestedAt: '2026-08-03T00:00:00Z' },
    ]);

    renderPage();
    await screen.findByText('사용자 화면의 지도를 기다리는 중입니다.');

    /* 세로 844px 기기. 나뉘는 자리가 52%가 아니라 54.5%다. */
    act(() => {
      signalingMocks.onEvent?.({
        eventType: 'MAP_SYNC',
        eventId: 'evt_1',
        sessionId: 'cs_1',
        senderType: 'USER',
        timestamp: '2026-08-03T00:00:00Z',
        version: 1,
        payload: {
          stationId: 1,
          floorId: null,
          current: null,
          headingDeg: null,
          destination: null,
          destinationLabel: null,
          pathNodes: [],
          screen: {
            width: 390,
            height: 844,
            lower: { x: 0, y: 0.545, width: 1, height: 0.455 },
            map: { x: 0.041, y: 0.5616, width: 0.9179, height: 0.3555 },
            cameraSource: { width: 1920, height: 1080 },
          },
        },
      });
    });

    const mirror = document.querySelector<HTMLElement>('[style*="--mirror-aspect"]');

    expect(Number(mirror?.style.getPropertyValue('--mirror-aspect'))).toBeCloseTo(390 / 844);
    /* 어림값(`PhoneFrame` 기준 크기)이 아니라 받은 값을 쓴다. */
    expect(Number(mirror?.style.getPropertyValue('--mirror-aspect'))).not.toBeCloseTo(342 / 726);
    /* 카메라도 원본 비율로 되돌린다. 320×240 그대로 두면 16:9 기기에서 늘어난 채로 보인다. */
    expect(Number(mirror?.style.getPropertyValue('--mirror-camera-aspect'))).toBeCloseTo(
      1920 / 1080,
    );

    const mapRegion = [...document.querySelectorAll<HTMLElement>('div[style]')].find(
      (element) => element.style.left === '4.1%',
    );

    expect(mapRegion?.style.top).toBe('56.16%');
    expect(mapRegion?.style.width).toBe('91.79%');
    expect(mapRegion?.style.height).toBe('35.55%');
  });
});
