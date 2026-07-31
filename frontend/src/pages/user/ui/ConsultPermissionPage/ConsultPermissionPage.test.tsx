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

vi.mock('@/shared/api', () => ({
  ApiError: class ApiError extends Error {},
  createConsultation: apiMocks.createConsultation,
}));

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

  it('requests real camera and microphone access before creating a consultation', async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop }],
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '동의하고 상담 연결' }));

    expect(await screen.findByText('상담 대기 화면')).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledWith({ video: true, audio: true });
    expect(stop).toHaveBeenCalled();
    expect(usePermissionStore.getState().granted).toEqual({
      loc: true,
      cam: true,
      mic: true,
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

  it('does not create a consultation when browser media permission is denied', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }),
          ),
      },
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '동의하고 상담 연결' }));

    expect(
      await screen.findByRole('dialog', { name: '화면·음성 공유가 필요해요' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '카메라와 마이크 권한을 모두 허용해 주세요.',
    );
    expect(apiMocks.createConsultation).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(usePermissionStore.getState().granted).toEqual({
        loc: true,
        cam: false,
        mic: false,
      }),
    );
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
