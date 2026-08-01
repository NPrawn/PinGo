import { requestCameraPermission, stopMediaStream } from '@/features/permissions';
import { acquireCamera, releaseCamera, stopCamera, useCameraStore } from './cameraStream';

vi.mock('@/features/permissions', () => ({
  requestCameraPermission: vi.fn(),
  stopMediaStream: vi.fn(),
}));

const mockedRequest = vi.mocked(requestCameraPermission);
const mockedStop = vi.mocked(stopMediaStream);

/** 트랙 하나를 가진 최소 스트림. `stopMediaStream`은 목이라 실제로 멈추지 않는다. */
function fakeStream(): MediaStream {
  return { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
}

function granted(stream: MediaStream) {
  return { kind: 'camera' as const, status: 'granted' as const, stream };
}

beforeEach(() => {
  vi.useFakeTimers();
  stopCamera();
  mockedRequest.mockReset();
  mockedStop.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('cameraStream', () => {
  it('허용되면 스트림을 담고 live가 된다', async () => {
    const stream = fakeStream();
    mockedRequest.mockResolvedValue(granted(stream));

    await acquireCamera();

    expect(useCameraStore.getState()).toEqual({ stream, status: 'live' });
  });

  /**
   * 실내 촬영은 후면 카메라여야 한다. 제약을 주지 않으면 폰에서 전면 카메라가 열려 셀카가 나온다.
   * `exact`가 아니라 `ideal`인 이유는 후면 카메라가 없는 PC에서도 열려야 하기 때문이다.
   */
  it('후면 카메라를 ideal로 요청한다', async () => {
    mockedRequest.mockResolvedValue(granted(fakeStream()));

    await acquireCamera();

    expect(mockedRequest).toHaveBeenCalledWith({ facingMode: { ideal: 'environment' } });
  });

  /**
   * 촬영 → 위치 확인 → 경로 선택이 모두 카메라를 쓴다. 화면마다 새로 열면 권한이 허용된 뒤에도
   * 매번 검은 화면이 보인다.
   */
  it('화면이 여러 개 붙잡아도 카메라를 한 번만 연다', async () => {
    mockedRequest.mockResolvedValue(granted(fakeStream()));

    await acquireCamera();
    await acquireCamera();
    await acquireCamera();

    expect(mockedRequest).toHaveBeenCalledTimes(1);
  });

  it('아직 붙잡고 있는 화면이 있으면 정리하지 않는다', async () => {
    const stream = fakeStream();
    mockedRequest.mockResolvedValue(granted(stream));

    await acquireCamera();
    await acquireCamera();
    releaseCamera();
    vi.advanceTimersByTime(10_000);

    expect(mockedStop).not.toHaveBeenCalled();
    expect(useCameraStore.getState().stream).toBe(stream);
  });

  /**
   * 라우터가 이전 화면을 먼저 내리므로 화면 전환 순간 붙잡은 수가 0이 된다. 그때 바로 끊으면
   * 다음 화면이 다시 열면서 깜빡인다. 여유 시간 안에 다시 붙잡으면 같은 스트림을 이어 쓴다.
   */
  it('마지막 화면이 떠나도 여유 시간 안에 다시 붙잡으면 같은 스트림을 쓴다', async () => {
    const stream = fakeStream();
    mockedRequest.mockResolvedValue(granted(stream));

    await acquireCamera();
    releaseCamera();
    vi.advanceTimersByTime(500);
    await acquireCamera();
    vi.advanceTimersByTime(10_000);

    expect(mockedStop).not.toHaveBeenCalled();
    expect(useCameraStore.getState().stream).toBe(stream);
    expect(mockedRequest).toHaveBeenCalledTimes(1);
  });

  it('아무도 붙잡지 않으면 여유 시간 뒤에 끊는다', async () => {
    const stream = fakeStream();
    mockedRequest.mockResolvedValue(granted(stream));

    await acquireCamera();
    releaseCamera();
    vi.advanceTimersByTime(2_000);

    expect(mockedStop).toHaveBeenCalledWith(stream);
    expect(useCameraStore.getState()).toEqual({ stream: null, status: 'idle' });
  });

  /**
   * XR 세션은 여유 시간을 기다릴 수 없다. 1.5초 뒤에 정리하면 세션이 이미 열린 뒤이고,
   * 그러면 세션은 성공하는데 pose가 하나도 들어오지 않는다(11.8).
   */
  it('stopCamera는 여유 시간을 기다리지 않고 즉시 끊는다', async () => {
    const stream = fakeStream();
    mockedRequest.mockResolvedValue(granted(stream));

    await acquireCamera();
    stopCamera();

    expect(mockedStop).toHaveBeenCalledWith(stream);
    expect(useCameraStore.getState().stream).toBeNull();
  });

  it('거부와 미지원을 구분해 남긴다', async () => {
    mockedRequest.mockResolvedValue({ kind: 'camera', status: 'denied' });
    await acquireCamera();
    expect(useCameraStore.getState().status).toBe('denied');

    stopCamera();
    mockedRequest.mockResolvedValue({ kind: 'camera', status: 'unsupported' });
    await acquireCamera();
    expect(useCameraStore.getState().status).toBe('unsupported');
  });

  /** 권한 창을 띄운 채 화면을 벗어나면 아무도 보지 않는 카메라가 켜진 채 남는다. */
  it('요청이 끝나기 전에 마지막 화면이 떠나면 받은 스트림을 바로 정리한다', async () => {
    const stream = fakeStream();
    mockedRequest.mockResolvedValue(granted(stream));

    const pending = acquireCamera();
    releaseCamera();
    await pending;

    expect(mockedStop).toHaveBeenCalledWith(stream);
    expect(useCameraStore.getState()).toEqual({ stream: null, status: 'idle' });
  });
});
