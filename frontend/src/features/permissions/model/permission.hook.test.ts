import { act, renderHook } from '@testing-library/react';
import { usePermissionRequest } from './permission.hook';
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

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  Reflect.deleteProperty(navigator, 'geolocation');
  Reflect.deleteProperty(navigator, 'mediaDevices');
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

  it('마운트 시 sessionStorage에 저장된 권한 상태를 불러온다', () => {
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
    expect(result.current.canUseService).toBe(true);
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
