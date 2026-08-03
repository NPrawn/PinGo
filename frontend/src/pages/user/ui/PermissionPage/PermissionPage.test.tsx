import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { usePermissionStore } from '@/entities/permission';
import { USER_ROUTES } from '@/shared/config';
import { PermissionPage } from './PermissionPage';

type PermissionState = 'granted' | 'prompt' | 'denied';

type FakePermissionStatus = {
  state: PermissionState;
  onchange: (() => void) | null;
};

const fakePosition = {
  coords: { latitude: 37.5, longitude: 127.0, accuracy: 10 },
  timestamp: 0,
} as unknown as GeolocationPosition;

/**
 * Permissions API를 흉내낸다.
 *
 * 같은 권한에는 같은 객체를 돌려줘야 화면이 붙여 둔 `onchange`가 살아남고, 테스트가 `state`를
 * 바꿔 "사용자가 브라우저 설정에서 권한을 켰다"를 재현할 수 있다.
 */
function stubPermissionStates(initial: Partial<Record<string, PermissionState>>): {
  statuses: Map<string, FakePermissionStatus>;
} {
  const statuses = new Map<string, FakePermissionStatus>();

  const query = vi.fn(({ name }: { name: string }) => {
    const existing = statuses.get(name);

    if (existing) {
      return Promise.resolve(existing);
    }

    const state = initial[name];

    if (!state) {
      return Promise.reject(new TypeError(`unsupported permission: ${name}`));
    }

    const status: FakePermissionStatus = { state, onchange: null };
    statuses.set(name, status);

    return Promise.resolve(status);
  });

  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query } });

  return { statuses };
}

/** 세 권한이 모두 허용되는 브라우저. 요청하면 곧바로 성공한다. */
function stubGrantingBrowser(): { getUserMedia: ReturnType<typeof vi.fn> } {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((success: (position: GeolocationPosition) => void) =>
        success(fakePosition),
      ),
    },
  });

  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const getUserMedia = vi.fn().mockResolvedValue(stream);

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });

  return { getUserMedia };
}

/** 구독이 붙기를 기다린다. 조회가 끝난 것과는 다른 시점이다. */
function waitForWatcher(statuses: Map<string, FakePermissionStatus>, name: string) {
  return waitFor(() => expect(statuses.get(name)?.onchange).toBeTypeOf('function'));
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[USER_ROUTES.PERMISSION]}>
      <Routes>
        <Route path={USER_ROUTES.PERMISSION} element={<PermissionPage />} />
        <Route path={USER_ROUTES.STATION} element={<div>역 선택 화면</div>} />
        <Route path={USER_ROUTES.LANGUAGE} element={<div>언어 선택 화면</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  usePermissionStore.setState({ granted: { loc: false, cam: false, mic: false } });
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  Reflect.deleteProperty(navigator, 'geolocation');
  Reflect.deleteProperty(navigator, 'mediaDevices');
  Reflect.deleteProperty(navigator, 'permissions');
  Reflect.deleteProperty(window, 'isSecureContext');
});

describe('PermissionPage', () => {
  it('세 권한이 모두 허용되면 역 선택 화면으로 넘어간다', async () => {
    stubGrantingBrowser();
    stubPermissionStates({ geolocation: 'prompt', camera: 'prompt', microphone: 'prompt' });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '권한 허용하고 시작하기' }));

    expect(await screen.findByText('역 선택 화면')).toBeInTheDocument();
  });

  /**
   * 거부된 권한은 다시 물어도 팝업이 뜨지 않는다. 그걸 모르고 재요청 버튼을 두면 눌러도
   * 같은 대화상자가 다시 열려, 사용자가 화면에서 빠져나갈 수 없다.
   */
  it('권한이 모두 차단돼 있으면 재요청 대신 설정 안내를 보여 준다', async () => {
    const { getUserMedia } = stubGrantingBrowser();
    stubPermissionStates({ geolocation: 'denied', camera: 'denied', microphone: 'denied' });

    renderPage();

    const start = await screen.findByRole('button', {
      name: '브라우저 설정에서 권한을 켜 주세요',
    });
    expect(start).toBeDisabled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('일부만 차단되면 남은 권한만 요청하고 차단된 권한은 설정으로 안내한다', async () => {
    const { getUserMedia } = stubGrantingBrowser();
    stubPermissionStates({ geolocation: 'granted', camera: 'denied', microphone: 'prompt' });

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '권한 허용하고 시작하기' })).toBeEnabled(),
    );

    fireEvent.click(screen.getByRole('button', { name: '권한 허용하고 시작하기' }));

    expect(await screen.findByText('브라우저에서 권한을 켜 주세요')).toBeInTheDocument();
    // 화면과 대화상자 양쪽에 안내가 있다. 대화상자를 닫아도 이유가 남아야 한다.
    expect(screen.getAllByText(/카메라 권한이 차단되어 있어요/)).toHaveLength(2);
    // 막힌 카메라는 빼고 마이크만 물었다.
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    // 대화상자에서 빠져나갈 수 있어야 안내를 따를 수 있다.
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument();
  });

  /**
   * 거부된 권한에서 빠져나오는 유일한 길.
   *
   * 버튼을 누르지 않아도 넘어가야 한다. 카메라만 막혀 있고 나머지가 이미 허용된 상태에서는
   * 요청할 것이 없어 버튼이 잠기므로, 누르기를 기다리면 사용자는 설정을 고치고도 이 화면에
   * 갇힌다.
   */
  it('설정에서 권한을 켜면 버튼을 누르지 않아도 역 선택 화면으로 넘어간다', async () => {
    stubGrantingBrowser();
    const { statuses } = stubPermissionStates({
      geolocation: 'granted',
      camera: 'denied',
      microphone: 'granted',
    });

    renderPage();

    expect(await screen.findByText(/카메라 권한이 차단되어 있어요/)).toBeInTheDocument();
    await waitForWatcher(statuses, 'camera');

    // 사용자가 브라우저 설정에서 카메라를 켰다.
    await act(async () => {
      statuses.get('camera')!.state = 'granted';
      statuses.get('camera')!.onchange?.();
      await Promise.resolve();
    });

    expect(await screen.findByText('역 선택 화면')).toBeInTheDocument();
  });

  /**
   * 이미 허용된 권한을 확인하겠다고 다시 잡으면, 앞 화면이 카메라를 놓지 않은 사이에
   * `NotReadableError` 로 실패해 방금 허용한 권한이 거부됨으로 그려진다. 새로고침해야
   * 넘어가던 원인이라, 물어볼 것이 없으면 장치를 건드리지 않는다.
   */
  it('이미 허용된 권한은 장치를 다시 잡지 않고 넘어간다', async () => {
    const { getUserMedia } = stubGrantingBrowser();
    stubPermissionStates({ geolocation: 'granted', camera: 'granted', microphone: 'granted' });

    renderPage();

    expect(await screen.findByText('역 선택 화면')).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  /**
   * 요청 실패가 곧 권한 없음은 아니다.
   *
   * 다른 화면이 카메라를 아직 쥐고 있으면 권한이 멀쩡해도 요청이 실패한다. 그 결과를 그대로
   * 두면 허용된 권한이 거부됨으로 굳어, 새로고침하기 전까지 화면이 넘어가지 않는다.
   */
  it('요청이 실패해도 브라우저가 허용이라고 하면 거부 표시를 정정한다', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: (position: GeolocationPosition) => void) =>
          success(fakePosition),
        ),
      },
    });

    const { statuses } = stubPermissionStates({
      geolocation: 'granted',
      camera: 'prompt',
      microphone: 'prompt',
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        // 브라우저는 허용으로 기록했지만 장치를 잡지 못해 요청은 실패한다.
        getUserMedia: vi.fn(() => {
          statuses.get('camera')!.state = 'granted';
          statuses.get('microphone')!.state = 'granted';

          return Promise.reject(
            Object.assign(new Error('device in use'), { name: 'NotReadableError' }),
          );
        }),
      },
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '권한 허용하고 시작하기' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: '권한 허용하고 시작하기' }));

    expect(await screen.findByText('역 선택 화면')).toBeInTheDocument();
  });

  /** 거부가 아니라 장치를 쓸 수 없는 것이다. 허용을 조르면 사용자가 할 수 있는 일이 없다. */
  it('다른 곳이 카메라를 쓰고 있으면 거부가 아니라 사용 중으로 안내한다', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: (position: GeolocationPosition) => void) =>
          success(fakePosition),
        ),
      },
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('device in use'), { name: 'NotReadableError' }),
          ),
      },
    });
    stubPermissionStates({ geolocation: 'prompt', camera: 'prompt', microphone: 'prompt' });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '권한 허용하고 시작하기' }));

    // 화면과 대화상자 양쪽에 같은 이유가 적힌다. 대화상자를 닫아도 이유가 남는다.
    expect(
      await screen.findAllByText(/카메라나 마이크를 다른 앱 또는 다른 탭이 사용하고 있어요/),
    ).toHaveLength(2);
    // 거부로 읽히면 안 된다. 사용자가 설정에서 할 수 있는 일이 없다.
    expect(screen.queryByText('브라우저에서 권한을 켜 주세요')).not.toBeInTheDocument();
  });

  /**
   * 저장값은 지난 요청의 기록이라, 그 뒤 사용자가 설정에서 권한을 껐어도 그대로 남는다.
   * 새로고침해도 옛 상태가 보이던 원인이다.
   */
  it('저장된 값이 허용이어도 브라우저가 차단이라고 하면 차단으로 보여 준다', async () => {
    stubGrantingBrowser();
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
    stubPermissionStates({ geolocation: 'granted', camera: 'denied', microphone: 'granted' });

    renderPage();

    // 저장값을 그대로 믿었다면 이 화면은 곧바로 역 선택으로 넘어갔을 것이다.
    await waitFor(() => expect(usePermissionStore.getState().granted.cam).toBe(false));
    expect(screen.queryByText('역 선택 화면')).not.toBeInTheDocument();
  });
});
