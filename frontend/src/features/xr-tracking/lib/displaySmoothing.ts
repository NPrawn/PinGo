import type { IndoorPoint } from '@/entities/navigation';

/**
 * 지도 마커의 표시 좌표 평활. (S15P11A206-296)
 *
 * **확정 주기를 다시 거는 것이 아니다.** 위치 확정은 11.4가 정한 대로 295의 샘플러가 이미
 * 끝냈고 여기서 다시 throttle하지 않는다. 이 모듈은 확정된 값을 화면에 어떻게 놓을지만
 * 다룬다 — 11.4의 "상태 확정과 화면 표시를 분리한다"에서 표시 쪽이다.
 */

/**
 * 이 거리(m) 이하의 변화는 마커를 움직이지 않는다.
 *
 * **provisional이다.** 2차 실기기 실측에서 정지 상태 지터가 0.01~0.03m였고 평지 보행 중
 * ΔY 잡음이 ±0.15m였다(`docs/WebXR_검증_결과.md` 3.0 2차). 관측된 잡음 바닥보다 넉넉히
 * 위이면서, 한 번의 확정으로 들어오는 이동보다는 아래여야 한다.
 *
 * **확정 간격에 매여 있다.** 처음에는 0.3m였는데, 그때는 확정이 2m마다 왔기 때문이다.
 * 확정 주기를 0.25m로 좁히면서(`DEFAULT_SAMPLING_RULE`) 그대로 두면 들어오는 모든 확정이
 * 데드밴드에 걸려 마커가 아예 움직이지 않는다. 확정 간격을 다시 손보면 이 값도 함께 본다.
 *
 * TODO: 역삼역 실기기 검증에서 정지 상태 마커가 눈에 띄게 떨리는지 확인하고 확정한다.
 * 평면 지터는 별도로 측정되지 않았고 ΔY 잡음에서 유추한 값이다.
 */
export const PROVISIONAL_DISPLAY_DEADBAND_M = 0.08;

/**
 * 데드밴드를 넘은 변화에 적용할 추종 비율. 1이면 평활 없이 바로 옮긴다.
 *
 * **provisional이다.** 처음에는 0.6이었으나 실기기에서 마커 지연이 체감된다는 확인을 받아
 * 올렸다(S15P11A206-79 안내 지도 검증). 비율이 r일 때 보행 중 남는 지연은
 * `확정 간격 × (1−r)/r`이다. 확정이 2m마다 오던 때 0.6은 1.33m를 상시로 남겼고, 스냅샷
 * 자체가 최대 2m 뒤에 오므로(11.4) 그 위에 얹혀 체감 지연이 두 배가 됐다. 확정 주기를
 * 0.25m로 좁힌 지금 0.9가 남기는 것은 0.03m다.
 *
 * 1로 두지 않는 이유는 스냅샷 하나가 튀었을 때 마커가 그 값으로 통째로 옮겨 가지 않게
 * 하려는 것이다. 정지 중 떨림은 데드밴드가 막으므로 이 비율이 맡을 몫은 아니다.
 */
export const PROVISIONAL_DISPLAY_FOLLOW_RATIO = 0.9;

export interface DisplaySmoothingOptions {
  deadbandM?: number;
  followRatio?: number;
}

/**
 * 직전 표시 좌표와 새로 확정된 좌표를 합쳐 이번에 그릴 좌표를 만든다.
 *
 * 규칙은 셋이다.
 *
 * 1. 직전 표시 좌표가 없으면 새 좌표를 그대로 쓴다. 첫 표시를 평활할 기준이 없다.
 * 2. **층이 바뀌면 그대로 쓴다.** 층이 다른 두 좌표를 섞으면 어느 층에도 없는 위치가 나온다.
 * 3. 평면 이동이 데드밴드 이하면 직전 좌표를 그대로 둔다. 그 이상이면 비율만큼 따라간다.
 *
 * 순수 함수다. 타이머도 rAF도 쓰지 않으며 호출한 만큼만 값이 움직인다.
 */
export function smoothMapPoint(
  previous: IndoorPoint | null,
  next: IndoorPoint,
  options: DisplaySmoothingOptions = {},
): IndoorPoint {
  const {
    deadbandM = PROVISIONAL_DISPLAY_DEADBAND_M,
    followRatio = PROVISIONAL_DISPLAY_FOLLOW_RATIO,
  } = options;

  if (!previous || previous.floorId !== next.floorId) return next;

  const dx = next.mapX - previous.mapX;
  const dy = next.mapY - previous.mapY;
  const moved = Math.hypot(dx, dy);

  /**
   * 잡음 구간. 정지 상태에서도 5초마다 heartbeat 스냅샷이 오는데(11.4) 그때마다 마커가
   * 미세하게 튀면 사용자에게는 위치가 불안정해 보인다.
   */
  if (moved <= deadbandM) return previous;

  return {
    floorId: next.floorId,
    mapX: previous.mapX + dx * followRatio,
    mapY: previous.mapY + dy * followRatio,
  };
}
