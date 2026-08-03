import type { PermissionStatus, RequiredPermissionsResult } from './permission.service';

/**
 * 권한 상태 저장 key.
 *
 * 현재는 브라우저 탭 단위 상태만 필요하므로 sessionStorage를 사용한다.
 */
const REQUIRED_PERMISSION_STORAGE_KEY = 'pingo.requiredPermissions';

/**
 * sessionStorage에 저장할 권한 상태.
 *
 * GeolocationPosition, MediaStream 같은 브라우저 객체는 저장하지 않는다.
 * 화면 분기와 서비스 진입 판단에 필요한 최소 상태만 저장한다.
 */
export interface StoredRequiredPermissionState {
  canUseService: boolean;
  location: PermissionStatus;
  camera: PermissionStatus;
  microphone: PermissionStatus;
  savedAt: string;
}

/**
 * sessionStorage 사용 가능 여부를 확인한다.
 */
function isSessionStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return false;
    }

    const testKey = 'pingo.storage.test';

    window.sessionStorage.setItem(testKey, '1');
    window.sessionStorage.removeItem(testKey);

    return true;
  } catch {
    return false;
  }
}

/**
 * 저장 가능한 권한 상태값인지 확인한다.
 */
function isPermissionStatus(value: unknown): value is PermissionStatus {
  return (
    value === 'idle' ||
    value === 'granted' ||
    value === 'denied' ||
    value === 'unsupported' ||
    value === 'error'
  );
}

/**
 * 저장된 객체가 권한 상태 저장 형식인지 확인한다.
 */
function isStoredRequiredPermissionState(value: unknown): value is StoredRequiredPermissionState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const state = value as Partial<StoredRequiredPermissionState>;

  return (
    typeof state.canUseService === 'boolean' &&
    isPermissionStatus(state.location) &&
    isPermissionStatus(state.camera) &&
    isPermissionStatus(state.microphone) &&
    typeof state.savedAt === 'string'
  );
}

/**
 * 권한 요청 결과를 sessionStorage에 저장 가능한 형태로 변환한다.
 */
export function toStoredRequiredPermissionState(
  result: RequiredPermissionsResult,
): StoredRequiredPermissionState {
  const canUseService =
    result.location.status === 'granted' &&
    result.camera.status === 'granted' &&
    result.microphone.status === 'granted';

  return {
    canUseService,
    location: result.location.status,
    camera: result.camera.status,
    microphone: result.microphone.status,
    savedAt: new Date().toISOString(),
  };
}

/**
 * 권한 요청 결과를 sessionStorage에 저장한다.
 *
 * 저장 실패가 권한 요청 실패를 의미하지는 않으므로 null을 반환한다.
 */
export function saveRequiredPermissionState(
  result: RequiredPermissionsResult,
): StoredRequiredPermissionState | null {
  if (!isSessionStorageAvailable()) {
    return null;
  }

  const state = toStoredRequiredPermissionState(result);

  try {
    window.sessionStorage.setItem(REQUIRED_PERMISSION_STORAGE_KEY, JSON.stringify(state));

    return state;
  } catch {
    return null;
  }
}

/**
 * sessionStorage에 저장된 권한 상태를 조회한다.
 */
export function getStoredRequiredPermissionState(): StoredRequiredPermissionState | null {
  if (!isSessionStorageAvailable()) {
    return null;
  }

  try {
    const rawState = window.sessionStorage.getItem(REQUIRED_PERMISSION_STORAGE_KEY);

    if (!rawState) {
      return null;
    }

    const parsedState: unknown = JSON.parse(rawState);

    if (!isStoredRequiredPermissionState(parsedState)) {
      return null;
    }

    return parsedState;
  } catch {
    return null;
  }
}

/**
 * 저장된 권한 상태를 삭제한다.
 */
export function clearStoredRequiredPermissionState(): void {
  if (!isSessionStorageAvailable()) {
    return;
  }

  window.sessionStorage.removeItem(REQUIRED_PERMISSION_STORAGE_KEY);
}
