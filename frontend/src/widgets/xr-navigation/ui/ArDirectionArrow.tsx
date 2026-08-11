import type { CSSProperties } from 'react';
import { inPlaneAngleDeg } from '@/shared/lib/angle';
import { useUnwrappedDeg } from '@/shared/lib/useUnwrappedDeg';
import styles from './ArDirectionArrow.module.css';

/**
 * 화살표를 눕히는 각도(도). (S15P11A206-382)
 *
 * **여기가 유일한 출처다.** CSS가 이 값으로 평면을 눕히고, 아래에서 같은 값으로 방향각을 보정한다
 * (`inPlaneAngleDeg`). 둘이 갈라지면 화살표가 지도와 다른 방향을 가리킨다.
 *
 * 값은 시안 검토에서 정했다. 많이 눕힌 쪽이 바닥에 놓인 느낌이 가장 강하다.
 */
const ARROW_TILT_DEG = 58;

export interface ArDirectionArrowProps {
  /**
   * 카메라가 보는 방향을 기준으로 얼마나 틀어야 하는지(도). `routeBearingOf`의 `relativeDeg`다.
   *
   * null이면 그리지 않는다. 방향을 모르는데 위를 향한 화살표를 두면 "정면"이라고 말하는 셈이다.
   */
  relativeDeg: number | null;
  /**
   * 화면에 보이지 않는 방향 설명. `aria-label`로만 쓴다.
   *
   * **자막을 두지 않는다.** 같은 문장을 안내 카드가 이미 말하고 있어 화면에서 두 번 읽힌다.
   * 화면을 읽어 주는 사용자에게는 이 라벨이 방향을 전달하는 유일한 경로다.
   */
  label: string;
}

/**
 * 카메라 영상 위에 눕혀 놓는 방향 화살표. (S15P11A206-382)
 *
 * 셰브론 셋을 겹쳐 바닥에 눕힌 모양이다. 기울기는 CSS가, 방향은 이 컴포넌트가 준다.
 *
 * **안내 화면과 상담 화면이 같은 것을 쓴다.** 기울기 상수와 방향 보정, 이어 붙이기가 한 곳에만
 * 있어야 두 화면의 화살표가 갈라지지 않는다. 부르는 쪽은 `relativeDeg`만 넘긴다.
 *
 * 자리는 부모가 정한다 — 두 화면 모두 카메라 영역이 가운데 정렬된 flex 컨테이너이고, 이 요소는
 * 그 안의 유일한 흐름 자식이다.
 */
export function ArDirectionArrow({ relativeDeg, label }: ArDirectionArrowProps) {
  /**
   * 화살표를 실제로 돌릴 각도. **접힌 값을 그대로 쓰지 않는다.**
   *
   * 순서가 중요하다 — 눕힌 평면 보정을 **먼저** 하고 그 결과를 이어 붙인다. `inPlaneAngleDeg`는
   * 주기 함수라 바퀴 수를 잃으므로, 이어 붙인 값을 보정하면 감아 둔 바퀴가 사라진다.
   *
   * 이어 붙이지 않으면 경로 반대쪽을 보고 좌우로 조금씩 돌릴 때 화살표가 의미 없이 한 바퀴
   * 돈다. 방향각이 `+179도`에서 `-179도`로 넘어가는 순간 값이 358도 움직이는데, 실제로 사용자가
   * 돈 것은 2도다. 이어 붙이면 뒤를 보는 동안 화살표도 뒤를 계속 가리킨다.
   */
  const targetDeg = relativeDeg === null ? null : inPlaneAngleDeg(relativeDeg, ARROW_TILT_DEG);
  const arrowDeg = useUnwrappedDeg(targetDeg);

  if (arrowDeg === null) return null;

  return (
    <div
      className={styles.arrow}
      style={
        {
          '--arrow-tilt': `${ARROW_TILT_DEG}deg`,
          '--arrow-deg': `${arrowDeg}deg`,
        } as CSSProperties
      }
      role="img"
      aria-label={label}
    >
      {/* 앞쪽이 먼저 오도록 뒤에서부터 쌓는다(`column-reverse`). */}
      <span className={styles.chevron} />
      <span className={styles.chevron} />
      <span className={styles.chevron} />
    </div>
  );
}
