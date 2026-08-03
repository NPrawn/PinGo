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
}));

const mediaMocks = vi.hoisted(() => ({
  canShareConsultScreen: vi.fn(),
  captureConsultMedia: vi.fn(),
  holdConsultMedia: vi.fn(),
  releaseConsultMedia: vi.fn(),
  captureConsultCamera: vi.fn(),
  holdConsultCamera: vi.fn(),
}));

vi.mock('@/shared/api', () => ({
  ApiError: class ApiError extends Error {},
  createConsultation: apiMocks.createConsultation,
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
    mediaMocks.canShareConsultScreen.mockReturnValue(true);
    mediaMocks.captureConsultMedia.mockResolvedValue({
      getAudioTracks: () => [{ kind: 'audio' }],
    } as unknown as MediaStream);
    // 카메라는 셀프뷰로 쓴다. 상담자에게 따로 보내지 않지만 여기서 함께 확보한다.
    mediaMocks.captureConsultCamera.mockResolvedValue({
      getVideoTracks: () => [{ kind: 'video' }],
    } as unknown as MediaStream);
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
   * 화면 선택 창은 버튼을 누른 직후에만 열 수 있다. 상담이 연결된 뒤로 미루면 브라우저가
   * 거절해 사용자 화면이 상담자에게 끝내 전달되지 않는다.
   */
  it('상담을 요청하기 전에 화면 공유를 확보해 상담 화면으로 넘긴다', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '동의하고 상담 연결' }));

    expect(await screen.findByText('상담 대기 화면')).toBeInTheDocument();
    expect(mediaMocks.captureConsultMedia).toHaveBeenCalled();
    expect(mediaMocks.holdConsultMedia).toHaveBeenCalled();
    // 카메라도 여기서 잡아 둬야 상담 화면에 셀프뷰가 뜬다.
    expect(mediaMocks.captureConsultCamera).toHaveBeenCalled();
    expect(mediaMocks.holdConsultCamera).toHaveBeenCalled();
    expect(mediaMocks.releaseConsultMedia).not.toHaveBeenCalled();
    /*
      전역 권한 상태는 그대로다. 이 화면이 확보한 것은 이 상담에 넘길 화면과 목소리이지
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
      }),
    );
    const request = apiMocks.createConsultation.mock.calls[0]?.[0];
    expect(request).not.toHaveProperty('destinationId');
    expect(request).not.toHaveProperty('destinationType');
  });

  it('화면 공유를 거절하면 상담을 만들지 않는다', async () => {
    mediaMocks.captureConsultMedia.mockRejectedValue(
      Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }),
    );

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '동의하고 상담 연결' }));

    expect(
      await screen.findByRole('dialog', { name: '화면·음성 공유가 필요해요' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('화면 공유와 마이크를 모두 허용해 주세요.');
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
   * 아직 아무것도 동의하지 않았다.
   *
   * 앞 화면에서 받은 카메라·마이크 권한을 그대로 읽었더니, 사용자가 버튼을 누르기도 전에 두
   * 줄에 초록 체크가 켜져 있었다. 여기서 묻는 것은 "이 상담에 화면과 목소리를 넘기겠는가"라
   * 앞 화면의 답으로 대신할 수 없다.
   */
  it('동의하기 전에는 공유 항목이 선택된 것으로 보이지 않는다', () => {
    usePermissionStore.setState({ granted: { loc: true, cam: true, mic: true } });

    renderPage();

    screen.getAllByRole('button', { name: /공유/ }).forEach((row) => {
      expect(row).toHaveAttribute('aria-pressed', 'false');
    });
  });

  /**
   * 거절한 것과 애초에 할 수 없는 것은 다르다.
   *
   * 모바일 브라우저에는 화면 공유가 없어 `getDisplayMedia` 호출이 즉시 실패한다. 그걸 거절로
   * 읽으면 사용자가 아무것도 거부하지 않았는데 "모두 동의해주세요" 대화상자가 뜬다.
   */
  it('화면 공유를 지원하지 않는 기기에서는 거부 대화상자를 띄우지 않는다', async () => {
    mediaMocks.canShareConsultScreen.mockReturnValue(false);

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '동의하고 상담 연결' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '이 기기의 브라우저는 화면 공유를 지원하지 않아요.',
    );
    expect(
      screen.queryByRole('dialog', { name: '화면·음성 공유가 필요해요' }),
    ).not.toBeInTheDocument();
    expect(mediaMocks.captureConsultMedia).not.toHaveBeenCalled();
    expect(apiMocks.createConsultation).not.toHaveBeenCalled();
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
