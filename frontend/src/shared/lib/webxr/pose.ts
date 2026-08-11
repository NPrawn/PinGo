import type { XrPoseReading } from './types';

/**
 * 전방 투영이 무너졌다고 보는 한계.
 *
 * `hypot`으로 잰 수평 성분의 크기는 `|cos(기울임각)|`이다. 0.2는 약 78도이고, 그보다 더 눕히면
 * 전방 벡터가 거의 수직이라 수평 방향이 잡히지 않는다. 그 구간에서는 아래 대체식으로 넘어간다.
 */
const FORWARD_HORIZONTAL_FLOOR = 0.2;

/** `(-180, 180]`으로 접는다. 180도를 더한 뒤 범위를 벗어나는 것을 되돌리는 데 쓴다. */
function normalizeDeg(degrees: number): number {
  const wrapped = ((degrees % 360) + 360) % 360;

  return wrapped > 180 ? wrapped - 360 : wrapped;
}

/**
 * 쿼터니언에서 +y 축 기준 우수 회전각(도)을 구한다.
 *
 * 좌표 스펙 8.2가 전방 벡터를 `(-sin ψ, -cos ψ)`로 정의할 때의 ψ가 이 값이다. 그 정의를 그대로
 * 풀면 식이 하나로 정해진다 — 전방은 `R·(0,0,-1) = (-R₀₂, -R₁₂, -R₂₂)`이므로 수평 성분이
 * `(-sin ψ, -cos ψ)`에 비례해야 하고, 따라서 `ψ = atan2(R₀₂, R₂₂)`다.
 *
 * **분모를 `1 - 2(y² + z²)`에서 `1 - 2(x² + y²)`로 고쳤다. (S15P11A206-382)**
 *
 * 옛 식은 `atan2(R₀₂, R₀₀)`이었다. 분자는 전방 축 성분인데 분모는 오른쪽 축 성분이라 서로 다른
 * 축을 짝지은 것이고, 기울임각 θ가 섞이면 `atan2(sin ψ·cos θ, cos ψ)`가 되어 값이 0쪽으로
 * 끌려갔다. 기울임 60도에서 최대 18.4도, 75도에서 30.5도가 어긋나고 90도를 넘으면 180도
 * 뒤집힌다. 오차가 heading 0·90·180도에서 정확히 0이라 축에 정렬된 방향만 확인한 실기기 검증
 * (체크리스트 16번)에서는 드러나지 않았다. 10번이 "실제 각도 대비 오차는 미측정"으로 남겨 둔
 * 구간이 정확히 여기다.
 *
 * 이 오차는 화면 표시만의 문제가 아니었다. 앵커의 회전이 스캔 순간의 이 값으로 고정되므로
 * (`createXrMapAnchor`), 기울여 든 채 위치를 확정하면 이후 걸어간 변위 전체가 잘못된 각도로
 * 회전됐다 — heading 18도 오차는 20m 걸었을 때 지도 위 위치를 6m 옮긴다.
 *
 * 고친 식은 기울임 85도·좌우 기울임(roll) 90도까지 오차가 0이다. 분자와 분모가 모두 회전행렬
 * 3열(카메라 전방)에서 오므로 시선축 회전이 그 열을 건드리지 않기 때문이다.
 *
 * 검증 페이지 `frontend/public/webxr-probe.html`의 `yawDegOf`도 함께 고쳤다. 두 식이 갈라지면
 * 다음 실측이 또 어긋난다. 문서에 기록된 옛 yaw 수치는 옛 식의 값이며, 개정 이력을
 * `docs/WebXR_검증_결과.md`에 남겼다.
 */
export function yawDegOf(orientation: { x: number; y: number; z: number; w: number }): number {
  const { x, y, z, w } = orientation;
  /** 카메라 전방(-Z)의 수평 성분. 부호가 함께 뒤집히므로 비율은 전방 벡터와 같다. */
  const forwardX = 2 * (x * z + w * y);
  const forwardZ = 1 - 2 * (x * x + y * y);

  /**
   * 거의 수직으로 눕힌 경우에는 카메라 up 축으로 갈아탄다.
   *
   * 폰을 바닥이나 천장으로 향하면 전방의 수평 성분이 사라져 방향을 뽑을 수 없다. 그때 up 축이
   * 진행 방향으로 눕는다 — 위치 인식을 위해 주변을 훑는 동안이 정확히 이 상황이고, 그 순간의
   * 값으로 앵커가 만들어지므로 여기서 포기하면 앵커가 틀어진다.
   *
   * **이쪽은 좌우 기울임(roll)에 민감하다.** up 축은 회전행렬 2열이라 시선축 회전이 값을
   * 바꾼다. 전방 투영이 살아 있는 동안에는 위 식을 쓰는 이유다.
   */
  if (Math.hypot(forwardX, forwardZ) < FORWARD_HORIZONTAL_FLOOR) {
    const upX = 2 * (x * y - w * z);
    const upZ = 2 * (y * z + w * x);
    /**
     * 전방의 수직 성분. 기울임각 θ에 대해 `sin θ`와 같다.
     *
     * up 축의 수평 성분은 `sin θ · (sin ψ, cos ψ)`이므로, 위를 볼 때(`sin θ > 0`)는 그대로
     * 진행 방향이고 아래를 볼 때는 반대 방향이 된다. 바닥을 훑는 쪽이 뒤집히는 경우다.
     */
    const forwardY = 2 * (w * x - y * z);
    const deg = (Math.atan2(upX, upZ) * 180) / Math.PI;

    return forwardY < 0 ? normalizeDeg(deg + 180) : deg;
  }

  return (Math.atan2(forwardX, forwardZ) * 180) / Math.PI;
}

/**
 * 카메라가 수평에서 얼마나 벗어났는지. `sin(기울임각)`이며 `[-1, 1]`이다.
 *
 * 양수면 위를, 음수면 아래를 본다. 0이면 수평이고 ±1이면 정확히 천장·바닥을 향한다.
 *
 * **좌우로 비스듬히 들어도(roll) 값이 바뀌지 않는다.** 카메라 전방은 회전행렬 3열이고 시선축
 * 회전은 그 열을 건드리지 않는다. 그래서 이 값은 "카메라가 어디를 향하는가"만 말한다.
 */
export function cameraTiltSinOf(orientation: {
  x: number;
  y: number;
  z: number;
  w: number;
}): number {
  const { x, y, z, w } = orientation;

  // 전방 `R·(0,0,-1)`의 y 성분이다.
  return 2 * (w * x - y * z);
}

/**
 * 단말 up 축이 세계 위쪽을 향하는 정도. `cos(기울임각)`이며 뒤집히면 음수다.
 *
 * **`cameraTiltSinOf`만으로는 부족해서 필요하다.** `sin`은 60도와 120도를 구분하지 못한다 —
 * 앞을 보며 조금 눕힌 자세와 카메라가 뒤를 향하도록 넘어간 자세가 같은 값이 된다. 그 둘을
 * 가르는 것은 부호가 있는 이 값이다.
 *
 * 좌우로 비스듬히 들면(roll) 이 값이 0에 가까워진다. up 축이 회전행렬 2열이라 시선축 회전이
 * 값을 바꾸기 때문이다. 그래서 이 값은 **판정에만** 쓰고 방향각을 만드는 데는 쓰지 않는다 —
 * 부호로 각도를 뒤집으면 옆으로 든 순간 작은 손떨림에 180도씩 뒤집힌다(실측으로 확인했다).
 */
export function deviceUprightOf(orientation: {
  x: number;
  y: number;
  z: number;
  w: number;
}): number {
  const { x, z } = orientation;

  return 1 - 2 * (x * x + z * z);
}

/**
 * 이 값을 넘게 기울면 방향각을 믿지 않는다. `sin 65도`다.
 *
 * **왜 65도인가.** 사람이 걸으며 앞을 보는 자세는 대략 0~45도다. 그보다 더 눕히면 카메라는
 * 바닥이나 천장을 보고 있고, 수평 방향 성분이 빠르게 줄어 방향각이 잡음에 가까워진다.
 *
 * **provisional이다.** 실기기에서 손을 자연스럽게 들었다 내리며 경계가 언제 걸리는지 보고
 * 정한다. 너무 낮으면 정상 자세에서 방향이 멈추고, 너무 높으면 손을 내렸을 때 화면이 돈다.
 */
export const PROVISIONAL_HEADING_TILT_LIMIT_SIN = Math.sin((65 * Math.PI) / 180);

/**
 * 뒤집힘으로 보는 한계. 0이 아니라 조금 음수로 둔다.
 *
 * 정확히 0으로 두면 옆으로 든 자세(roll 90도)에서 값이 0 근처를 오가며 판정이 깜빡인다. 여유를
 * 두면 그 구간이 위 기울임 한계에 먼저 걸려 걸러지므로, 이 값이 실제로 가르는 것은 카메라가
 * 뒤를 향하도록 넘어간 자세뿐이다.
 */
const UPRIGHT_LIMIT = -0.2;

/**
 * 지금 자세에서 나온 방향각을 화면에 반영해도 되는지. (S15P11A206-382)
 *
 * **몸이 향한 방향과 카메라가 향한 방향은 다르다.** 정면을 보고 서서 들고 있던 손만 내리면
 * 카메라는 바닥을, 더 내리면 뒤쪽을 향한다. 그때 방향각을 그대로 쓰면 지도와 화살표가 사용자가
 * 뒤돌아선 것처럼 회전한다 — 실기기에서 관측된 현상이다.
 *
 * 기기 자세만으로 몸의 방향을 알 수는 없다. 그래서 맞히려 하지 않고, **믿을 수 없는 구간에서는
 * 갱신하지 않는다.** 직전 방향을 그대로 두면 손을 내렸다 다시 들 때까지 화면이 가만히 있고,
 * 사용자가 실제로 방향을 바꾸지 않았다면 그것이 정확한 표시다.
 *
 * 두 조건을 함께 본다. 앞뒤로 눕힌 정도만 보면 카메라가 뒤를 향하도록 넘어간 자세를 통과시키고
 * (`sin`이 60도와 120도를 구분하지 못한다), 뒤집힘만 보면 바닥을 향한 자세를 통과시킨다. 둘을
 * 함께 걸면 통과하는 구간이 정확히 `기울임 65도 안쪽`이 된다.
 */
export function isHeadingTrustworthy(
  orientation: { x: number; y: number; z: number; w: number },
  tiltLimitSin = PROVISIONAL_HEADING_TILT_LIMIT_SIN,
): boolean {
  return (
    Math.abs(cameraTiltSinOf(orientation)) <= tiltLimitSin &&
    deviceUprightOf(orientation) > UPRIGHT_LIMIT
  );
}

/**
 * 두 각도(도) 사이의 최소 차이를 구한다. 결과는 0 이상 180 이하다.
 *
 * 확정 트리거에는 쓰지 않는다(11.4에서 회전 트리거가 제거됐다). 표시 갱신과
 * 진단 목적으로만 쓴다.
 */
export function angleDiffDeg(a: number, b: number): number {
  const diff = (((a - b + 180) % 360) - 180 + 360) % 360;

  return Math.abs(diff > 180 ? diff - 360 : diff);
}

/**
 * 평면 이동 거리(m).
 *
 * XR 평면은 (x, z)이므로 y는 넣지 않는다. 11.4의 "2m 이상 이동"은 지도 위 위치가
 * 얼마나 움직였는지를 뜻하므로, 계단에서 생기는 높이 변화가 거리에 섞이면 안 된다.
 * 높이 변화는 ΔY로 따로 다루며 층 전환 판정용이다(11.2).
 */
export function planarDistanceM(
  from: { x: number; z: number },
  to: { x: number; z: number },
): number {
  return Math.hypot(to.x - from.x, to.z - from.z);
}

/**
 * XRViewerPose를 앱이 다루는 값으로 옮긴다.
 *
 * XRRigidTransform과 DOMPointReadOnly는 프레임 밖으로 들고 나가지 않고 숫자만 복사한다.
 * XR 객체를 화면 상태에 보관하지 않는다는 `frontend/AGENTS.md` 규칙과도 맞는다.
 */
export function toPoseReading(pose: XRViewerPose, timestamp: DOMHighResTimeStamp): XrPoseReading {
  const { position, orientation } = pose.transform;

  return {
    position: { x: position.x, y: position.y, z: position.z },
    orientation: {
      x: orientation.x,
      y: orientation.y,
      z: orientation.z,
      w: orientation.w,
    },
    yawDeg: yawDegOf(orientation),
    timestamp,
  };
}
