import type { XrPoseReading } from './types';

/**
 * 쿼터니언에서 +y 축 기준 우수 회전각(도)을 구한다.
 *
 * 좌표 스펙 8.2가 전방 벡터를 `(-sin ψ, -cos ψ)`로 정의할 때의 ψ가 이 값이다.
 * WebXR 뷰어의 전방이 -z이기 때문이며, 이 부호 규약은 2·3차 실기기 검증으로 확인됐다
 * (`docs/WebXR_검증_결과.md` 3.0).
 *
 * 검증 페이지 `frontend/public/webxr-probe.html`의 `yawDegOf`와 같은 식이다.
 * 실측 데이터가 이 식으로 산출됐으므로 다른 식으로 바꾸지 않는다.
 */
export function yawDegOf(orientation: { x: number; y: number; z: number; w: number }): number {
  const { x, y, z, w } = orientation;
  const rad = Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));

  return (rad * 180) / Math.PI;
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
