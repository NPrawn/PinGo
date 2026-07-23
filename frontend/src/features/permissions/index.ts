export {
  requestLocationPermission,
  requestMediaPermissions,
  requestRequiredPermissions,
  stopMediaStream,
} from './permission.service';

export {
  clearStoredRequiredPermissionState,
  getStoredRequiredPermissionState,
  saveRequiredPermissionState,
  toStoredRequiredPermissionState,
} from './permission.storage';

export type {
  LocationPermissionResult,
  MediaPermissionsResult,
  PermissionError,
  PermissionKind,
  PermissionRequestResult,
  PermissionStatus,
  RequiredPermissionsResult,
} from './permission.service';

export type {
  StoredRequiredPermissionState,
} from './permission.storage';
