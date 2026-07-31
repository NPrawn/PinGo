export {
  PROVISIONAL_DISPLAY_DEADBAND_M,
  PROVISIONAL_DISPLAY_FOLLOW_RATIO,
  smoothMapPoint,
} from './lib/displaySmoothing';
export type { DisplaySmoothingOptions } from './lib/displaySmoothing';
export { createXrMapAnchor, forwardXrOf, normalizePlanar, xrToMapPoint } from './lib/mapAlignment';
export type { PlanarVector, XrAnchorInput, XrAnchorStatus, XrMapAnchor } from './lib/mapAlignment';
export {
  MOCK_ANCHOR_FORWARD_MAP,
  readForwardMap,
  resolveAnchorForwardMap,
} from './model/anchorForward';
export { useXrMapPosition } from './model/useXrMapPosition';
export type {
  UseXrMapPositionOptions,
  UseXrMapPositionValue,
  XrMapPositionSource,
} from './model/useXrMapPosition';
export { useXrTracking } from './model/useXrTracking';
export type { UseXrTrackingOptions, UseXrTrackingValue } from './model/useXrTracking';
