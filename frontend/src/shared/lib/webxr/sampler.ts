import { planarDistanceM } from './pose';
import type { XrPoseReading, XrPoseSnapshot, XrSamplingRule } from './types';

/**
 * 확정 주기 기본값. `docs/기술_의사결정_정리.md` 11.4 표와 같다.
 *
 * | 갱신 조건 | 직전 확정 위치 대비 0.25m 이상 이동 |
 * | 최소 간격 | 100ms |
 * | 변화 없을 때 | 5초마다 1회 확정 |
 *
 * **초안의 `2m·1초`에서 좁혔다(S15P11A206-79).** 그 값은 2차 실측에서 규칙 자체로는
 * 적합했지만, 안내 화면에 지도 추종이 붙으면서 보행 중 위치가 1.3~1.9초에 한 번만 갱신되는
 * 것이 화면에서 드러났다. 지도가 그 간격으로 끊어 움직여 실시간으로 보이지 않는다.
 *
 * 0.25m면 초속 1.2m 보행에서 약 5Hz다. 최소 간격 100ms는 30fps 세션에서 프레임 3개당
 * 한 번으로, 빨리 걸어도 그 위로는 올라가지 않게 막는 상한이다.
 *
 * **회전은 여전히 트리거가 아니다.** 아래 `createPoseSampler` 주석의 퇴화 사례는 회전
 * 조건에서 온 것이라 이 값과 무관하다.
 *
 * 표시 쪽 데드밴드가 이 값보다 크면 확정이 자주 와도 마커가 움직이지 않는다.
 * `PROVISIONAL_DISPLAY_DEADBAND_M`을 함께 본다.
 */
export const DEFAULT_SAMPLING_RULE: XrSamplingRule = {
  moveM: 0.25,
  minIntervalMs: 100,
  heartbeatMs: 5000,
};

/**
 * pose 샘플러.
 *
 * XR frame은 약 30fps로 들어오므로 전부 쓸 수 없다. consider에 매 프레임 pose를 넣으면
 * 확정 조건을 통과한 프레임만 스냅샷으로 돌려준다.
 */
export interface XrPoseSampler {
  /**
   * 이번 프레임의 pose를 넣는다.
   *
   * @returns 확정된 스냅샷. 확정 조건을 통과하지 못하면 null.
   */
  consider(reading: XrPoseReading): XrPoseSnapshot | null;
  /** 직전 확정 기록을 지운다. 다음 pose가 다시 first 스냅샷이 된다. */
  reset(): void;
}

/**
 * 11.4 확정 주기를 적용하는 샘플러를 만든다.
 *
 * 판정식은 검증 페이지에서 실측에 쓰인 것과 같다.
 *
 *     (이동량 >= moveM && 직전 확정 이후 경과 >= minIntervalMs) || 경과 >= heartbeatMs
 *
 * **회전은 트리거가 아니다.** 초안의 `15도 이상 회전` 조건은 1차 실측에서 상시 참이 되어
 * (손에 든 단말의 yaw 흔들림 중앙값 23.5도) 확정 38회 중 30회가 회전으로 발화하고 63%가
 * 최소 간격에 걸려 나갔다. 규칙이 "1초마다 갱신"으로 퇴화해 트리거에서 제거됐다.
 *
 * **세션 시작 직후 pose가 없는 구간은 여기서 다루지 않는다.** 실측에서 0.96~1.54초 동안
 * getViewerPose가 null이며, 그 구간에는 consider가 아예 호출되지 않으므로 확정이 나가지
 * 않는다. 추적 상실 구간도 같다.
 */
export function createPoseSampler(rule: XrSamplingRule = DEFAULT_SAMPLING_RULE): XrPoseSampler {
  /** 직전에 확정된 스냅샷. 이동량과 경과 시간의 기준점이다. */
  let lastFix: XrPoseSnapshot | null = null;

  return {
    consider(reading) {
      /**
       * 추적이 잡힌 뒤 첫 pose는 그대로 확정한다.
       *
       * 이후의 이동량·경과 시간을 재려면 기준점이 있어야 한다. 검증 페이지도 첫 pose를
       * 확정 1회로 셌다.
       */
      if (!lastFix) {
        lastFix = { ...reading, trigger: 'first' };

        return lastFix;
      }

      const elapsedMs = reading.timestamp - lastFix.timestamp;
      const movedM = planarDistanceM(lastFix.position, reading.position);

      /**
       * 이동으로 발화하는 경우에도 최소 간격을 지킨다.
       * 이동이 없어도 heartbeat 간격이 지나면 확정한다. heartbeatMs가 minIntervalMs보다
       * 크므로 heartbeat 쪽에 최소 간격을 다시 걸지 않는다.
       */
      const movedEnough = movedM >= rule.moveM && elapsedMs >= rule.minIntervalMs;

      if (!movedEnough && elapsedMs < rule.heartbeatMs) {
        return null;
      }

      lastFix = { ...reading, trigger: movedEnough ? 'move' : 'heartbeat' };

      return lastFix;
    },

    reset() {
      lastFix = null;
    },
  };
}
