import {
  requestCameraPermission,
  requestLocationPermission,
  requestMediaPermissions,
  requestMicrophonePermission,
  requestRequiredPermissions,
  stopMediaStream,
} from './permission.service';

type GeoSuccess = (position: GeolocationPosition) => void;
type GeoError = (error: GeolocationPositionError) => void;

/**
 * 브라우저 위치/미디어 API는 jsdom에 기본 제공되지 않으므로
 * 테스트마다 필요한 전역을 주입하고 afterEach에서 제거한다.
 */
function setSecureContext(value: boolean): void {
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value,
  });
}

function setGeolocation(value: unknown): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value,
  });
}

function setMediaDevices(value: unknown): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value,
  });
}

const fakePosition = {
  coords: { latitude: 37.5, longitude: 127.0, accuracy: 10 },
  timestamp: 0,
} as unknown as GeolocationPosition;

function createGeolocationError(code: number): GeolocationPositionError {
  return {
    code,
    message: 'geolocation error',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as unknown as GeolocationPositionError;
}

/**
 * stop 호출을 관찰할 수 있는 가짜 MediaStream을 만든다.
 */
function createFakeStream(): {
  stream: MediaStream;
  stop: ReturnType<typeof vi.fn>;
} {
  const stop = vi.fn();
  const track = { stop } as unknown as MediaStreamTrack;
  const stream = { getTracks: () => [track] } as unknown as MediaStream;

  return { stream, stop };
}

/**
 * 실제 브라우저는 getUserMedia 거부 시 name이 'NotAllowedError'인 오류를 던진다.
 */
function createNotAllowedError(): Error {
  const error = new Error('permission denied');
  error.name = 'NotAllowedError';
  return error;
}

beforeEach(() => {
  setSecureContext(true);
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'geolocation');
  Reflect.deleteProperty(navigator, 'mediaDevices');
  Reflect.deleteProperty(window, 'isSecureContext');
});

describe('requestLocationPermission', () => {
  it('보안 컨텍스트가 아니면 unsupported를 반환한다', async () => {
    setSecureContext(false);

    const result = await requestLocationPermission();

    expect(result.status).toBe('unsupported');
    expect(result.error?.name).toBe('InsecureContextError');
  });

  it('geolocation을 지원하지 않으면 unsupported를 반환한다', async () => {
    setGeolocation(undefined);

    const result = await requestLocationPermission();

    expect(result.status).toBe('unsupported');
    expect(result.error?.name).toBe('UnsupportedError');
  });

  it('위치 조회에 성공하면 granted와 position을 반환한다', async () => {
    const getCurrentPosition = vi.fn((success: GeoSuccess) => success(fakePosition));
    setGeolocation({ getCurrentPosition });

    const result = await requestLocationPermission();

    expect(result.status).toBe('granted');
    expect(result.position).toBe(fakePosition);
  });

  it('권한 거부(PERMISSION_DENIED)면 denied를 반환한다', async () => {
    const getCurrentPosition = vi.fn((_success: GeoSuccess, error: GeoError) =>
      error(createGeolocationError(1)),
    );
    setGeolocation({ getCurrentPosition });

    const result = await requestLocationPermission();

    expect(result.status).toBe('denied');
  });

  it('timeout 등 거부가 아닌 실패면 error를 반환한다', async () => {
    const getCurrentPosition = vi.fn((_success: GeoSuccess, error: GeoError) =>
      error(createGeolocationError(3)),
    );
    setGeolocation({ getCurrentPosition });

    const result = await requestLocationPermission();

    expect(result.status).toBe('error');
  });
});

describe('requestMediaPermissions', () => {
  it('보안 컨텍스트가 아니면 카메라/마이크 모두 unsupported를 반환한다', async () => {
    setSecureContext(false);

    const result = await requestMediaPermissions();

    expect(result.camera.status).toBe('unsupported');
    expect(result.microphone.status).toBe('unsupported');
  });

  it('getUserMedia를 지원하지 않으면 unsupported를 반환한다', async () => {
    setMediaDevices({});

    const result = await requestMediaPermissions();

    expect(result.camera.status).toBe('unsupported');
    expect(result.microphone.status).toBe('unsupported');
  });

  it('허용되면 카메라/마이크 모두 granted와 stream을 반환한다', async () => {
    const { stream } = createFakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    setMediaDevices({ getUserMedia });

    const result = await requestMediaPermissions();

    expect(result.camera.status).toBe('granted');
    expect(result.microphone.status).toBe('granted');
    expect(result.stream).toBe(stream);
  });

  it('NotAllowedError면 카메라/마이크 모두 denied를 반환한다', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(createNotAllowedError());
    setMediaDevices({ getUserMedia });

    const result = await requestMediaPermissions();

    expect(result.camera.status).toBe('denied');
    expect(result.microphone.status).toBe('denied');
  });

  it('거부가 아닌 일반 오류면 error를 반환한다', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new Error('device error'));
    setMediaDevices({ getUserMedia });

    const result = await requestMediaPermissions();

    expect(result.camera.status).toBe('error');
    expect(result.microphone.status).toBe('error');
  });
});

describe('requestCameraPermission / requestMicrophonePermission', () => {
  it('카메라만 요청해 granted와 stream을 반환한다', async () => {
    const { stream } = createFakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    setMediaDevices({ getUserMedia });

    const result = await requestCameraPermission();

    expect(result.kind).toBe('camera');
    expect(result.status).toBe('granted');
    expect(result.stream).toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith({ video: true });
  });

  it('마이크만 요청해 granted와 stream을 반환한다', async () => {
    const { stream } = createFakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    setMediaDevices({ getUserMedia });

    const result = await requestMicrophonePermission();

    expect(result.kind).toBe('microphone');
    expect(result.status).toBe('granted');
    expect(result.stream).toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
  });

  it('카메라 거부 시 denied를 반환하고 stream이 없다', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(createNotAllowedError());
    setMediaDevices({ getUserMedia });

    const result = await requestCameraPermission();

    expect(result.status).toBe('denied');
    expect(result.stream).toBeUndefined();
  });

  it('보안 컨텍스트가 아니면 unsupported를 반환한다', async () => {
    setSecureContext(false);

    const result = await requestMicrophonePermission();

    expect(result.status).toBe('unsupported');
    expect(result.error?.name).toBe('InsecureContextError');
  });
});

describe('requestRequiredPermissions', () => {
  it('모든 권한이 허용되면 canUseService가 true이고 확인용 stream을 정리한다', async () => {
    const getCurrentPosition = vi.fn((success: GeoSuccess) => success(fakePosition));
    setGeolocation({ getCurrentPosition });

    const { stream, stop } = createFakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    setMediaDevices({ getUserMedia });

    const result = await requestRequiredPermissions();

    expect(result.canUseService).toBe(true);
    expect(result.location.status).toBe('granted');
    expect(result.camera.status).toBe('granted');
    expect(result.microphone.status).toBe('granted');
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('위치가 거부되면 미디어를 요청하지 않고 canUseService가 false다', async () => {
    const getCurrentPosition = vi.fn((_success: GeoSuccess, error: GeoError) =>
      error(createGeolocationError(1)),
    );
    setGeolocation({ getCurrentPosition });

    const getUserMedia = vi.fn();
    setMediaDevices({ getUserMedia });

    const result = await requestRequiredPermissions();

    expect(result.canUseService).toBe(false);
    expect(result.location.status).toBe('denied');
    expect(result.camera.status).toBe('idle');
    expect(result.microphone.status).toBe('idle');
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});

describe('stopMediaStream', () => {
  it('전달된 stream의 모든 트랙을 정리한다', () => {
    const { stream, stop } = createFakeStream();

    stopMediaStream(stream);

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('stream이 없으면 아무 동작도 하지 않는다', () => {
    expect(() => stopMediaStream(undefined)).not.toThrow();
  });
});
