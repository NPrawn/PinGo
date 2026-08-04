import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { useStationFacilities } from '@/entities/facility';
import { useStationFloorMaps } from '@/entities/floor-map';
import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { useUserSessionStore } from '@/entities/user-session';
import { releaseConsultMedia } from '@/features/consult-signaling';
import { usePermissionsRevoked } from '@/features/permissions';
import { USER_ROUTES } from '@/shared/config';
import { i18n } from '@/shared/i18n';
import { ConsultSessionPage } from './ConsultSessionPage';

const apiMocks = vi.hoisted(() => ({
  getConsultation: vi.fn(),
  endConsultationByUser: vi.fn(),
  createIndoorRoute: vi.fn(),
  useCaptionTranslation: vi.fn(() => ''),
}));

/** 자막·연결 상태를 테스트마다 갈아 끼운다. 기본은 붙어 있는 상담이다. */
const signaling = vi.hoisted(() => ({
  state: {
    remoteCaption: '',
    remoteFinalCaption: '',
    remoteCaptionFinal: true,
    remoteCaptionError: null as string | null,
    captionError: null as string | null,
  } as Record<string, unknown>,
}));

/** 권한 조회는 이 화면의 관심사가 아니다. 사라졌는지 여부만 테스트가 정한다. */
vi.mock('@/features/permissions', () => ({ usePermissionsRevoked: vi.fn(() => false) }));

/**
 * 층·시설 조회만 갈아 끼운다. 좌표 변환과 도면 배치는 실제 구현을 그대로 쓴다.
 *
 * 이 화면이 지도에 얹는 것은 층 버튼과 시설 필터이고, 둘 다 조회 결과에서 만들어진다. 조회를
 * 비워 두면 버튼이 하나도 없어 "없는 것"과 "안 그린 것"을 구분할 수 없다.
 */
vi.mock('@/entities/floor-map', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/floor-map')>()),
  useStationFloorMaps: vi.fn(() => ({ data: undefined, isPending: false, isError: false })),
}));

vi.mock('@/entities/facility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/facility')>()),
  useStationFacilities: vi.fn(() => ({ data: undefined })),
}));

vi.mock('@/shared/api', async (importOriginal) => ({
  // 실내 지도 위젯이 층별 지도 조회 키를 쓴다. 화면이 그것까지 가짜로 만들 이유는 없다.
  ...(await importOriginal<typeof import('@/shared/api')>()),
  getConsultation: apiMocks.getConsultation,
  endConsultationByUser: apiMocks.endConsultationByUser,
  createIndoorRoute: apiMocks.createIndoorRoute,
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
  /** XR 세션이 카메라를 가져갈 때 부른다. 이 파일은 세션을 열지 않아 호출되지 않는다. */
  swapConsultVideoTrack: vi.fn(() => false),
  useConsultSignaling: () => ({
    localVideoRef: { current: null },
    remoteVideoRef: { current: null },
    replaceLocalVideoTrack: vi.fn(async () => false),
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
    // `clearAllMocks` 는 호출 기록만 지운다. 앞 테스트가 세운 반환값은 여기서 되돌린다.
    vi.mocked(usePermissionsRevoked).mockReturnValue(false);
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

    expect(await screen.findByRole('button', { name: '상담 종료' })).toBeInTheDocument();
    expect(screen.queryByText('상담 종료 화면')).toBeNull();
  });

  it('상담원의 확정 발화를 영어 자막으로 번역한다', async () => {
    apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'IN_PROGRESS' });

    renderPage();

    await screen.findByRole('button', { name: '상담 종료' });
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

    await screen.findByRole('button', { name: '상담 종료' });
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

    await screen.findByRole('button', { name: '상담 종료' });
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

    await screen.findByRole('button', { name: '상담 종료' });
    expect(screen.getByText('Go to exit 3')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '상담원 쪽 음성 인식 서버에 연결하지 못해',
    );
  });

  /**
   * 무엇이 건너가고 있는지 그대로 적어야 한다. (S15P11A206-89)
   *
   * 화면 공유가 있던 시절에는 무엇을 보내든 `화면 공유 중`이라고만 적혀 있었다. 지금 영상은
   * XR 세션에서 뽑은 카메라 프레임 하나뿐이고, 그것이 흐르기 시작하는 시점은 세션이 열려
   * 추적이 잡힌 뒤다. 그 전에 공유 중이라고 적으면 사용자는 상담자가 이미 보고 있다고 믿는다.
   */
  it('카메라 프레임이 아직 흐르지 않으면 준비 중이라고 적는다', async () => {
    apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'IN_PROGRESS' });
    // 트랙은 만들 수 있지만 세션이 없어 프레임은 오지 않는 상태.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData: (width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      }),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    HTMLCanvasElement.prototype.captureStream = vi.fn(
      () => ({ getTracks: () => [], getVideoTracks: () => [] }) as unknown as MediaStream,
    );

    renderPage();

    expect(await screen.findByText('상담 연결됨 · 카메라 준비 중')).toBeInTheDocument();

    delete (HTMLCanvasElement.prototype as { captureStream?: unknown }).captureStream;
  });

  /**
   * 붙지 않은 상담을 연결됐다고 적지 않는다. (S15P11A206-89)
   *
   * 예전에는 `상담 연결됨`이 고정 문구였다. `status` 를 보지 않았으므로 협상 중이거나 실패한
   * 상담에서도 연결됐다고 적혔고, 사용자는 상담자가 자기 말을 듣고 있다고 믿은 채 기다렸다.
   * 아래 `연결 상태:` 줄에는 사실이 적혀 있어 같은 화면의 두 표시가 서로 어긋났다.
   */
  it('아직 붙지 않았으면 연결 중이라고 적고 카메라 이야기를 하지 않는다', async () => {
    apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'IN_PROGRESS' });
    signaling.state = { ...signaling.state, status: 'signaling' };

    renderPage();

    expect(await screen.findByText('연결 중')).toBeInTheDocument();
    // 건너가는 곳이 없는데 카메라 준비 상태를 적으면 영상이 이미 간다고 읽힌다.
    expect(screen.queryByText(/카메라/)).toBeNull();
  });

  it('다시 붙는 중이면 그 사실을 적는다', async () => {
    apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'IN_PROGRESS' });
    signaling.state = { ...signaling.state, status: 'connected', reconnecting: true };

    renderPage();

    expect(await screen.findByText('연결 다시 시도 중')).toBeInTheDocument();
  });

  /**
   * 트랙 자체를 만들 수 없는 기기. 이 사실을 숨기면 상담자는 검은 화면을 보는데 사용자는
   * 자기 모습이 건너가고 있다고 믿는다. 무엇이 막혔는지 적어야 말로 설명할 수 있다.
   */
  it('카메라를 보낼 수 없는 기기에서는 그 사실을 적는다', async () => {
    apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'IN_PROGRESS' });

    renderPage();

    expect(
      await screen.findByText('상담 연결됨 · 이 기기는 카메라를 보낼 수 없어요'),
    ).toBeInTheDocument();
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

  /**
   * 상담 중에도 안내 화면과 같은 지도 조작이 있어야 한다. (S15P11A206-89)
   *
   * 없으면 상담자가 "한 층 위 엘리베이터로 가세요"라고 말해도 사용자는 그 층을 볼 방법이 없고,
   * 시설이 하나도 그려지지 않아 짚어 준 자리를 도면에서 찾을 수 없다.
   */
  describe('지도 조작', () => {
    const floorMap = {
      mapId: 1,
      floorId: 1,
      floorCode: 'B2',
      mapType: 'image',
      mapUrl: null,
      width: 1624,
      height: 969,
      originPxX: 622,
      originPxY: 512,
      frameAngleDeg: -21.28,
      scaleMPerPx: 0.19,
      version: 'v1',
    };

    beforeEach(() => {
      apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'IN_PROGRESS' });
      vi.mocked(useStationFloorMaps).mockReturnValue({
        data: [floorMap, { ...floorMap, mapId: 2, floorId: 2, floorCode: 'B3' }],
        isPending: false,
        isError: false,
      } as unknown as ReturnType<typeof useStationFloorMaps>);
    });

    const PATH = [
      { nodeId: 1, floorId: 1, mapX: 0, mapY: 0 },
      { nodeId: 2, floorId: 1, mapX: -12.4, mapY: 15.6 },
    ];

    /**
     * 스토어에 경로가 있으면 그것을 그린다. 안내 화면에서 넘어온 직후의 상태다.
     *
     * 조회 응답을 기다리는 사이에 선을 지우면 상담자가 짚어 주는 자리를 맞춰 볼 수 없다.
     */
    it('스토어의 현재 위치와 경로를 지도에 그린다', async () => {
      useNavigationStore.setState({
        currentFloorId: 1,
        currentMapX: 0,
        currentMapY: 0,
        routeResult: { pathNodes: PATH },
      } as unknown as Parameters<typeof useNavigationStore.setState>[0]);

      renderPage();

      // 이 파일은 i18n 을 en 으로 두므로 오버레이 라벨도 영어다.
      expect(await screen.findByRole('img', { name: 'Current location' })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Route' })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Destination' })).toBeInTheDocument();
    });

    /**
     * 스토어에 경로가 없으면 **이 화면이 직접 조회한다.** (S15P11A206-89)
     *
     * 예전에는 스토어에 있는 것만 그렸다. 안내 화면을 거치지 않고 들어온 경우, 새로고침으로
     * 스토어가 비워진 경우, 그리고 상담자가 목적지를 바꾼 경우에 경로가 그려지지 않았다 —
     * 마지막 것이 특히 문제였다. `targetNodeId` 만 바뀌고 경로를 다시 받는 사람이 없어, 화면에
     * 적힌 목적지와 지도에 그려진 길이 서로 다른 곳을 가리켰다.
     */
    it('스토어에 경로가 없으면 직접 조회해 그린다', async () => {
      useNavigationStore.setState({
        currentFloorId: 1,
        currentMapX: 0,
        currentMapY: 0,
        currentNodeId: 209,
        targetNodeId: 341,
        routeResult: null,
      } as unknown as Parameters<typeof useNavigationStore.setState>[0]);
      useStationStore.setState({ stationId: 1 });
      apiMocks.createIndoorRoute.mockResolvedValue({ pathNodes: PATH });

      renderPage();

      expect(await screen.findByRole('img', { name: 'Route' })).toBeInTheDocument();
      expect(apiMocks.createIndoorRoute).toHaveBeenCalledWith(
        expect.objectContaining({ stationId: 1, startNodeId: 209, targetNodeId: 341 }),
      );
    });

    /** 출발·도착 노드를 모르면 조회할 수 없다. 빈 요청을 보내지 않는다. */
    it('출발·도착 노드가 없으면 경로를 조회하지 않는다', async () => {
      useNavigationStore.setState({
        currentFloorId: 1,
        currentMapX: 0,
        currentMapY: 0,
        currentNodeId: null,
        targetNodeId: null,
        routeResult: null,
      } as unknown as Parameters<typeof useNavigationStore.setState>[0]);
      useStationStore.setState({ stationId: 1 });

      renderPage();

      await screen.findByRole('img', { name: 'Current location' });
      expect(apiMocks.createIndoorRoute).not.toHaveBeenCalled();
    });

    it('층 목록을 지도 응답에서 만들어 버튼으로 둔다', async () => {
      renderPage();

      const floors = await screen.findByRole('group', { name: '층 선택' });
      expect([...floors.querySelectorAll('button')].map((each) => each.textContent)).toEqual([
        'B2',
        'B3',
      ]);
    });

    /** 표시 층에 없는 유형은 칩도 두지 않는다. 눌러서 아무것도 안 나오는 칩은 두지 않는다. */
    it('표시 층에 있는 시설 유형만 필터로 둔다', async () => {
      useNavigationStore.setState({ currentFloorId: 1 });
      vi.mocked(useStationFacilities).mockReturnValue({
        data: [
          { facilityId: 1, floorId: 1, facilityType: 'exit', nameKo: '2번 출입구' },
          // 다른 층 시설. 이것 때문에 칩이 생기면 눌러도 아무것도 나오지 않는다.
          { facilityId: 2, floorId: 2, facilityType: 'toilet', nameKo: '화장실' },
        ],
      } as unknown as ReturnType<typeof useStationFacilities>);

      renderPage();

      const filters = await screen.findByRole('group', { name: '시설 필터' });
      const labels = [...filters.querySelectorAll('button')].map((each) =>
        each.getAttribute('title'),
      );

      expect(labels).toContain('출구');
      expect(labels).not.toContain('화장실');
    });

    /**
     * 유형 칩만으로는 시설을 하나도 없는 상태로 만들 수 없다. 되돌릴 수 있어야 누르기를
     * 망설이지 않는다 — 그래서 같은 버튼이 다시 전체 표시로 되돌린다.
     */
    it('숨기기 토글로 시설 아이콘을 끄고 다시 켠다', async () => {
      renderPage();

      const hide = await screen.findByRole('button', { name: '시설 아이콘 모두 숨기기' });
      expect(hide).toHaveAttribute('aria-pressed', 'false');

      await userEvent.click(hide);

      const show = screen.getByRole('button', { name: '시설 아이콘 다시 보기' });
      expect(show).toHaveAttribute('aria-pressed', 'true');

      await userEvent.click(show);
      expect(screen.getByRole('button', { name: '시설 아이콘 모두 숨기기' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });
  });
});
