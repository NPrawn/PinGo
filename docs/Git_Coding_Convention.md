# Git Coding Convention

> 적용 대상: PinGo frontend / backend
>
> 팀 구성과 개발 기간은 팀 확정 일정에 맞춰 갱신한다.

---

## 0. Repo 역할

PinGo는 프론트엔드와 백엔드 역할을 분리해 개발하는 것을 기준으로 한다. 실제 레포를 분리하지 않고 하나의 레포에서 관리하는 경우에도 아래 역할 경계를 유지한다.

| 영역 | 역할 |
| --- | --- |
| Frontend | React + TypeScript + Vite 기반 사용자 웹앱, 상담자 페이지, 관리자 화면, API 연동, 실내 지도 오버레이 구현 |
| Backend | Spring Boot API, MySQL 연동, 인증, 실내 경로 탐색, VPS 위치 인식 연동, WebRTC signaling, 관리자 API 구현 |
| Docs | 기획서, 요구사항, API 명세, ERD, 화면 정의, 협업 규칙 관리 |

---

## 1. Branch 전략

### 흐름

```bash
feature → develop → main
```

| 브랜치 | 설명 |
| --- | --- |
| `main` | 최종 배포용 브랜치. 직접 push 금지 |
| `develop` | 통합 개발 브랜치. 직접 push 금지 |
| `feature/` | 기능 단위 개발 브랜치. `develop`에서 분기 |

---

## 2. Branch Protection

- `main`, `develop` 브랜치 직접 push 금지
- 모든 변경은 PR을 통해 merge
- 최소 1명 이상 Approve 후 merge
- `main` merge는 배포 또는 최종 제출 시점에만 진행
- GitHub 또는 GitLab 설정에서 `main`, `develop` 브랜치 보호 규칙을 실제로 적용한다.

권장 설정:

| 항목 | 설정 |
| --- | --- |
| Require a pull request before merging | 활성화 |
| Required approvals | 1명 이상 |
| Delete head branches automatically | 활성화 권장 |

---

## 3. Feature 브랜치 규칙

- `develop` 브랜치에서 최신 변경 사항을 받은 뒤 생성한다.
- 작은 기능 단위로 쪼개서 작업한다.
- 가능하면 10개 미만의 커밋으로 구성한다.
- `develop`에 merge 후 로컬과 원격 feature 브랜치를 삭제한다.

### 브랜치 네이밍

```bash
feature/{파트}-{기능명}
```

Jira 이슈가 있는 작업은 이슈 키를 앞에 포함한다.

```bash
feature/{JIRA-KEY}-{파트}-{기능명}
```

Jira 키를 제외한 파트와 기능명은 소문자로 작성한다.

### FE 예시

```bash
feature/fe-language-select
feature/fe-station-search
feature/fe-indoor-map
feature/fe-route-guide
feature/fe-consultation-call
feature/fe-admin-map-management
```

### BE 예시

```bash
feature/be-auth
feature/be-station-api
feature/be-indoor-route
feature/be-vps-localization
feature/be-webrtc-signaling
feature/be-admin-facility
feature/S15P11A206-58-be-backend-init
```

### Docs 예시

```bash
feature/docs-api-spec
feature/docs-erd
feature/docs-git-convention
```

### 생성 명령어

```bash
git checkout develop
git pull origin develop
git checkout -b feature/be-indoor-route
```

---

## 4. Commit Message

### 형식

```bash
<타입>: <내용>
```

Jira 이슈가 있는 작업은 메시지 앞에 이슈 키를 붙인다.

```bash
<JIRA-KEY> <타입>: <내용>
```

### Commit Type

| 타입 | 설명 | 예시 |
| --- | --- | --- |
| `feat` | 새로운 기능 추가 | `feat: Add indoor route API` |
| `fix` | 버그 수정 | `fix: Fix route option filtering` |
| `refactor` | 기능 변화 없는 코드 리팩토링 | `refactor: Rename station DTO fields` |
| `style` | 코드 포맷팅, 세미콜론 등 코드 동작 변경 없음 | `style: Format route service` |
| `docs` | 문서 수정 | `docs: Update API specification` |
| `chore` | 패키지 매니저 수정, `.gitignore` 등 | `chore: Add env example` |
| `build` | 빌드 관련 수정 | `build: Update vite config` |
| `test` | 테스트 코드 추가/수정 | `test: Add route service tests` |
| `db` | DB schema, migration, seed 변경 | `db: Add route edge seed data` |
| `api` | API 계약, DTO, endpoint 변경 | `api: Update consultation response format` |

### 작성 규칙

- 타입은 소문자를 사용한다.
- 내용은 영어로 작성한다.
- 내용은 동사 원형으로 시작한다.
- 제목은 72자 이내를 권장한다.
- 제목 끝에 마침표를 쓰지 않는다.
- 상세 설명이 필요하면 commit body 또는 PR 설명에 작성한다.

> Commit message는 영어로 작성한다.
>
> PR 제목과 설명은 팀 이해를 위해 한국어 사용을 허용한다.

### 좋은 예 / 나쁜 예

```bash
# 좋은 예
feat: Add station nearby API
fix: Fix WebRTC signaling room validation
api: Update indoor route response format
db: Add station floor seed data
docs: Add Git coding convention
S15P11A206-58 chore: Initialize spring boot backend project

# 나쁜 예
feat: 기능 추가함
fix: 수정
feat: add station api and route api and admin page and signaling
```

---

## 5. Pull Request

### 규칙

1. feature 브랜치에서 기능 개발 완료 후 원격 feature 브랜치로 push한다.
2. 원격 `develop` 브랜치에 PR을 요청한다.
3. base branch가 `develop`인지 반드시 확인한다.
4. PR Reviewer를 지정한다.
5. Squash Merge를 기본으로 사용한다.
6. PR 승인 후 merge한다.
7. Merge된 feature 브랜치는 로컬과 원격 모두 삭제한다.

### Merge 방식

```bash
Squash Merge 기본 사용
```

feature 브랜치의 여러 커밋을 `develop`에 하나의 커밋으로 합친다.

`develop` 브랜치에는 기능 단위 커밋만 남긴다.

### PR 네이밍

```bash
[파트] <타입>: <내용>
```

Jira 이슈가 있는 PR은 제목 앞에 이슈 키를 붙인다.

```bash
<JIRA-KEY> [파트] <타입>: <내용>
```

예시:

```bash
[BE] feat: 실내 경로 탐색 API 구현
[FE] feat: 경로 안내 화면 구현
[BE] fix: WebRTC signaling 연결 오류 수정
[FE] feat: 출구 추천 화면 구현
[DOCS] docs: Git coding convention 추가
S15P11A206-58 [BE] chore: Spring Boot 백엔드 빈 프로젝트 생성
```

---

## 6. Front / Back 연동 규칙

프론트엔드와 백엔드 연동에서 가장 자주 발생하는 문제는 API 응답 구조 불일치이다.

```bash
backend API 응답 구조 변경
↓
frontend 아직 반영 안 됨
↓
화면 또는 기능 깨짐
```

### Breaking Change 표시

다른 파트에 영향을 주는 변경은 PR 제목에 `[breaking-change]`를 표시한다.

```bash
[BE][breaking-change] api: 경로 응답 구조 변경
[BE][breaking-change] api: 상담 요청 상태값 변경
[FE][breaking-change] feat: 경로 응답 변경 반영
```

### 연관 PR 작성 대상

아래 변경은 반드시 frontend / backend 연관 PR을 함께 작성한다.

- BE API 응답 필드 변경
- DTO / 타입 구조 변경
- 인증 방식 변경
- 환경변수 추가 또는 수정
- API endpoint 변경
- WebRTC signaling event 구조 변경
- DataChannel message payload 변경
- DB enum 또는 상태값 변경

### 연동 Merge 순서

연관 PR이 필요한 경우 한쪽 변경만 먼저 merge하지 않는다.

두 PR이 모두 준비된 뒤 아래 순서로 merge한다.

```bash
1. Backend   # API, DTO, DB, signaling event 반영
2. Frontend  # API 연동 및 화면 반영
```

### PR 설명에 연관 PR 링크 명시

```markdown
## 연관 PR
- BE: #12
- FE: #8
```

---

## 7. API Contract 관리 규칙

API 계약은 `docs/API_명세서.md`를 기준으로 관리한다.

### 변경 규칙

- API endpoint, request, response, error code 변경 시 API 명세서를 함께 수정한다.
- request / response 필드 변경은 PR 제목 또는 설명에 명확히 표시한다.
- frontend에서 사용하는 타입 변경 여부를 PR 체크리스트에 포함한다.
- breaking change라면 frontend 연관 PR을 함께 준비한다.

### API 관련 커밋 예시

```bash
api: Add indoor route options endpoint
api: Update VPS localization response
api: Add consultation accept endpoint
docs: Update API specification for route recalculation
```

---

## 8. Data / Map / VPS 관리 규칙

역, 지도, 시설, 경로, VPS 데이터는 서비스 동작에 직접 영향을 주므로 변경 내역을 명확히 관리한다.

### 데이터 변경 대상

- 역 정보
- 층별 지도 이미지
- 시설 및 출구 좌표
- 경로 노드와 간선
- 주변 장소와 추천 출구 매핑
- VPS 기준 데이터와 위치 인식 로그 정책

### 작업 규칙

- DB schema 변경은 migration 또는 명확한 SQL 변경 이력으로 관리한다.
- seed data 변경은 커밋과 PR 설명에 대상 역과 변경 범위를 적는다.
- 지도 이미지 좌표 기준은 `docs/ERD_초안.md`와 API 명세 기준을 따른다.
- VPS 실패 대응 흐름을 바꾸는 경우 기능 요구사항과 화면 흐름 영향을 함께 확인한다.

### 관련 커밋 예시

```bash
db: Add station floor tables
db: Add route node seed data
feat: Add manual localization fallback
docs: Update VPS fallback flow
```

---

## 9. Issue 규칙

작업이 분산되지 않도록 이슈 제목을 명확히 작성한다.

### Issue 제목 형식

```bash
[파트] 작업 내용
```

예시:

```bash
[BE] 주변 역 조회 API 구현
[FE] 목적지 검색 화면 구현
[BE] WebRTC signaling 구현
[FE] 경로 안내 지도 오버레이 구현
[DOCS] Git coding convention 작성
```

### Label 권장값

```bash
feat
fix
docs
api
db
breaking-change
fe
be
urgent
```

---

## 10. PR 템플릿

각 레포 또는 통합 레포의 `.github/PULL_REQUEST_TEMPLATE.md`에 추가한다.

```markdown
## 개요
> 이 PR에서 무엇을 변경했나요?

## 변경 사항
### 변경의 종류 (해당하는 것에 체크)
- [ ] 버그 수정
- [ ] 새로운 기능
- [ ] 코드 리팩토링
- [ ] 문서 업데이트
- [ ] API 계약 변경
- [ ] DB schema / seed 변경
- [ ] Breaking Change (다른 파트에 영향)
- [ ] 기타

## 구현 내용
> 주요 변경 사항을 간략히 설명해주세요.

## 연관 PR / 이슈
> 다른 파트 PR 링크 또는 관련 이슈 번호

## 체크리스트
- [ ] 컴파일 가능한가요?
- [ ] 로컬에서 정상 동작 확인했나요?
- [ ] PR 하기 전에 코드를 다시 한번 살펴봤나요?
- [ ] 이해하기 힘든 부분에 주석을 달았나요?
- [ ] API 명세서가 최신 상태인가요? (BE)
- [ ] 환경변수나 API 키가 코드에 하드코딩되어 있지 않나요?
- [ ] Breaking Change라면 연관 파트 PR이 모두 준비되어 있나요?
- [ ] DB 변경이라면 migration 또는 seed 변경 내역이 명확한가요? (BE)
- [ ] WebRTC / DataChannel 이벤트 변경이라면 FE/BE 반영 여부를 확인했나요?

## 스크린샷 (FE 변경 시)
> UI 변경이 있을 경우 스크린샷을 첨부해주세요.
```

---

## 11. 코드 리뷰 & 피드백

- 코드 리뷰가 진행되었으면 피드백을 반영한다.
- 모든 피드백을 반드시 반영할 필요는 없다.
- 의문점이 있거나 더 나은 방향이 있다면 리뷰에 코멘트를 남긴다.
- 피드백 반영이 완료되면 Reviewer를 재지정하고 Approve까지 반복한다.

---

## 12. 환경변수 관리 규칙

- 실제 `.env` 파일은 절대 커밋하지 않는다.
- 필요한 환경변수 목록은 `.env.example`에 키만 작성한다.
- JWT secret, DB password, 지도 API key, TURN credential 등 민감 정보는 환경변수로 관리한다.
- frontend에는 브라우저에 노출되어도 되는 값만 둔다.

### `.env.example` 예시

### FE

```env
VITE_API_BASE_URL=
VITE_NAVER_MAP_CLIENT_ID=
```

### BE

```env
DB_URL=
DB_USERNAME=
DB_PASSWORD=
JWT_SECRET=
NAVER_MAP_CLIENT_ID=
NAVER_MAP_CLIENT_SECRET=
STUN_URL=
TURN_URL=
TURN_USERNAME=
TURN_CREDENTIAL=
VPS_PROVIDER_API_URL=
VPS_PROVIDER_API_KEY=
```

---

## 13. .gitignore 필수 항목

### 공통

```gitignore
*.env
.env.*
!.env.example
.DS_Store
*.log
/logs/
/.idea/
*.iml
```

### Backend

```gitignore
/target/
application-local.yml
application-secret.yml
*.key
```

### Frontend

```gitignore
node_modules/
dist/
.vite/
coverage/
*.local
```

---

## 14. Release Tag 규칙

최종 제출 버전은 `main` 브랜치에 release tag를 남긴다.

```bash
v1.0.0-demo
v1.0.0-final
```

frontend / backend가 분리된 경우 최종 제출 시점의 버전을 맞춘다.

예시:

```bash
frontend  v1.0.0-final
backend   v1.0.0-final
```

---

## 15. 전체 흐름 요약

```bash
1. develop 브랜치에서 feature 브랜치를 생성한다.
   git checkout develop
   git pull origin develop
   git checkout -b feature/be-indoor-route

2. feature 브랜치에서 기능을 개발하고 커밋한다.
   git commit -m "feat: Add indoor route API"

3. 원격 feature 브랜치로 push한다.
   git push origin feature/be-indoor-route

4. develop 브랜치로 Pull Request를 요청한다.
   - Reviewer 지정
   - Breaking Change라면 연관 PR 링크 명시

5. Approve 후 Squash Merge한다.

6. feature 브랜치를 삭제한다.
   git branch -d feature/be-indoor-route
   git push origin --delete feature/be-indoor-route

7. develop → main 병합은 배포 또는 최종 제출 시점에만 진행한다.

8. 최종 제출 시 main 브랜치에 release tag를 남긴다.
```
