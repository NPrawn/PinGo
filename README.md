# PinGo

PinGo는 외국인 관광객을 위한 지하철역 실내 내비게이션 웹앱입니다.

사용자가 복잡한 지하철역 내부에서 현재 위치를 확인하고, 역 내부 시설 또는 역 주변 목적지와 가까운 출구까지 이동할 수 있도록 안내합니다. 자동 안내만으로 해결하기 어려운 상황에서는 WebRTC 기반 상담을 통해 역무원 또는 상담자가 사용자의 화면과 위치 정보를 보며 도움을 줄 수 있습니다.

## 프로젝트 목표

기존 지도 서비스는 역 밖 길찾기에는 강하지만, 지하철역 내부의 층, 통로, 개찰구, 승강장, 출구까지의 실제 이동 경로를 세밀하게 안내하는 데 한계가 있습니다. 이 프로젝트는 외국인 관광객이 겪는 다음 문제를 해결하는 것을 목표로 합니다.

- 실내에서 GPS가 부정확해 현재 위치를 알기 어려운 문제
- 출구 번호를 모르거나 역 주변 장소와 연결되는 출구를 찾기 어려운 문제
- 한국어 안내판, 복잡한 환승 동선, 개찰구 안팎 구분 때문에 이동 방향을 판단하기 어려운 문제
- 큰 짐, 휠체어, 유모차 사용자가 계단 없는 경로를 찾기 어려운 문제
- 자동 안내가 실패했을 때 현장 도움을 즉시 받기 어려운 문제

## 핵심 사용자

| 사용자 | 설명 |
| --- | --- |
| 관광객 사용자 | 로그인 없이 웹앱에 접속해 현재 위치 확인, 목적지 검색, 출구 추천, 실내 경로 안내와 상담을 이용합니다. |
| 상담자·역무원 | 로그인 후 담당 역의 상담 요청을 확인하고, WebRTC 영상·음성 상담과 화면 동기화 기능으로 사용자를 지원합니다. |
| 관리자 | 역, 층별 지도, 시설, 경로 노드·간선, 주변 장소, 추천 출구, 상담자 계정을 관리합니다. |

## MVP 범위

MVP 대상 역은 서울 지하철 2호선 **역삼역**입니다. 역삼역의 B1·B2·B3 지도와 경로 그래프를 기준으로 핵심 사용자 흐름을 검증합니다.

주요 흐름은 다음과 같습니다.

```text
웹앱 접속
→ 언어 선택
→ 권한 요청
→ 현재 역과 목적지 선택
→ 카메라 촬영 및 현재 위치 인식
→ 빠른 경로 또는 엘리베이터 이용 경로 선택
→ 실내 경로 안내
→ 출구 또는 실내 목적지 도착

문제 발생 시
→ 상담 요청
→ 상담자 수락
→ WebRTC 상담 및 양방향 자막
→ 상담 종료와 만족도 평가
```

MVP 필수 기능은 다음과 같습니다.

- 한국어·영어 언어 선택
- 위치, 카메라, 마이크 권한 안내와 상태 변화 대응
- GPS 기반 주변 역 후보 조회와 직접 역 선택
- 카메라 기반 HLOC/COLMAP VPS를 통한 현재 위치 확인
- VPS 실패 시 재촬영 또는 상담 요청 제공
- 층별 2D 실내 지도와 좌표 오버레이
- 역 내부 시설 및 역 주변 장소 검색
- 역 주변 장소와 가까운 출구 자동 추천
- 빠른 경로와 엘리베이터 이용 경로 탐색
- 카메라 화면과 지도 화면을 결합한 경로 안내
- 외부 목적지의 추천 출구와 실외 도보 거리·예상 시간 표시
- 상담자 로그인, 상담 요청 목록, WebRTC 상담
- 역, 지도, 시설, 경로, 상담자 기본 관리자 기능

## 주요 기능

### 실내 위치 인식

스마트폰 카메라로 역 내부를 촬영하면 HLOC/COLMAP 기반 위치추정 서비스가 맵 버전, 층, 6DoF pose와 기하 품질 지표를 반환합니다. Spring Backend는 AI 결과를 층별 캐노니컬 좌표로 변환하고 가장 가까운 경로 시작 노드를 함께 제공합니다. B2·B3는 좌표 앵커링을 지원하며 B1처럼 정합 정보가 없는 층은 `map_not_ready`로 처리합니다.

VPS가 불안정할 경우 다음 대체 흐름을 제공합니다.

1. 카메라 촬영 화면에서 다시 촬영
2. 상담 요청으로 전환
3. WebXR 미지원 환경에서는 추적 없이 지도 안내와 주기적 재인식 유지

### 실내 지도와 경로 탐색

대상 역의 층별 지도 이미지를 사용하고, 지도 위에 현재 위치, 목적지, 시설, 출구, 경로를 좌표 기반으로 표시합니다. 경로 데이터는 노드와 간선으로 관리하며, 백엔드에서 Dijkstra 알고리즘을 우선 사용합니다.

지원하는 경로 옵션은 다음과 같습니다.

| 화면 표시 | 내부 routeType | 기준 |
| --- | --- | --- |
| 빠른 경로 | `fastest` | 두 옵션의 이동 수단이 겹치지 않도록 엘리베이터 간선을 제외합니다. |
| 엘리베이터 이용 경로 | `elevator_only` | 계단과 에스컬레이터를 제외하고 일반 통로·엘리베이터·개찰구를 사용합니다. |

### 목적지 검색과 출구 추천

사용자는 출구 번호를 몰라도 호텔, 음식점, 관광지, 쇼핑몰, 공연장, 랜드마크 같은 역 주변 장소를 검색할 수 있습니다. 서비스는 해당 장소와 연결된 추천 출구를 실내 목적지로 설정하고, 현재 위치에서 해당 출구까지 길을 안내합니다.

외부 목적지는 등록 장소와 카카오 장소 검색 결과를 함께 제공합니다. 경로 유형별로 적합한 출구를 고르고, 현재 위치에서 출구까지의 실내 경로와 출구에서 목적지까지의 도보 거리·예상 시간을 경로 옵션 카드에 표시합니다.

Backend는 카카오 앱·웹 링크도 응답으로 생성하지만 현재 Frontend는 해당 링크를 노출하지 않습니다. 안내는 출입구에서 종료되며 도착 화면에서는 새 여정을 시작할 수 있습니다. 카카오 도보 경로 조회가 실패하면 출구와 목적지의 직선거리를 대신 표시하고 예상 시간은 생략합니다.

### WebRTC 상담

사용자는 주요 화면에서 상담을 요청할 수 있습니다. 상담 요청에는 현재 역, 현재 위치, 목적지, 문제 유형이 포함됩니다.

상담자는 전용 페이지에서 담당 역의 상담 요청을 확인하고 수락합니다. 상담 중에는 WebRTC 영상 또는 음성 연결을 사용하며, DataChannel을 통해 다음 이벤트를 사용자 화면에 반영합니다.

- `DRAW_STROKE_START`, `DRAW_STROKE_MOVE`, `DRAW_STROKE_END`: 공유 화면 위 선 그리기
- `DRAW_CLEAR`: 공유 화면의 주석 지우기
- `MAP_SYNC`: 상담자와 사용자 지도의 층·시점 동기화
- `DESTINATION_CHANGE_REQUESTED`: 상담자가 선택한 시설로 목적지 변경
- `CURRENT_LOCATION_CORRECTED`: 상담자가 선택한 시설로 사용자 위치 보정

DataChannel이 열리지 않으면 동일 이벤트를 서버 API로 중계합니다. 상담자 발화는 브라우저 SpeechRecognition, 사용자 발화는 서버 Whisper 전사를 사용하며 번역된 자막은 양쪽 화면에 표시됩니다.

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | React 19, TypeScript 6, Vite 8 |
| 상태·데이터 | TanStack Query, Zustand, React Hook Form, Zod |
| Styling | CSS Modules, CSS Variables |
| Icons | lucide-react |
| 지도·추적 | Three.js, WebXR Device API |
| Backend | Java 17, Spring Boot 4.1 |
| ORM / DB Access | Spring Data JPA, Flyway |
| Database | MySQL 8.4 |
| Auth | JWT Access Token |
| Realtime | WebSocket signaling, SSE, WebRTC, DataChannel |
| Indoor Map | 이미지 지도 + 좌표 오버레이 |
| Routing | 백엔드 Dijkstra |
| VPS | FastAPI, HLOC/COLMAP, 층별 좌표 앵커링 |
| AI·외부 연동 | SSAFY GMS Gemini·Whisper, Kakao Local·도보 API |
| Testing | JUnit, Vitest, React Testing Library, Playwright, pytest |
| Deployment | Jenkins, Host·Service Nginx, systemd, Docker MySQL·Coturn, HTTPS |

## 인증과 세션

- 일반 관광객 사용자는 로그인하지 않고 `userSessionId` 기반 임시 세션으로 이용합니다.
- 사용자 세션은 생성 시각 기준 6시간 후 만료되며 활동으로 연장되지 않습니다.
- 상담자와 관리자는 JWT Access Token 기반으로 로그인합니다.
- JWT Access Token 만료 시간은 6시간입니다.
- Refresh Token은 MVP에서 생략합니다.
- 상담 세션 ID는 UUID 또는 ULID 기반 문자열을 사용합니다.

## 데이터 설계

주요 데이터 영역은 다음과 같습니다.

- 역, 층, 층별 지도 이미지
- 출구, 개찰구, 승강장, 화장실, 엘리베이터 등 시설
- 경로 탐색용 노드와 간선
- 역 주변 장소와 추천 출구 연결
- 비로그인 사용자 임시 세션
- 상담 요청, 상담 세션, 상담 이벤트
- 상담자와 관리자 계정
- VPS 맵, 기준 이미지, 위치 인식 로그 스키마
- 다국어 문구와 시설명 확장을 위한 번역 스키마

MVP에서는 주요 응답에 `nameKo`, `nameEn`을 함께 내려주고 Frontend i18next와 선택 언어에 맞춰 표시합니다. `localization_log`, `location_share`, `translation`, `admin_audit_log` 등 일부 확장 테이블은 스키마만 존재하거나 제품 연동이 제한적입니다.

## API 범위

모든 REST API는 `/api` prefix를 사용합니다. 주요 영역은 다음과 같습니다.

- 상태: `GET /api/health`
- 인증: `POST /api/auth/login`, `POST /api/auth/signup`, `GET /api/auth/check-login-id`
- 사용자 세션: `POST/GET/PATCH/DELETE /api/user-sessions`
- 역·지도·시설: `/api/stations`, `/api/facilities`
- 목적지·출구 추천: `/api/destinations`, `/api/places/{placeId}/recommended-exits`
- 위치 인식: `POST /api/vps/localize`
- 경로: `POST /api/routes/indoor/options`, `POST /api/routes/indoor`
- 외부 도보 정보: `POST /api/external-maps/directions`
- 상담: `/api/consultations`의 생성·조회·취소·수락·거절·종료·평가·자막·요약·fallback API
- 상담자: `/api/counselors/consultations`, `/api/counselors/me`
- WebRTC: `GET /api/webrtc/ice-servers`, `WS /ws/signaling`
- 관리자: `/api/admin` 아래 역·층·지도·시설·경로·장소·상담자 관리 API

상세 계약과 인증 정책은 [API 명세서](docs/API_명세서.md)를 기준으로 합니다.

## 비기능 기준

- 모바일 웹앱은 Android Chrome을 기준 환경으로 하며, WebXR 미지원 환경에서는 추적 없이 지도 안내와 재인식을 유지합니다.
- 일반 모바일 네트워크에서 첫 화면은 3초 이내, 시연 환경에서는 2초 이내 표시를 목표로 합니다.
- 위치 인식 결과는 5초 이내 반환을 목표로 하며, 8초 이상 지연되면 대체 흐름을 제공합니다.
- 경로 탐색 결과는 2초 이내 반환을 목표로 합니다.
- HTTPS 환경에서 위치정보, 카메라, 마이크, WebRTC 기능을 사용합니다.
- 일반 사용자, 상담자, 관리자 권한을 분리합니다.
- 카메라 이미지는 위치 인식 처리 후 즉시 폐기하고, 상담 영상은 저장하지 않는 것을 기본 원칙으로 합니다.
- 네트워크, VPS, WebRTC, DataChannel, 외부 API 실패 시 대체 흐름을 제공합니다.

## 개발 규칙

협업 브랜치 전략, 커밋 메시지, Merge Request, 코드 리뷰, 환경변수 관리 규칙은 아래 문서를 기준으로 합니다.

- [Git Coding Convention](docs/Git_Coding_Convention.md)

## 문서

프로젝트 기획과 설계는 `docs` 디렉터리의 문서를 기준으로 합니다.

| 문서 | 내용 |
| --- | --- |
| [서비스 기획서](docs/서비스_기획서.md) | 문제 정의, 서비스 목표, MVP 범위, 차별점, 성공 기준 |
| [사용자 시나리오](docs/사용자_시나리오.md) | 관광객, 상담자, 관리자, 동행 사용자 흐름 |
| [기능 요구사항 명세서](docs/기능_요구사항_명세서.md) | 사용자 웹앱, 상담자, 관리자, VPS, WebRTC, 다국어 기능 요구사항 |
| [비기능 요구사항 명세서](docs/비기능_요구사항_명세서.md) | 성능, 사용성, 접근성, 보안, 개인정보, 장애 대응, 확장성 기준 |
| [화면 정의서](docs/화면_정의서.md) | 사용자, 상담자, 관리자 화면별 구성 요소와 액션 |
| [화면 흐름도](docs/화면_흐름도.md) | 사용자 웹앱, 상담, 상담자, 관리자 화면 흐름 |
| [API 명세서](docs/API_명세서.md) | REST API, WebSocket signaling, 공통 응답, 인증 정책 |
| [ERD 최종](docs/erd_최종.md) | 주요 엔티티, 관계, MVP 필수 테이블, 인덱스 제안 |
| [기술 의사결정 정리](docs/기술_의사결정_정리.md) | 확정 기술 스택, 구현 기준, 미정 항목 |
| [HLOC-COLMAP-Spring 파이프라인 설계서](docs/HLOC_COLMAP_SPRING_파이프라인_설계서.md) | HLOC/COLMAP 맵 구축, FastAPI 위치추정 및 Spring 연동 절차 |
| [WebXR 검증 결과](docs/WebXR_검증_결과.md) | WebXR 지원 환경·pose 추적 검증 기록, 실기기 체크리스트 |
| [Git Coding Convention](docs/Git_Coding_Convention.md) | 브랜치 전략, 커밋 메시지, Merge Request, 리뷰, 환경변수 관리 규칙 |

## 남은 검증·확장 항목

현재 구현 이후 추가 검증 또는 확장이 필요한 항목입니다.

- 대상 역의 실제 시연 대표 동선
- Android Chrome 역삼역 대표 동선 실기기 회귀
- 운영 도메인 `https://jenkins.example.invalid`의 HTTPS·WSS·TURN smoke test
- 카카오 운영 키와 도보 API 권한 검증
- VPS 이미지 즉시 폐기 여부를 확인할 수 있는 운영 로그
- 위치 공유·번역 테이블·관리자 감사 로그의 제품 API 연동
