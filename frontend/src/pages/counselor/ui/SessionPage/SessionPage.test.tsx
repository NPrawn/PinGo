import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import type { MapSyncPayload } from '@/shared/types';
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
  /** 사용자에게 나간 이벤트. 렌더마다 새로 만들면 무엇이 나갔는지 검사할 수 없다. */
  sendConsultEvent: vi.fn(() => true),
  translateCaption: vi.fn(),
  localCaption: '',
  localCaptionFinal: true,
  localFinalCaptionId: null as string | null,
  remoteCaption: '',
  remoteFinalCaption: '',
  remoteFinalCaptionId: null as string | null,
  remoteCaptionFinal: true,
}));

const facilityMocks = vi.hoisted(() => ({
  data: undefined as { floorId: number; facilityType: string }[] | undefined,
}));

/**
 * 시설 조회. 층별로 무엇이 있는지가 칩의 진하기를 가르므로 목록을 테스트가 정한다.
 *
 * 기본은 빈 목록이 아니라 `undefined` 다 — 아직 모르는 것과 없는 것은 다르다. 모르는 동안
 * 없다고 그리면 모든 칩이 잠깐 연해진다.
 */
vi.mock('@/entities/facility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/facility')>()),
  useStationFacilities: () => ({ data: facilityMocks.data }),
}));

/**
 * 층별 지도. 도면이 있어야 시설 마커가 그려진다.
 *
 * MSW 에는 층별 지도 핸들러가 없어 조회가 실패하고, 그러면 지도가 비어 마커를 누를 수 없다.
 * 좌표 프레임까지 갖춘 목업이 이미 있으므로 그것을 그대로 쓴다. (S15P11A206-206)
 */
vi.mock('@/entities/floor-map', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/entities/floor-map')>();

  return { ...actual, useStationFloorMaps: () => ({ data: actual.MOCK_FLOOR_MAPS }) };
});

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api')>()),
  getCounselorConsultations: apiMocks.getCounselorConsultations,
  getCounselorConsultation: apiMocks.getCounselorConsultation,
  endConsultation: apiMocks.endConsultation,
  submitConsultationTranscript: apiMocks.submitConsultationTranscript,
}));

/** WebRTC·음성 인식은 이 화면의 관심사가 아니다. 쌓인 전문만 넘겨준다. */
vi.mock('@/features/consult-signaling', async (importOriginal) => ({
  DEMO_PHARMACY_DRAW_DELAY_MS: 9500,
  useCaptionTranslation: signalingMocks.translateCaption,
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
      localCaption: signalingMocks.localCaption,
      localCaptionFinal: signalingMocks.localCaptionFinal,
      localFinalCaptionId: signalingMocks.localFinalCaptionId,
      remoteCaption: signalingMocks.remoteCaption,
      remoteFinalCaption: signalingMocks.remoteFinalCaption,
      remoteFinalCaptionId: signalingMocks.remoteFinalCaptionId,
      remoteCaptionFinal: signalingMocks.remoteCaptionFinal,
      remoteCaptionError: null,
      captionsSupported: true,
      transcript: signalingMocks.transcript,
      sendConsultEvent: signalingMocks.sendConsultEvent,
    };
  },
}));

/** 사용자가 보내오는 지도 스냅숏 한 통. 층이 바뀌는 상황도 이것으로 만든다. */
function sendMapSync(floorId: number | null = null, extra: Partial<MapSyncPayload> = {}) {
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
        floorId,
        current: null,
        headingDeg: null,
        destination: null,
        destinationLabel: null,
        destinationNodeId: null,
        pathNodes: [],
        screen: null,
        ...extra,
      },
    });
  });
}

/** MAP_SYNC 를 받아야 지도와 시설 칩이 그려진다. */
async function renderWithMapSync(
  floorId: number | null = null,
  extra: Partial<MapSyncPayload> = {},
) {
  apiMocks.getCounselorConsultations.mockResolvedValue([
    { consultationId: 'cs_1', status: 'ACCEPTED', requestedAt: '2026-08-03T00:00:00Z' },
  ]);

  renderPage();
  await screen.findByText('사용자 화면의 지도를 기다리는 중입니다.');

  sendMapSync(floorId, extra);
}

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
    signalingMocks.localCaption = '';
    signalingMocks.localCaptionFinal = true;
    signalingMocks.localFinalCaptionId = null;
    signalingMocks.remoteCaption = '';
    signalingMocks.remoteFinalCaption = '';
    signalingMocks.remoteFinalCaptionId = null;
    signalingMocks.remoteCaptionFinal = true;
    signalingMocks.translateCaption.mockImplementation(
      (_consultationId: string, text: string, targetLanguage: string) => {
        if (!text) return '';
        return targetLanguage === 'ko' ? `한국어: ${text}` : `English: ${text}`;
      },
    );
    useConsultStore.setState({
      consultationId: 'cs_1',
      signalingRoomId: 'room_cs_1',
      signalingAccessToken: 'token-1',
    });
  });

  it('실시간 자막을 한국어와 영어로 함께 표시한다', async () => {
    apiMocks.getCounselorConsultations.mockResolvedValue([
      { consultationId: 'cs_1', status: 'IN_PROGRESS', requestedAt: '2026-08-03T00:00:00Z' },
    ]);
    signalingMocks.remoteCaption = 'Where is exit three?';
    signalingMocks.remoteFinalCaption = 'Where is exit three?';
    signalingMocks.remoteFinalCaptionId = 'caption-user-1';
    signalingMocks.localCaption = '3번 출구는 왼쪽입니다.';
    signalingMocks.localFinalCaptionId = 'caption-counselor-1';

    renderPage();

    expect(await screen.findByText('한국어: Where is exit three?')).toBeInTheDocument();
    expect(screen.getByText('English: Where is exit three?')).toBeInTheDocument();
    expect(screen.getByText('3번 출구는 왼쪽입니다.')).toBeInTheDocument();
    expect(screen.getByText('English: 3번 출구는 왼쪽입니다.')).toBeInTheDocument();
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

  /**
   * 시설 표시는 사용자 화면과 같은 세 상태다 — 전체 · 유형 하나 · 숨김. (S15P11A206-89)
   *
   * 예전에는 아무 시설도 없는 도면에서 시작했다. 상담자는 역에 무엇이 어디 있는지부터 봐야
   * 짚어 줄 수 있는데, 빈 도면에서 시작하면 유형 칩을 하나씩 눌러 가며 찾아야 했고 사용자
   * 화면과도 다른 지도를 보고 있었다.
   */
  describe('시설 표시', () => {
    afterEach(() => {
      facilityMocks.data = undefined;
    });

    it('처음에는 전체 표시이고 켜진 유형 칩이 없다', async () => {
      await renderWithMapSync();

      const chips = screen.getAllByRole('button', { pressed: false });

      // 유형을 고르지 않은 것이 곧 전체 표시다. 어느 칩도 켜져 있지 않다.
      expect(chips.some((chip) => chip.textContent?.includes('엘리베이터'))).toBe(true);
      expect(screen.queryByRole('button', { pressed: true, name: /엘리베이터/ })).toBeNull();
      // 감출 길이 화면에 있어야 한다. 겹쳐 선 마커가 도면을 가릴 때 쓴다.
      expect(screen.getByRole('button', { name: /숨기기/ })).toBeInTheDocument();
    });

    it('숨기기를 누르면 켜지고 문구가 다시 보기로 바뀐다', async () => {
      await renderWithMapSync();

      fireEvent.click(screen.getByRole('button', { name: /숨기기/ }));

      const restore = screen.getByRole('button', { name: /다시 보기/ });
      expect(restore).toHaveAttribute('aria-pressed', 'true');

      // 되돌릴 길이 없으면 누르기를 망설이게 된다.
      fireEvent.click(restore);
      expect(screen.getByRole('button', { name: /숨기기/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    /** 켜 둔 유형을 다시 누르면 꺼지지 않고 전체 표시로 돌아간다. */
    it('유형을 골랐다가 다시 누르면 전체 표시로 돌아간다', async () => {
      await renderWithMapSync();

      const elevator = () => screen.getByRole('button', { name: /엘리베이터/ });

      fireEvent.click(elevator());
      expect(elevator()).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(elevator());
      expect(elevator()).toHaveAttribute('aria-pressed', 'false');
      // 숨김이 아니라 전체다. 숨기기 칩은 꺼진 채로 남는다.
      expect(screen.getByRole('button', { name: /숨기기/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    /**
     * 그 층에 없는 유형은 연하게 두고 누를 수 없게 한다.
     *
     * 사용자 화면은 없는 유형을 아예 빼지만 상담자는 층을 오가며 보는 사람이라, 칩이 층마다
     * 사라지고 나타나면 누르려던 자리가 계속 바뀐다. 예전에는 없는 유형도 같은 진하기로 떠 있어
     * 눌러서 빈 지도를 봐야만 그 층에 없다는 것을 알 수 있었다.
     */
    it('표시 층에 없는 시설 유형은 누를 수 없게 둔다', async () => {
      facilityMocks.data = [{ floorId: 7, facilityType: 'elevator' }];

      await renderWithMapSync(7);

      expect(screen.getByRole('button', { name: /엘리베이터/ })).toBeEnabled();

      const absent = screen.getByRole('button', { name: /승차권 충전/ });
      expect(absent).toBeDisabled();
      // 왜 누를 수 없는지 화면에서 알 수 있어야 한다.
      expect(absent).toHaveAttribute('title', '이 층에는 승차권 충전이 없어요');
    });

    /** 아직 조회가 오지 않은 동안 없다고 단정하면 모든 칩이 잠깐 연해진다. */
    it('시설 목록을 받기 전에는 어느 칩도 잠그지 않는다', async () => {
      await renderWithMapSync(7);

      expect(screen.getByRole('button', { name: /승차권 충전/ })).toBeEnabled();
    });
  });

  /**
   * **경로가 중간에 끊겨 보이지 않아야 한다.** (S15P11A206-206)
   *
   * 경로선은 그래프 노드에서 시작하고 사용자 점은 실제 좌표에 있어 둘이 몇 미터 떨어져 보인다.
   * 그 사이를 메우는 `connectCurrentToRoute` 가 거울 지도에는 있었는데 상담자 자신의 지도에만
   * 빠져 있어, 상담자가 보는 큰 지도에서만 경로가 끊겨 있었다. 두 지도가 다른 그림을 보여 주면
   * 상담자가 짚어 주는 자리를 사용자가 자기 화면에서 찾을 수 없다.
   *
   * 검사는 **앞으로 갈 길이 내 자리에서 시작하는지**로 한다. 예전에는 따로 그린 연결선(`line`)을
   * 찾았는데, 그 선은 닿는 점에서 길이 갈라져 보이는 문제로 없어졌고 지금은 경로를 다시 써서 한
   * 줄로 만든다(S15P11A206-345). 그리는 방식이 아니라 이어져 있다는 사실을 본다.
   */
  it('상담자 지도의 경로가 사용자 점에서 시작한다', async () => {
    await renderWithMapSync(1, {
      current: { floorId: 1, mapX: 0, mapY: 10 },
      pathNodes: [
        { nodeId: 1, floorId: 1, mapX: 0, mapY: 0 },
        { nodeId: 2, floorId: 1, mapX: 20, mapY: 0 },
      ],
    });

    const marker = screen.getAllByRole('img', { name: '현재 위치' })[0];
    const dot = marker?.querySelector('circle:last-of-type');
    const at = { x: Number(dot?.getAttribute('cx')), y: Number(dot?.getAttribute('cy')) };
    expect(Number.isFinite(at.x)).toBe(true);

    /* 그려진 지도 전부를 본다. 배치 정보(`screen`)가 오기 전에는 거울이 없어 한 장뿐이다. */
    const routes = screen.getAllByRole('img', { name: '이동 경로' });
    expect(routes.length).toBeGreaterThan(0);
    routes.forEach((route) => {
      // 테두리(`aria-hidden`)가 아닌 본선의 첫 좌표.
      const points = route.querySelector('polyline:not([aria-hidden])')?.getAttribute('points');
      const [first = ''] = (points ?? '').split(' ');
      const [x, y] = first.split(',').map(Number);

      expect(x).toBeCloseTo(at.x, 0);
      expect(y).toBeCloseTo(at.y, 0);
    });
  });

  /**
   * 지점 재지정. **두 순서를 모두 받는다.** (S15P11A206-206)
   *
   * 예전에는 버튼이 모드를 켜는 일만 했다. 그래서 아이콘을 눌러 이름을 확인한 상담자는 그 이름표를
   * 보면서도 버튼을 켜고 **같은 아이콘을 한 번 더** 눌러야 했다. 고른 것이 눈앞에 있는데 다시
   * 짚으라는 요구다.
   */
  describe('고른 시설에 곧바로 적용', () => {
    /** 도면에 실제로 그려질 수 있는 시설. 좌표와 노드가 온전해야 마커가 나온다. */
    const ELEVATOR = {
      facilityId: 52,
      stationId: 1,
      floorId: 1,
      facilityType: 'elevator',
      nameKo: '엘리베이터',
      nameEn: 'Elevator',
      mapX: -0.4,
      mapY: 27.2,
      linkedNodeId: 123,
      isAccessible: true,
    };

    afterEach(() => {
      facilityMocks.data = undefined;
    });

    /** 지도 마커. 같은 이름의 유형 칩과 구분해야 한다 — 마커는 SVG `g` 다. */
    function facilityMarker(name: string): HTMLElement {
      const found = screen
        .getAllByRole('button', { name })
        .find((node) => node.tagName.toLowerCase() === 'g');
      if (!found) throw new Error(`지도에 ${name} 마커가 없다`);

      return found;
    }

    it('시설을 골라 둔 채 목적지 재지정을 누르면 바로 보낸다', async () => {
      facilityMocks.data = [ELEVATOR];
      await renderWithMapSync(1);

      fireEvent.click(facilityMarker('엘리베이터'));
      // 버튼이 곧바로 적용된다는 것을 화면에서 알 수 있어야 한다.
      expect(screen.getByRole('status')).toHaveTextContent('엘리베이터을(를) 골랐어요');

      fireEvent.click(screen.getByRole('button', { name: /목적지 재지정/ }));

      expect(signalingMocks.sendConsultEvent).toHaveBeenCalledWith({
        eventType: 'DESTINATION_CHANGE_REQUESTED',
        payload: {
          facilityId: 52,
          nameKo: '엘리베이터',
          floorId: 1,
          mapX: -0.4,
          mapY: 27.2,
          linkedNodeId: 123,
        },
      });
      expect(screen.getByRole('status')).toHaveTextContent('엘리베이터(으)로 목적지를 옮겼어요');
    });

    it('현재 위치 수정도 같은 순서를 받는다', async () => {
      facilityMocks.data = [ELEVATOR];
      await renderWithMapSync(1);

      fireEvent.click(facilityMarker('엘리베이터'));
      fireEvent.click(screen.getByRole('button', { name: /현재 위치 수정/ }));

      expect(signalingMocks.sendConsultEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'CURRENT_LOCATION_CORRECTED' }),
      );
      expect(screen.getByRole('status')).toHaveTextContent('엘리베이터(으)로 현재 위치를 옮겼어요');
    });

    /**
     * **층이 바뀌면 고른 것이 풀려야 한다.** (S15P11A206-206 리뷰)
     *
     * 층은 상담자가 직접 넘기지 않아도 바뀐다 — 따라가기 중에 사용자가 계단을 오르면
     * `mapSync.floorId` 가 바뀌고 표시 층이 따라간다. 고른 시설이 남아 있으면 화면은 다른 층인데
     * 안내에는 이전 층 시설 이름이 뜨고, 그 상태에서 재지정을 누르면 **화면에 보이지도 않는
     * 시설**로 목적지가 지정된다.
     */
    it('사용자 층이 바뀌면 고른 시설이 풀린다', async () => {
      facilityMocks.data = [ELEVATOR];
      await renderWithMapSync(1);

      fireEvent.click(facilityMarker('엘리베이터'));
      expect(screen.getByRole('status')).toHaveTextContent('엘리베이터을(를) 골랐어요');

      // 사용자가 다른 층으로 옮겼다. 상담자는 아무것도 누르지 않았다.
      sendMapSync(2);

      // 안내 줄 자체가 사라진다 — 켜 둔 모드도, 고른 것도, 방금 보낸 결과도 없다.
      expect(screen.queryByText(/골랐어요/)).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /목적지 재지정/ }));

      // 보이지 않는 시설로 보내지 않는다. 모드만 켜고 지도에서 짚기를 기다린다.
      expect(signalingMocks.sendConsultEvent).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveTextContent('지도에서 새 목적지를 누르세요');
    });

    /** 고른 것이 없으면 예전처럼 모드를 켠다. 그때는 지도에서 짚는 것이 유일한 입력이다. */
    it('고른 시설이 없으면 모드만 켠다', async () => {
      facilityMocks.data = [ELEVATOR];
      await renderWithMapSync(1);

      fireEvent.click(screen.getByRole('button', { name: /목적지 재지정/ }));

      expect(signalingMocks.sendConsultEvent).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveTextContent('지도에서 새 목적지를 누르세요');
    });
  });
});
