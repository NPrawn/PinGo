import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
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

/**
 * Permissions API를 흉내낸다. 브라우저가 권한을 어떻게 기억하고 있는지를 정한다.
 *
 * 이것을 세우지 않으면 조회가 실패해 상태를 알 수 없는 브라우저(Safari 등)가 된다. 그때는
 * 아무것도 막지 않는 것이 정상이므로, 차단 동작을 확인하려면 반드시 세워야 한다.
 */
function stubPermissionStates(states: Record<string, 'granted' | 'prompt' | 'denied'>) {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: {
      query: vi.fn(({ name }: { name: string }) =>
        states[name]
          ? Promise.resolve({ state: states[name], onchange: null })
          : Promise.reject(new TypeError(`unsupported permission: ${name}`)),
      ),
    },
  });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'geolocation');
  Reflect.deleteProperty(navigator, 'mediaDevices');
  Reflect.deleteProperty(navigator, 'permissions');
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
   * 경로 옵션 화면은 출발 노드와 **목적지 좌표**가 있어야 조회를 건다. 유형마다 나갈 출구를
   * 그 좌표로 찾기 때문이다(`useExitRoute`). 세워 두지 않으면 사용자가 아직 할 일이 남은
   * 상태로 읽혀 안내 문구만 뜬다.
   *
   * 출발 노드는 V8 시드의 B3 승강장(205)이고, 도착 노드·출구 이름은 경로 유형을 고르는
   * 순간 화면이 덮어쓴다. 여기 값은 안내 화면이 단독으로 열릴 때 쓰는 초기값이다.
   *
   * 좌표는 B2 대합실 통로 위, 어느 시설과도 30m 이상 떨어진 지점이다. **원점 `(0, 0)`을 쓰지
   * 않는다** — 그 자리는 좌표계 기준인 `B2-B3 엘리베이터 B`라 시설 마커와 정확히 겹친다.
   * `floorId` 1이 B2다(auto-increment라 층 순서와 다르다).
   */
  beforeEach(() => {
    useNavigationStore.setState({
      currentNodeId: 205,
      targetNodeId: 325,
      targetExitLabel: '7번 출입구',
      destinationLatitude: 37.5007,
      destinationLongitude: 127.0365,
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

  /**
   * 위치를 거부해도 카메라·마이크는 마저 묻는다.
   *
   * 예전에는 위치에서 멈춰 나머지 두 줄이 `미요청`으로 남았다. 세 권한이 모두 있어야
   * 진입할 수 있으므로 사용자는 어차피 전부 처리해야 하는데, 무엇이 남았는지 한 번에 알 수
   * 없으니 같은 화면을 여러 번 통과하게 된다.
   */
  it('marks location refused and still asks for camera and microphone', async () => {
    stubPermissionEnvironment({ location: 'denied', media: 'granted' });
    await renderSection('/user/permission');

    fireEvent.click(await screen.findByRole('button', { name: '권한 허용하고 시작하기' }));

    await screen.findByRole('dialog', { name: '모든 권한이 필요해요' });
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]).getByText('거부됨')).toBeInTheDocument();
    expect(within(rows[1]).getByText('허용됨')).toBeInTheDocument();
    expect(within(rows[2]).getByText('허용됨')).toBeInTheDocument();
  });

  /**
   * 권한 화면을 통과한 뒤 브라우저 설정에서 권한을 꺼도 서비스가 그대로 돌아가던 문제.
   *
   * 세 권한을 모두 요구하기로 한 이상, 도중에 사라진 권한도 처음부터 없었던 것과 같게 다뤄야
   * 한다. 카메라가 꺼진 채 촬영 화면이 열리거나 마이크 없이 상담이 연결되면 안 된다.
   */
  it('sends the user back when a permission is revoked mid-flow', async () => {
    usePermissionStore.setState({ granted: { loc: true, cam: true, mic: true } });
    stubPermissionStates({ geolocation: 'granted', camera: 'denied', microphone: 'granted' });

    await renderSection('/user/station');

    expect(
      await screen.findByRole('heading', { name: /이용에 필요한 권한을/ }),
    ).toBeInTheDocument();
    // 공유 상태도 실제 권한을 따라가야 한다. 상담·설정 화면이 이 값을 읽는다.
    await waitFor(() => expect(usePermissionStore.getState().granted.cam).toBe(false));
  });

  it('keeps the flow open while every permission is still granted', async () => {
    stubPermissionStates({ geolocation: 'granted', camera: 'granted', microphone: 'granted' });

    await renderSection('/user/station');

    expect(
      await screen.findByRole('heading', { name: '오늘은 어디로 가시나요?' }),
    ).toBeInTheDocument();
  });

  /** 조회할 수 없는 브라우저에서 모르는 것을 없는 것으로 치면 멀쩡한 사용자까지 막힌다. */
  it('does not block when the browser cannot report permission state', async () => {
    await renderSection('/user/station');

    expect(
      await screen.findByRole('heading', { name: '오늘은 어디로 가시나요?' }),
    ).toBeInTheDocument();
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
   * 경로 유형마다 나가는 출입구가 다르다. (S15P11A206-303)
   *
   * 최단 경로는 목적지에서 가장 가까운 출구로, 엘리베이터 우선은 계단 없이 닿는 출구 중
   * 가장 가까운 곳으로 나간다. 화면이 정하지 않고 `POST /api/destinations/nearest-exit`가
   * `accessibleOnly` 여부에 따라 서로 다른 출구를 고른다.
   */
  it('경로 유형마다 서로 다른 출입구를 안내한다', async () => {
    useNavigationStore.setState({ route: 'fastest', destination: '강남파이낸스센터' });
    await renderSection('/user/route');

    const fastest = await screen.findByRole('button', { name: /최단 경로/ });
    const elevator = await screen.findByRole('button', { name: /엘리베이터 우선/ });

    // 전체 출구에서 고른 결과와, 엘리베이터로 닿는 출구만 두고 고른 결과가 다르다.
    expect(within(fastest).getByText('7번 출입구')).toBeInTheDocument();
    expect(within(elevator).getByText('3번 출입구')).toBeInTheDocument();
    // 어디로 나가서 어디로 가는지가 한 줄로 읽힌다.
    expect(within(fastest).getAllByText('강남파이낸스센터').length).toBeGreaterThan(0);
  });

  /**
   * 경로 옵션 화면. (S15P11A206-323)
   *
   * 시간·거리는 `POST /api/routes/indoor/options` 응답에서 온다. 유형별로 도착 노드가
   * 다르므로 조회도 유형별로 따로 나간다.
   */
  it('경로 옵션을 조회 응답으로 그린다', async () => {
    await renderSection('/user/route');

    const fastest = await screen.findByRole('button', { name: /최단 경로/ });

    expect(fastest).toHaveAttribute('aria-pressed', 'true');
    // estimatedTimeSec 240 → 4분, totalDistanceM 180 → 180m
    expect(within(fastest).getByText('4분')).toBeInTheDocument();
    expect(within(fastest).getByText('180m')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '7번 출입구 길 안내 시작' })).toBeInTheDocument();
    expect(screen.getByText('출발지')).toBeInTheDocument();
    expect(screen.getByText('목적지')).toBeInTheDocument();
  });

  /**
   * 계단 없이 닿는 출구가 있으면 엘리베이터 경로도 고를 수 있다.
   *
   * 예전에는 두 유형이 같은 도착 노드를 써서, 그 노드가 계단으로만 닿으면 엘리베이터 경로가
   * 늘 도달 불가로 나왔다. 실제로는 갈 수 있는 다른 출구가 있는데도 없다고 안내한 셈이다.
   */
  it('엘리베이터 우선 경로를 고르면 그 유형의 출구로 도착점이 바뀐다', async () => {
    await renderSection('/user/route');

    const elevator = await screen.findByRole('button', { name: /엘리베이터 우선/ });
    expect(elevator).toBeEnabled();

    fireEvent.click(elevator);

    expect(useNavigationStore.getState().route).toBe('elevator_only');
    expect(screen.getByRole('status')).toHaveTextContent('엘리베이터 우선로 설정했습니다.');
    // 도착 노드도 그 출구로 옮겨간다. 안내 화면이 이 값으로 상세 경로를 조회한다.
    await waitFor(() => expect(useNavigationStore.getState().targetNodeId).toBe(153));
    expect(useNavigationStore.getState().targetExitLabel).toBe('3번 출입구');
    expect(
      await screen.findByRole('link', { name: '3번 출입구 길 안내 시작' }),
    ).toBeInTheDocument();
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

    expect(await screen.findByText('이 역은 아직 실내 경로가 없어요')).toBeInTheDocument();
    expect(screen.queryByText('경로를 찾고 있어요')).toBeNull();
    expect(screen.queryByRole('link', { name: /안내 시작/ })).toBeNull();
    // 막다른 화면으로 두지 않는다. 빠져나갈 길을 함께 준다.
    expect(screen.getByRole('link', { name: '다른 역 선택하기' })).toBeInTheDocument();
  });

  /** 위 구분이 로딩 표시 자체를 잃지 않았는지 함께 고정한다. */
  it('실제로 조회하는 동안에는 로딩을 보여준다', async () => {
    renderAt('/user/route');

    expect(await screen.findByText('경로를 찾고 있어요')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /최단 경로/ })).toBeInTheDocument();
    expect(screen.queryByText('경로를 찾고 있어요')).toBeNull();
  });

  /**
   * 데이터가 없어도 화면이 무너지지 않아야 한다.
   *
   * 카드가 채우던 자리에 문구 한 줄만 남기면 패널에 빈 칸이 생긴다. 이유와 다음 행동을 함께
   * 주는 블록으로 그 자리를 채운다.
   */
  it('목적지 좌표가 없으면 이유와 다음 행동을 함께 보여준다', async () => {
    useNavigationStore.setState({
      destination: '스타벅스 역삼점',
      destinationLatitude: null,
      destinationLongitude: null,
    });

    renderAt('/user/route');

    const empty = await screen.findByRole('alert');
    expect(within(empty).getByText('목적지 위치를 알 수 없어요')).toBeInTheDocument();
    expect(within(empty).getByText(/스타벅스 역삼점의 좌표를/)).toBeInTheDocument();
    expect(within(empty).getByRole('link', { name: '목적지 다시 선택하기' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /안내 시작/ })).toBeNull();
  });

  /**
   * 물러난 선택은 스토어에도 남아야 한다.
   *
   * 안내·도착 화면은 스토어의 `route`와 `targetExitLabel`로 목적지를 적는다. 화면만 갈 수 있는
   * 경로로 옮기고 스토어를 두면, 헤더에 엘리베이터 경로의 출구가 적힌 채 최단 경로로 안내한다.
   */
  it('고른 경로가 도달 불가면 갈 수 있는 경로로 물러나고 스토어도 따라간다', async () => {
    // 계단 없이 나갈 수 있는 출구가 하나도 없는 역을 흉내낸다.
    server.use(
      http.post('*/api/destinations/nearest-exit', async ({ request }) => {
        const body = (await request.json()) as { accessibleOnly?: boolean };
        if (body.accessibleOnly) {
          return HttpResponse.json(
            {
              success: false,
              code: 'EXIT_LOCATION_NOT_FOUND',
              message: '출구를 찾을 수 없습니다.',
            },
            { status: 404 },
          );
        }

        return HttpResponse.json({
          success: true,
          data: { exitFacilityId: 25, exitNumber: '7' },
        });
      }),
    );
    useNavigationStore.setState({ route: 'elevator_only' });

    await renderSection('/user/route');

    const elevator = await screen.findByRole('button', { name: /엘리베이터 우선/ });
    expect(elevator).toBeDisabled();
    expect(
      within(elevator).getByText('계단 없이 나갈 수 있는 출입구가 없어요.'),
    ).toBeInTheDocument();

    const fastest = screen.getByRole('button', { name: /최단 경로/ });
    expect(fastest).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: '7번 출입구 길 안내 시작' })).toBeInTheDocument();
    await waitFor(() => expect(useNavigationStore.getState().route).toBe('fastest'));
  });

  it('prioritizes the route header and current maneuver during navigation', async () => {
    useNavigationStore.setState({
      destination: 'GS25 역삼역점',
      route: 'elevator_only',
      // 경로 옵션 화면에서 엘리베이터 우선을 고르면 그 유형의 출구가 여기 남는다.
      targetExitLabel: '2번 출입구',
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
    /**
     * 안내 문구는 경로 응답의 첫 구간에서 온다.
     *
     * 예전에는 경로를 모를 때도 `직진 25m`·`개찰구를 지나 에스컬레이터 방향으로 이동`을
     * 그대로 띄웠다. 사용자는 그것을 실제 안내로 읽고 그 방향으로 걷는다.
     */
    /**
     * 안내 문구는 경로 응답의 첫 구간에서 온다.
     *
     * 예전에는 경로를 모를 때도 `직진 25m`·`개찰구를 지나 에스컬레이터 방향으로 이동`을
     * 그대로 띄웠다. 사용자는 그것을 실제 안내로 읽고 그 방향으로 걷는다.
     */
    expect(await screen.findByText('개찰구 방향으로 25m 직진하세요')).toBeInTheDocument();
    expect(screen.getByText('다음 안내 · 경로 업데이트 완료')).toBeInTheDocument();
    expect(screen.getByText('총 224m · 약 5분')).toBeInTheDocument();
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
