/**
 * 화면에 각도를 그릴 때 필요한 계산. (S15P11A206-382)
 *
 * 방향각은 `atan2`에서 나와 `(-180, 180]`을 돈다. 그 값을 그대로 CSS `rotate`에 넣으면 두 가지가
 * 어긋난다 — 경계에서 한 바퀴 돌고, 눕힌 평면에서는 보이는 각도가 값과 다르다. 둘 다 여기서
 * 다룬다.
 */

/**
 * 두 각도 사이의 최단 차이(도). 결과는 `[-180, 180)`이다.
 *
 * 각도를 그냥 빼면 179도와 -179도가 358도 떨어진 것으로 나온다. 실제로는 2도다.
 */
export function shortestAngleDeltaDeg(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/**
 * 접힌 목표 각도를 직전 값에 이어 붙인다. 결과는 `(-180, 180]`을 넘을 수 있다.
 *
 * **CSS `rotate`에 넣을 값은 접혀 있으면 안 된다.** 실기기 테스트에서 경로 반대쪽을 보고 좌우로
 * 조금씩 돌렸을 때 화살표가 의미 없이 한 바퀴 돌았다. 방향각이 `+179도`에서 `-179도`로 넘어가는
 * 순간 값이 358도 움직이고, CSS가 그 차이를 그대로 애니메이션했기 때문이다. 실제로 사용자가 돈
 * 것은 2도였다.
 *
 * 이어 붙이면 `+179`에서 `+181`이 되어 2도만 움직인다. 뒤를 보고 있는 동안에는 화살표도 뒤를
 * 계속 가리키며 조금씩 흔들릴 뿐이다.
 */
export function unwrapDeg(previous: number, target: number): number {
  return previous + shortestAngleDeltaDeg(previous, target);
}

/**
 * 눕힌 평면 위에서 화면에 보이고 싶은 각도로 보이게 하는 회전각.
 *
 * 왜 필요한가. 카메라 위 화살표를 `rotateX`로 눕혀 3D처럼 보이게 만들면, 그 평면 안에서 d도를
 * 돌린 것이 화면에서는 **d도로 보이지 않는다.** 앞뒤 축이 `cos(기울임)`만큼 눌리기 때문이다.
 * 58도로 눕힌 경우 평면 안 30도가 화면에서는 47도로 보인다.
 *
 * 그래서 실기기 테스트에서 하단 지도가 가리키는 방향과 카메라 위 화살표가 어긋났다. 지도는
 * 방향각을 그대로 돌리는데(`useSmoothedRotationDeg`) 화살표는 눌린 각도로 보였다. 같은 화면의
 * 두 표시가 다른 각도를 말하면 사용자는 어느 쪽을 믿어야 할지 알 수 없다.
 *
 * 기울기를 줄이는 대신 각도를 미리 보정한다. 눕힌 모양은 그대로 두고 보이는 각도만 맞춘다.
 *
 * 유도. 평면 안에서 d도를 돌린 방향의 단위벡터는 `(sin d, cos d)`이고(오른쪽·앞), `rotateX(T)`를
 * 지나면 앞 성분만 `cos T`배로 눌려 화면에서는 `(sin d, cos d·cos T)`가 된다. 화면에서 보이는
 * 각도가 `atan2(sin d, cos d·cos T)`이므로, 이 값이 `screenDeg`가 되는 d는
 *
 * ```text
 * tan d = cos T · tan(screenDeg)   →   d = atan2(cos T · sin(screenDeg), cos(screenDeg))
 * ```
 *
 * `atan2`로 쓰는 이유는 사분면이다. `atan(cos T · tan θ)`로 쓰면 90도를 넘는 방향에서 부호가
 * 뒤집혀, 되돌아가야 할 때 화살표가 앞을 가리킨다. `cos T`가 양수이므로 위 형태는 사인·코사인의
 * 부호를 각각 보존한다.
 *
 * 기울기가 0이면 `cos T = 1`이라 `screenDeg`가 그대로 나온다.
 *
 * @param screenDeg 화면에서 보이고 싶은 각도(도). 위를 0으로 두고 시계 방향이 양수다.
 * @param tiltDeg `rotateX`로 눕힌 각도(도).
 */
export function inPlaneAngleDeg(screenDeg: number, tiltDeg: number): number {
  const screenRad = (screenDeg * Math.PI) / 180;
  const cosTilt = Math.cos((tiltDeg * Math.PI) / 180);

  const rad = Math.atan2(cosTilt * Math.sin(screenRad), Math.cos(screenRad));

  return (rad * 180) / Math.PI;
}
