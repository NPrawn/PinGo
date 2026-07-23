# PinGo Frontend

PinGo 프론트엔드는 React, TypeScript, Vite 기반의 웹 애플리케이션입니다.  
프로젝트 구조는 Feature-Sliced Design(FSD)을 따르며, 사용자·상담원·관리자 화면과 향후 위치 안내, 카메라, WebRTC, WebXR 기능을 확장할 수 있도록 구성되어 있습니다.

이 문서는 프론트엔드의 설치, 실행, 폴더 구조, 설계 규칙, 상태 관리, API, 스타일, 테스트 및 향후 구현 원칙을 한 곳에서 설명합니다.

## 1. 기술 스택

### 핵심 환경

| 구분          | 기술                  |
| ------------- | --------------------- |
| 운영체제 기준 | Windows 10/11         |
| 런타임        | Node.js 24.18.0 LTS   |
| 패키지 관리자 | npm 11.x              |
| UI            | React 19              |
| 언어          | TypeScript 6          |
| 빌드 도구     | Vite 8                |
| 권장 편집기   | VS Code               |
| 기준 브라우저 | Chrome 최신 안정 버전 |

### 애플리케이션

| 목적                 | 기술                   |
| -------------------- | ---------------------- |
| 라우팅               | React Router           |
| 서버 상태            | TanStack Query         |
| 클라이언트 전역 상태 | Zustand                |
| HTTP 통신            | Axios                  |
| 다국어               | i18next, react-i18next |
| 폼                   | React Hook Form        |
| 스키마 검증          | Zod                    |
| 아이콘               | Lucide React           |
| 3D·WebXR 기반 기능   | Three.js               |

### 개발 및 품질 관리

| 목적                 | 기술                          |
| -------------------- | ----------------------------- |
| 코드 검사            | ESLint                        |
| 코드 포맷            | Prettier                      |
| FSD 구조 검사        | Steiger                       |
| 단위·컴포넌트 테스트 | Vitest, React Testing Library |
| API 모킹             | MSW                           |
| E2E 테스트           | Playwright                    |

패키지의 정확한 버전은 `package.json`과 `package-lock.json`을 기준으로 합니다.

## 2. 시작하기

### 필수 조건

- Node.js `24.18.0`
- npm `11.x`
- Git

Node 버전은 다음 파일에서 동일하게 고정합니다.

- `.nvmrc`
- `.node-version`
- `package.json`의 `engines.node`

현재 버전을 확인합니다.

```powershell
node --version
npm --version
```

예상 범위:

```text
Node.js: v24.18.0
npm: 11.x
```

다른 Node 버전을 사용 중이라면 프로젝트 설치 전에 버전을 맞춥니다.

```powershell
cd frontend
nvm use 24.18.0
```

### 최초 설치

저장소 루트에서 실행합니다.

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npx playwright install chromium
npm run dev
```

macOS 또는 Linux에서는 환경변수 예제 파일을 다음과 같이 복사합니다.

```bash
cp .env.example .env
```

새로 clone한 저장소와 CI에서는 `npm install` 대신 `npm ci`를 사용합니다. `npm ci`는 `package-lock.json`을 기준으로 의존성을 동일하게 재현하며 잠금 파일을 임의로 변경하지 않습니다.

새 패키지를 추가하거나 패키지 버전을 변경할 때만 `npm install <package>` 또는 `npm install -D <package>`를 사용하고, 변경된 `package.json`과 `package-lock.json`을 함께 커밋합니다.

## 3. 실행 명령

| 명령                   | 설명                                            |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | 로컬 개발 서버 실행                             |
| `npm run dev:host`     | 같은 네트워크에서 접근 가능한 개발 서버 실행    |
| `npm run build`        | TypeScript 검사 후 프로덕션 번들 생성           |
| `npm run preview`      | 생성된 프로덕션 번들 미리 보기                  |
| `npm run typecheck`    | TypeScript 타입 검사                            |
| `npm run lint`         | ESLint 코드 검사                                |
| `npm run lint:fsd`     | Steiger FSD 구조 검사                           |
| `npm run format`       | Prettier로 파일 포맷 적용                       |
| `npm run format:check` | 포맷 변경 없이 검사                             |
| `npm run test`         | Vitest 단위·컴포넌트 테스트 실행                |
| `npm run test:watch`   | Vitest 감시 모드 실행                           |
| `npm run test:e2e`     | Playwright Chromium E2E 테스트 실행             |
| `npm run check`        | 타입, ESLint, FSD, 포맷, 테스트, 빌드 전체 검사 |

작업을 완료하기 전 최소한 다음 명령을 실행합니다.

```powershell
npm run check
npm run test:e2e
```

## 4. 모바일 기기에서 개발 서버 접속

PC와 모바일 기기를 같은 네트워크에 연결한 뒤 실행합니다.

```powershell
npm run dev:host
```

터미널에 표시되는 Network 주소 또는 PC의 LAN IP로 접속합니다.

```text
http://<PC의 LAN IP>:5173
```

Windows 방화벽이 연결을 차단하면 Node.js 또는 해당 포트의 사설 네트워크 접근 허용 여부를 확인합니다.

카메라, 마이크, 위치, WebRTC, WebXR 등 일부 브라우저 API는 `localhost`가 아닌 주소에서 HTTPS 보안 컨텍스트를 요구합니다. 단순 화면 확인은 HTTP로 가능하지만 해당 기능의 실제 모바일 테스트에는 HTTPS 개발 환경이 필요할 수 있습니다.

## 5. 환경변수

로컬 환경변수는 `.env.example`을 복사한 `.env`에 작성합니다.

| 변수                      | 용도                | 기본 예시               |
| ------------------------- | ------------------- | ----------------------- |
| `VITE_API_BASE_URL`       | HTTP API 기본 주소  | `http://localhost:8080` |
| `VITE_WS_BASE_URL`        | WebSocket 기본 주소 | `ws://localhost:8080`   |
| `VITE_APP_ENV`            | 실행 환경           | `development`           |
| `VITE_NAVER_MAP_BASE_URL` | 지도 관련 기본 주소 | 미정                    |
| `VITE_STUN_URL`           | WebRTC STUN 서버    | 미정                    |
| `VITE_TURN_URL`           | WebRTC TURN 서버    | 미정                    |
| `VITE_TURN_USERNAME`      | TURN 사용자 이름    | 미정                    |
| `VITE_TURN_CREDENTIAL`    | TURN 인증 정보      | 미정                    |

환경변수는 `src/shared/config/env.ts`에서 Zod로 검증합니다.

- 필수값과 선택값을 구분합니다.
- 선택값은 빈 문자열을 허용하여 초기 빌드를 막지 않습니다.
- 실제 `.env`와 `.env.*.local`은 Git에 커밋하지 않습니다.
- 비밀값을 `.env.example`, 소스 코드 또는 README에 작성하지 않습니다.
- 클라이언트에 포함되는 `VITE_` 환경변수는 브라우저에서 확인할 수 있으므로 서버 전용 비밀정보를 저장하면 안 됩니다.

## 6. 전체 폴더 구조

현재 Git에서 관리하는 주요 구조입니다. `node_modules`, `dist`, 테스트 결과물은 생략했습니다.

```text
frontend/
├─ .env.example
├─ .gitignore
├─ .node-version
├─ .nvmrc
├─ .prettierignore
├─ .prettierrc
├─ .vscode/
│  ├─ extensions.json
│  └─ settings.json
├─ public/
│  ├─ favicon.svg
│  └─ icons.svg
├─ scripts/
│  └─ test-e2e.mjs
├─ src/
│  ├─ app/
│  │  ├─ providers/
│  │  │  ├─ AppProvider.tsx
│  │  │  ├─ QueryProvider.tsx
│  │  │  └─ index.ts
│  │  ├─ router/
│  │  │  ├─ AppRouter.tsx
│  │  │  └─ index.ts
│  │  ├─ styles/
│  │  │  ├─ globals.css
│  │  │  ├─ reset.css
│  │  │  └─ variables.css
│  │  ├─ App.test.tsx
│  │  └─ App.tsx
│  ├─ pages/
│  │  ├─ admin/
│  │  │  ├─ ui/AdminPage.tsx
│  │  │  └─ index.ts
│  │  ├─ counselor/
│  │  │  ├─ ui/CounselorPage.tsx
│  │  │  └─ index.ts
│  │  ├─ home/
│  │  │  ├─ ui/HomePage.tsx
│  │  │  └─ index.ts
│  │  ├─ not-found/
│  │  │  ├─ ui/NotFoundPage.tsx
│  │  │  └─ index.ts
│  │  └─ user/
│  │     ├─ ui/UserPage.tsx
│  │     └─ index.ts
│  ├─ shared/
│  │  ├─ api/
│  │  │  ├─ client.ts
│  │  │  ├─ endpoints.ts
│  │  │  ├─ queryKeys.ts
│  │  │  └─ index.ts
│  │  ├─ config/
│  │  │  ├─ env.ts
│  │  │  ├─ routes.ts
│  │  │  └─ index.ts
│  │  └─ i18n/
│  │     ├─ locales/
│  │     │  ├─ en/translation.ts
│  │     │  └─ ko/translation.ts
│  │     ├─ config.ts
│  │     └─ index.ts
│  ├─ test/
│  │  ├─ mocks/
│  │  │  ├─ handlers.ts
│  │  │  └─ server.ts
│  │  └─ setup.ts
│  ├─ main.tsx
│  └─ vite-env.d.ts
├─ tests/
│  └─ app.spec.ts
├─ AGENTS.md
├─ eslint.config.js
├─ index.html
├─ package.json
├─ package-lock.json
├─ playwright.config.ts
├─ README.md
├─ steiger.config.js
├─ tsconfig.app.json
├─ tsconfig.json
├─ tsconfig.node.json
└─ vite.config.ts
```

`widgets`, `features`, `entities`, `shared/ui`, `shared/hooks`, `shared/lib`, `shared/types`는 실제 코드가 필요해질 때 생성합니다. 구조를 보여주기 위한 빈 폴더나 샘플 파일은 미리 만들지 않습니다.

## 7. 최상위 파일과 폴더의 역할

### `public/`

빌드 과정에서 변환할 필요가 없는 정적 파일을 둡니다. 파일은 사이트 루트 경로로 제공됩니다.

### `scripts/`

프로젝트 개발과 검증을 위한 Node.js 실행 스크립트를 둡니다. `test-e2e.mjs`는 Vite 테스트 서버의 시작과 종료를 직접 관리해 Windows에서도 Playwright 실행이 정상 종료되도록 합니다.

### `src/`

실제 애플리케이션 소스입니다. FSD 계층과 테스트 지원 코드가 포함됩니다.

### `tests/`

브라우저에서 실행되는 Playwright E2E 테스트를 둡니다. 단위 테스트는 대상 코드 가까이에 `*.test.ts` 또는 `*.test.tsx`로 배치합니다.

### 주요 설정 파일

| 파일                   | 역할                                     |
| ---------------------- | ---------------------------------------- |
| `vite.config.ts`       | Vite, React, `@` alias, Vitest 환경 설정 |
| `tsconfig*.json`       | 브라우저와 Node용 TypeScript 설정        |
| `eslint.config.js`     | React·TypeScript ESLint 규칙             |
| `steiger.config.js`    | FSD 구조 검사 규칙                       |
| `.prettierrc`          | 코드 포맷 규칙                           |
| `playwright.config.ts` | Chromium E2E 설정                        |
| `package.json`         | 패키지, 엔진, 실행 명령                  |
| `package-lock.json`    | 설치 패키지 버전 잠금                    |
| `.env.example`         | 커밋 가능한 환경변수 키 예시             |
| `.vscode/`             | 권장 확장 및 저장 시 포맷 설정           |

## 8. FSD 아키텍처

의존 방향은 다음과 같습니다.

```text
app
 ↓
pages
 ↓
widgets
 ↓
features
 ↓
entities
 ↓
shared
```

허용되는 방향:

```text
app      → pages, widgets, features, entities, shared
pages    → widgets, features, entities, shared
widgets  → features, entities, shared
features → entities, shared
entities → shared
shared   → 외부 라이브러리와 자체 모듈
```

하위 계층은 상위 계층을 import할 수 없습니다. 예를 들어 `shared`에서 `features`를 참조하거나 `pages`에서 `app`을 참조하면 안 됩니다.

### `app`

애플리케이션 전체의 초기화와 조합을 담당합니다.

- 전역 Provider 조합
- 최상위 라우터
- 전역 스타일
- 최상위 오류 처리
- 앱 실행 진입 구조

`main.tsx`는 복잡한 Provider를 직접 중첩하지 않고 `AppProvider`를 사용합니다.

### `pages`

URL 단위의 화면을 구성합니다.

- `/`
- `/user/*`
- `/counselor/*`
- `/admin/*`
- 일치하지 않는 경로

페이지는 여러 widget과 feature를 조합할 수 있지만 다른 page를 직접 import하지 않습니다.

### `widgets`

여러 feature와 entity를 조합한 독립적인 UI 블록입니다.

예시:

- 지도와 목적지 검색을 합친 탐색 패널
- 상담 세션 헤더
- 관리자 통계 대시보드

현재는 실제 widget이 없어 폴더를 만들지 않았습니다.

### `features`

사용자의 구체적인 행동과 사용 사례를 담당합니다.

예시:

- 현재 위치 인식
- 목적지 검색
- 경로 안내 시작
- 상담 요청
- 로그인
- 관리자 편집 동작

서로 다른 feature를 직접 import하지 않습니다. 여러 feature가 필요하면 page 또는 widget에서 조합합니다.

### `entities`

비즈니스 도메인 객체와 해당 객체의 표시·상태·API를 담당합니다.

예시:

- 층
- 지도
- 시설
- 출구
- 경로
- 위치
- 상담 세션

특정 entity가 다른 entity에 강하게 의존하지 않도록 설계하고, 공통 기술 로직은 `shared`에 둡니다.

### `shared`

특정 비즈니스 기능에 종속되지 않는 공통 코드를 둡니다.

권장 segment:

```text
shared/ui       공통 UI
shared/api      Axios 인스턴스, 공통 API 설정
shared/config   환경변수와 공통 설정
shared/hooks    범용 React Hook
shared/lib      범용 유틸리티
shared/types    공통 타입
shared/i18n     다국어 설정과 번역 리소스
```

모든 코드를 편의상 `shared`에 모으지 않습니다. 특정 기능이나 도메인에 종속되면 해당 feature 또는 entity로 이동합니다.

## 9. Slice와 Segment 구성

`pages`, `widgets`, `features`, `entities` 아래의 기능별 폴더를 slice라고 합니다.

```text
features/
└─ destination-search/  ← slice
   ├─ ui/
   ├─ model/
   ├─ api/
   ├─ lib/
   └─ index.ts
```

slice 내부의 역할별 폴더를 segment라고 합니다.

| Segment  | 책임                        |
| -------- | --------------------------- |
| `ui`     | 컴포넌트와 CSS Module       |
| `model`  | 상태, 스키마, 비즈니스 로직 |
| `api`    | 해당 slice 전용 API         |
| `lib`    | 해당 slice 내부 보조 로직   |
| `config` | 해당 slice 설정             |

필요한 segment만 만들며, 빈 segment를 미리 생성하지 않습니다.

## 10. Public API와 import 규칙

외부 slice에서 사용할 항목은 slice 루트의 `index.ts`를 통해서만 노출합니다.

허용:

```ts
import { UserPage } from '@/pages/user';
import { env, ROUTES } from '@/shared/config';
```

금지:

```ts
import { UserPage } from '@/pages/user/ui/UserPage';
import { env } from '@/shared/config/env';
```

단, 같은 slice 내부에서는 상대 경로로 내부 모듈을 import할 수 있습니다.

```ts
import { QueryProvider } from './QueryProvider';
```

Public API에서는 실제 외부 사용이 필요한 항목만 export합니다. slice 내부 구현 전체를 무분별하게 노출하지 않습니다.

`@`는 `src`를 가리키는 path alias입니다.

```ts
import { env } from '@/shared/config';
```

Vite와 TypeScript 양쪽에 동일한 alias가 설정되어 있습니다.

## 11. 라우팅

기본 라우트:

| 경로           | 페이지          |
| -------------- | --------------- |
| `/`            | `HomePage`      |
| `/user/*`      | `UserPage`      |
| `/counselor/*` | `CounselorPage` |
| `/admin/*`     | `AdminPage`     |
| 그 외          | `NotFoundPage`  |

사용자, 상담원, 관리자 페이지는 lazy loading으로 분리합니다. 경로 문자열은 `src/shared/config/routes.ts`의 `ROUTES` 상수에서 관리합니다.

상담원과 관리자 Route Guard는 인증 계약이 확정된 뒤 구현합니다. JWT의 저장 위치, 갱신 방식 또는 권한 값을 임의로 가정하지 않습니다.

## 12. Provider 구성

`src/app/providers`에서 전역 Provider를 조합합니다.

```text
AppProvider
├─ QueryProvider
│  └─ QueryClientProvider
└─ BrowserRouter
```

- TanStack Query Devtools는 개발 환경에서만 렌더링합니다.
- i18next는 애플리케이션 시작 시 한 번만 초기화합니다.
- 새로운 전역 Provider가 필요하면 `main.tsx`에 직접 중첩하지 않고 `AppProvider`에서 조합합니다.

## 13. 상태 관리 원칙

상태의 성격에 따라 도구를 구분합니다.

### TanStack Query

서버에서 조회하거나 서버에 변경을 요청하는 데이터에 사용합니다.

예시:

- 층, 지도, 시설 조회
- 목적지 검색
- 추천 출구
- 경로 결과
- 상담 요청 목록
- 관리자 CRUD 데이터

서버 데이터를 Zustand에 복사하여 중복 관리하지 않습니다.

### Zustand

여러 컴포넌트가 공유해야 하는 직렬화 가능한 클라이언트 상태에 사용합니다.

예시:

- 선택 언어
- 선택 층
- 선택 목적지
- 길안내 진행 상태
- 권한 관련 UI 상태
- 상담 UI 상태

실제 사용처가 생길 때 해당 feature 또는 entity의 `model`에 store를 생성합니다. 범용 `src/stores` 폴더는 만들지 않습니다.

### React 지역 상태

특정 컴포넌트나 가까운 컴포넌트 트리에서만 사용하는 상태에 사용합니다.

예시:

- 입력값
- 모달 열림 여부
- 일시적인 UI 상태

### Zustand에 저장하면 안 되는 객체

다음과 같은 비직렬화 브라우저 객체는 Zustand에 저장하지 않습니다.

```text
MediaStream
MediaStreamTrack
RTCPeerConnection
RTCDataChannel
WebSocket
XRSession
XRReferenceSpace
```

이 객체들의 생성, 정리, 재연결 및 이벤트 구독은 관련 feature 내부 controller 또는 service가 관리합니다. UI에 필요한 정보만 직렬화 가능한 snapshot으로 전달합니다.

WebXR pose처럼 자주 변하는 값은 매 프레임 Zustand에 저장하지 않습니다. 별도 추적 모듈에서 관리하고 UI에는 throttle된 snapshot만 전달합니다.

## 14. API 통신

공통 Axios 인스턴스는 `src/shared/api/client.ts`에서 관리합니다.

현재 포함된 설정:

- `VITE_API_BASE_URL`
- 요청 timeout
- JSON 공통 헤더
- 공통 오류 전파 구조
- 향후 인증 interceptor 확장 지점

공통 endpoint와 query key는 각각 다음 파일에 둡니다.

```text
src/shared/api/endpoints.ts
src/shared/api/queryKeys.ts
```

실제 API 명세가 확정되기 전에는 endpoint, 요청·응답 타입, JWT 저장 방식과 인증 헤더를 추측하여 구현하지 않습니다.

기능 전용 API는 해당 feature 또는 entity의 `api` segment에 작성하고, 모든 API를 `shared/api`에 모으지 않습니다.

## 15. 다국어

`react-i18next`와 `i18next`를 사용합니다.

지원 언어:

- 한국어 `ko`
- 영어 `en`

구조:

```text
src/shared/i18n/
├─ locales/
│  ├─ ko/translation.ts
│  └─ en/translation.ts
├─ config.ts
└─ index.ts
```

번역 키는 의미와 화면을 드러내도록 작성합니다.

```text
app.title
page.home
page.user
page.counselor
page.admin
page.notFound
```

컴포넌트에 한국어와 영어 문구를 조건문으로 직접 작성하지 않고 번역 리소스를 사용합니다. 번역 리소스가 커지면 도메인 또는 namespace별 파일 분리를 고려합니다.

## 16. 스타일

전역 스타일은 다음 파일에서 관리합니다.

```text
src/app/styles/reset.css
src/app/styles/variables.css
src/app/styles/globals.css
```

스타일 원칙:

- 전역 디자인 값은 CSS Variables로 관리합니다.
- 페이지와 컴포넌트 전용 스타일은 CSS Modules를 사용합니다.
- 전역 class를 무분별하게 추가하지 않습니다.
- 현재 합의되지 않은 UI 프레임워크나 CSS-in-JS 도구를 추가하지 않습니다.
- Tailwind CSS, styled-components, Emotion, Sass는 별도 합의 없이 도입하지 않습니다.

CSS Variables는 다음 범주를 중심으로 확장합니다.

- color
- spacing
- font-size
- radius
- z-index

## 17. 테스트

### 단위·컴포넌트 테스트

Vitest, React Testing Library, jest-dom, jsdom을 사용합니다.

현재 검증 항목:

- App 기본 렌더링
- 사용자 라우트
- NotFound 페이지
- 언어 전환

테스트 파일은 대상 코드 가까이에 둡니다.

```text
src/app/App.tsx
src/app/App.test.tsx
```

구현 세부사항보다 사용자에게 보이는 동작을 검증합니다.

### API 모킹

MSW 설정:

```text
src/test/mocks/handlers.ts
src/test/mocks/server.ts
```

실제 API 계약이 확정되면 기능별 handler를 추가합니다. 초기 구조 확인을 위한 `/health` 예제 handler만 포함되어 있습니다.

### E2E 테스트

Playwright Chromium을 사용합니다.

현재 검증 항목:

- 홈 화면 진입
- 사용자 페이지 이동
- 관리자 lazy route 직접 진입

최초 실행 전 브라우저를 설치합니다.

```powershell
npx playwright install chromium
npm run test:e2e
```

실제 권한, 카메라, WebXR, WebRTC E2E는 기능과 실행 환경이 준비된 뒤 추가합니다.

## 18. ESLint, Prettier, Steiger

도구별 책임을 분리합니다.

```text
ESLint   → React, TypeScript, Hooks와 코드 오류 검사
Prettier → 코드 포맷
Steiger  → FSD 구조와 의존성 검사
```

Prettier 기준:

- 작은따옴표
- `printWidth: 100`
- `tabWidth: 2`
- LF 줄바꿈

FSD 오류가 발생하면 규칙을 비활성화해 숨기기보다 폴더 위치, 의존 방향 또는 Public API import를 수정합니다. `app/providers`는 프로젝트에서 명시적으로 선택한 Provider 조합 폴더이므로 해당 명칭에 대한 Steiger 예외만 설정되어 있습니다.

## 19. 브라우저 API 구현 원칙

향후 사용 예정인 기능:

```text
Geolocation API
Permissions API
MediaDevices.getUserMedia
ImageCapture
Canvas Capture
WebXR
WebRTC
RTCDataChannel
WebSocket
SpeechSynthesis
Web Share
Clipboard
```

모든 브라우저에서 지원된다고 가정하지 않습니다.

권장 fallback:

| 기본 기능       | 미지원 또는 실패 시            |
| --------------- | ------------------------------ |
| ImageCapture    | Canvas Capture                 |
| Web Share       | Clipboard                      |
| WebXR           | VPS 재시도 또는 수동 위치 선택 |
| Permissions API | 실제 API 호출 후 예외 처리     |

지원 여부 탐지만 믿지 않고 실제 API 호출의 예외도 처리합니다. 카메라, 마이크, 위치, WebRTC, WebXR에는 HTTPS 보안 컨텍스트가 필요할 수 있습니다.

HTTPS 인증서, signaling 메시지, 좌표계, STUN/TURN 값은 확정된 계약 없이 구현하지 않습니다.

## 20. 기능 추가 방법

새 기능을 추가할 때 다음 순서로 판단합니다.

1. URL 전체 화면이면 `pages`에 둡니다.
2. 사용자 행동이면 `features`에 둡니다.
3. 도메인 객체 자체의 데이터와 UI이면 `entities`에 둡니다.
4. 여러 feature와 entity를 조합한 큰 UI 블록이면 `widgets`에 둡니다.
5. 비즈니스에 종속되지 않은 공통 코드이면 `shared`에 둡니다.
6. 필요한 segment만 만들고 slice의 `index.ts`에 Public API를 정의합니다.
7. 타입 검사, lint, FSD 검사와 테스트를 실행합니다.

예시:

```text
src/features/destination-search/
├─ api/
│  └─ searchDestinations.ts
├─ model/
│  └─ schema.ts
├─ ui/
│  ├─ DestinationSearch.tsx
│  └─ DestinationSearch.module.css
└─ index.ts
```

```ts
// src/features/destination-search/index.ts
export { DestinationSearch } from './ui/DestinationSearch';
```

## 21. Git에 포함하거나 제외할 파일

Git에 포함:

```text
package.json
package-lock.json
.env.example
.nvmrc
.node-version
.vscode/
src/
tests/
scripts/
playwright.config.ts
README.md
AGENTS.md
```

Git에서 제외:

```text
node_modules/
dist/
coverage/
playwright-report/
test-results/
.env
.env.local
.env.*.local
*.log
```

빌드 결과물과 테스트 결과물을 커밋하지 않습니다.

## 22. 작업 완료 체크리스트

- [ ] 코드가 올바른 FSD 계층과 slice에 배치되었는가?
- [ ] 하위 계층에서 상위 계층을 import하지 않는가?
- [ ] 같은 계층의 다른 slice를 직접 import하지 않는가?
- [ ] 외부 import가 `index.ts` Public API를 사용하는가?
- [ ] 서버 상태와 클라이언트 상태를 구분했는가?
- [ ] 브라우저 객체를 Zustand에 저장하지 않았는가?
- [ ] 환경변수나 비밀값을 소스에 하드코딩하지 않았는가?
- [ ] 브라우저 API의 미지원과 예외를 처리했는가?
- [ ] 필요한 테스트를 추가했는가?
- [ ] 문서 또는 `.env.example` 변경이 필요한가?
- [ ] `npm run check`가 통과하는가?
- [ ] 주요 사용자 흐름 변경 시 `npm run test:e2e`가 통과하는가?

## 23. 아직 확정되지 않은 항목

다음 항목은 백엔드, 인프라 또는 제품 정책이 확정된 뒤 구현합니다.

- 실제 API endpoint와 요청·응답 계약
- JWT 발급, 저장, 갱신 및 로그아웃 방식
- 사용자·상담원·관리자 권한 정책
- VPS 응답 스키마와 좌표계
- 지도와 층 데이터 정의
- WebSocket 이벤트 계약
- WebRTC signaling 계약
- STUN/TURN 설정
- 모바일 HTTPS 개발 환경
- WebXR PoC와 지원 기기 기준
- Nginx 및 Jenkins 배포 연동

확정되지 않은 값을 임의로 구현하거나 임시 계약을 실제 계약처럼 사용하지 않습니다. 필요한 위치에 TODO와 영향을 받는 범위를 남긴 뒤 팀과 합의합니다.

## 24. 문제 해결

### PowerShell에서 npm 실행이 차단되는 경우

PowerShell 실행 정책 때문에 `npm.ps1`이 차단되면 다음과 같이 실행할 수 있습니다.

```powershell
npm.cmd ci
npm.cmd run dev
```

프로젝트가 시스템 실행 정책을 임의로 변경하지는 않습니다.

### Node 버전 오류

```powershell
node --version
nvm use 24.18.0
npm ci
```

### 의존성 상태가 잠금 파일과 다른 경우

개별 파일을 수동으로 고치지 말고 설치 결과물을 다시 구성합니다.

```powershell
npm ci
```

### Playwright 브라우저가 없는 경우

```powershell
npx playwright install chromium
npm run test:e2e
```

### FSD lint가 실패하는 경우

오류에 표시된 import 방향과 Public API를 확인합니다.

```powershell
npm run lint:fsd
```

deep import를 slice의 `index.ts` import로 변경하고, 상위 계층 의존은 올바른 계층으로 옮깁니다.
