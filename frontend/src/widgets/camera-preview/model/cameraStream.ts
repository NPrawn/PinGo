import { create } from 'zustand';
import { requestCameraPermission, stopMediaStream } from '@/features/permissions';

/**
 * 미리보기 상태.
 *
 * `denied`·`unsupported`를 뭉치지 않는다. 거부는 사용자가 되돌릴 수 있고, 미지원은
 * (보안 컨텍스트가 아니거나 브라우저가 못 하는 경우) 되돌릴 수 없다. 화면이 다른 말을 해야 한다.
 */
export type CameraStatus = 'idle' | 'starting' | 'live' | 'denied' | 'unsupported' | 'error';

interface CameraState {
  stream: MediaStream | null;
  status: CameraStatus;
}

export const useCameraStore = create<CameraState>(() => ({ stream: null, status: 'idle' }));

/**
 * 스트림을 붙잡고 있는 화면 수.
 *
 * **스토어 밖에 둔다.** 이 값이 바뀔 때 화면이 다시 그려질 이유가 없다.
 */
let holders = 0;
/** 진행 중인 요청. 화면 두 개가 동시에 붙잡아도 카메라를 한 번만 연다. */
let starting: Promise<void> | null = null;
let graceTimer: number | null = null;
/**
 * 지금 유효한 시도의 세대.
 *
 * `stopCamera`가 값을 올려 **진행 중인 시도를 무효로 만든다.** 재시도를 기다리는 사이에
 * XR 세션이 열리면 그 시도는 결과를 반영해서는 안 된다 — 세션이 카메라를 쓰는 중에 미리보기가
 * 되살아나면 pose가 끊긴다(11.8).
 */
let generation = 0;

/**
 * 마지막 화면이 떠난 뒤 스트림을 정리하기까지 기다리는 시간.
 *
 * 촬영 → 위치 확인 → 경로 선택은 모두 카메라를 보여주는데, 화면이 바뀔 때 라우터가 이전 화면을
 * 먼저 내린다. 그 순간 스트림을 끊으면 다음 화면이 다시 열면서 검은 화면이 깜빡인다.
 * StrictMode의 이펙트 이중 호출도 이 여유로 흡수된다.
 */
const GRACE_MS = 1500;

/**
 * 후면 카메라를 요청한다. **렌즈를 고르지 못했을 때의 폴백이다.**
 *
 * **`ideal`로 둔다.** `exact`로 하면 후면 카메라가 없는 기기(노트북 웹캠)에서
 * `OverconstrainedError`로 실패해 미리보기가 아예 안 열린다. 개발 중 PC 확인이 막힌다.
 * `ideal`은 후면이 있으면 그것을, 없으면 있는 것을 준다.
 *
 * 다만 후면이 여러 개면 **그중 아무거나** 준다. 그래서 아래에서 렌즈를 직접 고른다.
 */
const REAR_CAMERA: MediaTrackConstraints = { facingMode: { ideal: 'environment' } };

/**
 * 크롬 안드로이드의 카메라 라벨. `camera 0, facing back` 처럼 Camera2 의 카메라 ID 가 그대로 적힌다.
 *
 * 다른 브라우저·플랫폼은 형식이 다르다. 못 읽으면 판단을 포기하고 `facingMode` 로 돌아간다.
 */
const REAR_LABEL = /camera\s+(\d+),\s*facing\s+back/i;

/**
 * 메인 후면 렌즈의 `deviceId` 를 고른다. 고를 수 없으면 null.
 *
 * **후면 렌즈가 여러 개인 기기 때문이다.** `facingMode: 'environment'` 만 주면 브라우저가 후면
 * 중 아무거나 준다. 실측한 기기는 후면이 `camera 0` 과 `camera 2` 두 개인데, Chrome 150 이
 * `camera 2`(초광각)를 고르기 시작해 **코드를 하나도 건드리지 않았는데 화면이 광각으로 바뀌었다.**
 * `camera 0` 이 정상 화각인 것을 실기기에서 확인했다.
 *
 * 카메라 번호가 가장 작은 것을 메인으로 본다. Camera2 는 기본 후면에 0 을 주고 보조 렌즈는 그
 * 뒤 번호를 받는 것이 관례다. 라벨에 기대는 판단이라 견고하지 않지만, 실패하면 null 이라 지금
 * 동작 그대로로 돌아갈 뿐 더 나빠지지 않는다.
 *
 * **값을 저장해 두지 않는다.** `deviceId` 는 오리진마다 다르고 사용자가 저장된 데이터를 지우면
 * 바뀐다. 열 때마다 다시 고른다.
 *
 * **권한을 받기 전에는 라벨이 빈 문자열이라 아무것도 고르지 못한다.** 그때는 null 이고,
 * 호출부가 `facingMode` 로 열어 권한을 받은 뒤 다시 부른다.
 */
async function preferredRearDeviceId(): Promise<string | null> {
  if (!navigator.mediaDevices?.enumerateDevices) return null;

  const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  let best: { number: number; deviceId: string } | null = null;

  for (const device of devices) {
    if (device.kind !== 'videoinput' || !device.deviceId) continue;

    const matched = REAR_LABEL.exec(device.label);

    if (!matched) continue;

    const number = Number(matched[1]);

    if (!best || number < best.number) best = { number, deviceId: device.deviceId };
  }

  return best?.deviceId ?? null;
}

/**
 * 카메라 열기가 실패했을 때 다시 시도하는 간격.
 *
 * **XR 세션이 카메라를 놓는 시차 때문이다.** 안내 화면에서 위치 재인식을 누르면 촬영 화면으로
 * 넘어가는데, 안내 화면의 언마운트 정리가 `void controller.stop()`으로 세션 종료를 **시작만**
 * 하고 결과를 기다리지 않는다(`useXrTracking`). `session.end()`가 비동기라서, 새 화면이 곧바로
 * `getUserMedia`를 부르면 세션이 아직 카메라를 쥐고 있어 `NotReadableError`로 실패할 수 있다.
 * 실기기에서만 나타나는 경합이다.
 *
 * XR 컨트롤러 상태를 직접 들여다보는 대신 재시도로 푼다. 다른 앱이 카메라를 잠깐 잡고 있는
 * 경우까지 같은 방법으로 덮이고, 위젯이 XR을 알 필요도 없어진다.
 *
 * **`denied`·`unsupported`는 다시 시도하지 않는다.** 사용자 결정이거나 환경이라 결과가 같다.
 */
const RETRY_DELAYS_MS: readonly number[] = [250, 750];

/**
 * 미리보기를 시작한다. 이미 켜져 있으면 그대로 쓴다.
 *
 * 카메라 흐름 안에서는 화면이 바뀌어도 같은 스트림을 이어 쓴다. 화면마다 새로 열면 권한이
 * 허용된 뒤에도 매번 수백 ms 검은 화면이 보인다.
 */
export async function acquireCamera(): Promise<void> {
  holders += 1;
  cancelGrace();

  if (useCameraStore.getState().stream) return;
  if (starting) return starting;

  useCameraStore.setState({ status: 'starting' });
  starting = openStream().finally(() => {
    starting = null;
  });

  return starting;
}

/**
 * 스트림을 연다. 일시적 실패는 정해진 횟수만큼 다시 시도한다.
 *
 * **어떤 경로로 끝나도 `starting`에 남지 않는다.** 권한 계층은 실패를 결과 객체로 돌려주게
 * 되어 있지만, 예기치 않은 예외가 새어 나오면 상태가 `starting`에 갇힌다. 그러면 화면은 이유
 * 없는 대체 그림만 보여주고 — 안내 문구는 `starting`에서 아무것도 그리지 않는다 — 사용자는
 * 무엇을 해야 하는지 알 수 없다. 처리되지 않은 프로미스 거부도 함께 남는다.
 */
async function openStream(): Promise<void> {
  const mine = generation;
  /** 이 시도가 아직 유효한지. 아무도 보지 않게 됐거나 `stopCamera`가 끊었으면 거짓이다. */
  const alive = (): boolean => generation === mine && holders > 0;

  /** 고른 메인 후면 렌즈. null 이면 `facingMode` 로 연다. */
  let preferred = await preferredRearDeviceId();
  /**
   * 렌즈를 고를 기회를 이미 썼는지.
   *
   * 권한을 받기 전에는 라벨이 없어 고르지 못하므로, 첫 스트림을 연 **직후에** 한 번 더 고른다.
   * 그 한 번을 여기서 세어 두 번 바꾸지 않는다.
   */
  let lensSettled = preferred !== null;

  /**
   * 렌즈를 고르느라 한 박자 쉬었지만 여기서 `alive()` 를 보지 않는다.
   *
   * 이미 떠났으면 요청을 건너뛰는 편이 빨라 보이지만, 그러면 **요청이 도는 중에 떠나는** 경로와
   * 결과가 갈린다. 정리 책임은 아래 한 곳(스트림을 받은 직후)에 모아 둔다.
   */
  for (let attempt = 0; ; ) {
    const video: MediaTrackConstraints = preferred ? { deviceId: { exact: preferred } } : REAR_CAMERA;
    const result = await requestCameraPermission(video).catch((error: unknown) => ({
      status: 'error' as const,
      stream: undefined,
      error: { name: errorNameOf(error), message: String(error) },
    }));

    if (result.status === 'granted' && result.stream) {
      // 요청이 끝나기 전에 화면이 떠났거나 XR이 끼어들었다면 그대로 정리한다. 안 그러면
      // 아무도 보지 않는 카메라가 켜진 채 남고, XR 세션 중이면 pose가 끊긴다.
      if (!alive()) {
        stopMediaStream(result.stream);
        settleIdle(mine);
        return;
      }

      /**
       * 권한이 막 생겨 이제야 라벨이 보인다. 초광각으로 열렸다면 여기서 바로잡는다.
       *
       * **먼저 놓고 다시 연다.** 안드로이드는 같은 카메라를 동시에 두 번 열지 못한다 —
       * 실기기에서 두 번째 요청이 `NotReadableError` 로 떨어지는 것을 확인했다.
       */
      if (!lensSettled) {
        lensSettled = true;

        const better = await preferredRearDeviceId();
        /**
         * **어느 렌즈가 열렸는지 읽지 못하면 그대로 둔다.** 확인할 수 없는데 다시 여는 것은
         * 멀쩡한 스트림을 끊고 도박하는 것이고, 그 도박을 카메라를 열 때마다 되풀이한다 —
         * 매번 검은 화면이 한 번씩 깜빡인다. 실기기에서는 `getSettings().deviceId` 가 늘
         * 채워지므로, 이 폴백이 도는 것은 그 값을 주지 않는 환경뿐이다.
         */
        const opened = openedDeviceId(result.stream);

        if (better && opened && better !== opened) {
          stopMediaStream(result.stream);
          preferred = better;
          continue;
        }
      }

      useCameraStore.setState({ stream: result.stream, status: 'live' });
      return;
    }

    /**
     * 고른 렌즈를 이 기기에서 쓸 수 없다. 제약을 풀고 곧바로 다시 시도한다.
     *
     * 재시도 횟수를 쓰지 않는다. 기다려서 해결될 일이 아니고, 폴백은 지금까지 쓰던 제약이라
     * 여기서 횟수를 소모하면 정작 일시적 실패에 쓸 몫이 준다.
     */
    if (preferred && result.error?.name === 'OverconstrainedError') {
      preferred = null;
      continue;
    }

    // `granted`인데 스트림이 없는 경우는 여기로 온다. 실제로는 없지만 타입이 허용하고,
    // 그 상태를 `live`로 두면 화면이 영상이 있다고 믿는다.
    const status: CameraStatus = result.status === 'granted' ? 'error' : result.status;

    if (!alive()) {
      settleIdle(mine);
      return;
    }

    if (status !== 'error' || attempt >= RETRY_DELAYS_MS.length) {
      warnWhyUnavailable(status, result.error);
      useCameraStore.setState({ stream: null, status });
      return;
    }

    await wait(RETRY_DELAYS_MS[attempt]);
    attempt += 1;

    if (!alive()) {
      settleIdle(mine);
      return;
    }
  }
}

/**
 * 무효가 된 시도를 조용히 끝낸다.
 *
 * **`stopCamera`가 이미 정리했다면 상태를 건드리지 않는다.** 그쪽이 `idle`로 맞춰 두었고,
 * 그 뒤에 새 시도가 시작됐을 수도 있어 덮으면 그 시도의 상태를 지운다.
 */
function settleIdle(mine: number): void {
  if (generation !== mine) return;
  useCameraStore.setState({ stream: null, status: 'idle' });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** 지금 열린 영상 트랙의 `deviceId`. 읽을 수 없으면 null. */
function openedDeviceId(stream: MediaStream): string | null {
  return stream.getVideoTracks?.()[0]?.getSettings?.().deviceId ?? null;
}

function errorNameOf(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

/** 화면 하나가 미리보기를 놓는다. 마지막이면 잠시 뒤 스트림을 끈다. */
export function releaseCamera(): void {
  holders = Math.max(0, holders - 1);
  if (holders > 0) return;

  cancelGrace();
  graceTimer = window.setTimeout(() => {
    graceTimer = null;
    stopCamera();
  }, GRACE_MS);
}

/**
 * 스트림을 즉시 끊는다.
 *
 * **XR 세션을 열기 전에 반드시 부른다.** `getUserMedia`와 `immersive-ar`는 공존하지 못하고,
 * 미리보기를 켠 채 세션을 열면 오류 없이 열리면서 pose가 하나도 들어오지 않는다(11.8).
 * 여유 시간을 두지 않는 이유가 그것이다 — 1.5초 뒤에 정리하면 세션이 이미 열린 뒤다.
 */
export function stopCamera(): void {
  cancelGrace();
  holders = 0;
  /**
   * 진행 중인 시도를 무효로 만든다.
   *
   * **세대를 올리고 `starting`을 비운다.** 올리지 않으면 재시도를 기다리던 시도가 나중에
   * 깨어나 카메라를 열고, XR 세션이 이미 열린 뒤라면 pose가 끊긴다. `starting`을 비우지 않으면
   * 다음 `acquireCamera`가 그 옛 프로미스를 돌려주어 카메라가 다시 열리지 않는다.
   */
  generation += 1;
  starting = null;

  const { stream } = useCameraStore.getState();
  if (stream) stopMediaStream(stream);
  useCameraStore.setState({ stream: null, status: 'idle' });
}

/**
 * 카메라를 못 켠 기술적 원인을 개발 빌드에서만 남긴다.
 *
 * **화면 문구와 분리한다.** 사용자에게는 자기가 할 수 있는 일만 보여야 하는데, 원인을 찾는
 * 쪽에는 그 구분이 필요하다. 실기기 확인 때 LAN 주소(`http://192.168.x.x:5173`)로 접속하면
 * 보안 컨텍스트가 아니어서 `getUserMedia`가 아예 막히는데, 화면만 보면 권한 거부와 구별되지
 * 않아 원인을 찾는 데 시간이 걸렸다. 그 정보를 여기로 옮긴다.
 *
 * 프로덕션 빌드에서는 `import.meta.env.DEV`가 false라 번들에서 함께 제거된다.
 */
function warnWhyUnavailable(status: CameraStatus, error?: { name: string; message: string }): void {
  if (!import.meta.env.DEV) return;

  const hint =
    status === 'unsupported' && !window.isSecureContext
      ? ' 보안 컨텍스트가 아니다. HTTPS나 localhost로 접속해야 카메라가 열린다.'
      : '';

  console.warn(`[camera-preview] ${status}: ${error?.name ?? '알 수 없음'}.${hint}`);
}

function cancelGrace(): void {
  if (graceTimer === null) return;
  window.clearTimeout(graceTimer);
  graceTimer = null;
}
