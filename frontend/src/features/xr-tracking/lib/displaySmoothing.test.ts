import { describe, expect, it } from 'vitest';
import { DEFAULT_SAMPLING_RULE } from '@/shared/lib/webxr';
import {
  PROVISIONAL_DISPLAY_DEADBAND_M,
  PROVISIONAL_DISPLAY_FOLLOW_RATIO,
  smoothMapPoint,
} from './displaySmoothing';

const B2 = 2;
const B3 = 3;

describe('smoothMapPoint', () => {
  it('직전 표시 좌표가 없으면 새 좌표를 그대로 쓴다', () => {
    const next = { floorId: B2, mapX: 10, mapY: 20 };

    expect(smoothMapPoint(null, next)).toEqual(next);
  });

  /**
   * 2차 실측 정지 지터는 0.01~0.03m였다. 이 정도 변화로 마커가 움직이면 안 된다.
   * 정지 상태에서도 5초마다 heartbeat 스냅샷이 오므로(11.4) 매번 떨리게 된다.
   */
  it('정지 상태 지터로는 마커를 움직이지 않는다', () => {
    const previous = { floorId: B2, mapX: 10, mapY: 20 };
    const jittered = { floorId: B2, mapX: 10.03, mapY: 19.98 };

    expect(smoothMapPoint(previous, jittered)).toBe(previous);
  });

  it('데드밴드 경계값에서는 움직이지 않는다', () => {
    const previous = { floorId: B2, mapX: 0, mapY: 0 };
    const atEdge = { floorId: B2, mapX: PROVISIONAL_DISPLAY_DEADBAND_M, mapY: 0 };

    expect(smoothMapPoint(previous, atEdge)).toBe(previous);
  });

  it('데드밴드를 넘으면 비율만큼 따라간다', () => {
    const smoothed = smoothMapPoint(
      { floorId: B2, mapX: 0, mapY: 0 },
      { floorId: B2, mapX: 10, mapY: 0 },
    );

    expect(smoothed.mapX).toBeCloseTo(10 * PROVISIONAL_DISPLAY_FOLLOW_RATIO, 6);
    expect(smoothed.mapY).toBeCloseTo(0, 6);
  });

  /**
   * 평활은 지연을 만들되 수렴해야 한다. 계속 같은 목표를 주면 거리가 줄어들다가 데드밴드
   * 안에서 멈춘다. 정확히 목표에 닿지는 않으며, 남는 오차는 데드밴드 이하라 화면에서
   * 구분되지 않는다.
   */
  it('같은 목표를 반복하면 데드밴드 안까지 수렴하고 멈춘다', () => {
    const target = { floorId: B2, mapX: 10, mapY: 0 };
    let current = smoothMapPoint({ floorId: B2, mapX: 0, mapY: 0 }, target);
    const first = Math.abs(target.mapX - current.mapX);

    for (let index = 0; index < 20; index += 1) {
      current = smoothMapPoint(current, target);
    }

    const remaining = Math.abs(target.mapX - current.mapX);

    expect(remaining).toBeLessThan(first);
    expect(remaining).toBeLessThanOrEqual(PROVISIONAL_DISPLAY_DEADBAND_M);
  });

  /** 데드밴드 안에 들어오면 더 호출해도 값이 바뀌지 않는다. 무한히 미세 이동하지 않는다. */
  it('데드밴드 안에 들어오면 값이 고정된다', () => {
    const target = { floorId: B2, mapX: 10, mapY: 0 };
    let current = smoothMapPoint({ floorId: B2, mapX: 0, mapY: 0 }, target);

    for (let index = 0; index < 20; index += 1) {
      current = smoothMapPoint(current, target);
    }

    expect(smoothMapPoint(current, target)).toBe(current);
  });

  /**
   * 평활을 걸어도 한 스냅샷에서 절반 이상은 따라가야 마커가 사용자보다 크게 뒤처지지 않는다.
   */
  it('한 번의 확정에서 절반 이상 따라간다', () => {
    const step = DEFAULT_SAMPLING_RULE.moveM;
    const smoothed = smoothMapPoint(
      { floorId: B2, mapX: 0, mapY: 0 },
      { floorId: B2, mapX: 0, mapY: step },
    );

    expect(smoothed.mapY).toBeGreaterThanOrEqual(step / 2);
  });

  /**
   * 걷는 동안 남는 지연은 한 스냅샷에서 회복되지 않고 계속 쌓인 채로 유지된다. 스냅샷 자체가
   * 확정 간격만큼 뒤에 오므로(11.4) 평활이 그 위에 지연을 더 얹으면 체감이 두 배가 된다.
   * 상시 지연을 데드밴드 아래로 묶어 화면에서 구분되지 않게 한다.
   */
  it('보행 중 상시로 남는 지연이 데드밴드 이하다', () => {
    let walked = 0;
    let current = { floorId: B2, mapX: 0, mapY: 0 };

    for (let index = 0; index < 30; index += 1) {
      walked += DEFAULT_SAMPLING_RULE.moveM;
      current = smoothMapPoint(current, { floorId: B2, mapX: walked, mapY: 0 });
    }

    expect(walked - current.mapX).toBeLessThanOrEqual(PROVISIONAL_DISPLAY_DEADBAND_M);
  });

  /**
   * 데드밴드가 확정 간격보다 크면 확정이 아무리 자주 와도 마커가 한 번도 움직이지 않는다.
   * 두 값은 따로 정할 수 없다.
   */
  it('한 번의 확정으로 들어오는 이동은 데드밴드를 넘는다', () => {
    expect(DEFAULT_SAMPLING_RULE.moveM).toBeGreaterThan(PROVISIONAL_DISPLAY_DEADBAND_M);
  });

  /**
   * 층이 다른 두 좌표를 섞으면 어느 층에도 없는 위치가 나온다. 층 전환은 즉시 반영한다.
   */
  it('층이 바뀌면 평활하지 않고 그대로 옮긴다', () => {
    const next = { floorId: B3, mapX: 500, mapY: 500 };
    const smoothed = smoothMapPoint({ floorId: B2, mapX: 0, mapY: 0 }, next);

    expect(smoothed).toEqual(next);
  });

  /** 층이 바뀌면 데드밴드도 적용하지 않는다. 같은 좌표라도 다른 층이면 다른 위치다. */
  it('층만 바뀌고 좌표가 같아도 그대로 옮긴다', () => {
    const next = { floorId: B3, mapX: 10, mapY: 20 };
    const smoothed = smoothMapPoint({ floorId: B2, mapX: 10, mapY: 20 }, next);

    expect(smoothed).toEqual(next);
  });

  it('비율을 1로 주면 평활 없이 바로 옮긴다', () => {
    const next = { floorId: B2, mapX: 10, mapY: 0 };
    const smoothed = smoothMapPoint({ floorId: B2, mapX: 0, mapY: 0 }, next, { followRatio: 1 });

    expect(smoothed.mapX).toBeCloseTo(10, 6);
  });

  it('데드밴드를 0으로 주면 미세 변화도 반영한다', () => {
    const smoothed = smoothMapPoint(
      { floorId: B2, mapX: 0, mapY: 0 },
      { floorId: B2, mapX: 0.02, mapY: 0 },
      { deadbandM: 0, followRatio: 1 },
    );

    expect(smoothed.mapX).toBeCloseTo(0.02, 6);
  });

  it('기본 상수는 provisional 값이다', () => {
    expect(PROVISIONAL_DISPLAY_DEADBAND_M).toBe(0.08);
    expect(PROVISIONAL_DISPLAY_FOLLOW_RATIO).toBe(0.9);
  });
});
