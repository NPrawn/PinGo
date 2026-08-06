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

  /**
   * 후면 렌즈가 여러 개인 기기에서 초광각이 열리던 문제.
   *
   * `facingMode: 'environment'` 만 주면 브라우저가 후면 중 아무거나 준다. 실측 기기는 후면이
   * `camera 0`(정상)과 `camera 2`(초광각) 두 개인데 Chrome 150 이 `camera 2` 를 고르기
   * 시작해, 코드 변경 없이 화면만 광각으로 바뀌었다.
   */
  describe('후면 렌즈 선택', () => {
    /** `deviceId` 를 돌려주는 트랙을 가진 스트림. */
    function streamOn(deviceId: string): MediaStream {
      return {
        getTracks: () => [{ stop: vi.fn() }],
        getVideoTracks: () => [{ getSettings: () => ({ deviceId }) }],
      } as unknown as MediaStream;
    }

    function withCameras(cameras: { deviceId: string; label: string }[]) {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          enumerateDevices: vi
            .fn()
            .mockResolvedValue(cameras.map((camera) => ({ kind: 'videoinput', ...camera }))),
        },
      });
    }

    const REAR_MAIN = { deviceId: 'rear-0', label: 'camera 0, facing back' };
    const REAR_WIDE = { deviceId: 'rear-2', label: 'camera 2, facing back' };
    const FRONT = { deviceId: 'front-1', label: 'camera 1, facing front' };

    afterEach(() => {
      Reflect.deleteProperty(navigator, 'mediaDevices');
    });

    it('후면이 여러 개면 번호가 가장 작은 렌즈를 고른다', async () => {
      withCameras([FRONT, REAR_WIDE, REAR_MAIN]);
      mockedRequest.mockResolvedValue(granted(streamOn('rear-0')));

      await acquireCamera();

      expect(mockedRequest).toHaveBeenCalledWith({ deviceId: { exact: 'rear-0' } });
      expect(useCameraStore.getState().status).toBe('live');
    });

    /**
     * 권한을 받기 전에는 라벨이 빈 문자열이라 렌즈를 고를 수 없다. 그 첫 요청에서 초광각이
     * 열릴 수 있으므로, 라벨이 보이기 시작한 직후 한 번 바로잡는다.
     */
    it('권한을 막 받아 초광각이 열렸으면 메인 렌즈로 다시 연다', async () => {
      withCameras([
        { deviceId: '', label: '' },
        { deviceId: '', label: '' },
      ]);

      const wide = streamOn('rear-2');
      const main = streamOn('rear-0');

      mockedRequest.mockImplementationOnce(async () => {
        // 권한이 생겼다. 이제 라벨이 보인다.
        withCameras([FRONT, REAR_WIDE, REAR_MAIN]);
        return granted(wide);
      });
      mockedRequest.mockResolvedValue(granted(main));

      await acquireCamera();

      expect(mockedRequest).toHaveBeenNthCalledWith(1, { facingMode: { ideal: 'environment' } });
      expect(mockedRequest).toHaveBeenNthCalledWith(2, { deviceId: { exact: 'rear-0' } });
      // 잘못 열린 스트림은 놓는다. 안드로이드는 같은 카메라를 두 번 열지 못한다.
      expect(mockedStop).toHaveBeenCalledWith(wide);
      expect(useCameraStore.getState()).toEqual({ stream: main, status: 'live' });
    });

    /** 이미 메인이 열렸으면 멀쩡한 스트림을 끊지 않는다. */
    it('처음부터 메인 렌즈가 열렸으면 다시 열지 않는다', async () => {
      withCameras([
        { deviceId: '', label: '' },
        { deviceId: '', label: '' },
      ]);

      const main = streamOn('rear-0');

      mockedRequest.mockImplementationOnce(async () => {
        withCameras([FRONT, REAR_WIDE, REAR_MAIN]);
        return granted(main);
      });

      await acquireCamera();

      expect(mockedRequest).toHaveBeenCalledTimes(1);
      expect(useCameraStore.getState()).toEqual({ stream: main, status: 'live' });
    });

    /**
     * 고른 `deviceId` 를 쓸 수 없는 기기가 있다. 그때도 미리보기는 열려야 한다 —
     * 화각이 어긋나는 것보다 카메라가 아예 안 열리는 쪽이 나쁘다.
     */
    it('고른 렌즈를 쓸 수 없으면 facingMode로 폴백한다', async () => {
      withCameras([REAR_MAIN, REAR_WIDE]);

      const fallback = streamOn('rear-2');

      mockedRequest.mockResolvedValueOnce({
        kind: 'camera',
        status: 'error',
        error: { name: 'OverconstrainedError', message: 'deviceId' },
      });
      mockedRequest.mockResolvedValue(granted(fallback));

      await acquireCamera();

      expect(mockedRequest).toHaveBeenNthCalledWith(1, { deviceId: { exact: 'rear-0' } });
      expect(mockedRequest).toHaveBeenNthCalledWith(2, { facingMode: { ideal: 'environment' } });
      expect(useCameraStore.getState()).toEqual({ stream: fallback, status: 'live' });
    });

    /**
     * 열린 렌즈를 확인할 수 없으면 멀쩡한 스트림을 끊지 않는다.
     *
     * 확인 없이 다시 열면 카메라를 열 때마다 그 도박을 되풀이해서 매번 검은 화면이 깜빡인다.
     */
    it('열린 렌즈의 deviceId를 읽을 수 없으면 다시 열지 않는다', async () => {
      withCameras([
        { deviceId: '', label: '' },
        { deviceId: '', label: '' },
      ]);

      // `getVideoTracks` 가 없는 스트림. `getSettings().deviceId` 를 알 길이 없다.
      const unknown = fakeStream();

      mockedRequest.mockImplementationOnce(async () => {
        withCameras([FRONT, REAR_WIDE, REAR_MAIN]);
        return granted(unknown);
      });

      await acquireCamera();

      expect(mockedRequest).toHaveBeenCalledTimes(1);
      expect(mockedStop).not.toHaveBeenCalled();
      expect(useCameraStore.getState()).toEqual({ stream: unknown, status: 'live' });
    });

    /** 크롬 안드로이드가 아니면 라벨 형식이 다르다. 그때는 지금까지 하던 대로 연다. */
    it('라벨을 읽을 수 없으면 facingMode로 연다', async () => {
      withCameras([{ deviceId: 'webcam', label: 'Integrated Webcam (04f2:b6d9)' }]);
      mockedRequest.mockResolvedValue(granted(streamOn('webcam')));

      await acquireCamera();

      expect(mockedRequest).toHaveBeenCalledTimes(1);
      expect(mockedRequest).toHaveBeenCalledWith({ facingMode: { ideal: 'environment' } });
    });
  });
});
