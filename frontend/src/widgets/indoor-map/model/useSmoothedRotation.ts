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
 * 된다.
 *
 * **이 값은 서 있는 동안만 쓴다.** 실제 회전이 문턱을 넘으면 `PROVISIONAL_TURNING_INPUT_TAU_MS`
 * 로 갈아탄다 — 0.5초는 흔들림을 버리는 값으로는 맞지만 도는 동안의 뒤처짐으로는 너무 크다.
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
 *
 * **3도에서 0.5도로 내렸다. (S15P11A206-382)**
 *
 * 놓는 순간 남은 차이를 한 프레임에 메우므로(`current + delta`) 이 값이 곧 마지막에 튀는 크기다.
 * 실기기에서 "회전이 끝날 때 끊기듯이 고정된다"고 보고된 것이 그 3도였다 — 5.4배로 당겨진 화면
 * 에서는 눈에 띈다. 0.5도면 보이지 않고, 따라가기가 그만큼 더 도는 대신 `REDRAW_DEG`(0.05도)가
 * 리렌더를 막으므로 화면을 다시 그리는 횟수는 늘지 않는다.
 */
const RELEASE_DEG = 0.5;

/** 이만큼도 안 움직였으면 화면을 다시 그리지 않는다. 0.05°는 도면 모서리가 0.3px 움직인다. */
const REDRAW_DEG = 0.05;

/**
 * 돌기 시작한 뒤 따라가는 속도의 시간 상수(ms).
 *
 * 흔들림은 위 두 단계가 이미 걸렀으므로 여기서는 계단을 부드럽게 잇기만 하면 된다.
 */
export const PROVISIONAL_ROTATION_TIME_CONSTANT_MS = 250;

/**
 * **돌고 있는 동안** 쓰는 고르기 시간 상수(ms). (S15P11A206-382)
 *
 * 위 두 상수는 서 있는 동안의 값이다. 그것을 돌 때도 그대로 쓰면 램프 입력의 정상상태 뒤처짐이
 * `회전속도 × (500+250)ms` 가 된다 — 몸을 1.2초에 90° 돌리면(75°/s) 지도가 **56° 뒤에 있다.**
 * 실기기에서 "회전할 때 지도가 늦게 따라온다"고 보고된 것이 이 값이다.
 *
 * **그냥 낮출 수는 없다.** 걸음 흔들림(±12°·1.5Hz)의 각속도는 12×2π×1.5 = 113°/s 로 실제
 * 회전보다 **오히려 빠르다.** 속도만 보는 필터로는 둘을 가를 수 없고, 1€ 필터처럼 컷오프를
 * 각속도에 비례시키면 흔들리는 동안에도 컷오프가 올라가 잔떨림이 그대로 통과한다. 수치로도
 * 확인했다 — 컷오프를 0.05Hz/(°/s) 로 올리면 흔들림 구간의 실효 시간 상수가 50ms 로 떨어져
 * 잔떨림이 ±11° 가 되고 8° 문턱을 넘는다.
 *
 * 둘을 가르는 것은 속도가 아니라 **지속성**이고, 그 판정은 이미 8° 문턱이 하고 있다. 500ms
 * 필터를 통과한 값이 8° 를 넘었다는 것은 한쪽으로 지속된 회전이라는 뜻이다(흔들림의 잔떨림은
 * ±2.5° 로 3배 이상 여유가 있다). 그래서 새 판정기를 만들지 않고 **`chasingRef` 를 그대로
 * 모드로 쓴다** — 잡아 두는 동안은 500/250, 따라가는 동안은 이 값들이다.
 *
 * 160ms 는 흔들림을 완전히 버리는 값이 아니다. 1.5Hz 를 12°→6.9° 로 줄이고 아래 따라가기가
 * 다시 4.8° 로 줄인다. 돌고 있는 동안의 ±5° 는 눈에 걸리지 않는다 — 그 구간에는 지도가 이미
 * 크게 돌고 있다.
 *
 * TODO: 실기기에서 확정한다. 도는 동안 지도가 떨면 올리고, 여전히 굼뜨면 내린다.
 */
export const PROVISIONAL_TURNING_INPUT_TAU_MS = 160;

/**
 * **돌고 있는 동안** 쓰는 따라가기 시간 상수(ms). (S15P11A206-382)
 *
 * 따라가기가 있는 이유는 문턱이 열리는 순간 표시 각도가 목표에서 8° 떨어져 있다는 것뿐이다.
 * 그 8° 를 한 프레임에 메우면 튀므로 완만하게 흡수한다. 그런데 도는 동안에는 그 간격이
 * `회전속도 × 시간상수` 로 계속 유지되므로, 이 상수가 곧 도는 내내 남는 뒤처짐이다.
 *
 * 100ms 면 75°/s 에서 간격이 7.5° — 문턱이 열릴 때 흡수하던 8° 와 같은 크기다. 흡수의 목적은
 * 그대로 지키면서 뒤처짐은 250ms 의 40% 로 줄어든다. 60fps 에서 6프레임에 걸쳐 메우므로
 * 계단으로 보이지도 않는다.
 *
 * 합해서 도는 동안의 뒤처짐은 260ms — 75°/s 에서 19.5° 다. 750ms(56°) 에서 3분의 1이다.
 * 나머지는 방향 채널이 갖고 있다(최소 간격 120ms 로 평균 4.5°, 데드밴드 5°). 그쪽을 좁히면
 * 방향 이벤트와 리렌더 횟수가 함께 늘어나므로 이 태스크에서는 건드리지 않는다.
 */
export const PROVISIONAL_TURNING_CHASE_TAU_MS = 100;

export interface SmoothedRotationOptions {
  /** 들어온 각도를 고르는 시간 상수. 걸음 흔들림 제거용이다. */
  inputTauMs?: number;
  /** 표시 각도가 목표를 따라가는 속도. */
  chaseTauMs?: number;
  /** 돌기 시작하는 최소 변화. */
  holdDeg?: number;
  /** 돌고 있는 동안의 고르기 시간 상수. */
  turningInputTauMs?: number;
  /** 돌고 있는 동안의 따라가기 시간 상수. */
  turningChaseTauMs?: number;
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
 * 1단계와 3단계의 시간 상수는 **2단계의 판정에 따라 달라진다.** 잡아 두는 동안에는 흔들림을
 * 버리는 것이 목적이라 길게(500/250ms), 넘어선 뒤에는 뒤처지지 않는 것이 목적이라 짧게
 * (160/100ms) 쓴다. 근거는 두 상수의 주석에 있다. (S15P11A206-382)
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
    turningInputTauMs = PROVISIONAL_TURNING_INPUT_TAU_MS,
    turningChaseTauMs = PROVISIONAL_TURNING_CHASE_TAU_MS,
  } = options;

  const [displayDeg, setDisplayDeg] = useState<number | null>(null);
  /** 프레임 사이에 이어지는 표시 각도. 상태 갱신은 비동기라 프레임 안에서 읽을 수 없다. */
  const displayRef = useRef<number | null>(null);
  /** 흔들림을 걸러 낸 목표. */
  const inputRef = useRef<number | null>(null);
  /** 지금 목표를 따라가는 중인지. 잡아 두는 구간과 따라가는 구간을 가른다. */
  const chasingRef = useRef(false);
  /**
   * 마지막으로 돈 프레임의 시각. **effect 지역 변수가 아니라 ref다.**
   *
   * `targetDeg`가 의존성이라 방향이 갱신될 때마다 effect가 다시 실행된다. 지역 변수로 두면
   * 그때마다 null로 돌아가 재실행 뒤 첫 프레임의 경과 시간이 0이 되고, 그 한 프레임만큼
   * 고르기가 진행되지 않는다. 방향 채널의 최소 간격(120ms, `PROVISIONAL_HEADING_MIN_INTERVAL_MS`)
   * 에서 시간의 약 6%를 잃고, 그 간격이 프레임 간격까지 좁아지면 **모든** 프레임의 경과 시간이
   * 0이 되어 지도가 아예 돌지 않는다. 실측으로 확인했다.
   *
   * 의존성에서 `targetDeg`를 빼는 것으로는 해결되지 않는다. 루프는 수렴하면 스스로 예약을
   * 멈추고(아래), 그것을 다시 거는 유일한 계기가 effect 재실행이다. 의존성을 없애면 첫 방향을
   * 붙여 보여준 뒤 루프가 영영 서 버린다.
   *
   * 프레임을 취소하고 곧바로 다시 거는 것은 시간이 이어지는 일이므로 정리 함수에서는 비우지
   * 않는다. 루프가 **스스로 예약을 멈추는** 자리에서만 비운다.
   */
  const previousTimeRef = useRef<DOMHighResTimeStamp | null>(null);

  useEffect(() => {
    let frame: number | null = null;

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
        previousTimeRef.current = null;
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
        previousTimeRef.current = null;
        apply(targetDeg);
        return;
      }

      const elapsed = previousTimeRef.current === null ? 0 : time - previousTimeRef.current;
      previousTimeRef.current = time;

      /**
       * 지금 돌고 있는가. **문턱이 곧 그 판정이다.** (S15P11A206-382)
       *
       * 이 프레임이 아니라 직전 프레임의 상태를 읽는다. 문턱은 아래에서 열리므로 열리는 그 한
       * 프레임만 서 있는 값으로 계산되고, 다음 프레임부터 짧은 상수가 적용된다. 한 프레임의
       * 차이라 눈에 보이지 않으면서 판정과 적용의 순서가 뒤엉키지 않는다.
       */
      const turning = chasingRef.current;
      const activeInputTauMs = turning ? turningInputTauMs : inputTauMs;
      const activeChaseTauMs = turning ? turningChaseTauMs : chaseTauMs;

      // 1) 고르기.
      const toTarget = shortestAngleDeltaDeg(inputRef.current, targetDeg);
      inputRef.current += toTarget * (1 - Math.exp(-elapsed / activeInputTauMs));

      const current = displayRef.current;
      const delta = shortestAngleDeltaDeg(current, inputRef.current);

      // 2) 문턱. 넘지 않으면 화면은 그대로 두고, 고르기만 계속 수렴시킨다.
      if (!chasingRef.current && Math.abs(delta) > holdDeg) chasingRef.current = true;

      if (chasingRef.current) {
        // 3) 따라가기.
        const next =
          Math.abs(delta) <= RELEASE_DEG
            ? current + delta
            : current + delta * (1 - Math.exp(-elapsed / activeChaseTauMs));
        if (Math.abs(delta) <= RELEASE_DEG) chasingRef.current = false;
        // 눈에 보이지 않는 변화로는 리렌더하지 않는다.
        if (Math.abs(shortestAngleDeltaDeg(current, next)) >= REDRAW_DEG) apply(next);
        else displayRef.current = next;
      }

      // 고르기가 목표에 닿고 따라가기도 끝났으면 프레임을 놓는다. 다음 방향이 오면 다시 건다.
      if (!chasingRef.current && Math.abs(toTarget) < REDRAW_DEG) {
        // 여기서 루프가 선다. 다시 걸릴 때까지의 공백은 지나간 시간이 아니다.
        previousTimeRef.current = null;
        return;
      }

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [targetDeg, inputTauMs, chaseTauMs, holdDeg, turningInputTauMs, turningChaseTauMs]);

  return displayDeg;
}
