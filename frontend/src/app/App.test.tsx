import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNavigationStore } from '@/entities/navigation';
import { useConsultStore } from '@/entities/consult';
import { usePermissionStore } from '@/entities/permission';
import { DEFAULT_STATION, DEFAULT_STATION_ID, useStationStore } from '@/entities/station';
import { setAuthSession } from '@/shared/api';
import { i18n } from '@/shared/i18n';
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
  // 언어 전환 테스트가 영어로 바꿔 둔 것을 되돌린다. 남으면 뒤 테스트가 영어 라벨을 만난다.
  void i18n.changeLanguage('ko');
  usePermissionStore.setState({ granted: { loc: false, cam: false, mic: false } });
  // 등록되지 않은 역을 세워 둔 테스트가 뒤 테스트의 지도·시설·경로 조회를 끄지 않도록 되돌린다.
  useStationStore.setState({ station: DEFAULT_STATION, stationId: DEFAULT_STATION_ID });
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
    fireEvent.click(screen.getByRole('link', { name: /관리자/ }));

    expect(await screen.findByRole('heading', { name: 'PinGo 콘솔 로그인' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('아이디'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

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
  /**
   * 위치 인식을 마치고 목적지를 고른 상태로 시작한다.
   *
   * 경로 옵션·안내 화면은 출발·도착 실내 노드가 모두 있어야 조회를 건다(`useIndoorRouteOptions`).
   * 세워 두지 않으면 사용자가 아직 할 일이 남은 상태로 읽혀 안내 문구만 뜬다. 값은 V8 시드의
   * 실제 노드다 — B3 승강장(205)에서 7번 출구(325).
   *
   * 좌표는 B2 대합실 통로 위, 어느 시설과도 30m 이상 떨어진 지점이다. **원점 `(0, 0)`을 쓰지
   * 않는다** — 그 자리는 좌표계 기준인 `B2-B3 엘리베이터 B`라 시설 마커와 정확히 겹친다.
   * `floorId` 1이 B2다(auto-increment라 층 순서와 다르다).
   */
  beforeEach(() => {
    useNavigationStore.setState({
      currentNodeId: 205,
      targetNodeId: 325,
      currentFloorId: 1,
      currentMapX: -30,
      currentMapY: 10,
    });
  });

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

    fireEvent.click(await screen.findByRole('button', { name: /역삼역.*실내 안내 가능/ }));
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

  /**
   * 데이터가 없는 역은 흐름에 들어가기 전에 막는다.
   *
   * 지도·시설·경로 API는 모두 역 id를 요구한다. id가 없는 역을 고르게 두면 조회를 걸 수 없는
   * 상태로 촬영·경로 화면까지 진행하게 된다.
   */
  it('lists stations found only by the external provider without letting them be picked', async () => {
    await renderSection('/user/station');

    expect(await screen.findByRole('heading', { name: '출발지 선택' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('역 이름 검색'), { target: { value: '선릉' } });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));

    const externalRow = await screen.findByRole('button', { name: /선릉역/ });
    expect(externalRow).toBeDisabled();
    expect(within(externalRow).getByText('준비 중')).toBeInTheDocument();
    expect(within(externalRow).getByText('2호선·수인분당선')).toBeInTheDocument();

    // 선택이 막혀 있으니 다음 단계로 넘어가지 않는다.
    fireEvent.click(externalRow);
    expect(useStationStore.getState().station).toBe(DEFAULT_STATION);
    expect(screen.queryByRole('heading', { name: '목적지 선택' })).toBeNull();
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

  /**
   * 층 전환. (S15P11A206-280)
   *
   * 탭 목록은 층별 지도 응답에서 만든다. 프로토타입에 하드코딩돼 있던 `1F`는 역삼역에 등록된
   * 지도가 없어 눌러도 보여줄 것이 없었으므로 목록에서 빠진다.
   */
  it('층 탭은 지도가 있는 층만 보여주고 누르면 표시 층이 바뀐다', async () => {
    await renderSection('/user/navigation');
    fireEvent.click(await screen.findByRole('button', { name: /지도만 보고 이동하기/ }));

    const floorGroup = await screen.findByRole('group', { name: '층 선택' });
    const tabs = within(floorGroup).getAllByRole('button');

    expect(tabs.map((tab) => tab.textContent)).toEqual(['B1', 'B2', 'B3']);

    // 진입 시에는 현재 위치가 있는 층을 따라간다.
    expect(within(floorGroup).getByRole('button', { name: 'B2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(within(floorGroup).getByRole('button', { name: 'B1' }));

    expect(within(floorGroup).getByRole('button', { name: 'B1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(floorGroup).getByRole('button', { name: 'B2' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  /**
   * 목적지 마커. (S15P11A206-79)
   *
   * 이름과 좌표가 같은 곳을 가리켜야 한다. 목업 좌표(3번출구 엘리베이터)에 경로 옵션 화면의
   * 문자열(`7번 출입구`)을 붙여 두면, 3번 출구 자리에 7번이라고 적힌 마커가 그려진다.
   *
   * 역삼역 출구는 B1에 있으므로 B2를 보고 있을 때는 그려지지 않는 것이 정상이다.
   */
  it('목적지 마커는 실제 출구 시설의 이름과 좌표를 쓴다', async () => {
    useNavigationStore.setState({ route: 'fastest' });
    await renderSection('/user/navigation');
    fireEvent.click(await screen.findByRole('button', { name: /지도만 보고 이동하기/ }));

    const floorGroup = await screen.findByRole('group', { name: '층 선택' });

    // B2에는 7번 출구가 없다.
    expect(screen.queryByRole('img', { name: '목적지' })).not.toBeInTheDocument();

    fireEvent.click(within(floorGroup).getByRole('button', { name: 'B1' }));

    const marker = await screen.findByRole('img', { name: '목적지' });

    // 응답의 이름이다. 화면이 들고 있던 `7번 출입구`가 아니다.
    expect(within(marker).getByText('7번 출구')).toBeInTheDocument();
  });

  /**
   * 안내 중 위치 재인식. (S15P11A206-141)
   *
   * U-10 → U-04(촬영·매칭) → U-05(위치 확인) → **U-10** 으로 돌아와야 한다. 표시가 없으면
   * U-05의 기본 CTA가 경로 옵션 선택이라 목적지를 다시 고르는 화면부터 밟게 된다.
   */
  it('안내 중 재인식은 경로 옵션이 아니라 안내로 돌아온다', async () => {
    await renderSection('/user/navigation');
    fireEvent.click(await screen.findByRole('button', { name: /지도만 보고 이동하기/ }));

    fireEvent.click(screen.getByRole('button', { name: '현재 위치 다시 인식' }));
    expect(await screen.findByText('세 방향을 자유롭게 비춰주세요')).toBeInTheDocument();
    expect(useNavigationStore.getState().relocalizing).toBe(true);

    // 촬영·매칭 화면에서 위치 확인 화면으로 넘어가는 것은 FR-U-004의 범위다.
    await renderSection('/user/locate/success');

    expect(
      await screen.findByRole('link', { name: '이 위치에서 안내 계속하기 →' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '이 위치에서 경로 선택하기 →' })).toBeNull();
  });

  it('안내 화면에 돌아오면 재인식 표시가 사라진다', async () => {
    useNavigationStore.setState({ relocalizing: true });

    await renderSection('/user/navigation');

    expect(useNavigationStore.getState().relocalizing).toBe(false);
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

  /**
   * 목적지 좌표를 알면 어느 출구로 나가는지까지 보여준다. (S15P11A206-303)
   *
   * 출구는 화면이 정하지 않고 `POST /api/destinations/nearest-exit`가 고른다.
   */
  it('labels the shortest route with the nearest exit the server picked', async () => {
    useNavigationStore.setState({
      route: 'fastest',
      destination: '역삼전자담배멀티샵',
      destinationLatitude: 37.5007,
      destinationLongitude: 127.0365,
    });
    await renderSection('/user/route');

    const fastest = await screen.findByRole('button', { name: /빠른 경로/ });

    expect(await within(fastest).findByText(/3번 출입구로 나가요/)).toBeInTheDocument();
  });

  /** 좌표가 없으면 가장 가까운 출구를 물을 수 없다. 그 줄만 빠지고 나머지는 그대로다. */
  it('omits the exit line when the destination has no coordinates', async () => {
    useNavigationStore.setState({
      route: 'fastest',
      destinationLatitude: null,
      destinationLongitude: null,
    });
    await renderSection('/user/route');

    const fastest = await screen.findByRole('button', { name: /빠른 경로/ });

    expect(within(fastest).queryByText(/나가요/)).toBeNull();
    expect(within(fastest).getByText('4분')).toBeInTheDocument();
  });

  /**
   * 경로 옵션 화면. (S15P11A206-323)
   *
   * 예전에는 옵션 두 개가 컴포넌트 안 상수 배열이었다. 이제 `POST /api/routes/indoor/options`
   * 응답으로 그리므로, 이름·시간·거리가 모두 응답에서 온 값인지를 본다.
   */
  it('경로 옵션을 조회 응답으로 그린다', async () => {
    await renderSection('/user/route');

    // 응답의 displayName이다. 화면이 들고 있던 `최단 경로`가 아니다.
    const fastest = await screen.findByRole('button', { name: /빠른 경로/ });

    expect(fastest).toHaveAttribute('aria-pressed', 'true');
    // estimatedTimeSec 240 → 4분, totalDistanceM 180 → 180m
    expect(within(fastest).getByText('4분')).toBeInTheDocument();
    expect(within(fastest).getByText('180m')).toBeInTheDocument();
    // FR-U-009 "계단 포함 여부를 표시해야 한다"
    expect(within(fastest).getByText(/계단·에스컬레이터를 지나요/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '빠른 경로 안내 시작' })).toBeInTheDocument();
    expect(screen.getByText('출발지')).toBeInTheDocument();
    expect(screen.getByText('목적지')).toBeInTheDocument();
  });

  /**
   * 도달할 수 없는 옵션은 목록에 남되 고를 수 없다. (명세 8.1)
   *
   * 역삼역은 B1↔B2에 엘리베이터가 없어 B3에서 B1 출구로 가는 `elevator_only`가 실제로
   * `NO_ACCESSIBLE_ROUTE`를 돌려준다. 목록에서 지우면 사용자는 왜 계단으로 안내받는지 모른다.
   */
  it('도달할 수 없는 경로는 사유와 함께 남기고 고를 수 없게 한다', async () => {
    await renderSection('/user/route');

    const elevator = await screen.findByRole('button', { name: /엘리베이터 이용 경로/ });

    expect(elevator).toBeDisabled();
    expect(
      within(elevator).getByText(
        '계단·에스컬레이터를 제외한 경로로는 도착지까지 이동할 수 없습니다.',
      ),
    ).toBeInTheDocument();
    // 갈 수 없으므로 시간·거리를 보여주지 않는다.
    expect(within(elevator).queryByText(/분$/)).toBeNull();

    fireEvent.click(elevator);

    // 눌러도 선택이 옮겨가지 않는다.
    expect(useNavigationStore.getState().route).toBe('fastest');
    expect(screen.getByRole('link', { name: '빠른 경로 안내 시작' })).toBeInTheDocument();
  });

  it('경로를 고르면 응답의 유형이 그대로 저장된다', async () => {
    await renderSection('/user/route');

    fireEvent.click(await screen.findByRole('button', { name: /빠른 경로/ }));

    // 프로토타입 어휘(`fast`)가 아니라 백엔드 RouteType이다.
    expect(useNavigationStore.getState().route).toBe('fastest');
    expect(screen.getByRole('status')).toHaveTextContent('빠른 경로로 설정했습니다.');
    expect(screen.getByRole('link', { name: '상담원 연결' })).toHaveTextContent('?');
  });

  /**
   * 조회를 걸 수 없는 상태와 조회 중을 구분한다.
   *
   * 조회를 끈 쿼리는 `isPending`에 머무르므로 그것을 로딩으로 읽으면 화면이 로딩 문구에서
   * 영구히 멈춘다. 역 선택에서 등록되지 않은 역을 막아 두었지만, 스토어 타입이 `null`을
   * 허용하는 동안 화면도 그 상태를 스스로 설명해야 한다.
   */
  it('등록되지 않은 역에서는 로딩에 갇히지 않는다', async () => {
    useStationStore.setState({ station: '선릉역', stationId: null });

    renderAt('/user/route');

    expect(await screen.findByText('이 역은 아직 실내 경로 정보가 없어요.')).toBeInTheDocument();
    expect(screen.queryByText('경로를 찾고 있어요…')).toBeNull();
    expect(screen.queryByRole('link', { name: /안내 시작/ })).toBeNull();
  });

  /** 위 구분이 로딩 표시 자체를 잃지 않았는지 함께 고정한다. */
  it('실제로 조회하는 동안에는 로딩을 보여준다', async () => {
    renderAt('/user/route');

    expect(await screen.findByText('경로를 찾고 있어요…')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /빠른 경로/ })).toBeInTheDocument();
    expect(screen.queryByText('경로를 찾고 있어요…')).toBeNull();
  });

  /**
   * 물러난 선택은 스토어에도 남아야 한다.
   *
   * 안내·도착 화면은 스토어의 `route`로 출구를 정한다. 화면만 갈 수 있는 경로로 옮기고
   * 스토어를 두면, CTA에 "빠른 경로"라고 적힌 채 엘리베이터 경로의 출구로 안내한다.
   */
  it('고른 경로가 도달 불가면 갈 수 있는 경로로 물러나고 스토어도 따라간다', async () => {
    useNavigationStore.setState({ route: 'elevator_only' });

    await renderSection('/user/route');

    const fastest = await screen.findByRole('button', { name: /빠른 경로/ });
    expect(fastest).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: '빠른 경로 안내 시작' })).toBeInTheDocument();
    await waitFor(() => expect(useNavigationStore.getState().route).toBe('fastest'));
  });

  it('prioritizes the route header and current maneuver during navigation', async () => {
    useNavigationStore.setState({
      destination: 'GS25 역삼역점',
      route: 'elevator_only',
      waypoints: ['화장실', '승차권 충전'],
    });
    await renderSection('/user/navigation');

    /**
     * 경로 안내는 XR 세션 안내부터 시작한다. 11.7이 "세션을 자동으로 열지 않고 안내 후
     * 사용자가 확인을 누르면 연다"로 확정했으므로, 지도 조작을 확인하려면 먼저 이 안내를
     * 지나야 한다. 여기서는 추적 없이 계속하는 쪽을 고른다 — 세션을 열지 않아도 경로 안내가
     * 완결되어야 한다는 것이 11.7의 원칙이고, 그 경로를 이 테스트가 함께 고정한다.
     */
    fireEvent.click(await screen.findByRole('button', { name: /지도만 보고 이동하기/ }));

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

    /**
     * 시설 마커는 유형 필터를 켠 뒤에 나타난다. 기본으로 전부 그리지 않는 이유는 밀도다 —
     * 역삼역 B2는 실제 240m 폭이 이 지도에서 287px에 들어가 시설 36개를 모두 그리면 마커가
     * 서로를 덮는다(FR-U-006 점진적 공개). 좌표는 시설 조회 응답에서 온다.
     */
    fireEvent.click(screen.getByRole('button', { name: '승차권 충전 필터 적용' }));
    fireEvent.click(await screen.findByRole('button', { name: '승차권 충전' }));
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

    fireEvent.click(screen.getByRole('button', { name: '엘리베이터 필터 적용' }));
    fireEvent.click(await screen.findByRole('button', { name: '엘리베이터' }));
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
