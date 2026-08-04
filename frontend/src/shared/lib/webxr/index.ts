export { DEFAULT_CAMERA_FRAME_FPS, DEFAULT_CAMERA_FRAME_SIZE } from './cameraFrames';
export type { XrCameraFrameSize } from './cameraFrames';
export { angleDiffDeg, planarDistanceM, toPoseReading, yawDegOf } from './pose';
export { createPoseSampler, DEFAULT_SAMPLING_RULE } from './sampler';
export type { XrPoseSampler } from './sampler';
export {
  createXrSessionController,
  PROVISIONAL_HEADING_DEADBAND_DEG,
  PROVISIONAL_HEADING_MIN_INTERVAL_MS,
  PROVISIONAL_TRACKING_LOST_MS,
  xrSessionController,
} from './session';
export type {
  XrCameraStreamHandle,
  XrCameraStreamOptions,
  XrCameraStreamState,
  XrSessionController,
  XrSessionControllerOptions,
  XrSessionState,
  XrStartOptions,
} from './session';
export { canAttemptXrSession, canRetryXrSession, detectXrSupport } from './support';
export type {
  XrFailureReason,
  XrPoseReading,
  XrPoseSnapshot,
  XrSamplingRule,
  XrSnapshotTrigger,
  XrSupport,
  XrTrackingStatus,
} from './types';
