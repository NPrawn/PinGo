import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { useUserSessionStore } from '@/entities/user-session';
import { releaseConsultMedia } from '@/features/consult-signaling';
import { usePermissionsRevoked } from '@/features/permissions';
import { USER_ROUTES } from '@/shared/config';
import { ConsultWaitingPage } from './ConsultWaitingPage';

const apiMocks = vi.hoisted(() => ({
  getConsultation: vi.fn(),
  cancelConsultation: vi.fn(),
  subscribeToConsultationWaitingEvents: vi.fn(),
}));

vi.mock('@/shared/api', () => ({
  ApiError: class ApiError extends Error {
    code?: string;
  },
  getConsultation: apiMocks.getConsultation,
  cancelConsultation: apiMocks.cancelConsultation,
  subscribeToConsultationWaitingEvents: apiMocks.subscribeToConsultationWaitingEvents,
}));

vi.mock('@/features/consult-signaling', () => ({ releaseConsultMedia: vi.fn() }));

/** 권한 조회는 이 화면의 관심사가 아니다. 사라졌는지 여부만 테스트가 정한다. */
vi.mock('@/features/permissions', () => ({ usePermissionsRevoked: vi.fn(() => false) }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[USER_ROUTES.CONSULT_WAITING]}>
      <Routes>
        <Route path={USER_ROUTES.CONSULT_WAITING} element={<ConsultWaitingPage />} />
        <Route path={USER_ROUTES.PERMISSION} element={<div>권한 요청 화면</div>} />
        <Route path={USER_ROUTES.CONSULT_REQUEST} element={<div>문제 유형 선택 화면</div>} />
        <Route path={USER_ROUTES.CONSULT_SESSION} element={<div>상담 화면</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ConsultWaitingPage', () => {
  beforeEach(() => {
    useConsultStore.setState({ consultationId: 'cs_1', signalingRoomId: null });
    useUserSessionStore.setState({ userSessionId: 'session-1' });
    apiMocks.getConsultation.mockResolvedValue({ consultationId: 'cs_1', status: 'WAITING' });
    apiMocks.cancelConsultation.mockResolvedValue(undefined);
    apiMocks.subscribeToConsultationWaitingEvents.mockReturnValue({
      addEventListener: vi.fn(),
      close: vi.fn(),
    } as unknown as EventSource);
    vi.mocked(usePermissionsRevoked).mockReturnValue(false);
  });

  afterEach(() => {
    useConsultStore.getState().reset();
    useUserSessionStore.setState({ userSessionId: null, expiresAt: undefined });
    vi.clearAllMocks();
  });

  it('기다리는 동안에는 화면을 그대로 둔다', async () => {
    renderPage();

    expect(await screen.findByText('CONNECTING · 상담 대기 중')).toBeInTheDocument();
    expect(apiMocks.cancelConsultation).not.toHaveBeenCalled();
  });

  /**
   * 대기 중 권한이 사라진 경우.
   *
   * 그냥 떠나면 잡아 둔 장치가 남고, 서버에는 응답할 사람 없는 요청이 대기열에 남아 상담자가
   * 수락한 뒤에야 잘못된 것을 알게 된다.
   */
  it('기다리는 동안 권한이 사라지면 장치를 놓고 요청을 거둬들인다', async () => {
    vi.mocked(usePermissionsRevoked).mockReturnValue(true);

    renderPage();

    expect(await screen.findByText('권한 요청 화면')).toBeInTheDocument();
    expect(releaseConsultMedia).toHaveBeenCalled();
    expect(apiMocks.cancelConsultation).toHaveBeenCalledWith('cs_1', 'session-1');
    await waitFor(() => expect(useConsultStore.getState().consultationId).toBeNull());
  });

  /** 취소가 거절돼도 장치는 이미 놓았고 화면은 넘어가야 한다. */
  it('취소 요청이 실패해도 권한 화면으로 넘어간다', async () => {
    apiMocks.cancelConsultation.mockRejectedValue(new Error('boom'));
    vi.mocked(usePermissionsRevoked).mockReturnValue(true);

    renderPage();

    expect(await screen.findByText('권한 요청 화면')).toBeInTheDocument();
    expect(releaseConsultMedia).toHaveBeenCalled();
  });

  it('CANCELED 이벤트 이후 늦게 도착한 ACCEPTED 응답으로 상담 화면에 진입하지 않는다', async () => {
    let resolveAccepted: ((value: unknown) => void) | undefined;
    let acceptedListener: EventListener | undefined;
    let canceledListener: EventListener | undefined;

    apiMocks.getConsultation
      .mockResolvedValueOnce({ consultationId: 'cs_1', status: 'WAITING' })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveAccepted = resolve;
          }),
      );
    apiMocks.subscribeToConsultationWaitingEvents.mockReturnValue({
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        if (type === 'ACCEPTED') acceptedListener = listener;
        if (type === 'CANCELED') canceledListener = listener;
      }),
      close: vi.fn(),
    } as unknown as EventSource);

    renderPage();
    expect(await screen.findByText('CONNECTING · 상담 대기 중')).toBeInTheDocument();

    await act(async () => {
      acceptedListener?.({ data: JSON.stringify({ signalingRoomId: 'room_1' }) } as MessageEvent);
      await Promise.resolve();
    });
    await act(async () => {
      canceledListener?.({ data: JSON.stringify({}) } as MessageEvent);
      await Promise.resolve();
    });

    expect(await screen.findByText('문제 유형 선택 화면')).toBeInTheDocument();
    await act(async () => {
      resolveAccepted?.({
        consultationId: 'cs_1',
        status: 'ACCEPTED',
        signalingRoomId: 'room_1',
        signalingAccessToken: 'token-1',
      });
      await Promise.resolve();
    });

    expect(screen.queryByText('상담 화면')).not.toBeInTheDocument();
    expect(useConsultStore.getState().consultationId).toBeNull();
    expect(releaseConsultMedia).toHaveBeenCalled();
  });
});
