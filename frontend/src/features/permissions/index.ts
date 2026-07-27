export {
  requestLocationPermission,
  requestMediaPermissions,
  requestRequiredPermissions,
  stopMediaStream,
} from './model/permission.service';

export {
  clearStoredRequiredPermissionState,
  getStoredRequiredPermissionState,
  saveRequiredPermissionState,
  toStoredRequiredPermissionState,
} from './model/permission.storage';

export type {
  LocationPermissionResult,
  MediaPermissionsResult,
  PermissionError,
  PermissionKind,
  PermissionRequestResult,
  PermissionStatus,
  RequiredPermissionsResult,
} from './model/permission.service';

export type { StoredRequiredPermissionState } from './model/permission.storage';
