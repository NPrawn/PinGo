import type { XrMapPositionSource } from '@/features/xr-tracking';
import type { XrAnchorStatus } from '@/features/xr-tracking';
import type { XrTrackingStatus } from '@/shared/lib/webxr';
import styles from './XrTrackingBadge.module.css';

interface XrTrackingBadgeProps {
  status: XrTrackingStatus;
  /** 앵커가 생겼는지. 없으면 추적 좌표를 만들지 않고 확정 위치만 표시된다(11.2). */
  anchorStatus: XrAnchorStatus;
  /** 표시 중인 좌표의 출처. */
  source: XrMapPositionSource;
}

/**
 * 추적 상태 배지. (S15P11A206-141)
 *
 * 화면 정의서 U-10은 `실시간 추적 중` 또는 `추적 미지원 · 재인식 필요` 두 가지를 요구한다.
 * 그 사이에 사용자가 구분해야 하는 상태가 더 있어 다섯으로 나눴다.
 *
 * | 상태 | 문구 | 왜 나누는가 |
 * | --- | --- | --- |
 * | 세션 전·종료 | 추적 꺼짐 | 사용자가 켜지 않은 것과 못 켜는 것은 다르다 |
 * | warming-up | 추적 준비 중 | 0.96~1.54초 pose 없는 구간. 멈춘 게 아니다 |
 * | tracking + 앵커 없음 | 위치 인식 필요 | pose는 오는데 지도에 놓을 기준이 없다(11.2) |
 * | tracking + 앵커 | 실시간 추적 중 | 정상 |
 * | lost | 위치 확인 중 | 11.7이 정한 문구. 복구되면 자동 재개된다 |
 * | failed | 추적 미지원 · 재인식 필요 | U-10의 문구 그대로 |
 *
 * **`lost`를 실패로 표시하지 않는다.** 11.7은 추적 상실에 "위치 갱신을 멈추고 위치 확인 중을
 * 표시. 복구되면 자동 재개"로 정한다. 실측에서 엘리베이터 상승 중 7초간 pose가 없었고, 화면이
 * 얼어붙은 것처럼 보이지 않게 하는 것이 이 표시의 목적이다.
 */
export function XrTrackingBadge({ status, anchorStatus, source }: XrTrackingBadgeProps) {
  const { label, tone } = describe(status, anchorStatus, source);

  return (
    /**
     * `role="status"`를 쓰지 않는다. 앱의 다른 화면이 로딩 표시에 그 역할을 쓰고 있어,
     * 사라지지 않는 배지가 같은 역할을 가지면 "로딩이 끝나지 않은 화면"으로 읽힌다.
     * `aria-live="polite"`만으로 상태 변화는 그대로 읽힌다.
     */
    <span className={[styles.badge, styles[tone]].join(' ')} aria-live="polite">
      <span className={styles.dot} aria-hidden />
      {label}
    </span>
  );
}

type Tone = 'live' | 'waiting' | 'off';

function describe(
  status: XrTrackingStatus,
  anchorStatus: XrAnchorStatus,
  source: XrMapPositionSource,
): { label: string; tone: Tone } {
  if (status === 'failed') return { label: '추적 미지원 · 재인식 필요', tone: 'off' };
  if (status === 'idle' || status === 'ended') return { label: '추적 꺼짐', tone: 'off' };
  if (status === 'starting' || status === 'warming-up') {
    return { label: '추적 준비 중', tone: 'waiting' };
  }

  /**
   * `lost`에서 마지막 유효 좌표가 남아 있는 경우와 그렇지 않은 경우를 나눈다.
   * 앵커가 없으면 애초에 추적 좌표를 만든 적이 없어 "확인 중"이라는 말이 맞지 않는다.
   */
  if (status === 'lost') {
    return source === 'last-known'
      ? { label: '위치 확인 중', tone: 'waiting' }
      : { label: '위치 인식 필요', tone: 'waiting' };
  }

  // status === 'tracking'
  return anchorStatus === 'none'
    ? { label: '위치 인식 필요', tone: 'waiting' }
    : { label: '실시간 추적 중', tone: 'live' };
}
