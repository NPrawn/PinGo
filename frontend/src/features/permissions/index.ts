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

export { usePermissionRequest } from './model/permission.hook';

export type {
  LocationPermissionResult,
  MediaPermissionsResult,
  PermissionError,
  PermissionKind,
  PermissionRequestResult,
  PermissionStatus,
  RequiredPermissionsResult,
  SingleMediaPermissionResult,
} from './model/permission.service';

export type { StoredRequiredPermissionState } from './model/permission.storage';

export type { PermissionRequestPhase, UsePermissionRequestValue } from './model/permission.hook';
