import { act, renderHook } from '@testing-library/react';
import { usePermissionRequest } from './permission.hook';
import type { RequiredPermissionsResult } from './permission.service';
import type { StoredRequiredPermissionState } from './permission.storage';

type GeoSuccess = (position: GeolocationPosition) => void;

const STORAGE_KEY = 'pingo.requiredPermissions';

const fakePosition = {
  coords: { latitude: 37.5, longitude: 127.0, accuracy: 10 },
  timestamp: 0,
} as unknown as GeolocationPosition;

/**
 * 모든 권한이 허용되도록 브라우저 전역을 설정한다.
 */
function stubGrantedEnvironment(): void {
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value: true,
  });

  const getCurrentPosition = vi.fn((success: GeoSuccess) => success(fakePosition));
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  });

  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
}

type FakePermissionStatus = {
  state: 'granted' | 'prompt' | 'denied';
  onchange: (() => void) | null;
};

/**
 * Permissions API를 흉내낸다. 같은 권한에는 같은 객체를 돌려줘야 붙여 둔 `onchange`가
 * 살아남고, 테스트가 `state`를 바꿔 브라우저 설정 변경을 흉내낼 수 있다.
 */
function stubPermissionStates(initial: Partial<Record<string, FakePermissionStatus['state']>>): {
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

  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query },
  });

  return { statuses };
}

beforeEach(() => {
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

describe('usePermissionRequest', () => {
  it('저장된 상태가 없으면 idle 상태로 시작한다', () => {
    const { result } = renderHook(() => usePermissionRequest());

    expect(result.current.phase).toBe('idle');
    expect(result.current.isRequesting).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.stored).toBeNull();
    expect(result.current.canUseService).toBe(false);
  });

  /**
   * 저장값은 화면 복원에만 쓴다. 진입 허용은 브라우저에 물어본 뒤에 정해진다 — 그 사이에
   * 허락해 버리면 권한을 꺼 둔 사용자가 조회 결과가 오기 전에 다음 화면으로 넘어간다.
   */
  it('마운트 시 sessionStorage에 저장된 권한 상태를 불러온다', async () => {
    const storedState: StoredRequiredPermissionState = {
      canUseService: true,
      location: 'granted',
      camera: 'granted',
      microphone: 'granted',
      savedAt: '2026-07-27T00:00:00.000Z',
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));

    const { result } = renderHook(() => usePermissionRequest());

    expect(result.current.stored).toEqual(storedState);
    expect(result.current.canUseService).toBe(false);

    await vi.waitFor(() => expect(result.current.canUseService).toBe(true));
  });

  it('requestPermissions 호출 시 completed로 전이하고 결과를 저장한다', async () => {
    stubGrantedEnvironment();

    const { result } = renderHook(() => usePermissionRequest());

    await act(async () => {
      await result.current.requestPermissions();
    });

    expect(result.current.phase).toBe('completed');
    expect(result.current.isRequesting).toBe(false);
    expect(result.current.result?.canUseService).toBe(true);
    expect(result.current.canUseService).toBe(true);
    expect(result.current.stored?.canUseService).toBe(true);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('요청 결과를 권한별 상태로 노출한다', async () => {
    stubGrantedEnvironment();

    const { result } = renderHook(() => usePermissionRequest());

    expect(result.current.statuses).toEqual({
      location: 'idle',
      camera: 'idle',
      microphone: 'idle',
    });

    await act(async () => {
      await result.current.requestPermissions();
    });

    expect(result.current.statuses).toEqual({
      location: 'granted',
      camera: 'granted',
      microphone: 'granted',
    });
  });

  it('요청이 진행 중이면 새 요청을 시작하지 않고 같은 결과를 공유한다', async () => {
    stubGrantedEnvironment();

    const { result } = renderHook(() => usePermissionRequest());

    let first: RequiredPermissionsResult | undefined;
    let second: RequiredPermissionsResult | undefined;

    await act(async () => {
      const pending = result.current.requestPermissions();
      const duplicate = result.current.requestPermissions();

      [first, second] = await Promise.all([pending, duplicate]);
    });

    // 지난 결과가 아니라 진행 중이던 이번 요청의 결과를 받아야 한다.
    expect(second).toBe(first);
    expect(first?.canUseService).toBe(true);
    expect(vi.mocked(navigator.geolocation.getCurrentPosition)).toHaveBeenCalledTimes(1);
  });

  it('브라우저 API가 예외를 던져도 진입 불가 결과로 정리한다', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });

    // getCurrentPosition이 동기 throw하면 위치 요청 Promise가 reject된다.
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn(() => {
          throw new Error('geolocation failed');
        }),
      },
    });

    const { result } = renderHook(() => usePermissionRequest());

    let requestResult: RequiredPermissionsResult | undefined;

    await act(async () => {
      requestResult = await result.current.requestPermissions();
    });

    expect(requestResult?.canUseService).toBe(false);
    expect(requestResult?.location.status).toBe('error');

    // 요청 중 상태에 갇히지 않고 다시 시도할 수 있어야 한다.
    expect(result.current.phase).toBe('completed');
    expect(result.current.isRequesting).toBe(false);
    expect(result.current.statuses).toEqual({
      location: 'error',
      camera: 'error',
      microphone: 'error',
    });
  });

  it('reset 호출 시 상태와 저장소를 초기화한다', async () => {
    stubGrantedEnvironment();

    const { result } = renderHook(() => usePermissionRequest());

    await act(async () => {
      await result.current.requestPermissions();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.stored).toBeNull();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('usePermissionRequest · 브라우저 권한 조회', () => {
  /**
   * 저장값은 "지난번에 물었더니 이랬다"일 뿐이다. 그 사이 사용자가 설정에서 권한을 껐다면
   * 화면은 허용된 적 없는 권한을 허용됨으로 보여 주게 된다.
   */
  it('저장된 값보다 브라우저가 아는 상태를 우선한다', async () => {
    const stored: StoredRequiredPermissionState = {
      canUseService: true,
      location: 'granted',
      camera: 'granted',
      microphone: 'granted',
      savedAt: '2026-08-03T00:00:00.000Z',
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    stubPermissionStates({ geolocation: 'granted', camera: 'denied', microphone: 'prompt' });

    const { result } = renderHook(() => usePermissionRequest());

    await vi.waitFor(() => {
      expect(result.current.statuses).toEqual({
        location: 'granted',
        camera: 'denied',
        microphone: 'idle',
      });
    });

    expect(result.current.canUseService).toBe(false);
    expect(result.current.blockedKinds).toEqual(['camera']);
    expect(result.current.promptableKinds).toEqual(['microphone']);
  });

  /** 조회할 수 없는 브라우저에서는 기존처럼 저장값을 쓴다. */
  it('조회할 수 없으면 저장된 상태를 그대로 둔다', async () => {
    const stored: StoredRequiredPermissionState = {
      canUseService: true,
      location: 'granted',
      camera: 'granted',
      microphone: 'granted',
      savedAt: '2026-08-03T00:00:00.000Z',
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => usePermissionRequest());

    await vi.waitFor(() => expect(result.current.canUseService).toBe(true));
    expect(result.current.blockedKinds).toEqual([]);
  });

  /**
   * 거부된 권한에서 빠져나오는 유일한 길. 이것이 없으면 안내를 따라 설정을 바꾼 사용자도
   * 새로고침을 해야 한다.
   */
  it('설정에서 권한을 켜면 새 요청 없이 진입 가능해진다', async () => {
    const { statuses } = stubPermissionStates({
      geolocation: 'granted',
      camera: 'denied',
      microphone: 'granted',
    });

    const { result } = renderHook(() => usePermissionRequest());

    await vi.waitFor(() => expect(result.current.blockedKinds).toEqual(['camera']));
    // 조회가 끝난 것과 구독이 붙은 것은 다른 시점이다. 붙기 전에 바꾸면 아무도 듣지 않는다.
    await vi.waitFor(() =>
      expect(statuses.get('camera')?.onchange).toBeTypeOf('function'),
    );

    // 사용자가 브라우저 설정에서 카메라를 켰다.
    await act(async () => {
      statuses.get('camera')!.state = 'granted';
      statuses.get('camera')!.onchange?.();
      await Promise.resolve();
    });

    await vi.waitFor(() => expect(result.current.canUseService).toBe(true));
    expect(result.current.blockedKinds).toEqual([]);
  });

  /** 다시 물어도 팝업이 뜨지 않는다. 호출하면 같은 요청에 묶인 권한까지 함께 실패한다. */
  it('막힌 권한은 요청하지 않는다', async () => {
    stubGrantedEnvironment();
    stubPermissionStates({ geolocation: 'granted', camera: 'denied', microphone: 'denied' });

    const { result } = renderHook(() => usePermissionRequest());

    await vi.waitFor(() => expect(result.current.blockedKinds).toHaveLength(2));

    await act(async () => {
      await result.current.requestPermissions();
    });

    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(result.current.statuses).toEqual({
      location: 'granted',
      camera: 'denied',
      microphone: 'denied',
    });
  });
});
