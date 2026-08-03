import {
  deniedKindsOf,
  promptableKindsOf,
  queryPermissionStates,
  watchPermissionStates,
  type BrowserPermissionState,
  type BrowserPermissionStates,
} from './permission.query';

type FakeStatus = {
  state: BrowserPermissionState;
  onchange: (() => void) | null;
};

function setPermissions(value: unknown): void {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value,
  });
}

/**
 * 이름별로 정해진 상태를 돌려주는 가짜 Permissions API.
 *
 * 반환한 객체를 그대로 보관하므로, 테스트가 `state`를 바꾸고 `onchange`를 불러 브라우저
 * 설정 변경을 흉내낼 수 있다.
 */
function stubPermissions(initial: Partial<Record<string, BrowserPermissionState>>): {
  statuses: Map<string, FakeStatus>;
  query: ReturnType<typeof vi.fn>;
} {
  const statuses = new Map<string, FakeStatus>();

  const query = vi.fn(({ name }: { name: string }) => {
    // 실제 브라우저는 같은 권한에 같은 객체를 준다. 새로 만들면 붙여 둔 onchange 가 사라진다.
    const existing = statuses.get(name);

    if (existing) {
      return Promise.resolve(existing);
    }

    const state = initial[name];

    // 실제 브라우저도 모르는 이름에는 TypeError 를 던진다(Firefox 의 camera 가 그렇다).
    if (!state) {
      return Promise.reject(new TypeError(`unsupported permission: ${name}`));
    }

    const status: FakeStatus = { state, onchange: null };
    statuses.set(name, status);

    return Promise.resolve(status);
  });

  setPermissions({ query });

  return { statuses, query };
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'permissions');
});

describe('queryPermissionStates', () => {
  it('세 권한의 상태를 조회한다', async () => {
    stubPermissions({ geolocation: 'granted', camera: 'denied', microphone: 'prompt' });

    await expect(queryPermissionStates()).resolves.toEqual({
      location: 'granted',
      camera: 'denied',
      microphone: 'prompt',
    });
  });

  it('Permissions API가 없으면 모두 unknown이다', async () => {
    setPermissions(undefined);

    await expect(queryPermissionStates()).resolves.toEqual({
      location: 'unknown',
      camera: 'unknown',
      microphone: 'unknown',
    });
  });

  /** Firefox 는 geolocation 만 조회할 수 있고 camera·microphone 에는 TypeError 를 던진다. */
  it('조회할 수 없는 권한만 unknown으로 남긴다', async () => {
    stubPermissions({ geolocation: 'prompt' });

    await expect(queryPermissionStates()).resolves.toEqual({
      location: 'prompt',
      camera: 'unknown',
      microphone: 'unknown',
    });
  });

  it('조회 중 예외가 나도 전체가 실패하지 않는다', async () => {
    setPermissions({
      query: vi.fn(() => {
        throw new Error('boom');
      }),
    });

    await expect(queryPermissionStates()).resolves.toEqual({
      location: 'unknown',
      camera: 'unknown',
      microphone: 'unknown',
    });
  });
});

describe('watchPermissionStates', () => {
  it('권한이 바뀌면 새 상태를 알려 준다', async () => {
    const { statuses } = stubPermissions({
      geolocation: 'granted',
      camera: 'denied',
      microphone: 'granted',
    });
    const listener = vi.fn();

    const unwatch = watchPermissionStates(listener);
    // 구독은 조회가 끝난 뒤에 붙는다. 조회가 끝난 것만으로는 아직 이르다.
    await vi.waitFor(() => expect(statuses.get('camera')?.onchange).toBeTypeOf('function'));

    // 사용자가 브라우저 설정에서 카메라를 켰다.
    statuses.get('camera')!.state = 'granted';
    statuses.get('camera')!.onchange?.();

    await vi.waitFor(() =>
      expect(listener).toHaveBeenCalledWith({
        location: 'granted',
        camera: 'granted',
        microphone: 'granted',
      }),
    );

    unwatch();
  });

  it('정리한 뒤에는 알리지 않는다', async () => {
    const { statuses } = stubPermissions({
      geolocation: 'granted',
      camera: 'denied',
      microphone: 'granted',
    });
    const listener = vi.fn();

    const unwatch = watchPermissionStates(listener);
    await vi.waitFor(() => expect(statuses.size).toBe(3));

    const camera = statuses.get('camera')!;
    unwatch();

    expect(camera.onchange).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });

  it('조회할 수 없는 브라우저에서는 아무것도 구독하지 않는다', () => {
    setPermissions(undefined);
    const listener = vi.fn();

    expect(() => watchPermissionStates(listener)()).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('deniedKindsOf / promptableKindsOf', () => {
  const states: BrowserPermissionStates = {
    location: 'granted',
    camera: 'denied',
    microphone: 'prompt',
  };

  it('denied인 권한만 골라낸다', () => {
    expect(deniedKindsOf(states)).toEqual(['camera']);
  });

  /** unknown 은 조회 실패라 물어보는 것 말고는 확인할 방법이 없다. */
  it('prompt와 unknown을 물어볼 수 있는 권한으로 본다', () => {
    expect(promptableKindsOf({ ...states, location: 'unknown' })).toEqual([
      'location',
      'microphone',
    ]);
  });
});
