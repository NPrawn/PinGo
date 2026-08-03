/**
 * 항목 1 — 사용자 인터랙션 응답(버튼 클릭 등) 100ms 이내(Google RAIL 기준).
 *
 * Event Timing API(`PerformanceObserver({ entryTypes: ['event'] })`)는 클릭·키 입력부터
 * 다음 화면이 실제로 그려지기까지 걸린 시간(`duration`)을 브라우저가 직접 재서 준다.
 * 개발자가 콜백 앞뒤로 `performance.now()`를 직접 찍는 것보다 정확하다 — 렌더링·페인트까지
 * 포함한 값이라, "핸들러는 빨리 끝났는데 화면은 늦게 바뀌었다" 같은 경우도 잡아낸다.
 */

const RAIL_RESPONSE_BUDGET_MS = 100;

/**
 * 100ms를 넘긴 인터랙션을 콘솔에 남긴다.
 *
 * 이 API를 지원하지 않는 브라우저(Safari 등)에서는 조용히 아무 일도 하지 않는다 —
 * 아직 지원하지 않는 환경에서 인터랙션 지연을 재지 못한다고 상담을 막을 이유는 없다.
 */
export function observeInteractionTiming(): () => void {
  // 배포 환경 사용자에게는 콘솔 로그를 보여주지 않는다. 개발 빌드에서만 관찰을 켠다.
  if (!import.meta.env.DEV) return () => {};
  if (typeof PerformanceObserver === 'undefined') return () => {};
  if (!PerformanceObserver.supportedEntryTypes?.includes('event')) return () => {};

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration <= RAIL_RESPONSE_BUDGET_MS) continue;
      console.warn(
        `[interaction] ${entry.name} ${Math.round(entry.duration)}ms (목표 ${RAIL_RESPONSE_BUDGET_MS}ms 초과)`,
      );
    }
  });

  // durationThreshold: 이 값 미만인 인터랙션은 브라우저가 아예 리포트하지 않는다.
  // RAIL 목표(100ms)보다 살짝 낮춰 잡아, 딱 걸치는 값도 놓치지 않는다.
  observer.observe({ type: 'event', durationThreshold: 40, buffered: true } as PerformanceObserverInit);

  return () => observer.disconnect();
}
