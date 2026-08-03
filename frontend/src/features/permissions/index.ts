export {
  requestCameraPermission,
  requestLocationPermission,
  requestMediaPermissions,
  requestMicrophonePermission,
  requestRequiredPermissions,
  stopMediaStream,
} from './model/permission.service';

export {
  clearStoredRequiredPermissionState,
  getStoredRequiredPermissionState,
  saveRequiredPermissionState,
  toStoredRequiredPermissionState,
} from './model/permission.storage';

export {
  deniedKindsOf,
  grantedKindsOf,
  hasKnownPermissionState,
  promptableKindsOf,
  queryPermissionStates,
  revokedKindsOf,
  watchPermissionStates,
} from './model/permission.query';

export { RequirePermissions } from './ui/RequirePermissions';

export { usePermissionRequest } from './model/permission.hook';

export type {
  LocationPermissionResult,
  MediaPermissionsResult,
  PermissionError,
  PermissionKind,
  PermissionRequestResult,
  PermissionStatus,
  RequestRequiredPermissionsOptions,
  RequiredPermissionsProgress,
  RequiredPermissionsResult,
  SingleMediaPermissionResult,
} from './model/permission.service';

export type { StoredRequiredPermissionState } from './model/permission.storage';

export type { BrowserPermissionState, BrowserPermissionStates } from './model/permission.query';

export type {
  PermissionRequestPhase,
  RequiredPermissionStatuses,
  UsePermissionRequestValue,
} from './model/permission.hook';
