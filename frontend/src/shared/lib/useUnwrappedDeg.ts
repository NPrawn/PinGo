import { useEffect, useRef, useState } from 'react';
import { unwrapDeg } from './angle';

/**
 * 접힌 각도를 이어 붙여 돌려준다. CSS `rotate`에 넣을 값을 만드는 자리다. (S15P11A206-382)
 *
 * **왜 필요한가.** 실기기 테스트에서 경로 반대쪽을 보고 좌우로 조금씩 돌렸을 때 카메라 위
 * 화살표가 의미 없이 한 바퀴 돌았다. 방향각이 `atan2`에서 나와 `(-180, 180]`을 돌기 때문에
 * `+179도`에서 `-179도`로 넘어가는 순간 값이 358도 움직이고, CSS가 그 차이를 그대로
 * 애니메이션했다. 사용자가 실제로 돈 것은 2도다.
 *
 * 이어 붙이면 `+179`에서 `+181`이 되어 2도만 움직인다. 뒤를 보는 동안 화살표도 뒤를 계속
 * 가리키며 조금씩 흔들릴 뿐이다.
 *
 * **평활하지 않는다.** 지도 회전은 걸음 흔들림까지 걸러야 해서 시간 상수와 문턱을 두지만
 * (`useSmoothedRotationDeg`), 화살표는 CSS 전환으로 이어 붙이므로 여기서 값을 더 다듬으면
 * 두 번 늦어진다. 이 훅이 하는 일은 이어 붙이기 하나뿐이다.
 *
 * **프레임에서 값을 세운다.** 렌더 중에는 ref를 읽을 수 없고 effect에서 바로 상태를 바꾸는 것도
 * 막혀 있다(`react-hooks/refs`, `react-hooks/set-state-in-effect`). 지도 회전 훅과 같은 방식으로
 * 프레임 콜백에서 처리한다. 한 프레임 늦지만 CSS 전환이 0.24초라 눈에 띄지 않는다.
 *
 * @param target 접힌 목표 각도(도). 그릴 것이 없으면 null이며, 다음에 다시 값이 오면 그
 *   각도에서 새로 시작한다 — 감아 둔 바퀴를 들고 있다가 이어 붙이면 화살표가 그 바퀴만큼 돈다.
 */
export function useUnwrappedDeg(target: number | null): number | null {
  const [value, setValue] = useState<number | null>(null);
  /** 마지막으로 내보낸 값. 상태 갱신이 비동기라 프레임 안에서 상태를 읽을 수 없다. */
  const valueRef = useRef<number | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const previous = valueRef.current;
      const next =
        target === null ? null : previous === null ? target : unwrapDeg(previous, target);

      if (next === previous) return;

      valueRef.current = next;
      setValue(next);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [target]);

  return value;
}
