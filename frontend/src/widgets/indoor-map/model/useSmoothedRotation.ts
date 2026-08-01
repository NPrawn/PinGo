import { useEffect, useRef, useState } from 'react';

/**
 * 두 각도 사이의 최단 차이(도). 결과는 `[-180, 180)`이다.
 *
 * 각도를 그냥 빼면 179°와 -179°가 358° 떨어진 것으로 나온다. 실제로는 2°다.
 */
export function shortestAngleDeltaDeg(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/**
 * 표시 각도가 목표에 붙었다고 보는 차이(도). 이보다 작게 남으면 목표에 맞추고 프레임을 놓는다.
 *
 * 지수 평활은 목표에 정확히 닿지 않으므로 끊을 지점이 필요하다. 0.05°는 안내 화면 지도에서
 * 가장 먼 모서리가 0.3px 움직이는 각도라 화면에서 구분되지 않는다.
 */
const SETTLE_DEG = 0.05;

/**
 * 방향 갱신이 화면에 반영되는 시간 상수(ms).
 *
 * **provisional이다.** 방향 채널은 5° 데드밴드로 걸러 최소 120ms 간격으로 온다
 * (`PROVISIONAL_HEADING_DEADBAND_DEG`). 그 5° 계단을 그대로 지도에 걸면, 5.4배로 당겨진
 * 화면에서는 도면 가장자리가 30px씩 튄다. 손에 든 단말이 데드밴드 경계에서 흔들리면 같은
 * 폭으로 좌우로 흔들린다.
 *
 * 180ms면 2Hz 흔들림을 3분의 1로 줄이면서, 초당 60° 회전에서 뒤처지는 각도가 11°다.
 * 걷는 사람이 몸을 돌리는 속도에서 늦다고 느끼지 않는 선으로 잡았다.
 *
 * TODO: 실기기에서 정지 중 흔들림과 회전 추종 지연을 함께 보고 확정한다.
 */
export const PROVISIONAL_ROTATION_TIME_CONSTANT_MS = 180;

/**
 * 지도 회전각을 이어 붙이고 완만하게 따라가게 한다. (S15P11A206-79)
 *
 * 두 가지를 한다.
 *
 * 1. **각도를 이어 붙인다.** 방향각은 `atan2`에서 나와 `(-180, 180]`을 돈다. 미터 프레임 +X
 *    반대쪽(역삼역이면 대합실을 되돌아 걷는 방향)을 보면 179°와 -179° 사이를 오가는데, 그
 *    값을 그대로 CSS `rotate`에 넣으면 2° 흔들림이 358° 회전으로 그려져 지도가 한 바퀴 돈다.
 *    최단 차이만 누적하므로 언제나 짧은 쪽으로 돈다.
 * 2. **계단을 완만하게 편다.** 프레임마다 남은 차이의 일부만 좁힌다. 시간 상수 기반이라
 *    프레임 간격이 들쭉날쭉해도 같은 속도로 수렴한다.
 *
 * 위치가 아니라 **회전각만** 평활한다. 화면 이동량(x·y)은 이 각도에서 다시 계산되므로
 * (`computeFollowView`), 둘을 따로 애니메이션하면 도는 동안 내 위치가 앵커에서 미끄러진다.
 *
 * @param targetDeg 목표 회전각. 방향을 모르면 null이며 그때는 돌리지 않는다.
 */
export function useSmoothedRotationDeg(
  targetDeg: number | null,
  timeConstantMs: number = PROVISIONAL_ROTATION_TIME_CONSTANT_MS,
): number | null {
  const [displayDeg, setDisplayDeg] = useState<number | null>(null);
  /** 프레임 사이에 이어지는 현재 각도. 상태 갱신은 비동기라 프레임 안에서 읽을 수 없다. */
  const displayRef = useRef<number | null>(null);

  /**
   * 목표가 바뀔 때마다 프레임 루프를 다시 건다.
   *
   * **갱신은 모두 프레임 안에서 한다.** 효과 본문에서 바로 상태를 바꾸면 렌더가 연쇄된다.
   * 방향을 처음 잡거나 잃는 것도 한 프레임 뒤에 반영되는데, 16ms라 화면에서 구분되지 않는다.
   */
  useEffect(() => {
    let frame: number | null = null;
    let previousTime: DOMHighResTimeStamp | null = null;

    const apply = (value: number | null): void => {
      displayRef.current = value;
      setDisplayDeg(value);
    };

    const step = (time: DOMHighResTimeStamp): void => {
      frame = null;
      const current = displayRef.current;

      // 방향을 잃었다. 다음에 다시 잡으면 그 각도에서 새로 시작한다.
      if (targetDeg === null) {
        if (current !== null) apply(null);
        return;
      }

      /**
       * 첫 방향은 붙여서 보여준다.
       *
       * 0°에서 애니메이션으로 들어오면, 방향을 처음 잡는 순간 지도가 제자리에서 크게 도는
       * 것으로 보인다. 그 회전은 사용자가 움직인 결과가 아니다.
       */
      if (current === null) {
        apply(targetDeg);
        return;
      }

      const elapsed = previousTime === null ? 0 : time - previousTime;
      previousTime = time;

      const delta = shortestAngleDeltaDeg(current, targetDeg);

      if (Math.abs(delta) <= SETTLE_DEG) {
        // 목표에 닿았다. 다음 방향이 올 때까지 프레임을 잡아 두지 않는다.
        apply(current + delta);
        return;
      }

      apply(current + delta * (1 - Math.exp(-elapsed / timeConstantMs)));
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [targetDeg, timeConstantMs]);

  return displayDeg;
}
