import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { useNavigationStore } from '@/entities/navigation';
import { usePermissionStore } from '@/entities/permission';
import { useUserSessionStore } from '@/entities/user-session';
import { USER_ROUTES } from '@/shared/config';
import { ConsultPermissionPage } from './ConsultPermissionPage';

const apiMocks = vi.hoisted(() => ({
  createConsultation: vi.fn(),
  cancelConsultation: vi.fn(),
}));

const mediaMocks = vi.hoisted(() => ({
  captureConsultMicrophone: vi.fn(),
  composeConsultMedia: vi.fn(),
  holdConsultMedia: vi.fn(),
  releaseConsultMedia: vi.fn(),
  captureConsultCamera: vi.fn(),
  holdConsultCamera: vi.fn(),
}));

vi.mock('@/shared/api', () => ({
  ApiError: class ApiError extends Error {},
  createConsultation: apiMocks.createConsultation,
  cancelConsultation: apiMocks.cancelConsultation,
}));

vi.mock('@/features/consult-signaling', () => mediaMocks);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[USER_ROUTES.CONSULT_PERMISSION]}>
      <Routes>
        <Route path={USER_ROUTES.CONSULT_PERMISSION} element={<ConsultPermissionPage />} />
        <Route path={USER_ROUTES.CONSULT_REQUEST} element={<div>문제 유형 선택 화면</div>} />
        <Route path={USER_ROUTES.CONSULT_WAITING} element={<div>상담 대기 화면</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ConsultPermissionPage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    useConsultStore.setState({ issue: 0, consultationId: null, signalingRoomId: null });
    useNavigationStore.setState({
      currentNodeId: 107,
      destinationId: null,
      destinationType: 'place',
    });
    useUserSessionStore.setState({ userSessionId: 'session-1' });
    usePermissionStore.setState({ granted: { loc: true, cam: false, mic: false } });
    apiMocks.createConsultation.mockResolvedValue({ consultationId: 'consultation-1' });
    apiMocks.cancelConsultation.mockResolvedValue(undefined);
    mediaMocks.captureConsultMicrophone.mockResolvedValue({
      getAudioTracks: () => [{ kind: 'audio' }],
    } as unknown as MediaStream);
    // 카메라 영상은 상담자에게 그대로 건너가고, 같은 트랙이 셀프뷰에도 쓰인다.
    mediaMocks.captureConsultCamera.mockResolvedValue({
      getVideoTracks: () => [{ kind: 'video' }],
    } as unknown as MediaStream);
    mediaMocks.composeConsultMedia.mockImplementation(
      (microphone: MediaStream, camera: MediaStream | null) =>
        ({
          getAudioTracks: () => microphone.getAudioTracks(),
          getVideoTracks: () => camera?.getVideoTracks() ?? [],
        }) as unknown as MediaStream,
    );
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'mediaDevices');
    Reflect.deleteProperty(window, 'isSecureContext');
    useConsultStore.getState().reset();
    useNavigationStore.setState({
      currentNodeId: null,
      destinationId: null,
      destinationType: null,
    });
    useUserSessionStore.setState({ userSessionId: null, expiresAt: undefined });
    usePermissionStore.setState({ granted: { loc: false, cam: false, mic: false } });
    vi.clearAllMocks();
  });

  /**
   * 장치는 연결 전에 잡아 둬야 한다. 상담이 연결된 뒤로 미루면 협상이 먼저 끝나 트랙 없는
   * 연결이 맺어지고, 상담자 쪽에 영상과 소리가 한참 동안 뜨지 않는다.
   */
  it('상담을 요청하기 전에 카메라·마이크를 확보해 상담 화면으로 넘긴다', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '동의하고 상담 연결' }));

    expect(await screen.findByText('상담 대기 화면')).toBeInTheDocument();
    expect(mediaMocks.captureConsultMicrophone).toHaveBeenCalled();
    expect(mediaMocks.holdConsultMedia).toHaveBeenCalled();
    // 카메라도 여기서 잡아 둬야 상담 화면에 셀프뷰가 뜬다.
    expect(mediaMocks.captureConsultCamera).toHaveBeenCalled();
    expect(mediaMocks.holdConsultCamera).toHaveBeenCalled();
    expect(mediaMocks.releaseConsultMedia).not.toHaveBeenCalled();
    /*
      전역 권한 상태는 그대로다. 이 화면이 확보한 것은 이 상담에 넘길 목소리와 영상이지
      브라우저가 준 카메라·마이크 권한이 아니다.
    */
    expect(usePermissionStore.getState().granted).toEqual({
      loc: true,
      cam: false,
      mic: false,
    });
    expect(apiMocks.createConsultation).toHaveBeenCalledWith(
      expect.objectContaining({
        userSessionId: 'session-1',
        currentNodeId: 107,
        videoConsent: true,
        audioConsent: true,
        locationConsent: true,
      }),
    );
    const request = apiMocks.createConsultation.mock.calls[0]?.[0];
    expect(request).not.toHaveProperty('destinationId');
    expect(request).not.toHaveProperty('destinationType');
  });

  /**
   * 대기 화면에서 기기 뒤로가기로 되돌아오면 이 화면에 도착한다. (S15P11A206-353)
   *
   * 취소 버튼을 거치지 않았으므로 서버의 상담은 대기열에 그대로 남아 있다. 상담자가 수락해도
   * 사용자는 이미 이 화면에 있어 아무 응답이 없다. 대기 화면 쪽에서는 잡을 수 없는 통로라
   * (StrictMode·popstate 제약) 도착하는 이 화면이 거둬들인다.
   */
  it('대기 화면에서 되돌아오면 남은 상담을 거둬들인다', async () => {
    useConsultStore.setState({ issue: 0, consultationId: 'consultation-1' });

    renderPage();

    await waitFor(() =>
      expect(apiMocks.cancelConsultation).toHaveBeenCalledWith('consultation-1', 'session-1'),
    );
    expect(mediaMocks.releaseConsultMedia).toHaveBeenCalled();
    await waitFor(() => expect(useConsultStore.getState().consultationId).toBeNull());
    // 문의 유형은 그대로 남아 이 화면에서 다시 연결할 수 있다.
    expect(useConsultStore.getState().issue).toBe(0);
    expect(screen.getByRole('heading', { name: '무엇을 공유할지 정해주세요' })).toBeInTheDocument();
  });

  /** 앞으로 나아가는 길에서는 방금 만든 상담을 거둬들이지 않는다. */
  it('상담을 만든 직후에는 취소하지 않는다', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '동의하고 상담 연결' }));

    expect(await screen.findByText('상담 대기 화면')).toBeInTheDocument();
    expect(apiMocks.cancelConsultation).not.toHaveBeenCalled();
  });

  it('마이크를 거절하면 상담을 만들지 않는다', async () => {
    mediaMocks.captureConsultMicrophone.mockRejectedValue(
      Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }),
    );

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '동의하고 상담 연결' }));

    expect(await screen.findByRole('dialog', { name: '음성 공유가 필요해요' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('상담하려면 마이크를 허용해 주세요.');
    // 목소리를 얻지 못했으면 카메라도 열지 않는다.
    expect(mediaMocks.captureConsultCamera).not.toHaveBeenCalled();
    expect(apiMocks.createConsultation).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(usePermissionStore.getState().granted).toEqual({
        loc: true,
        cam: false,
        mic: false,
      }),
    );
  });

  /**
   * 필수 항목은 끌 수 없으므로 스위치를 두지 않는다.
   *
   * 해제할 수 없는 것에 스위치를 달면 고르는 시늉만 하게 되고, 사용자는 껐다고 믿은 항목이
   * 그대로 전달되는 것을 나중에 알게 된다.
   */
  it('필수 항목은 스위치 없이 알리고 카메라만 끄고 켤 수 있다', () => {
    renderPage();

    // 음성과 현재 위치. 화면 공유는 목록에 없다.
    expect(screen.getAllByText('필수')).toHaveLength(2);
    expect(screen.queryByText('화면')).not.toBeInTheDocument();

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(1);
    expect(switches[0]).toHaveAccessibleName('카메라 공유');
    // 상담자가 눈앞 상황을 보며 안내하는 것이 이 서비스가 그리는 흐름이다.
    expect(switches[0]).toBeChecked();
  });

  /** 동의 시점에 알려야 의미가 있다(NFR-PR-002). */
  it('저장하지 않는다는 사실을 동의 전에 알린다', () => {
    renderPage();

    expect(screen.getByText('상담 영상과 음성은 저장하지 않아요.')).toBeInTheDocument();
  });

  /**
   * 예전에는 `videoConsent: true` 를 박아 두어, 아무것도 고르지 않은 사용자가 전부 동의한
   * 것으로 기록됐다.
   */
  it('카메라를 끄면 잡지 않고 동의하지 않은 것으로 보낸다', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('switch', { name: '카메라 공유' }));
    fireEvent.click(screen.getByRole('button', { name: '동의하고 상담 연결' }));

    expect(await screen.findByText('상담 대기 화면')).toBeInTheDocument();
    expect(mediaMocks.captureConsultCamera).not.toHaveBeenCalled();
    // 보내는 스트림에도 영상이 담기지 않는다.
    expect(mediaMocks.composeConsultMedia).toHaveBeenCalledWith(expect.anything(), null);
    expect(apiMocks.createConsultation).toHaveBeenCalledWith(
      expect.objectContaining({ videoConsent: false, audioConsent: true }),
    );
  });

  it('카메라를 켜 두면 확보한 뒤 동의한 것으로 보낸다', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '동의하고 상담 연결' }));

    expect(await screen.findByText('상담 대기 화면')).toBeInTheDocument();
    expect(mediaMocks.captureConsultCamera).toHaveBeenCalled();
    expect(apiMocks.createConsultation).toHaveBeenCalledWith(
      expect.objectContaining({ videoConsent: true }),
    );
  });

  /** 켜 두었어도 확보하지 못했으면 보내지 않는다. 기록과 실제가 어긋나면 안 된다. */
  it('카메라를 켜 두었어도 확보에 실패하면 동의하지 않은 것으로 보낸다', async () => {
    mediaMocks.captureConsultCamera.mockRejectedValue(new Error('no camera'));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '동의하고 상담 연결' }));

    expect(await screen.findByText('상담 대기 화면')).toBeInTheDocument();
    expect(apiMocks.createConsultation).toHaveBeenCalledWith(
      expect.objectContaining({ videoConsent: false }),
    );
  });

  /**
   * 화면 공유는 데스크톱 브라우저에만 있다.
   *
   * 모바일에는 `getDisplayMedia` 함수 자체가 없어 부르는 순간 `TypeError` 가 난다. 그걸
   * 거절로 읽었더니, 사용자가 아무것도 거부하지 않았는데 "모두 동의해주세요" 대화상자가 떴다.
   * 줄 수 없는 것은 아예 묻지 않는다.
   */
  it('화면 공유를 요구하지 않아 모바일에서도 상담으로 넘어간다', async () => {
    const getDisplayMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getDisplayMedia },
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '동의하고 상담 연결' }));

    expect(await screen.findByText('상담 대기 화면')).toBeInTheDocument();
    expect(getDisplayMedia).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('returns to issue selection instead of showing an internal error when no issue exists', async () => {
    useConsultStore.setState({ issue: null });

    renderPage();

    expect(await screen.findByText('문제 유형 선택 화면')).toBeInTheDocument();
    expect(screen.queryByText('사용자 세션 또는 상담 유형을 확인해 주세요.')).toBeNull();
  });

  it('offers to prepare the session again instead of locking the button', () => {
    useUserSessionStore.setState({ userSessionId: null, expiresAt: undefined });

    renderPage();

    // 세션이 없으면 연결 버튼이 준비 재시도 버튼으로 바뀐다. 잠긴 버튼으로 막히면
    // 통신 실패 한 번에 상담 요청 자체가 불가능해진다.
    expect(screen.getByRole('button', { name: '상담 연결 준비하기' })).toBeEnabled();
    expect(screen.queryByText('사용자 세션 또는 상담 유형을 확인해 주세요.')).toBeNull();
  });
});
