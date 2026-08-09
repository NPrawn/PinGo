import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
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

/** 대기 화면을 떠난 뒤 기록에 무엇이 남았는지 확인하는 용도다. */
function BackButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate(-1)}>
      테스트 뒤로가기
    </button>
  );
}

/** 상담 신청 흐름을 그대로 밟고 대기 화면에 서 있는 상태. (S15P11A206-353) */
const CONSULT_FLOW_ENTRIES = [
  USER_ROUTES.NAVIGATION,
  USER_ROUTES.CONSULT_REQUEST,
  USER_ROUTES.CONSULT_PERMISSION,
  USER_ROUTES.CONSULT_WAITING,
];

function renderPage(entries: string[] = [USER_ROUTES.CONSULT_WAITING]) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route path={USER_ROUTES.CONSULT_WAITING} element={<ConsultWaitingPage />} />
        <Route path={USER_ROUTES.PERMISSION} element={<div>권한 요청 화면</div>} />
        <Route path={USER_ROUTES.CONSULT_REQUEST} element={<div>문제 유형 선택 화면</div>} />
        <Route path={USER_ROUTES.CONSULT_PERMISSION} element={<div>공유 동의 화면</div>} />
        <Route path={USER_ROUTES.CONSULT_SESSION} element={<div>상담 화면</div>} />
        <Route path={USER_ROUTES.STATION} element={<div>역 선택 화면</div>} />
        <Route
          path={USER_ROUTES.NAVIGATION}
          element={
            <div>
              길안내 화면
              <BackButton />
            </div>
          }
        />
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

    // 상담 CTA를 거치지 않은 상태라 돌아갈 자리를 모른다 — 역 선택으로 간다.
    expect(await screen.findByText('역 선택 화면')).toBeInTheDocument();
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

  /**
   * 취소는 한 단계 되돌리기가 아니라 신청을 접는 것이다. (S15P11A206-353)
   *
   * 앞 화면(공유 동의)으로 보내면 방금 취소한 상담을 다시 만드는 버튼 앞에 서게 되고, 문의
   * 유형 화면으로 보내면 그만둔 사람에게 유형을 다시 고르라고 내미는 셈이 된다.
   */
  it('취소하면 상담을 시작한 화면으로 되돌린다', async () => {
    useConsultStore.setState({ entryRoute: USER_ROUTES.NAVIGATION });

    renderPage(CONSULT_FLOW_ENTRIES);
    await userEvent.click(await screen.findByRole('button', { name: '요청 취소' }));

    expect(apiMocks.cancelConsultation).toHaveBeenCalledWith('cs_1', 'session-1');
    expect(await screen.findByText('길안내 화면')).toBeInTheDocument();
    expect(releaseConsultMedia).toHaveBeenCalled();
    expect(useConsultStore.getState().consultationId).toBeNull();
  });

  /**
   * 신고된 증상 그대로의 시나리오. (S15P11A206-353)
   *
   * 예전에는 취소 후 이동을 push로 해서 대기 화면이 기록에 남았다. 거기서 뒤로가기를 누르면
   * "상담원 연결 중"이 다시 떠, 사용자에게는 상담이 재신청된 것처럼 보였다.
   */
  it('취소한 뒤 뒤로가기로 대기 화면에 되돌아가지 않는다', async () => {
    useConsultStore.setState({ entryRoute: USER_ROUTES.NAVIGATION });

    renderPage(CONSULT_FLOW_ENTRIES);
    await userEvent.click(await screen.findByRole('button', { name: '요청 취소' }));
    expect(await screen.findByText('길안내 화면')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '테스트 뒤로가기' }));

    expect(await screen.findByText('공유 동의 화면')).toBeInTheDocument();
    expect(screen.queryByText('CONNECTING · 상담 대기 중')).not.toBeInTheDocument();
  });

  /** 상담자가 거둬들인 경우도 사용자가 취소한 것과 결과가 같다. */
  it('상담자가 취소하면 상담을 시작한 화면으로 되돌린다', async () => {
    useConsultStore.setState({ entryRoute: USER_ROUTES.NAVIGATION });
    let canceledListener: EventListener | undefined;
    apiMocks.subscribeToConsultationWaitingEvents.mockReturnValue({
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        if (type === 'CANCELED') canceledListener = listener;
      }),
      close: vi.fn(),
    } as unknown as EventSource);

    renderPage(CONSULT_FLOW_ENTRIES);
    expect(await screen.findByText('CONNECTING · 상담 대기 중')).toBeInTheDocument();

    await act(async () => {
      canceledListener?.({ data: JSON.stringify({}) } as MessageEvent);
      await Promise.resolve();
    });

    expect(await screen.findByText('길안내 화면')).toBeInTheDocument();
  });

  /**
   * 기다릴 상담이 없는 채로 닿은 경우. (S15P11A206-353)
   *
   * 주소로 직접 들어오면 끝나지 않는 "상담원 연결 중" 화면이 그대로 보여, 사용자는 신청된
   * 줄 알고 계속 기다렸다.
   */
  it('기다릴 상담이 없으면 문의 유형 화면으로 내보낸다', async () => {
    useConsultStore.setState({ consultationId: null });

    renderPage();

    expect(await screen.findByText('문제 유형 선택 화면')).toBeInTheDocument();
    expect(apiMocks.subscribeToConsultationWaitingEvents).not.toHaveBeenCalled();
  });
});
