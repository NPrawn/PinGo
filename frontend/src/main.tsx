import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { onINP, onLCP, onTTFB } from 'web-vitals';
import { App } from '@/app/App';
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

// 항목 1 — 인터랙션(버튼 클릭 등) 응답 100ms. 항목 2 — 애니메이션·스크롤 프레임 16ms.
// (관찰 함수 내부에서 개발 빌드 여부를 확인하므로 여기서는 그대로 호출한다.)
observeInteractionTiming();
observeFrameTiming();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
