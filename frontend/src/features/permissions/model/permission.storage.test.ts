import type { RequiredPermissionsResult } from './permission.service';
import {
  clearStoredRequiredPermissionState,
  getStoredRequiredPermissionState,
  saveRequiredPermissionState,
  toStoredRequiredPermissionState,
} from './permission.storage';

const STORAGE_KEY = 'pingo.requiredPermissions';

/**
 * 모든 권한이 허용된 요청 결과를 만든다.
 */
function createGrantedResult(): RequiredPermissionsResult {
  return {
    canUseService: true,
    location: { kind: 'location', status: 'granted' },
    camera: { kind: 'camera', status: 'granted' },
    microphone: { kind: 'microphone', status: 'granted' },
  };
}

/**
 * 위치만 거부된 요청 결과를 만든다.
 */
function createLocationDeniedResult(): RequiredPermissionsResult {
  return {
    canUseService: false,
    location: { kind: 'location', status: 'denied' },
    camera: { kind: 'camera', status: 'idle' },
    microphone: { kind: 'microphone', status: 'idle' },
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('toStoredRequiredPermissionState', () => {
  it('세 권한이 모두 granted면 canUseService가 true다', () => {
    const state = toStoredRequiredPermissionState(createGrantedResult());

    expect(state.canUseService).toBe(true);
    expect(state.location).toBe('granted');
    expect(state.camera).toBe('granted');
    expect(state.microphone).toBe('granted');
    expect(typeof state.savedAt).toBe('string');
  });

  it('하나라도 granted가 아니면 canUseService가 false다', () => {
    const state = toStoredRequiredPermissionState(createLocationDeniedResult());

    expect(state.canUseService).toBe(false);
    expect(state.location).toBe('denied');
  });
});

describe('saveRequiredPermissionState / getStoredRequiredPermissionState', () => {
  it('저장한 상태를 다시 읽어올 수 있다', () => {
    const saved = saveRequiredPermissionState(createGrantedResult());

    expect(saved).not.toBeNull();

    const loaded = getStoredRequiredPermissionState();

    expect(loaded).toEqual(saved);
    expect(loaded?.canUseService).toBe(true);
  });

  it('저장된 값이 없으면 null을 반환한다', () => {
    expect(getStoredRequiredPermissionState()).toBeNull();
  });

  it('저장 형식이 아닌 값이 들어 있으면 null을 반환한다', () => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));

    expect(getStoredRequiredPermissionState()).toBeNull();
  });

  it('JSON이 깨져 있어도 안전하게 null을 반환한다', () => {
    window.sessionStorage.setItem(STORAGE_KEY, '{not-json');

    expect(getStoredRequiredPermissionState()).toBeNull();
  });

  it('sessionStorage를 사용할 수 없으면 저장은 null을 반환한다', () => {
    const originalSessionStorage = window.sessionStorage;

    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => {
        throw new Error('storage unavailable');
      },
    });

    try {
      expect(saveRequiredPermissionState(createGrantedResult())).toBeNull();
    } finally {
      Object.defineProperty(window, 'sessionStorage', {
        configurable: true,
        value: originalSessionStorage,
      });
    }
  });
});

describe('clearStoredRequiredPermissionState', () => {
  it('저장된 상태를 제거한다', () => {
    saveRequiredPermissionState(createGrantedResult());
    expect(getStoredRequiredPermissionState()).not.toBeNull();

    clearStoredRequiredPermissionState();

    expect(getStoredRequiredPermissionState()).toBeNull();
  });
});
