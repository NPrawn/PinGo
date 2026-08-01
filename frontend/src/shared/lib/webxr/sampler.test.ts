import { describe, expect, it } from 'vitest';
import { createPoseSampler, DEFAULT_SAMPLING_RULE } from './sampler';
import type { XrPoseReading } from './types';

/**
 * 확정 주기 테스트. `docs/기술_의사결정_정리.md` 11.4 기준값을 그대로 검사한다.
 *
 * 시각을 인자로 넣으므로 타이머를 쓰지 않는다. XR frame이 timestamp를 함께 주기 때문에
 * 실제 동작도 이와 같다.
 */
function reading(x: number, z: number, timestamp: number): XrPoseReading {
  return {
    position: { x, y: 0, z },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    yawDeg: 0,
    timestamp,
  };
}

describe('DEFAULT_SAMPLING_RULE', () => {
  it('11.4 표의 기준값과 같다', () => {
    expect(DEFAULT_SAMPLING_RULE).toEqual({
      moveM: 0.25,
      minIntervalMs: 100,
      heartbeatMs: 5000,
    });
  });

  /**
   * 초당 몇 번 확정되는지가 지도에서 움직임이 실시간으로 보이는지를 가른다. 초속 1.2m
   * 보행에서 4Hz 아래로 내려가면 지도가 끊어서 움직이는 것으로 보인다(S15P11A206-79).
   */
  it('보행 중 확정이 초당 4회 이상이다', () => {
    const walkingSpeedMps = 1.2;
    const intervalMs = Math.max(
      (DEFAULT_SAMPLING_RULE.moveM / walkingSpeedMps) * 1000,
      DEFAULT_SAMPLING_RULE.minIntervalMs,
    );

    expect(1000 / intervalMs).toBeGreaterThanOrEqual(4);
  });
});

const { moveM, minIntervalMs } = DEFAULT_SAMPLING_RULE;

describe('createPoseSampler', () => {
  it('첫 pose를 first 스냅샷으로 확정한다', () => {
    const sampler = createPoseSampler();

    expect(sampler.consider(reading(0, 0, 0))?.trigger).toBe('first');
  });

  it('갱신 거리만큼 이동하면 move로 확정한다', () => {
    const sampler = createPoseSampler();
    sampler.consider(reading(0, 0, 0));

    const snapshot = sampler.consider(reading(0, -moveM, 1500));

    expect(snapshot?.trigger).toBe('move');
    expect(snapshot?.position.z).toBe(-moveM);
  });

  it('갱신 거리에 못 미치면 확정하지 않는다', () => {
    const sampler = createPoseSampler();
    sampler.consider(reading(0, 0, 0));

    expect(sampler.consider(reading(0, -(moveM - 0.01), 1500))).toBeNull();
  });

  /**
   * 1차 실측에서 확정의 63%가 여기서 걸려 나갔다. 그 원인이던 회전 트리거는 제거됐고,
   * 지금 이 값은 빨리 걷거나 뛸 때 확정이 프레임마다 나가지 않게 막는 상한이다.
   */
  it('충분히 이동했어도 최소 간격 안이면 확정하지 않는다', () => {
    const sampler = createPoseSampler();
    sampler.consider(reading(0, 0, 0));

    expect(sampler.consider(reading(0, -5, minIntervalMs - 1))).toBeNull();
    expect(sampler.consider(reading(0, -5, minIntervalMs))?.trigger).toBe('move');
  });

  it('이동이 없어도 5초가 지나면 heartbeat로 확정한다', () => {
    const sampler = createPoseSampler();
    sampler.consider(reading(0, 0, 0));

    expect(sampler.consider(reading(0, 0, 4999))).toBeNull();
    expect(sampler.consider(reading(0, 0, 5000))?.trigger).toBe('heartbeat');
  });

  it('확정 기준은 직전 확정 위치와 시각이다', () => {
    const sampler = createPoseSampler();
    sampler.consider(reading(0, 0, 0));
    sampler.consider(reading(0, -3, 1500));

    // 원점에서는 3m 넘게 갔지만 직전 확정(-3)에서는 갱신 거리에 못 미친다.
    expect(sampler.consider(reading(0, -3 - (moveM - 0.01), 3000))).toBeNull();
    // 직전 확정 대비 갱신 거리가 되는 시점에 확정된다.
    expect(sampler.consider(reading(0, -3 - moveM, 3200))?.trigger).toBe('move');
  });

  /**
   * 11.4에서 회전이 트리거에서 제거된 항목이다. yaw가 180도 바뀌어도 발화하지 않는다.
   */
  it('회전만으로는 확정하지 않는다', () => {
    const sampler = createPoseSampler();
    sampler.consider(reading(0, 0, 0));

    const turned: XrPoseReading = {
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 1, z: 0, w: 0 },
      yawDeg: 180,
      timestamp: 2000,
    };

    expect(sampler.consider(turned)).toBeNull();
  });

  /**
   * 계단 구간. 높이 변화가 평면 이동 거리에 섞이면 이동하지 않았는데 확정이 나간다.
   * ΔY는 층 전환 판정용이고 확정 트리거가 아니다(11.2).
   */
  it('높이만 변해도 확정하지 않는다', () => {
    const sampler = createPoseSampler();
    sampler.consider(reading(0, 0, 0));

    const climbed: XrPoseReading = {
      position: { x: 0, y: 3.8, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      yawDeg: 0,
      timestamp: 2000,
    };

    expect(sampler.consider(climbed)).toBeNull();
  });

  it('reset 후 다음 pose가 다시 first가 된다', () => {
    const sampler = createPoseSampler();
    sampler.consider(reading(0, 0, 0));
    sampler.reset();

    expect(sampler.consider(reading(0, 0, 100))?.trigger).toBe('first');
  });

  it('기준값을 주입할 수 있다', () => {
    const sampler = createPoseSampler({ moveM: 1, minIntervalMs: 0, heartbeatMs: 10000 });
    sampler.consider(reading(0, 0, 0));

    expect(sampler.consider(reading(0, -1, 10))?.trigger).toBe('move');
  });
});
