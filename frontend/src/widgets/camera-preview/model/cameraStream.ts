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
 * 마지막 화면이 떠난 뒤 스트림을 정리하기까지 기다리는 시간.
 *
 * 촬영 → 위치 확인 → 경로 선택은 모두 카메라를 보여주는데, 화면이 바뀔 때 라우터가 이전 화면을
 * 먼저 내린다. 그 순간 스트림을 끊으면 다음 화면이 다시 열면서 검은 화면이 깜빡인다.
 * StrictMode의 이펙트 이중 호출도 이 여유로 흡수된다.
 */
const GRACE_MS = 1500;

/**
 * 후면 카메라를 요청한다.
 *
 * **`ideal`로 둔다.** `exact`로 하면 후면 카메라가 없는 기기(노트북 웹캠)에서
 * `OverconstrainedError`로 실패해 미리보기가 아예 안 열린다. 개발 중 PC 확인이 막힌다.
 * `ideal`은 후면이 있으면 그것을, 없으면 있는 것을 준다.
 */
const REAR_CAMERA: MediaTrackConstraints = { facingMode: { ideal: 'environment' } };

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
  starting = requestCameraPermission(REAR_CAMERA)
    .then((result) => {
      if (result.status === 'granted' && result.stream) {
        // 요청이 끝나기 전에 마지막 화면이 떠났다면 그대로 정리한다. 안 그러면 아무도 보지
        // 않는 카메라가 켜진 채 남는다.
        if (holders === 0) {
          stopMediaStream(result.stream);
          useCameraStore.setState({ stream: null, status: 'idle' });
          return;
        }

        useCameraStore.setState({ stream: result.stream, status: 'live' });
        return;
      }

      // `granted`인데 스트림이 없는 경우는 여기로 온다. 실제로는 없지만 타입이 허용하고,
      // 그 상태를 `live`로 두면 화면이 영상이 있다고 믿는다.
      useCameraStore.setState({
        stream: null,
        status: result.status === 'granted' ? 'error' : result.status,
      });
    })
    .finally(() => {
      starting = null;
    });

  return starting;
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

  const { stream } = useCameraStore.getState();
  if (stream) stopMediaStream(stream);
  useCameraStore.setState({ stream: null, status: 'idle' });
}

function cancelGrace(): void {
  if (graceTimer === null) return;
  window.clearTimeout(graceTimer);
  graceTimer = null;
}
