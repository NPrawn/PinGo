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
 * 들어온 방향각을 고르는 시간 상수(ms). **걸음 흔들림을 여기서 없앤다.**
 *
 * 실측이 있다. 1차 실기기 검증에서 손에 들고 걸을 때 1초 창의 yaw 회전량 **중앙값이 23.5°**
 * 였다(`docs/기술_의사결정_정리.md` 11.4 — 회전을 위치 확정 트리거에서 빼게 만든 그 값이다).
 * 걸음 흔들림이 ±12° 수준이라는 뜻이고, 웬만한 문턱은 그냥 넘는다.
 *
 * 다만 흔들림은 걸음 주기(1~2Hz)로 좌우가 상쇄되고 실제 회전은 한쪽으로 지속된다. 그래서
 * 시간으로 고르는 것이 여기서는 통한다 — 500ms면 1.5Hz 성분이 5분의 1로 줄어 ±12°가 ±2.5°가
 * 되고, 실제 회전은 0.5초 늦게 따라온다. 지도에서 0.5초는 눈에 띄지 않는다.
 *
 * **차례가 중요하다.** 고르기를 먼저 하고 문턱을 뒤에 둔다. 반대로 하면 흔들리는 원본이 문턱을
 * 넘어 버려서 문턱이 하는 일이 없다.
 *
 * TODO: 실기기에서 확정한다. 걸으면서 여전히 흔들리면 올리고, 몸을 돌렸을 때 지도가 굼뜨면
 * 내린다.
 */
export const PROVISIONAL_HEADING_INPUT_TAU_MS = 500;

/**
 * 지도를 돌리기 시작하는 최소 방향 변화(도).
 *
 * 위에서 흔들림을 걸렀으므로 여기서 막을 것은 남은 잔떨림(±2.5°)뿐이다. 8°면 그것을 덮으면서
 * 사람이 의도해서 튼 방향은 대부분 통과시킨다.
 *
 * 문턱의 값어치는 **화면을 다시 그리지 않는 것**에 있다. 조금씩이라도 계속 따라가게 두면
 * 걷는 내내 매 프레임 지도 전체가 다시 그려진다.
 */
export const PROVISIONAL_ROTATION_HOLD_DEG = 8;

/**
 * 따라가기를 끝내는 차이(도).
 *
 * 문턱보다 넉넉히 작되 0에 가깝지 않아야 한다. 목표가 미세하게 움직이는 동안에는 차이가 0으로
 * 수렴하지 않으므로, 너무 좁게 잡으면 따라가는 구간에서 빠져나오지 못한다.
 */
const RELEASE_DEG = 3;

/** 이만큼도 안 움직였으면 화면을 다시 그리지 않는다. 0.05°는 도면 모서리가 0.3px 움직인다. */
const REDRAW_DEG = 0.05;

/**
 * 돌기 시작한 뒤 따라가는 속도의 시간 상수(ms).
 *
 * 흔들림은 위 두 단계가 이미 걸렀으므로 여기서는 계단을 부드럽게 잇기만 하면 된다.
 */
export const PROVISIONAL_ROTATION_TIME_CONSTANT_MS = 250;

export interface SmoothedRotationOptions {
  /** 들어온 각도를 고르는 시간 상수. 걸음 흔들림 제거용이다. */
  inputTauMs?: number;
  /** 표시 각도가 목표를 따라가는 속도. */
  chaseTauMs?: number;
  /** 돌기 시작하는 최소 변화. */
  holdDeg?: number;
}

/**
 * 지도 회전각을 이어 붙이고, 걸음 흔들림을 걸러 완만하게 따라가게 한다. (S15P11A206-79)
 *
 * 세 단계다.
 *
 * 1. **고르기** — 들어온 방향각을 시간 상수로 low-pass한다. 걸음 흔들림이 여기서 빠진다.
 * 2. **문턱** — 고른 값과 화면의 차이가 문턱을 넘어야 돌기 시작한다.
 * 3. **따라가기** — 남은 차이를 좁히고, 다 좁히면 멈춘다.
 *
 * 어느 단계든 각도는 **최단 차이로만** 누적한다. 방향각은 `atan2`에서 나와 `(-180, 180]`을
 * 도는데(역삼역이면 대합실을 되돌아 걷는 방향이 그 경계다) 그 값을 그대로 CSS `rotate`에
 * 넣으면 2° 흔들림이 358° 회전으로 그려져 지도가 한 바퀴 돈다.
 *
 * **프레임을 도는 것과 화면을 다시 그리는 것은 다르다.** 고르기는 방향이 멈춘 뒤에도 수렴해야
 * 하므로(멈춘 뒤 갱신이 끊기면 지도가 실제 방향에 못 미친 채로 선다) 프레임에서 돌린다. 대신
 * 표시 각도가 실제로 움직였을 때만 상태를 바꾼다 — 잡아 두는 동안에는 리렌더가 없다.
 *
 * 위치가 아니라 **회전각만** 평활한다. 화면 이동량(x·y)은 이 각도에서 다시 계산되므로
 * (`computeFollowView`), 둘을 따로 애니메이션하면 도는 동안 내 위치가 앵커에서 미끄러진다.
 *
 * @param targetDeg 목표 회전각. 방향을 모르면 null이며 그때는 돌리지 않는다.
 */
export function useSmoothedRotationDeg(
  targetDeg: number | null,
  options: SmoothedRotationOptions = {},
): number | null {
  const {
    inputTauMs = PROVISIONAL_HEADING_INPUT_TAU_MS,
    chaseTauMs = PROVISIONAL_ROTATION_TIME_CONSTANT_MS,
    holdDeg = PROVISIONAL_ROTATION_HOLD_DEG,
  } = options;

  const [displayDeg, setDisplayDeg] = useState<number | null>(null);
  /** 프레임 사이에 이어지는 표시 각도. 상태 갱신은 비동기라 프레임 안에서 읽을 수 없다. */
  const displayRef = useRef<number | null>(null);
  /** 흔들림을 걸러 낸 목표. */
  const inputRef = useRef<number | null>(null);
  /** 지금 목표를 따라가는 중인지. 잡아 두는 구간과 따라가는 구간을 가른다. */
  const chasingRef = useRef(false);

  useEffect(() => {
    let frame: number | null = null;
    let previousTime: DOMHighResTimeStamp | null = null;

    const apply = (value: number | null): void => {
      displayRef.current = value;
      setDisplayDeg(value);
    };

    const step = (time: DOMHighResTimeStamp): void => {
      frame = null;

      // 방향을 잃었다. 다음에 다시 잡으면 그 각도에서 새로 시작한다.
      if (targetDeg === null) {
        chasingRef.current = false;
        inputRef.current = null;
        if (displayRef.current !== null) apply(null);
        return;
      }

      /**
       * 첫 방향은 붙여서 보여준다.
       *
       * 0°에서 애니메이션으로 들어오면, 방향을 처음 잡는 순간 지도가 제자리에서 크게 도는
       * 것으로 보인다. 그 회전은 사용자가 움직인 결과가 아니다.
       */
      if (inputRef.current === null || displayRef.current === null) {
        chasingRef.current = false;
        inputRef.current = targetDeg;
        apply(targetDeg);
        return;
      }

      const elapsed = previousTime === null ? 0 : time - previousTime;
      previousTime = time;

      // 1) 고르기.
      const toTarget = shortestAngleDeltaDeg(inputRef.current, targetDeg);
      inputRef.current += toTarget * (1 - Math.exp(-elapsed / inputTauMs));

      const current = displayRef.current;
      const delta = shortestAngleDeltaDeg(current, inputRef.current);

      // 2) 문턱. 넘지 않으면 화면은 그대로 두고, 고르기만 계속 수렴시킨다.
      if (!chasingRef.current && Math.abs(delta) > holdDeg) chasingRef.current = true;

      if (chasingRef.current) {
        // 3) 따라가기.
        const next =
          Math.abs(delta) <= RELEASE_DEG
            ? current + delta
            : current + delta * (1 - Math.exp(-elapsed / chaseTauMs));
        if (Math.abs(delta) <= RELEASE_DEG) chasingRef.current = false;
        // 눈에 보이지 않는 변화로는 리렌더하지 않는다.
        if (Math.abs(shortestAngleDeltaDeg(current, next)) >= REDRAW_DEG) apply(next);
        else displayRef.current = next;
      }

      // 고르기가 목표에 닿고 따라가기도 끝났으면 프레임을 놓는다. 다음 방향이 오면 다시 건다.
      if (!chasingRef.current && Math.abs(toTarget) < REDRAW_DEG) return;

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [targetDeg, inputTauMs, chaseTauMs, holdDeg]);

  return displayDeg;
}
