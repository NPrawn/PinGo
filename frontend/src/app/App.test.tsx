import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { useNavigationStore } from '@/entities/navigation';
import { useConsultStore } from '@/entities/consult';
import { usePermissionStore } from '@/entities/permission';
import { DEFAULT_STATION, DEFAULT_STATION_ID, useStationStore } from '@/entities/station';
import { useUserSessionStore } from '@/entities/user-session';
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
  useUserSessionStore.setState({ userSessionId: null, language: undefined, expiresAt: undefined });
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
      /*
        스토어에 남는 값들을 테스트마다 되돌린다.

        `stepsOpen`과 진행도는 화면을 다시 열어도 남는 것이 정상이다(같은 경로를 이어서 안내한다).
        그래서 앞 테스트가 상세 경로를 펼치거나 걸어간 상태가 뒤 테스트로 넘어간다.
      */
      stepsOpen: false,
      progressKey: null,
      travelledM: 0,
    });
  });

  it('redirects /user to the splash screen', async () => {
    await renderSection('/user');
    expect(await screen.findByRole('link', { name: 'Get Started' })).toBeInTheDocument();
  });

  it('renders the language screen', async () => {
    await renderSection('/user/language');
    expect(
      await screen.findByRole('heading', { name: /Select your\s+preferred language/ }),
    ).toBeInTheDocument();
  });

  it('사용자 웹앱에서 고른 영어를 새 세션과 다음 화면에 적용한다', async () => {
    let requestedLanguage: string | undefined;
    // The backend currently serializes its UTC LocalDateTime without a `Z`.
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1_000)
      .toISOString()
      .replace(/Z$/, '');
    server.use(
      http.post('*/api/user-sessions', async ({ request }) => {
        requestedLanguage = ((await request.json()) as { language?: string }).language;
        return HttpResponse.json({
          success: true,
          data: {
            userSessionId: 'english-user-session',
            language: 'en',
            expiresAt,
          },
        });
      }),
      http.get('*/api/user-sessions/english-user-session', () =>
        HttpResponse.json({
          success: true,
          data: {
            userSessionId: 'english-user-session',
            language: 'en',
            expiresAt,
          },
        }),
      ),
    );

    await renderSection('/user/language');
    fireEvent.click(await screen.findByRole('button', { name: /English/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: /Allow the permissions/ })).toBeInTheDocument();
    expect(requestedLanguage).toBe('en');
    expect(useUserSessionStore.getState()).toMatchObject({
      userSessionId: 'english-user-session',
      language: 'en',
    });
  });

  it('기존 한국어 세션이 있어도 첫 언어 선택에서 영어로 갱신한다', async () => {
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1_000).toISOString();
    const requestedLanguages: string[] = [];
    useUserSessionStore.getState().setSession({
      userSessionId: 'existing-user-session',
      language: 'ko',
      expiresAt,
    });
    server.use(
      http.get('*/api/user-sessions/existing-user-session', async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 30));
        return HttpResponse.json({
          success: true,
          data: {
            userSessionId: 'existing-user-session',
            language: 'ko',
            expiresAt,
          },
        });
      }),
      http.patch('*/api/user-sessions/existing-user-session', async ({ request }) => {
        const language = ((await request.json()) as { language?: string }).language;
        if (language) requestedLanguages.push(language);
        return HttpResponse.json({
          success: true,
          data: {
            userSessionId: 'existing-user-session',
            language: language ?? 'ko',
            expiresAt,
          },
        });
      }),
    );

    await renderSection('/user/language');
    fireEvent.click(await screen.findByRole('button', { name: /English/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: /Allow the permissions/ })).toBeInTheDocument();
    expect(requestedLanguages).toContain('en');
    expect(useUserSessionStore.getState()).toMatchObject({
      userSessionId: 'existing-user-session',
      language: 'en',
    });
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

  /**
   * 권한을 조회할 수 없는 브라우저(Safari 등)에서 전역 상태가 비어 있던 문제.
   *
   * 전역 상태는 Zustand 라 새로고침하면 초기값(전부 거부)으로 돌아간다. 조회가 안 되면
   * 가드가 그 값을 갱신하지 못해, 온보딩에서 권한을 멀쩡히 허용한 사용자가 거부한 사람으로
   * 남는다. 지난 요청의 기록은 지금 이 순간의 사실은 아니지만 초기값보다는 실제에 가깝다.
   */
  it('falls back to the stored answer when permissions cannot be queried', async () => {
    window.sessionStorage.setItem(
      'pingo.requiredPermissions',
      JSON.stringify({
        canUseService: true,
        location: 'granted',
        camera: 'granted',
        microphone: 'granted',
        savedAt: '2026-08-03T00:00:00.000Z',
      }),
    );

    // `navigator.permissions` 를 세우지 않는다 — 조회할 수 없는 브라우저다.
    await renderSection('/user/station');

    await waitFor(() =>
      expect(usePermissionStore.getState().granted).toEqual({ loc: true, cam: true, mic: true }),
    );
    // 모르는 것을 없는 것으로 치면 안 된다. 화면은 그대로 열려 있어야 한다.
    expect(screen.getByRole('heading', { name: '오늘은 어디로 가시나요?' })).toBeInTheDocument();
  });

  it('keeps the flow open while every permission is still granted', async () => {
    stubPermissionStates({ geolocation: 'granted', camera: 'granted', microphone: 'granted' });

    await renderSection('/user/station');

    expect(
      await screen.findByRole('heading', { name: '오늘은 어디로 가시나요?' }),
    ).toBeInTheDocument();
  });

  /**
   * 설정 화면에서 권한을 풀어도 돌아가야 한다.
   *
   * 권한 카드가 상태를 보여 주기만 하게 바뀐 뒤로 그 화면에서 할 수 있는 일이 없다. 복구
   * 안내와 다시 갖춰졌을 때의 자동 진행은 권한 화면에 있으므로 거기로 보낸다.
   */
  it('sends the user back when a permission is revoked on the settings screen', async () => {
    stubPermissionStates({ geolocation: 'granted', camera: 'prompt', microphone: 'granted' });

    await renderSection('/user/settings');

    expect(
      await screen.findByRole('heading', { name: /이용에 필요한 권한을/ }),
    ).toBeInTheDocument();
  });

  it('shows the settings screen while every permission is still granted', async () => {
    stubPermissionStates({ geolocation: 'granted', camera: 'granted', microphone: 'granted' });

    await renderSection('/user/settings');

    expect(await screen.findByRole('heading', { name: '설정' })).toBeInTheDocument();
    // 권한은 여기서 바꿀 수 없다. 상태만 읽는다.
    expect(screen.getAllByText('허용됨')).toHaveLength(3);
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
    useNavigationStore.setState({ waypoints: [{ nodeId: 130, nameKo: '화장실' }] });

    expect(screen.getAllByText('출발지')).not.toHaveLength(0);
    expect(screen.getByText('역삼역')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '목적지 선택' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /블리스 라운드 역삼점/ }));

    await waitFor(() => expect(useNavigationStore.getState().waypoints).toEqual([]));
    expect(await screen.findByRole('heading', { name: '출발지와 목적지' })).toBeInTheDocument();
    expect(screen.getByLabelText('역삼역에서 블리스 라운드 역삼점까지')).toBeInTheDocument();
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
   * 경로선. (S15P11A206-83 / FR-U-010)
   *
   * 예전에는 화면이 `pathNodes`를 넘기지 않아 위젯이 목업(B3 승강장 → 3번출구 엘리베이터)으로
   * 채웠다. 사용자가 어디로 가든 늘 같은 선이 그려져 있었고, 그것이 실제 안내 경로처럼 보였다.
   *
   * 응답의 경로는 B3에 두 노드, B2에 한 노드를 지난다. 한 점만으로는 선이 되지 않으므로 B2에는
   * 그려지지 않는 것이 맞다.
   */
  it('안내 경로는 응답의 노드를 따라 그린다', async () => {
    useNavigationStore.setState({ currentNodeId: 205, targetNodeId: 325 });
    await renderSection('/user/navigation');
    fireEvent.click(await screen.findByRole('button', { name: /지도만 보고 이동하기/ }));

    const floorGroup = await screen.findByRole('group', { name: '층 선택' });
    fireEvent.click(within(floorGroup).getByRole('button', { name: 'B3' }));

    expect(await screen.findByRole('img', { name: '이동 경로' })).toBeInTheDocument();
  });

  /** 경로를 모르면 아무것도 그리지 않는다. 목업으로 대신하면 가지 않을 길을 안내하게 된다. */
  it('경로를 조회할 수 없으면 경로선을 그리지 않는다', async () => {
    useNavigationStore.setState({ currentNodeId: null, targetNodeId: null });
    await renderSection('/user/navigation');
    fireEvent.click(await screen.findByRole('button', { name: /지도만 보고 이동하기/ }));

    const floorGroup = await screen.findByRole('group', { name: '층 선택' });
    fireEvent.click(within(floorGroup).getByRole('button', { name: 'B3' }));

    await screen.findByRole('group', { name: '시설 필터' });
    expect(screen.queryByRole('img', { name: '이동 경로' })).not.toBeInTheDocument();
  });

  /**
   * 경유지. (S15P11A206-83 / FR-U-010)
   *
   * 예전에는 이름만 저장하고 요청에도 조회 키에도 싣지 않았다. 경유지를 추가하면 헤더에 칩이
   * 붙고 안내 카드가 "경로 업데이트 완료"로 바뀌었지만, 서버는 그 사실을 몰랐고 지도의 선은
   * 하나도 바뀌지 않았다.
   */
  it('경유지를 추가하면 그 노드를 실어 경로를 다시 계산한다', async () => {
    const routeRequests: { waypointNodeIds?: number[] }[] = [];
    server.use(
      http.post('*/api/routes/indoor', async ({ request }) => {
        routeRequests.push((await request.json()) as { waypointNodeIds?: number[] });
        return HttpResponse.json({ success: true, data: {}, message: null });
      }),
    );

    await renderSection('/user/navigation');
    fireEvent.click(await screen.findByRole('button', { name: /지도만 보고 이동하기/ }));

    // 첫 조회에는 경유지가 없다.
    await waitFor(() => expect(routeRequests).not.toHaveLength(0));
    expect(routeRequests[0]?.waypointNodeIds).toEqual([]);

    fireEvent.click(await screen.findByRole('button', { name: '승차권 충전' }));
    fireEvent.click(await screen.findByRole('button', { name: '경유지로 추가' }));

    // 시설의 linkedNodeId 가 그대로 실린다. 이름으로 되찾지 않는다.
    await waitFor(() => expect(routeRequests.at(-1)?.waypointNodeIds).toEqual([121]));
    expect(useNavigationStore.getState().waypoints).toEqual([
      { nodeId: 121, nameKo: '승차권 충전' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: '승차권 충전 경유지 삭제' }));

    await waitFor(() => expect(routeRequests.at(-1)?.waypointNodeIds).toEqual([]));
  });

  /**
   * 서버가 진입 노드를 멀리 고른 경우. (S15P11A206-83 / S15P11A206-337)
   *
   * 좌표를 보내면 서버가 목적지까지의 총 거리로 진입 노드를 다시 고르는데, 그 결과가 계단·엘리베이터
   * 노드일 수 있다. 그러면 사용자가 서 있는 층에 경로 노드가 **그 하나만** 남고, 그것이 수십 m
   * 떨어져 있다. 역삼역 B3 복도(노드 209)에서 2번 출구로 갈 때 계단 2가 56m 떨어진 채 뽑힌다.
   *
   * 예전에는 그 층 지도가 통째로 비었다. 선으로 그릴 구간이 없고(점 하나), 이탈로 판정되어 이어
   * 주는 선까지 꺼졌다 — 사용자가 서 있는 층인데 아무 안내도 없었다.
   */
  it('진입 노드가 멀어도 내 층에 경로를 그린다', async () => {
    server.use(
      http.post('*/api/routes/indoor', () =>
        HttpResponse.json({
          success: true,
          data: {
            routeType: 'fastest',
            available: true,
            startNodeId: 237,
            targetNodeId: 341,
            totalDistanceM: 120,
            steps: [],
            pathNodes: [
              // B3에는 계단 2 하나뿐이다. 사용자(노드 209)에게서 56m 떨어져 있다.
              { nodeId: 237, floorId: 2, mapX: 105.207, mapY: 27.57 },
              { nodeId: 137, floorId: 1, mapX: 105.207, mapY: 27.57 },
              { nodeId: 112, floorId: 1, mapX: 106.264, mapY: 22.653 },
            ],
          },
          message: null,
        }),
      ),
    );

    // 실제 시드값이다. B3 복도 노드 209.
    useNavigationStore.setState({
      currentNodeId: 209,
      currentFloorId: 2,
      currentMapX: 49.121,
      currentMapY: 24.331,
    });
    await renderSection('/user/navigation');
    fireEvent.click(await screen.findByRole('button', { name: /지도만 보고 이동하기/ }));

    const floorGroup = await screen.findByRole('group', { name: '층 선택' });
    fireEvent.click(within(floorGroup).getByRole('button', { name: 'B3' }));

    // 이어 주는 선 하나뿐이어도 그 층의 안내다.
    expect(await screen.findByRole('img', { name: '이동 경로' })).toBeInTheDocument();
  });

  /**
   * 사용자 좌표. (S15P11A206-83 / S15P11A206-337)
   *
   * 좌표를 보내면 서버가 진입 노드를 목적지 기준으로 다시 고르는데, 그 기준이 **직선 거리**라
   * 선로를 모른다. 역삼역 B3는 선로 양쪽에 승강장이 있어(y≈24와 y≈2) 반대편 계단이 직선으로 더
   * 가깝게 나오고, 실제로 관통하는 경로가 나왔다 — 같은 승강장 계단 5가 27.7m인데 건너편 계단 7
   * (35.6m)이 뽑혔다.
   *
   * 배선은 남겨 두고 `SEND_CURRENT_POSITION`만 껐다. 백엔드가 그래프 거리로 고르게 되면 그 값을
   * 되돌리고 이 테스트를 "좌표를 함께 보낸다"로 바꾼다.
   */
  it('지금은 좌표를 보내지 않는다', async () => {
    const routeRequests: Record<string, unknown>[] = [];
    server.use(
      http.post('*/api/routes/indoor', async ({ request }) => {
        routeRequests.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ success: true, data: {}, message: null });
      }),
    );

    useNavigationStore.setState({ currentMapX: 49.121, currentMapY: 24.331 });
    await renderSection('/user/navigation');
    fireEvent.click(await screen.findByRole('button', { name: /지도만 보고 이동하기/ }));

    await waitFor(() => expect(routeRequests).not.toHaveLength(0));
    expect(routeRequests[0]).not.toHaveProperty('currentMapX');
    expect(routeRequests[0]).not.toHaveProperty('currentMapY');
    // 좌표가 없으면 서버가 요청에 온 진입 노드를 그대로 쓴다. 내가 서 있는 노드에서 시작한다.
    expect(routeRequests[0]).toMatchObject({ startNodeId: 205 });
  });

  /**
   * 시설 필터. (S15P11A206-83)
   *
   * 진입하면 그 층 시설을 모두 보여 주고, 칩은 그 층에 실제로 있는 유형만 둔다. 눌러서 아무것도
   * 나오지 않는 것을 확인해야만 없다는 걸 알 수 있는 칩은 두지 않는다.
   */
  it('시설 칩은 표시 층에 있는 유형만 두고 기본은 전부 보여준다', async () => {
    await renderSection('/user/navigation');
    fireEvent.click(await screen.findByRole('button', { name: /지도만 보고 이동하기/ }));

    const filterGroup = await screen.findByRole('group', { name: '시설 필터' });
    const floorGroup = screen.getByRole('group', { name: '층 선택' });

    // B2에는 승차권 충전기와 엘리베이터가 있다. 유형을 고르기 전에도 지도에 떠 있어야 한다.
    expect(await screen.findByRole('button', { name: '승차권 충전' })).toBeInTheDocument();
    expect(
      within(filterGroup).getByRole('button', { name: '승차권 충전 필터 적용' }),
    ).toBeInTheDocument();

    // B1에는 출구뿐이다. 승차권 충전 칩이 남아 있으면 안 된다.
    fireEvent.click(within(floorGroup).getByRole('button', { name: 'B1' }));

    await waitFor(() =>
      expect(
        within(filterGroup).queryByRole('button', { name: '승차권 충전 필터 적용' }),
      ).not.toBeInTheDocument(),
    );
    expect(within(filterGroup).getByRole('button', { name: '출구 필터 적용' })).toBeInTheDocument();
  });

  /**
   * 전부 감추기.
   *
   * 유형 칩만으로는 시설을 하나도 없는 상태로 만들 수 없다. 켠 뒤 되돌릴 수 없으면 누르기
   * 망설이게 되므로, 같은 버튼이 다시 보이기까지 맡는다.
   */
  it('시설 아이콘을 한 번에 감추고 다시 보일 수 있다', async () => {
    await renderSection('/user/navigation');
    fireEvent.click(await screen.findByRole('button', { name: /지도만 보고 이동하기/ }));

    expect(await screen.findByRole('button', { name: '승차권 충전' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '시설 아이콘 모두 숨기기' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '승차권 충전' })).not.toBeInTheDocument(),
    );
    // 안내에 필요한 표시는 남는다. 시설만 감추는 버튼이다.
    expect(screen.getByRole('img', { name: '현재 위치' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '시설 아이콘 다시 보기' }));

    expect(await screen.findByRole('button', { name: '승차권 충전' })).toBeInTheDocument();
  });

  /**
   * 진행도에 따른 안내. (S15P11A206-83)
   *
   * 예전에는 안내 카드가 `steps[0]`에 고정돼 있어 걸어도 첫 구간 문구가 그대로였고, 상세 경로도
   * 모든 단계를 똑같이 그려 지금 어디인지 알 수 없었다.
   *
   * 목업 경로는 B3 승강장(205) → 엘리베이터(202) → B2(102)다. 첫 구간 끝쪽에 서면 안내가 층
   * 전환 구간으로 넘어가야 한다.
   */
  it('걸어간 만큼 안내 카드와 상세 경로가 다음 구간으로 넘어간다', async () => {
    useNavigationStore.setState({
      // 첫 구간(205 → 202)의 끝에 가까운 지점. B3이다.
      currentFloorId: 2,
      currentMapX: -2,
      currentMapY: 27,
    });
    await renderSection('/user/navigation');
    fireEvent.click(await screen.findByRole('button', { name: /지도만 보고 이동하기/ }));

    // 첫 구간이 아니라 층 전환 구간을 안내한다.
    expect(await screen.findByText('엘리베이터를 타고 B2로 이동하세요')).toBeInTheDocument();
    expect(screen.queryByText('개찰구 방향으로 25m 직진하세요')).toBeNull();

    /*
      카메라 화면의 화살표와 문구는 그리지 않는다. 층을 오르내리는 구간이라 수평 방향에 뜻이
      없고, XR 추적 없이 들어왔으므로 방향각도 없다. 예전에는 이 자리에 `정면 통로를 따라
      직진하세요`가 하드코딩돼 있어, 엘리베이터를 타야 할 때도 정면으로 걸으라고 말했다.
    */
    expect(screen.queryByText('정면 통로를 따라 직진하세요')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /상세 경로/ }));

    // 상세 경로에서는 지금 구간만 표시가 붙는다. 지나온 구간은 지우지 않고 남긴다.
    const passedStep = await screen.findByText('개찰구 방향으로 25m 직진하세요');
    expect(passedStep.closest('[aria-current="step"]')).toBeNull();
    expect(
      screen.getAllByText('엘리베이터를 타고 B2로 이동하세요').at(-1)?.closest('[aria-current]'),
    ).not.toBeNull();
  });

  /**
   * `내 위치` 버튼과 층. (S15P11A206-83)
   *
   * 예전에는 시점만 되돌렸다. 층은 화면이 들고 있어서 다른 층을 보던 사용자는 그 층 지도가
   * 자기 좌표로 옮겨진 것만 보고, 마커는 다른 층이라 그려지지 않았다 — 내 위치로 가는 버튼을
   * 눌렀는데 내 위치가 화면에 없었다.
   *
   * 지도를 밀지 않고 층만 넘긴 경우에는 추종이 켜져 있어 버튼 자체가 나타나지도 않았다.
   */
  it('다른 층에서 내 위치 버튼을 누르면 내가 있는 층으로 돌아온다', async () => {
    await renderSection('/user/navigation');
    fireEvent.click(await screen.findByRole('button', { name: /지도만 보고 이동하기/ }));

    const floorGroup = await screen.findByRole('group', { name: '층 선택' });

    fireEvent.click(within(floorGroup).getByRole('button', { name: 'B1' }));
    expect(within(floorGroup).getByRole('button', { name: 'B1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // 지도를 밀지 않았어도 다른 층이면 돌아갈 곳을 제시해야 한다.
    fireEvent.click(await screen.findByRole('button', { name: '내 위치' }));

    // 내 층은 B2다(`currentFloorId: 1`). 시점만이 아니라 층까지 돌아와야 마커가 보인다.
    expect(within(floorGroup).getByRole('button', { name: 'B2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(floorGroup).getByRole('button', { name: 'B1' })).toHaveAttribute(
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
      waypoints: [
        { nodeId: 130, nameKo: '화장실' },
        { nodeId: 121, nameKo: '승차권 충전' },
      ],
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
     * 유형을 켜면 그 유형만 남는다. 좌표는 시설 조회 응답에서 온다.
     *
     * 진입 시에는 그 층 시설이 모두 떠 있고(S15P11A206-83), 하나를 고르려면 유형을 켜야 한다 —
     * 역삼역 B2는 실제 240m 폭이 이 지도에서 287px에 들어가 36개를 모두 그리면 마커가 서로를
     * 덮기 때문이다.
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
    expect(useNavigationStore.getState().waypoints.map((waypoint) => waypoint.nameKo)).toEqual([
      '화장실',
      '승차권 충전',
    ]);
    expect(within(routeHeader).getByText('엘리베이터')).toBeInTheDocument();
    expect(within(routeHeader).queryByText('2번 출입구')).toBeNull();
    expect(within(routeHeader).getByText('화장실')).toBeInTheDocument();
    expect(within(routeHeader).getByText('승차권 충전')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '목적지를 2번 출입구로 되돌리기' }));
    expect(useNavigationStore.getState().destination).toBe('GS25 역삼역점');
    expect(useNavigationStore.getState().waypoints.map((waypoint) => waypoint.nameKo)).toEqual([
      '화장실',
      '승차권 충전',
    ]);
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
    expect(await screen.findByText('개찰구 방향으로 25m 직진하세요')).toBeInTheDocument();
    /*
      다시 계산이 끝나면 거리 표시로 돌아온다. 예전에는 경유지를 한 번 건드리면 안내가 끝날
      때까지 `경로 업데이트 완료`에 머물러, 다음 지점까지 몇 미터인지가 영영 사라졌다.
    */
    expect(await screen.findByText('다음 안내 · 25m')).toBeInTheDocument();
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
