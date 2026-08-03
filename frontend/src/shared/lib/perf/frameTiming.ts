/**
 * 항목 2 — 애니메이션·스크롤 프레임 16ms 이내(60fps).
 *
 * `requestAnimationFrame`이 불리는 간격을 재는 것이 가장 직접적인 방법이다 — 이 콜백이
 * 16.7ms보다 늦게 불렸다는 것은 그 사이에 프레임이 하나 이상 밀렸다는 뜻이다. 브라우저의
 * Long Tasks API(50ms 이상 걸린 작업)로는 16ms 단위의 미세한 밀림까지는 잡지 못한다.
 */

const FRAME_BUDGET_MS = 16;
/** 60fps 기준 한 프레임(16.67ms)의 몇 배까지를 "밀렸다"로 볼지. 노이즈가 많으면 올린다. */
const DROPPED_FRAME_THRESHOLD_MS = FRAME_BUDGET_MS * 1.5;

/**
 * 프레임 간격이 예산을 넘긴 경우를 콘솔에 남긴다.
 *
 * 상시로 켜 두면 로그가 너무 잦을 수 있어, 실제로 쓸 때는 스크롤·애니메이션이 일어나는
 * 구간에서만 켰다 끄는 식으로 쓰는 것을 권한다(반환한 정리 함수로 끈다).
 */
export function observeFrameTiming(): () => void {
  // 배포 환경 사용자에게는 콘솔 로그를 보여주지 않는다. 개발 빌드에서만 관찰을 켠다.
  if (!import.meta.env.DEV) return () => {};

  let last = performance.now();
  let handle = 0;
  let stopped = false;

  const tick = (now: number) => {
    if (stopped) return;
    const delta = now - last;
    last = now;
    if (delta > DROPPED_FRAME_THRESHOLD_MS) {
      console.warn(
        `[frame] ${Math.round(delta)}ms (예산 ${FRAME_BUDGET_MS}ms · 약 ${Math.round(delta / FRAME_BUDGET_MS)}프레임분 밀림)`,
      );
    }
    handle = requestAnimationFrame(tick);
  };
  handle = requestAnimationFrame(tick);

  return () => {
    stopped = true;
    cancelAnimationFrame(handle);
  };
}
