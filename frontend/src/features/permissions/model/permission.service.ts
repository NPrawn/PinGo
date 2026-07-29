/**
 * 권한 요청 대상.
 *
 * 현재 서비스는 위치, 카메라, 마이크 권한을 모두 필요로 한다.
 */
export type PermissionKind = 'location' | 'camera' | 'microphone';

/**
 * 권한 요청 결과 상태.
 *
 * - idle: 아직 요청하지 않음
 * - granted: 허용됨
 * - denied: 사용자가 거부했거나 브라우저가 차단함
 * - unsupported: 브라우저 또는 실행 환경에서 지원하지 않음
 * - error: 권한 거부 외의 일반 오류
 */
export type PermissionStatus = 'idle' | 'granted' | 'denied' | 'unsupported' | 'error';

/**
 * 브라우저 권한 요청 중 발생한 오류 정보.
 *
 * 브라우저마다 Error.name 값이 다를 수 있으므로
 * 화면에서는 name 자체보다 status를 우선 기준으로 사용한다.
 */
export interface PermissionError {
  name: string;
  message: string;
}

/**
 * 위치, 카메라, 마이크 권한 요청 결과의 공통 형식.
 */
export interface PermissionRequestResult {
  kind: PermissionKind;
  status: PermissionStatus;
  error?: PermissionError;
}

/**
 * 위치 권한 요청 결과.
 *
 * status는 "위치 권한 상태"만 나타낸다. GPS 좌표 획득 여부와는 별개다.
 * - granted: 위치 권한 허용됨. 단, GPS 좌표를 얻었는지는 position 유무로 판단한다.
 *   (실내 등에서 좌표를 못 얻어도 권한이 허용됐으면 granted다. 이때 error에 좌표 실패 사유가 담긴다.)
 * - denied: 사용자가 위치 권한을 거부함.
 *
 * 실내 위치추적은 카메라(WebXR/VPS)와 IMU로 하고, GPS는 현재 역 확인·외부 지도 연계
 * 보조 용도이므로, 좌표를 못 얻는 것 자체는 서비스 진입을 막지 않는다.
 */
export interface LocationPermissionResult extends PermissionRequestResult {
  kind: 'location';
  position?: GeolocationPosition;
}

/**
 * 카메라와 마이크를 한 번에 요청한 결과.
 *
 * UI가 [모두 수락] 버튼 하나이므로 getUserMedia도 video/audio를 함께 요청한다.
 * 단, 브라우저 정책에 따라 실제 권한 팝업은 분리되어 보일 수 있다.
 */
export interface MediaPermissionsResult {
  camera: PermissionRequestResult;
  microphone: PermissionRequestResult;
  stream?: MediaStream;
}

/**
 * 서비스 진입 가능 여부까지 포함한 최종 권한 요청 결과.
 *
 * canUseService가 true인 경우에만 다음 화면으로 이동한다.
 */
export interface RequiredPermissionsResult {
  canUseService: boolean;
  location: LocationPermissionResult;
  camera: PermissionRequestResult;
  microphone: PermissionRequestResult;
}

/**
 * 요청 도중 확정된 단계별 권한 상태.
 *
 * 세 권한을 한 번에 요청하지 않고 위치 → 카메라·마이크 순서로 물어보므로,
 * 화면이 각 단계가 끝나는 즉시 결과를 반영할 수 있도록 중간 상태를 전달한다.
 * 아직 확정되지 않은 권한은 키 자체가 없다.
 */
export type RequiredPermissionsProgress = Partial<Record<PermissionKind, PermissionStatus>>;

/**
 * requestRequiredPermissions 호출 옵션.
 */
export interface RequestRequiredPermissionsOptions {
  /** 각 단계가 끝날 때마다 확정된 상태를 전달받는다. */
  onProgress?: (progress: RequiredPermissionsProgress) => void;
}

/**
 * 위치 권한 요청 옵션.
 *
 * - enableHighAccuracy: 가능한 높은 정확도의 위치를 요청한다.
 * - timeout: 10초 안에 위치를 얻지 못하면 실패로 처리한다.
 * - maximumAge: 캐시된 위치를 재사용하지 않는다.
 */
const locationOptions: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

/**
 * 일반 Error 객체를 앱에서 쓰기 쉬운 PermissionError 형태로 변환한다.
 */
function toPermissionError(error: unknown): PermissionError {
  if (error instanceof Error) {
    return {
      name: error.name || 'UnknownError',
      message: error.message || 'Unknown permission error',
    };
  }

  return {
    name: 'UnknownError',
    message: 'Unknown permission error',
  };
}

/**
 * Geolocation API 전용 오류를 PermissionError 형태로 변환한다.
 */
function toGeolocationError(error: GeolocationPositionError): PermissionError {
  return {
    name:
      error.code === error.PERMISSION_DENIED
        ? 'PermissionDeniedError'
        : error.code === error.POSITION_UNAVAILABLE
          ? 'PositionUnavailableError'
          : error.code === error.TIMEOUT
            ? 'TimeoutError'
            : 'UnknownGeolocationError',
    message: error.message || 'Failed to request location permission',
  };
}

/**
 * 권한 거부로 볼 수 있는 오류인지 판단한다.
 *
 * - NotAllowedError: 카메라/마이크 권한 거부에서 자주 발생
 * - SecurityError: 보안 정책 또는 권한 정책에 의해 차단된 경우
 * - PermissionDeniedError: 위치 권한 거부를 내부에서 변환한 이름
 */
function isPermissionDenied(error: PermissionError): boolean {
  return (
    error.name === 'NotAllowedError' ||
    error.name === 'SecurityError' ||
    error.name === 'PermissionDeniedError'
  );
}

/**
 * 열린 MediaStream의 모든 트랙을 종료한다.
 *
 * 권한 확인만 하고 실제 카메라/마이크 화면을 아직 쓰지 않는 경우,
 * 스트림을 종료하지 않으면 브라우저의 카메라/마이크 표시등이 계속 켜질 수 있다.
 */
export function stopMediaStream(stream?: MediaStream): void {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

/**
 * 위치 권한을 요청한다.
 *
 * 실제 위치 권한 팝업은 navigator.geolocation.getCurrentPosition 호출 시 표시된다.
 */
export function requestLocationPermission(): Promise<LocationPermissionResult> {
  /**
   * 위치, 카메라, 마이크 권한은 HTTPS 또는 localhost 같은 보안 컨텍스트가 필요하다.
   */
  if (!window.isSecureContext) {
    return Promise.resolve({
      kind: 'location',
      status: 'unsupported',
      error: {
        name: 'InsecureContextError',
        message: 'Location permission requires HTTPS or localhost.',
      },
    });
  }

  /**
   * 브라우저가 Geolocation API를 지원하지 않는 경우.
   */
  if (!navigator.geolocation) {
    return Promise.resolve({
      kind: 'location',
      status: 'unsupported',
      error: {
        name: 'UnsupportedError',
        message: 'Geolocation is not supported in this browser.',
      },
    });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      /**
       * 위치 권한 허용 및 위치 조회 성공.
       */
      (position) => {
        resolve({
          kind: 'location',
          status: 'granted',
          position,
        });
      },

      /**
       * 위치 권한 거부, 위치 확인 실패, timeout 등.
       *
       * PERMISSION_DENIED(사용자가 권한 거부)만 denied로 처리해 서비스 진입을 막는다.
       * POSITION_UNAVAILABLE / TIMEOUT은 권한은 허용됐으나 좌표만 못 얻은 경우이므로
       * granted로 간주하고(좌표는 없음), error에 실패 사유를 참고용으로 담는다.
       */
      (error) => {
        const permissionError = toGeolocationError(error);
        const denied = error.code === error.PERMISSION_DENIED;

        resolve({
          kind: 'location',
          status: denied ? 'denied' : 'granted',
          error: permissionError,
        });
      },

      locationOptions,
    );
  });
}

/**
 * 카메라와 마이크 권한을 한 번에 요청한다.
 *
 * 현재 UI 정책:
 * - [모두 수락] 버튼 하나
 * - 카메라와 마이크 중 하나라도 실패하면 서비스 진입 불가
 *
 * 주의:
 * getUserMedia({ video: true, audio: true })는 하나라도 실패하면 전체 요청이 실패한다.
 * 따라서 실패 시 camera/microphone을 같은 상태로 처리한다.
 */
export async function requestMediaPermissions(): Promise<MediaPermissionsResult> {
  /**
   * HTTPS 또는 localhost가 아닌 환경에서는 카메라/마이크를 사용할 수 없다.
   */
  if (!window.isSecureContext) {
    const error = {
      name: 'InsecureContextError',
      message: 'Camera and microphone permissions require HTTPS or localhost.',
    };

    return {
      camera: {
        kind: 'camera',
        status: 'unsupported',
        error,
      },
      microphone: {
        kind: 'microphone',
        status: 'unsupported',
        error,
      },
    };
  }

  /**
   * 브라우저가 MediaDevices API를 지원하지 않는 경우.
   */
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      camera: {
        kind: 'camera',
        status: 'unsupported',
        error: {
          name: 'UnsupportedError',
          message: 'Camera permission is not supported in this browser.',
        },
      },
      microphone: {
        kind: 'microphone',
        status: 'unsupported',
        error: {
          name: 'UnsupportedError',
          message: 'Microphone permission is not supported in this browser.',
        },
      },
    };
  }

  try {
    /**
     * 카메라와 마이크를 동시에 요청한다.
     *
     * 성공하면 카메라와 마이크 모두 granted로 본다.
     */
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    return {
      camera: {
        kind: 'camera',
        status: 'granted',
      },
      microphone: {
        kind: 'microphone',
        status: 'granted',
      },
      stream,
    };
  } catch (error) {
    /**
     * 사용자가 거부했거나, 장치가 없거나, 브라우저 정책상 실패한 경우.
     */
    const permissionError = toPermissionError(error);
    const status: PermissionStatus = isPermissionDenied(permissionError) ? 'denied' : 'error';

    return {
      camera: {
        kind: 'camera',
        status,
        error: permissionError,
      },
      microphone: {
        kind: 'microphone',
        status,
        error: permissionError,
      },
    };
  }
}

/**
 * 카메라 또는 마이크 중 하나만 요청한 결과.
 *
 * 권한이 허용되면 열린 MediaStream을 함께 반환하므로, 카메라 미리보기처럼
 * 스트림이 필요한 화면에서 사용할 수 있다. 사용 후에는 stopMediaStream으로 정리한다.
 */
export interface SingleMediaPermissionResult extends PermissionRequestResult {
  kind: 'camera' | 'microphone';
  stream?: MediaStream;
}

/**
 * 카메라 또는 마이크 권한을 개별적으로 요청한다.
 *
 * requestMediaPermissions는 카메라와 마이크를 함께 요청하지만,
 * 테스트 페이지처럼 각각을 따로 확인해야 하는 경우 이 함수를 사용한다.
 */
async function requestSingleMediaPermission(
  kind: 'camera' | 'microphone',
  constraints: MediaStreamConstraints,
): Promise<SingleMediaPermissionResult> {
  if (!window.isSecureContext) {
    return {
      kind,
      status: 'unsupported',
      error: {
        name: 'InsecureContextError',
        message: 'Camera and microphone permissions require HTTPS or localhost.',
      },
    };
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      kind,
      status: 'unsupported',
      error: {
        name: 'UnsupportedError',
        message: 'Camera and microphone permissions are not supported in this browser.',
      },
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    return {
      kind,
      status: 'granted',
      stream,
    };
  } catch (error) {
    const permissionError = toPermissionError(error);

    return {
      kind,
      status: isPermissionDenied(permissionError) ? 'denied' : 'error',
      error: permissionError,
    };
  }
}

/**
 * 카메라 권한만 요청한다. 허용되면 미리보기에 사용할 수 있는 stream을 함께 반환한다.
 */
export function requestCameraPermission(): Promise<SingleMediaPermissionResult> {
  return requestSingleMediaPermission('camera', { video: true });
}

/**
 * 마이크 권한만 요청한다. 허용되면 오디오 트랙을 가진 stream을 함께 반환한다.
 */
export function requestMicrophonePermission(): Promise<SingleMediaPermissionResult> {
  return requestSingleMediaPermission('microphone', { audio: true });
}

/**
 * 서비스 이용에 필요한 모든 권한을 요청한다.
 *
 * 이 함수가 권한 화면의 [모두 수락] 버튼에 연결될 대표 함수다.
 *
 * 처리 순서:
 * 1. 위치 권한 요청
 * 2. 위치 권한 실패 시 즉시 서비스 진입 불가 처리
 * 3. 카메라+마이크 권한 요청
 * 4. 세 권한이 모두 granted일 때만 canUseService = true
 *
 * onProgress를 넘기면 각 단계가 끝나는 즉시 확정된 상태를 전달받는다.
 */
export async function requestRequiredPermissions({
  onProgress,
}: RequestRequiredPermissionsOptions = {}): Promise<RequiredPermissionsResult> {
  const idleCamera: PermissionRequestResult = {
    kind: 'camera',
    status: 'idle',
  };

  const idleMicrophone: PermissionRequestResult = {
    kind: 'microphone',
    status: 'idle',
  };

  /**
   * 위치 권한을 먼저 요청한다.
   *
   * 위치 권한이 실패하면 서비스 진입이 불가능하므로
   * 카메라/마이크 권한 요청을 이어서 하지 않는다.
   */
  const location = await requestLocationPermission();

  onProgress?.({ location: location.status });

  if (location.status !== 'granted') {
    return {
      canUseService: false,
      location,
      camera: idleCamera,
      microphone: idleMicrophone,
    };
  }

  /**
   * 위치 권한이 허용된 경우에만 카메라+마이크를 요청한다.
   */
  const media = await requestMediaPermissions();

  /**
   * 이번 단계에서는 권한 확인만 하므로 즉시 스트림을 종료한다.
   *
   * 실제 카메라 화면이나 WebRTC 연결에서는 해당 화면에서 별도로 스트림을 다시 요청한다.
   */
  stopMediaStream(media.stream);

  onProgress?.({
    camera: media.camera.status,
    microphone: media.microphone.status,
  });

  const canUseService =
    location.status === 'granted' &&
    media.camera.status === 'granted' &&
    media.microphone.status === 'granted';

  return {
    canUseService,
    location,
    camera: media.camera,
    microphone: media.microphone,
  };
}
