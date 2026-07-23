# Frontend Agent Rules

- React + TypeScript + Vite를 사용한다.
- FSD 의존 방향 `app → pages → widgets → features → entities → shared`를 지킨다.
- 같은 계층의 다른 slice를 직접 import하지 않는다. 외부 import는 slice의 `index.ts` Public API만 사용한다.
- CSS Modules와 CSS Variables를 사용한다.
- 서버 상태는 TanStack Query, 직렬화 가능한 클라이언트 전역 상태만 Zustand로 관리한다.
- MediaStream, WebRTC, WebSocket, XR 객체를 Zustand에 저장하지 않는다.
- API, JWT, WebXR 지원 범위 등 미정 계약을 추측하지 않고 TODO로 남긴다.
- 지원 여부를 탐지하고 명시된 fallback을 제공한다.
- 빈 FSD 계층이나 과도한 샘플 코드를 만들지 않는다.
- 기존 파일 또는 상위 저장소의 Git/Jira 규칙을 임의로 변경하지 않는다.
- 완료 전 `npm run typecheck`, `npm run lint`, `npm run lint:fsd`, `npm run test`, `npm run build`를 실행한다.
