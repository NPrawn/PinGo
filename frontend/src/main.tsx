import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { onINP, onLCP, onTTFB } from 'web-vitals';
import { App } from '@/app/App';
import { exposeDevtools } from '@/app/devtools';
import { AppProvider } from '@/app/providers';
import { observeFrameTiming, observeInteractionTiming } from '@/shared/lib/perf';
import '@/app/styles/globals.css';

/**
 * 항목 4 — 페이지 최초 로딩(LCP, Core Web Vitals).
 *
 * `/counselor` 이하는 공개 웹이 아니라 상담원이 쓰는 내부 콘솔이라 목표가 더 빡빡하다
 * (2.5초 대신 1초). 같은 SPA가 두 화면을 다 서빙하므로 측정 시점의 경로로 나눈다.
 */
const LCP_GOOD_MS = location.pathname.startsWith('/counselor') ? 1000 : 2500;
const LCP_POOR_MS = 4000;

function lcpGrade(valueMs: number): string {
  if (valueMs <= LCP_GOOD_MS) return 'Good';
  if (valueMs <= LCP_POOR_MS) return 'Needs Improvement';
  return 'Poor';
}

// 배포 환경 사용자에게는 콘솔 로그를 보여주지 않는다. 개발 빌드에서만 찍는다.
if (import.meta.env.DEV) {
  onLCP((metric) =>
    console.log(
      `[web-vitals] LCP ${Math.round(metric.value)}ms (목표 ${LCP_GOOD_MS}ms)`,
      lcpGrade(metric.value),
    ),
  );
  onTTFB((metric) => console.log(`[web-vitals] TTFB ${Math.round(metric.value)}ms`));
  onINP((metric) => console.log(`[web-vitals] INP ${Math.round(metric.value)}ms`));
}

// 항목 1 — 인터랙션(버튼 클릭 등) 응답 100ms.
// (관찰 함수 내부에서 개발 빌드 여부를 확인하므로 여기서는 그대로 호출한다.)
observeInteractionTiming();

/**
 * 항목 2 — 애니메이션·스크롤 프레임 16ms.
 *
 * 상시로 켜 두면 관찰 자체(매 프레임 rAF 콜백)가 메인 스레드를 붙잡아 측정을 왜곡하고,
 * 아무 조작이 없는 유휴 상태에서도 루프가 계속 돈다. 그래서 앱을 켜자마자 자동으로 켜지
 * 않고, 개발 빌드에서만 devtools 콘솔에 켜고 끄는 스위치를 노출해 둔다 — 스크롤·애니메이션
 * 프레임을 실제로 확인하고 싶을 때 `__startFrameTiming()`을 부르고, 그 반환값을 다시
 * 부르면 끈다.
 */
if (import.meta.env.DEV) {
  Object.assign(window, { __startFrameTiming: observeFrameTiming });
}

// 개발 빌드에서만 콘솔에 `window.pingo`를 둔다. 배포 번들에는 들어가지 않는다.
exposeDevtools();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
