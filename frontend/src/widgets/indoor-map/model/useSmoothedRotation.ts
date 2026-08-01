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
 * 지도를 돌리기 시작하는 최소 방향 변화(도).
 *
 * **흔들림과 실제 회전을 가르는 것은 시간이 아니라 크기다.**
 *
 * 걷는 동안 손에 든 단말의 yaw는 걸음마다 좌우로 오간다. 방향 채널이 5° 데드밴드로 거르지만
 * (`PROVISIONAL_HEADING_DEADBAND_DEG`) 흔들림이 그보다 크면 그대로 통과하고, 5.4배로 당겨진
 * 화면에서 도면 가장자리는 그 몇 배로 쓸린다. 지도가 이리저리 흔들리는 것으로 보인다.
 *
 * 시간 상수로는 갈라낼 수 없다. 흔들림이 1Hz 안팎이라 실제 회전과 시간 규모가 겹치기
 * 때문이다 — 실측에서 400ms를 걸어도 ±5° 흔들림이 화면에서 5.66°로 남았고, 그만큼 걸러내려면
 * 90° 회전을 따라잡는 데 2초가 넘게 걸렸다. 크기로 가르면 둘 다 해결된다. 걸음 흔들림은
 * 10° 남짓이고 사람이 방향을 바꾸는 것은 그보다 훨씬 크다.
 *
 * 한 번 돌기 시작하면 목표에 닿을 때까지 따라간다(`RELEASE_DEG`). 경계에서 멈춰 서면 작은
 * 변화마다 붙었다 떨어졌다 하게 된다.
 *
 * TODO: 실기기에서 확정한다. 걸으면서 여전히 흔들리면 올리고, 고개를 조금 돌렸는데 지도가
 * 반응하지 않으면 내린다. 흔들림의 실제 폭은 아직 측정되지 않았다
 * (`docs/WebXR_검증_결과.md`에 평면 yaw 지터 항목이 없다).
 */
export const PROVISIONAL_ROTATION_HOLD_DEG = 12;

/** 따라가기를 끝내는 차이(도). 이 안에 들어오면 목표에 맞추고 다시 잡아 둔다. */
const RELEASE_DEG = 1.5;

/**
 * 방향 갱신이 화면에 반영되는 시간 상수(ms).
 *
 * 돌기 시작한 뒤의 속도만 정한다. 흔들림은 위의 크기 기준이 이미 걸렀으므로 여기서는 계단을
 * 부드럽게 잇기만 하면 된다. 250ms면 90° 회전이 0.7초 안에 따라붙는다.
 */
export const PROVISIONAL_ROTATION_TIME_CONSTANT_MS = 250;

/**
 * 지도 회전각을 이어 붙이고 완만하게 따라가게 한다. (S15P11A206-79)
 *
 * 세 가지를 한다.
 *
 * 1. **각도를 이어 붙인다.** 방향각은 `atan2`에서 나와 `(-180, 180]`을 돈다. 미터 프레임 +X
 *    반대쪽(역삼역이면 대합실을 되돌아 걷는 방향)을 보면 179°와 -179° 사이를 오가는데, 그
 *    값을 그대로 CSS `rotate`에 넣으면 2° 흔들림이 358° 회전으로 그려져 지도가 한 바퀴 돈다.
 *    최단 차이만 누적하므로 언제나 짧은 쪽으로 돈다.
 * 2. **걸음 흔들림에는 반응하지 않는다.** 변화가 `PROVISIONAL_ROTATION_HOLD_DEG`을 넘어야
 *    돌기 시작하고, 시작하면 목표에 닿을 때까지 따라간다.
 * 3. **계단을 완만하게 편다.** 프레임마다 남은 차이의 일부만 좁힌다. 시간 상수 기반이라
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
  holdDeg: number = PROVISIONAL_ROTATION_HOLD_DEG,
): number | null {
  const [displayDeg, setDisplayDeg] = useState<number | null>(null);
  /** 프레임 사이에 이어지는 현재 각도. 상태 갱신은 비동기라 프레임 안에서 읽을 수 없다. */
  const displayRef = useRef<number | null>(null);
  /** 지금 목표를 따라가는 중인지. 잡아 두는 구간과 따라가는 구간을 가른다. */
  const chasingRef = useRef(false);

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
        chasingRef.current = false;
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
        chasingRef.current = false;
        apply(targetDeg);
        return;
      }

      const elapsed = previousTime === null ? 0 : time - previousTime;
      previousTime = time;

      const delta = shortestAngleDeltaDeg(current, targetDeg);

      /*
       * 걸음 흔들림 구간. 지도를 잡아 두고 프레임도 놓는다.
       *
       * 여기서 조금씩이라도 따라가면 흔들림이 그대로 화면에 남는다. 크기로 가르는 것이
       * 목적이므로 문턱 아래에서는 아무것도 하지 않는다.
       */
      if (!chasingRef.current) {
        if (Math.abs(delta) <= holdDeg) return;
        chasingRef.current = true;
      }

      /*
       * 따라잡았다. 목표에 맞추고 다시 잡아 둔다.
       *
       * `SETTLE_DEG`가 아니라 그보다 넉넉한 값으로 끊는 이유는, 목표 자체가 흔들리는 동안에는
       * 차이가 0에 수렴하지 않기 때문이다. 그대로 두면 따라가는 구간에서 빠져나오지 못한다.
       */
      if (Math.abs(delta) <= RELEASE_DEG) {
        chasingRef.current = false;
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
  }, [targetDeg, timeConstantMs, holdDeg]);

  return displayDeg;
}
