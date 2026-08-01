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

  /**
   * 권한 계층은 실패를 결과 객체로 돌려주게 되어 있지만, 예외가 새어 나오면 상태가
   * `starting`에 갇힌다. 그러면 화면은 이유 없는 대체 그림만 보여준다 — 안내 문구는
   * `starting`에서 아무것도 그리지 않는다.
   */
  it('권한 요청이 거부를 던져도 상태를 error로 끝낸다', async () => {
    mockedRequest.mockRejectedValue(new Error('예기치 않은 실패'));

    // 거부도 일시적 실패로 보고 재시도하므로, 그 대기를 지나가야 끝난다.
    const pending = acquireCamera();
    await vi.advanceTimersByTimeAsync(2_000);
    await pending;

    expect(useCameraStore.getState()).toEqual({ stream: null, status: 'error' });
  });

  /**
   * 안내 화면에서 재인식을 누르면 XR 세션 종료(`void controller.stop()`)가 결과를 기다리지 않고
   * 촬영 화면이 곧바로 카메라를 요구한다. 세션이 아직 카메라를 쥐고 있으면 첫 시도가 실패한다.
   */
  it('일시적 실패는 다시 시도해서 열린다', async () => {
    const stream = fakeStream();
    mockedRequest
      .mockResolvedValueOnce({ kind: 'camera', status: 'error' })
      .mockResolvedValueOnce(granted(stream));

    const pending = acquireCamera();
    await vi.advanceTimersByTimeAsync(300);
    await pending;

    expect(mockedRequest).toHaveBeenCalledTimes(2);
    expect(useCameraStore.getState()).toEqual({ stream, status: 'live' });
  });

  it('재시도를 다 써도 안 열리면 error로 끝낸다', async () => {
    mockedRequest.mockResolvedValue({ kind: 'camera', status: 'error' });

    const pending = acquireCamera();
    await vi.advanceTimersByTimeAsync(2_000);
    await pending;

    // 첫 시도 + 재시도 2회
    expect(mockedRequest).toHaveBeenCalledTimes(3);
    expect(useCameraStore.getState()).toEqual({ stream: null, status: 'error' });
  });

  /** 사용자 결정과 환경은 다시 물어도 결과가 같다. 헛되게 두 번 더 묻지 않는다. */
  it.each(['denied', 'unsupported'] as const)('%s는 다시 시도하지 않는다', async (status) => {
    mockedRequest.mockResolvedValue({ kind: 'camera', status });

    await acquireCamera();

    expect(mockedRequest).toHaveBeenCalledTimes(1);
    expect(useCameraStore.getState().status).toBe(status);
  });

  /** 재시도를 기다리는 사이 화면이 모두 떠났으면 카메라를 열지 않는다. */
  it('재시도 대기 중 마지막 화면이 떠나면 그만둔다', async () => {
    mockedRequest.mockResolvedValue({ kind: 'camera', status: 'error' });

    const pending = acquireCamera();
    releaseCamera();
    await vi.advanceTimersByTimeAsync(2_000);
    await pending;

    expect(mockedRequest).toHaveBeenCalledTimes(1);
    expect(useCameraStore.getState()).toEqual({ stream: null, status: 'idle' });
  });

  /**
   * XR 세션이 열리는 순간 진행 중인 시도가 있으면, 그 시도는 결과를 반영해서는 안 된다.
   * 나중에 깨어나 카메라를 열면 세션이 카메라를 쓰는 중이라 pose가 끊긴다(11.8).
   */
  it('stopCamera는 진행 중인 시도가 카메라를 되살리지 못하게 한다', async () => {
    const stream = fakeStream();
    mockedRequest.mockResolvedValue(granted(stream));

    const pending = acquireCamera();
    stopCamera();
    await pending;

    expect(mockedStop).toHaveBeenCalledWith(stream);
    expect(useCameraStore.getState()).toEqual({ stream: null, status: 'idle' });
  });

  /**
   * **세대 가드가 없으면 여기서 카메라가 되살아난다.**
   *
   * `stopCamera`가 붙잡은 수를 0으로 만들어도, 그 뒤에 다른 화면이 붙잡으면 다시 1이 된다.
   * 그 상태에서 무효가 된 옛 시도가 늦게 응답하면 "아직 보는 화면이 있다"고 판단해 스트림을
   * 스토어에 넣는다. XR 세션이 이미 열린 뒤라면 그 순간 pose가 끊긴다(11.8).
   */
  it('stopCamera 뒤 새 화면이 붙잡아도 옛 시도가 카메라를 되살리지 않는다', async () => {
    const stale = fakeStream();
    const fresh = fakeStream();
    let answerStale!: (result: ReturnType<typeof granted>) => void;
    mockedRequest
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answerStale = resolve;
          }),
      )
      .mockResolvedValue(granted(fresh));

    const staleAttempt = acquireCamera();
    stopCamera();
    // XR을 닫고 돌아온 화면이 다시 붙잡는다. 붙잡은 수가 1로 돌아온다.
    await acquireCamera();
    // 이제 옛 시도가 늦게 응답한다.
    answerStale(granted(stale));
    await staleAttempt;

    // 늦게 온 스트림은 정리되고, 화면은 새 시도의 것을 그대로 쓴다.
    expect(mockedStop).toHaveBeenCalledWith(stale);
    expect(useCameraStore.getState()).toEqual({ stream: fresh, status: 'live' });
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
