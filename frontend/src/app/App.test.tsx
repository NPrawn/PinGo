import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNavigationStore } from '@/entities/navigation';
import { useConsultStore } from '@/entities/consult';
import { usePermissionStore } from '@/entities/permission';
import { setAuthSession } from '@/shared/api';
import { App } from './App';

type GeoSuccess = (position: GeolocationPosition) => void;
type GeoFailure = (error: GeolocationPositionError) => void;

const fakePosition = {
  coords: { latitude: 37.5, longitude: 127.0, accuracy: 10 },
  timestamp: 0,
} as unknown as GeolocationPosition;

/** Geolocation reports a refusal through an error code, not a rejection. */
const deniedPositionError = {
  code: 1,
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
  message: 'User denied geolocation',
} as unknown as GeolocationPositionError;

/** `getUserMedia` refusals surface as a `NotAllowedError`. */
const deniedMediaError = Object.assign(new Error('Permission denied'), {
  name: 'NotAllowedError',
});

/**
 * Puts the browser globals the permission screen reads into a known state.
 *
 * jsdom ships no geolocation or mediaDevices, and `isSecureContext` is not
 * writable, so each case defines exactly what the prompts answer.
 */
function stubPermissionEnvironment({
  location,
  media,
}: {
  location: 'granted' | 'denied';
  media: 'granted' | 'denied';
}) {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });

  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((success: GeoSuccess, failure: GeoFailure) =>
        location === 'granted' ? success(fakePosition) : failure(deniedPositionError),
      ),
    },
  });

  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia:
        media === 'granted'
          ? vi.fn().mockResolvedValue(stream)
          : vi.fn().mockRejectedValue(deniedMediaError),
    },
  });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'geolocation');
  Reflect.deleteProperty(navigator, 'mediaDevices');
  Reflect.deleteProperty(window, 'isSecureContext');
  window.sessionStorage.clear();
  usePermissionStore.setState({ granted: { loc: false, cam: false, mic: false } });
});

function renderAt(path: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function authenticateAs(role: 'COUNSELOR' | 'ADMIN') {
  setAuthSession({
    accessToken: `${role.toLowerCase()}-access-token`,
    accountType: role,
    accountId: 1,
    name: '테스트 계정',
    stationId: role === 'COUNSELOR' ? 1 : undefined,
  });
}

/**
 * `/user`, `/counselor` and `/admin` are lazy chunks. Loading them on demand
 * inside a test can take longer than the default query timeout, so import them
 * up front and let each test only wait for the Suspense fallback to clear.
 */
beforeAll(async () => {
  await Promise.all([import('@/pages/user'), import('@/pages/counselor'), import('@/pages/admin')]);
});

async function renderSection(path: string) {
  renderAt(path);
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
}

describe('App', () => {
  it('renders the home route', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'PinGo' })).toBeInTheDocument();
  });

  it('renders the not found route', () => {
    renderAt('/missing');
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeInTheDocument();
  });

  it('signs into a console from the landing page', async () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: /관리자/ }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('아이디'), { target: { value: 'admin' } });
    fireEvent.change(within(dialog).getByLabelText('비밀번호'), { target: { value: '1234' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '로그인' }));

    expect(await screen.findByRole('heading', { name: '시설 · 출구 관리' })).toBeInTheDocument();
  });

  it('switches language', async () => {
    renderAt('/');
    expect(screen.getByText('지하철 실내 내비게이션')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /English/ }));
    expect(await screen.findByText('Indoor navigation for the subway')).toBeInTheDocument();
  });
});

describe('user routes', () => {
  it('redirects /user to the splash screen', async () => {
    await renderSection('/user');
    expect(await screen.findByRole('link', { name: 'Get Started' })).toBeInTheDocument();
  });

  it('renders the language screen', async () => {
    await renderSection('/user/language');
    expect(await screen.findByRole('heading', { name: /사용할 언어를/ })).toBeInTheDocument();
  });

  it('continues to the station screen once the browser grants every permission', async () => {
    stubPermissionEnvironment({ location: 'granted', media: 'granted' });
    await renderSection('/user/permission');

    fireEvent.click(await screen.findByRole('button', { name: '권한 허용하고 시작하기' }));

    expect(
      await screen.findByRole('heading', { name: '오늘은 어디로 가시나요?' }),
    ).toBeInTheDocument();
    expect(usePermissionStore.getState().granted).toEqual({ loc: true, cam: true, mic: true });
  });

  it('blocks the permission screen when the browser refuses a permission', async () => {
    stubPermissionEnvironment({ location: 'granted', media: 'denied' });
    await renderSection('/user/permission');

    fireEvent.click(await screen.findByRole('button', { name: '권한 허용하고 시작하기' }));

    expect(await screen.findByRole('dialog', { name: '모든 권한이 필요해요' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /이용에 필요한 권한을/ })).toBeInTheDocument();
  });

  it('switches a permission back off in the store when the browser later refuses it', async () => {
    stubPermissionEnvironment({ location: 'granted', media: 'granted' });
    await renderSection('/user/permission');
    fireEvent.click(await screen.findByRole('button', { name: '권한 허용하고 시작하기' }));
    await screen.findByRole('heading', { name: '오늘은 어디로 가시나요?' });
    expect(usePermissionStore.getState().granted).toEqual({ loc: true, cam: true, mic: true });

    cleanup();

    // The user revoked camera and microphone in the browser settings and came
    // back. The store must not keep claiming access it no longer has.
    stubPermissionEnvironment({ location: 'granted', media: 'denied' });
    await renderSection('/user/permission');
    fireEvent.click(await screen.findByRole('button', { name: '권한 허용하고 시작하기' }));

    await screen.findByRole('dialog', { name: '모든 권한이 필요해요' });
    expect(usePermissionStore.getState().granted).toEqual({ loc: true, cam: false, mic: false });
  });

  it('recovers instead of locking the button when the permission API throws', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn(() => {
          throw new Error('geolocation blew up');
        }),
      },
    });
    await renderSection('/user/permission');

    fireEvent.click(await screen.findByRole('button', { name: '권한 허용하고 시작하기' }));

    expect(await screen.findByRole('dialog', { name: '모든 권한이 필요해요' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '권한 허용하고 시작하기' })).toBeEnabled();
  });

  it('marks location refused and leaves camera and microphone unasked', async () => {
    // A refused location short-circuits the flow, so the other two prompts
    // never open and their rows stay empty.
    stubPermissionEnvironment({ location: 'denied', media: 'granted' });
    await renderSection('/user/permission');

    fireEvent.click(await screen.findByRole('button', { name: '권한 허용하고 시작하기' }));

    await screen.findByRole('dialog', { name: '모든 권한이 필요해요' });
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]).getByText('거부됨')).toBeInTheDocument();
    expect(within(rows[1]).getByText('미요청')).toBeInTheDocument();
    expect(within(rows[2]).getByText('미요청')).toBeInTheDocument();
  });

  it('reveals origin, destination, and final confirmation one step at a time', async () => {
    await renderSection('/user/station');

    expect(
      await screen.findByRole('heading', { name: '오늘은 어디로 가시나요?' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '출발지 선택' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '목적지 선택' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /역삼역.*현재 GPS 위치/ }));
    useNavigationStore.setState({ waypoints: ['화장실'] });

    expect(screen.getAllByText('출발지')).not.toHaveLength(0);
    expect(screen.getByText('역삼역')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '목적지 선택' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /GS25 역삼역점/ }));

    expect(useNavigationStore.getState().waypoints).toEqual([]);
    expect(await screen.findByRole('heading', { name: '출발지와 목적지' })).toBeInTheDocument();
    expect(screen.getByLabelText('역삼역에서 GS25 역삼역점까지')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /이 경로로 촬영 시작/ })).toBeInTheDocument();
  });

  it('redirects the legacy analyzing route to the combined capture screen', async () => {
    await renderSection('/user/analyzing');

    expect(await screen.findByText('세 방향을 자유롭게 비춰주세요')).toBeInTheDocument();
    expect(screen.getByText('촬영과 동시에 현재 위치를 찾고 있어요')).toBeInTheDocument();
  });

  it('keeps the camera visible while confirming the matched location', async () => {
    await renderSection('/user/locate/success');

    expect(await screen.findByLabelText('후면 카메라 화면')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '여기가 맞는지 확인해 주세요' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이 위치에서 경로 선택하기 →' })).toBeInTheDocument();
  });

  it('starts portrait recapture from the reroute modal', async () => {
    await renderSection('/user/navigation/reroute');

    fireEvent.click(await screen.findByRole('link', { name: /위치 재인식/ }));

    expect(await screen.findByText('세 방향을 자유롭게 비춰주세요')).toBeInTheDocument();
  });

  it('renders the offline fallback as a reusable modal', async () => {
    await renderSection('/user/offline');

    const offlineDialog = await screen.findByRole('dialog', { name: '인터넷 연결 중' });
    expect(offlineDialog).toHaveTextContent('잠시만 기다려 주세요.');
    expect(screen.queryByRole('button', { name: '오프라인으로 계속' })).toBeNull();
    expect(screen.getByRole('button', { name: /다시 연결/ })).toBeInTheDocument();
  });

  it('shows every route option in a list and updates the selected exit', async () => {
    useNavigationStore.setState({ route: 'fast' });
    await renderSection('/user/route');

    const shortestOption = await screen.findByRole('button', {
      name: /최단 경로/,
    });
    const elevatorOption = screen.getByRole('button', {
      name: /엘리베이터 우선/,
    });

    expect(shortestOption).toHaveAttribute('aria-pressed', 'true');
    expect(elevatorOption).toHaveAttribute('aria-pressed', 'false');
    expect(within(shortestOption).getByText('4분')).toBeInTheDocument();
    expect(within(shortestOption).getByText('180m')).toBeInTheDocument();
    expect(within(shortestOption).getByText('7번 출입구')).toBeInTheDocument();
    expect(within(elevatorOption).getByText('6분')).toBeInTheDocument();
    expect(within(elevatorOption).getByText('240m')).toBeInTheDocument();
    expect(screen.queryByText('후면 카메라')).toBeNull();
    expect(screen.getByText('출발지')).toBeInTheDocument();
    expect(screen.getByText('목적지')).toBeInTheDocument();

    fireEvent.click(elevatorOption);

    expect(elevatorOption).toHaveAttribute('aria-pressed', 'true');
    expect(shortestOption).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('엘리베이터 우선 경로로 설정했습니다.');
    expect(screen.getByRole('link', { name: '2번 출입구 길 안내 시작' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '상담원 연결' })).toHaveTextContent('?');
  });

  it('prioritizes the route header and current maneuver during navigation', async () => {
    useNavigationStore.setState({
      destination: 'GS25 역삼역점',
      route: 'elev',
      waypoints: ['화장실', '승차권 충전'],
    });
    await renderSection('/user/navigation');

    expect(await screen.findByRole('link', { name: '이전 화면으로 돌아가기' })).toBeInTheDocument();
    expect(await screen.findByText('출발지')).toBeInTheDocument();
    expect(screen.getByText('목적지')).toBeInTheDocument();
    const routeHeader = screen.getByLabelText('현재 경로');
    expect(within(routeHeader).getByText('2번 출입구')).toBeInTheDocument();
    expect(within(routeHeader).queryByText('GS25 역삼역점')).toBeNull();
    expect(within(routeHeader).getByText('경유 1')).toBeInTheDocument();
    expect(within(routeHeader).getByText('화장실')).toBeInTheDocument();
    expect(within(routeHeader).getByText('경유 2')).toBeInTheDocument();
    expect(within(routeHeader).getByText('승차권 충전')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '승차권 충전 경로 옵션 열기' }));
    const duplicateDestinationButton = await screen.findByRole('button', {
      name: '경유지로 등록된 장소',
    });
    expect(duplicateDestinationButton).toBeDisabled();
    fireEvent.click(duplicateDestinationButton);
    expect(useNavigationStore.getState().destination).toBe('GS25 역삼역점');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: '승차권 충전 경로 설정' }),
      ).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: '엘리베이터 경로 옵션 열기' }));
    fireEvent.click(await screen.findByRole('button', { name: '새 목적지로 설정' }));
    expect(useNavigationStore.getState().destination).toBe('엘리베이터');
    expect(useNavigationStore.getState().waypoints).toEqual(['화장실', '승차권 충전']);
    expect(within(routeHeader).getByText('엘리베이터')).toBeInTheDocument();
    expect(within(routeHeader).queryByText('2번 출입구')).toBeNull();
    expect(within(routeHeader).getByText('화장실')).toBeInTheDocument();
    expect(within(routeHeader).getByText('승차권 충전')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '목적지를 2번 출입구로 되돌리기' }));
    expect(useNavigationStore.getState().destination).toBe('GS25 역삼역점');
    expect(useNavigationStore.getState().waypoints).toEqual(['화장실', '승차권 충전']);
    expect(within(routeHeader).getByText('2번 출입구')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '목적지를 2번 출입구로 되돌리기' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '화장실 경유지 삭제' }));
    expect(within(routeHeader).queryByText('화장실')).toBeNull();
    expect(within(routeHeader).getByText('승차권 충전')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '승차권 충전 경유지 삭제' }));
    expect(within(routeHeader).queryByText('승차권 충전')).toBeNull();
    expect(screen.getByText('직진 25m')).toBeInTheDocument();
    expect(screen.getByText('개찰구를 지나 에스컬레이터 방향으로 이동')).toBeInTheDocument();
    expect(screen.queryByText(/2번 출입구까지 210m/)).toBeNull();
  });

  it('returns to the station main page after a satisfaction rating', async () => {
    await renderSection('/user/consult/ended');

    fireEvent.click(await screen.findByRole('button', { name: '5점' }));

    expect(
      await screen.findByRole('heading', { name: '오늘은 어디로 가시나요?' }, { timeout: 1500 }),
    ).toBeInTheDocument();
  });
});

describe('counselor routes', () => {
  it('redirects /counselor to login', async () => {
    await renderSection('/counselor');
    expect(await screen.findByRole('heading', { name: 'PinGo 콘솔 로그인' })).toBeInTheDocument();
  });

  it('opens the connecting screen after the API accepts a request', async () => {
    authenticateAs('COUNSELOR');
    await renderSection('/counselor/requests');
    fireEvent.click(await screen.findByRole('button', { name: '상담 수락' }));
    expect(
      await screen.findByRole('heading', { name: '사용자와 연결하고 있어요' }),
    ).toBeInTheDocument();
  });

  it('returns to the API-backed queue after ending the session', async () => {
    authenticateAs('COUNSELOR');
    useConsultStore.setState({ consultationId: 'cs_test', signalingRoomId: null });
    await renderSection('/counselor/session');
    fireEvent.click(await screen.findByRole('button', { name: '상담 종료' }));
    expect(await screen.findByRole('button', { name: '상담 수락' })).toBeInTheDocument();
  });

  it('rejects unknown credentials', async () => {
    await renderSection('/counselor/login');
    fireEvent.change(await screen.findByLabelText('아이디'), { target: { value: 'nobody' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByText('아이디와 비밀번호를 확인해 주세요.')).toBeInTheDocument();
  });
});

describe('admin routes', () => {
  it('redirects /admin to the console sign-in', async () => {
    await renderSection('/admin');
    expect(await screen.findByRole('heading', { name: 'PinGo 콘솔 로그인' })).toBeInTheDocument();
  });

  it('redirects the console root to the facility tab', async () => {
    authenticateAs('ADMIN');
    await renderSection('/admin/console');
    expect(await screen.findByRole('heading', { name: '시설 · 출구 관리' })).toBeInTheDocument();
  });

  it('renders the requested console tab', async () => {
    authenticateAs('ADMIN');
    await renderSection('/admin/console/station');
    expect(await screen.findByRole('heading', { name: '역 관리' })).toBeInTheDocument();
  });

  it('signs an admin into the console', async () => {
    await renderSection('/admin/login');
    fireEvent.change(await screen.findByLabelText('아이디'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByRole('heading', { name: '시설 · 출구 관리' })).toBeInTheDocument();
  });
});
