# 🗂️ PinGo GitLab & Git Convention

> 적용 프로젝트: `S15P11A206` PinGo
> 협업 도구: GitLab · Jira
> 팀 구성: 6인
> 기본 브랜치 흐름: `작업 브랜치 → develop → master`

---

## 0. 목적

이 문서는 PinGo 프로젝트에서 사용하는 브랜치, 커밋, Merge Request, 코드 리뷰 및 Jira 연동 규칙을 정의한다.

모든 개발 작업은 Jira Task를 기준으로 진행한다. 브랜치명과 Merge Request 제목에는 Jira 이슈 키를 반드시 직접 작성한다. 커밋 메시지에는 Jira 키를 직접 작성하지 않으며, `.githooks`의 Git Hook이 현재 브랜치명에서 Jira 키를 추출해 자동으로 추가한다.

브랜치명은 영어로 작성하고, 커밋 메시지와 Merge Request 제목의 작업 설명은 한국어로 작성한다. `feat`, `fix`, `refactor` 등의 Type 접두사는 기존 영문 표기를 유지한다.

```text
Jira Task 확인
→ 작업 브랜치 생성
→ 기능 개발 및 커밋
→ Merge Request 생성
→ 코드 리뷰
→ develop 병합
→ 기능 검증
→ Jira Done 처리
```

---

## 1. 개발 영역

| 영역       | 코드       | 역할                                                  |
| -------- | -------- | --------------------------------------------------- |
| Frontend | `fe`     | 화면, 카메라, 센서, 지도 및 경로 안내 UI                          |
| Backend  | `be`     | API, DB, 인증, 경로 탐색, WebRTC 및 실시간 통신                 |
| AI / VPS | `ai`     | Visual Localization, COLMAP, hloc, 특징점 매칭 및 Pose 추정 |
| Infra    | `infra`  | 서버, 배포, Docker, CI/CD 및 환경 설정                       |
| Common   | `common` | 공통 문서, 공통 설정 및 프로젝트 전반 작업                           |

작업이 여러 영역에 영향을 주더라도 브랜치와 MR에는 변경의 중심이 되는 영역 하나를 사용한다.

---

## 2. 전체 네이밍 규칙

### 브랜치

```text
<type>/<part>-<task-slug>-<jira-key>
```

```bash
feature/fe-language-select-S15P11A206-70
```

브랜치에는 Jira 키를 맨 끝에 반드시 직접 작성한다.

### 커밋

개발자가 입력하는 형식:

```text
<type>: <한국어 작업 내용>
```

```bash
feat: 언어 선택 화면 구현
```

Git Hook 적용 후 실제 저장 형식:

```text
[<jira-key>] <type>: <한국어 작업 내용>
```

```text
[S15P11A206-70] feat: 언어 선택 화면 구현
```

### Merge Request

```text
[<PART>] <type>: <한국어 작업 내용>-<jira-key>
```

```text
[FE] feat: 언어 선택 화면 구현-S15P11A206-70
```

### 핵심 원칙

```text
브랜치
→ Jira 키를 맨 끝에 직접 작성한다.

커밋
→ Jira 키를 직접 작성하지 않는다.
→ Git Hook이 브랜치명에서 Jira 키를 추출해 자동으로 앞에 추가한다.

MR
→ Jira 키를 맨 끝에 직접 작성한다.

언어
→ 브랜치의 task slug는 영어 소문자로 작성한다.
→ 커밋 메시지와 MR 제목의 작업 설명은 한국어로 작성한다.
→ feat, fix 등의 Type 접두사는 영어를 유지한다.
```

---

## 3. Jira 연동 규칙

### 3.1 Jira 이슈 키

Jira 이슈 키는 다음과 같은 형태다.

```text
S15P11A206-70
```

| 구성           | 의미          |
| ------------ | ----------- |
| `S15P11A206` | Jira 프로젝트 키 |
| `70`         | Jira 이슈 번호  |

`FR-U-001`과 같은 기능 요구사항 ID는 Jira 이슈 키가 아니다.

```text
기능 요구사항 ID: FR-U-001
Jira 이슈 키: S15P11A206-70
```

GitLab 연동에는 Jira 이슈 키를 사용한다.

### 3.2 작성 규칙

* Jira 키는 원본 대문자를 그대로 유지한다.
* Jira 키 내부의 하이픈을 삭제하거나 변경하지 않는다.
* 브랜치명에는 Jira 키를 반드시 직접 작성한다.
* MR 제목에는 Jira 키를 맨 끝에 반드시 직접 작성한다.
* 커밋 메시지에는 Jira 키를 직접 작성하지 않는다.
* `.githooks`의 Git Hook이 브랜치명에서 Jira 키를 추출해 커밋 메시지 맨 앞에 자동 추가한다.
* 하나의 작업 브랜치는 하나의 Jira Task를 기준으로 생성한다.
* 다른 Jira Task 작업이 추가되면 별도의 브랜치를 생성한다.

```text
✅ 올바른 Jira 키
S15P11A206-70

❌ 잘못된 Jira 키
s15p11a206-70
S15P11A20670
FR-U-001
```

### 3.3 Jira 자동 제안 브랜치명

Jira가 다음과 같은 브랜치명을 자동으로 제안할 수 있다.

```bash
git checkout -b S15P11A206-70-fr-u-001-언어-선택
```

자동 제안 이름을 그대로 사용하지 않고 Git 컨벤션에 맞게 수정한다.

```bash
git checkout -b feature/fe-language-select-S15P11A206-70
```

Jira 키가 브랜치명에 정확히 포함되어 있으면 앞뒤 위치와 관계없이 Jira 개발 정보와 연결할 수 있다.

---

## 4. Git Hook 최초 설정

커밋 메시지의 Jira 키는 `.githooks`에 포함된 Git Hook이 현재 브랜치명에서 자동으로 추출해 추가한다.

### 4.1 최초 설정

최신 `develop` 브랜치를 pull 하고 프로젝트 루트에 `.githooks` 디렉터리가 생성되었는지 확인한다.

```bash
git checkout develop
git pull origin develop
```

Git Hook 경로를 설정한다.

```bash
git config core.hooksPath .githooks
```

> 위 명령어는 저장소별로 최초 한 번만 실행하면 된다.

### 4.2 적용 확인

```bash
git config core.hooksPath
```

정상 결과:

```text
.githooks
```

### 4.3 동작 예시

현재 브랜치:

```text
feature/fe-language-select-S15P11A206-70
```

개발자가 입력:

```bash
git commit -m "feat: 언어 선택 화면 구현"
```

실제 저장 결과:

```text
[S15P11A206-70] feat: 언어 선택 화면 구현
```

### 4.4 주의사항

- 브랜치명에 Jira 키가 없으면 자동 추가할 수 없다.
- 커밋 메시지에 Jira 키를 직접 입력하면 중복될 수 있으므로 작성하지 않는다.
- Hook이 동작하지 않으면 `git config core.hooksPath` 결과를 먼저 확인한다.
- `.githooks` 내부 스크립트는 임의로 수정하지 않는다.

---

## 5. Branch 전략


### 5.1 브랜치 흐름

```text
feature / fix / refactor / docs / test / chore / build / ci
                                    ↓
                                 develop
                                    ↓
                                 master
```

| 브랜치       | 설명                        |
| --------- | ------------------------- |
| `master`  | 최종 배포 및 제출 브랜치            |
| `develop` | 기능 통합 및 테스트 브랜치           |
| 작업 브랜치    | Jira Task 단위로 생성하는 개발 브랜치 |

### 5.2 운영 원칙

* `master`와 `develop`에는 직접 push하지 않는다.
* 작업 브랜치는 최신 `develop`에서 생성한다.
* 모든 코드 변경은 작업 브랜치에서 수행한다.
* 기능 개발 완료 후 `develop`을 대상으로 MR을 생성한다.
* `master` 병합은 배포, 시연 또는 최종 제출 시점에 진행한다.
* 하나의 브랜치에서는 하나의 Jira Task만 처리한다.
* 관련 없는 여러 기능을 하나의 브랜치에 함께 구현하지 않는다.
* MR 병합 후 작업 브랜치는 삭제한다.

---

## 6. Branch Protection

GitLab에서 `master`, `develop` 브랜치를 Protected Branch로 설정한다.

### 필수 설정

* `master`, `develop` 직접 push 금지
* Merge Request를 통해서만 병합
* 최소 1명 이상 Approve 후 병합
* 작성자가 자신의 MR을 단독 승인하지 않음
* Conflict가 남은 MR은 병합 금지
* Merge 후 Source branch 삭제
* CI 구축 이후 Pipeline 실패 시 병합 금지

### 권장 설정

| 항목                    | 설정                           |
| --------------------- | ---------------------------- |
| Allowed to push       | Maintainer만 허용하거나 직접 push 금지 |
| Allowed to merge      | 승인된 팀원                       |
| Required approvals    | 최소 1명                        |
| Delete source branch  | 활성화                          |
| Squash commits        | 비활성화                        |
| Pipeline must succeed | CI 구축 후 활성화                  |

---

## 7. 작업 브랜치 규칙

### 7.1 브랜치 형식

```text
<type>/<part>-<task-slug>-<jira-key>
```

예시:

```bash
feature/fe-language-select-S15P11A206-70
feature/be-route-search-api-S15P11A206-74
feature/ai-visual-localization-S15P11A206-82
fix/fe-camera-permission-S15P11A206-95
refactor/be-route-service-S15P11A206-96
docs/common-api-spec-S15P11A206-110
test/ai-pose-estimation-S15P11A206-111
chore/infra-env-config-S15P11A206-112
ci/infra-gitlab-pipeline-S15P11A206-115
```

### 7.2 브랜치 구성

```text
feature/                   브랜치 작업 유형
fe                         담당 영역
language-select            작업 내용을 나타내는 영문 이름
S15P11A206-70              Jira 이슈 키
```

### 7.3 Branch Type

| Type       | 사용 기준                           |
| ---------- | ------------------------------- |
| `feature`  | 새로운 기능 구현                       |
| `fix`      | 오류 또는 버그 수정                     |
| `refactor` | 기능 변화가 없는 코드 구조 개선              |
| `docs`     | 문서 추가 및 수정                      |
| `test`     | 테스트 코드 및 테스트 데이터 추가·수정          |
| `chore`    | 패키지, 환경변수, `.gitignore` 등 기타 작업 |
| `build`    | 빌드 및 배포 설정                      |
| `ci`       | GitLab CI/CD 구성                 |

### 7.4 Part

| Part     | 설명            |
| -------- | ------------- |
| `fe`     | Frontend      |
| `be`     | Backend       |
| `ai`     | AI · VPS      |
| `infra`  | Infra · CI/CD |
| `common` | 공통 문서 및 공통 설정 |

### 7.5 Task Slug 규칙

* 영문 소문자로 작성한다.
* 단어는 하이픈으로 구분한다.
* 작업 내용을 짧고 명확하게 표현한다.
* 한글, 공백, 언더바, 불필요한 특수문자를 사용하지 않는다.
* 의미 없는 이름을 사용하지 않는다.
* 지나치게 긴 문장 형태로 작성하지 않는다.

```bash
# ✅ 좋은 예
language-select
station-search
route-search-api
camera-permission
visual-localization
pose-estimation

# ❌ 나쁜 예
언어-선택
language_select
work
task1
develop
implement-language-selection-screen-for-foreign-users
```

### 7.6 브랜치 생성

```bash
git checkout develop
git pull origin develop
git checkout -b feature/fe-language-select-S15P11A206-70
```

또는 다음 명령어를 사용할 수 있다.

```bash
git switch develop
git pull origin develop
git switch -c feature/fe-language-select-S15P11A206-70
```

### 7.7 원격 브랜치 등록

```bash
git push -u origin feature/fe-language-select-S15P11A206-70
```

### 7.8 브랜치 삭제

MR 병합 후 로컬 브랜치를 삭제한다.

```bash
git checkout develop
git pull origin develop
git branch -d feature/fe-language-select-S15P11A206-70
```

원격 브랜치가 자동 삭제되지 않은 경우 다음 명령어를 사용한다.

```bash
git push origin --delete feature/fe-language-select-S15P11A206-70
```

---

## 8. Commit Message

### 8.1 개발자가 입력하는 형식

```text
<type>: <한국어 작업 내용>
```

예시:

```bash
feat: 언어 선택 화면 구현
feat: 경로 탐색 API 구현
fix: 카메라 권한 거부 처리 수정
refactor: 경로 탐색 서비스 분리
docs: API 명세서 업데이트
```

### 8.2 Git Hook 적용 후 실제 형식

```text
[<jira-key>] <type>: <한국어 작업 내용>
```

```text
[S15P11A206-70] feat: 언어 선택 화면 구현
```

개발자는 Jira 키를 직접 입력하지 않는다. Git Hook이 현재 브랜치명에서 Jira 키를 추출해 자동으로 추가한다.

### 8.3 Commit Type

| Type | 설명 | 입력 예시 |
| --- | --- | --- |
| `feat` | 새로운 기능 추가 | `feat: 경로 탐색 API 구현` |
| `fix` | 버그 수정 | `fix: 빈 경로 결과 예외 처리` |
| `refactor` | 기능 변화 없는 리팩토링 | `refactor: 경로 검증 로직 분리` |
| `style` | 코드 동작 변화 없는 포맷 수정 | `style: 경로 컨트롤러 포맷 정리` |
| `docs` | 문서 수정 | `docs: WebRTC API 명세서 업데이트` |
| `chore` | 설정 및 기타 작업 | `chore: gitignore 항목 추가` |
| `build` | 빌드 설정 | `build: Docker 설정 추가` |
| `test` | 테스트 코드 추가·수정 | `test: 위치 추정 테스트 추가` |
| `perf` | 성능 개선 | `perf: 특징점 매칭 지연 시간 단축` |
| `ci` | CI/CD 설정 | `ci: GitLab 파이프라인 추가` |

### 8.4 작성 규칙

- Jira 키는 직접 작성하지 않는다.
- Type 접두사는 영문 소문자로 작성한다.
- 작업 설명은 한국어로 작성한다.
- 제목 끝에 마침표를 붙이지 않는다.
- 하나의 커밋에는 하나의 논리적인 변경만 담는다.
- `수정`, `작업`, `완료`처럼 의미가 불분명한 표현만 단독으로 사용하지 않는다.
- 상세 설명이 필요한 경우 commit body에 작성한다.

### 8.5 좋은 예와 나쁜 예

```bash
# ✅ 좋은 예
feat: 다국어 언어 선택 기능 구현
feat: 역사 검색 API 구현
fix: WebRTC 중복 연결 방지
refactor: 경로 그래프 검증 로직 분리
docs: 위치 추정 API 계약 업데이트

# ❌ 나쁜 예
feat: 수정
fix: 작업
feat: 완료
[S15P11A206-70] feat: 언어 선택 화면 구현
feat: 화면과 API와 테스트를 모두 구현
```

### 8.6 커밋 명령어 및 확인

```bash
git status
git diff
git add <변경한 파일>
git commit -m "feat: 언어 선택 화면 구현"
git log -1 --pretty=%B
```

정상 결과:

```text
[S15P11A206-70] feat: 언어 선택 화면 구현
```

---

## 9. Merge Request

GitLab에서는 Pull Request가 아니라 **Merge Request, MR**이라는 용어를 사용한다.

### 9.1 MR 제목 형식

```text
[<PART>] <type>: <한국어 작업 내용>-<jira-key>
```

예시:

```text
[FE] feat: 언어 선택 화면 구현-S15P11A206-70
[BE] feat: 경로 탐색 API 구현-S15P11A206-74
[AI] feat: Visual Localization 파이프라인 구현-S15P11A206-82
[FE] fix: 카메라 권한 거부 처리 수정-S15P11A206-95
[COMMON] docs: API 명세서 업데이트-S15P11A206-110
```

### 9.2 MR 제목 작성 규칙

- 담당 영역은 대문자로 작성한다.
- Type 접두사는 영문 소문자로 작성한다.
- 작업 설명은 한국어로 작성한다.
- Jira 키는 제목 맨 끝에 직접 작성한다.
- 작업 설명과 Jira 키 사이는 하이픈 `-`으로 구분한다.
- 브랜치명과 동일한 Jira 키를 사용한다.
- 제목 끝에 마침표를 붙이지 않는다.
- 제목만 보고 변경 내용을 파악할 수 있도록 구체적으로 작성한다.

```text
# ✅ 좋은 예
[FE] feat: 언어 선택 화면 구현-S15P11A206-70
[BE] feat: 교통약자 경로 탐색 API 구현-S15P11A206-74
[AI] feat: SuperPoint 특징점 추출 구현-S15P11A206-82
[FE] fix: 카메라 중복 초기화 방지-S15P11A206-95

# ❌ 나쁜 예
[FE] feat: 언어 선택 화면 구현
[FE] feat: 언어 선택 화면 구현-S15P11A206-70
[FE] 수정-S15P11A206-70
[FE] feat: 언어 선택 화면 구현-S15P11A20670
```

### 9.3 MR 생성 규칙

1. Jira Task와 연결된 작업 브랜치에서 개발한다.
2. 변경 사항을 커밋하고 원격 브랜치로 push한다.
3. Target branch가 `develop`인지 확인한다.
4. Reviewer를 최소 1명 지정한다.
5. MR 제목의 Part와 Type을 정확히 작성한다.
6. 작업 설명은 한국어로 작성한다.
7. MR 제목 맨 끝에 Jira 키를 직접 작성한다.
8. 브랜치와 MR의 Jira 키가 같은지 확인한다.
9. 관련 Jira 이슈와 연관 MR을 설명에 작성한다.
10. 코드 리뷰와 테스트 완료 후 병합한다.
11. 일반 Merge를 사용한다.
12. 병합 후 Source branch를 삭제한다.

### 9.4 MR Type

```text
feat
fix
refactor
style
docs
chore
build
test
perf
ci
```

### 9.5 Breaking Change

```text
[BE][breaking-change] feat: 경로 응답 구조 변경-S15P11A206-120
[AI][breaking-change] feat: 위치 추정 응답 스키마 변경-S15P11A206-121
[FE][breaking-change] feat: 위치 응답 변경 반영-S15P11A206-122
```

### 9.6 Draft MR

```text
Draft: [AI] feat: VPS 위치 추정 파이프라인 구현-S15P11A206-82
```

다음 상태에서는 Draft를 해제하지 않는다.

- 컴파일 또는 빌드 실패
- 주요 기능 미완료
- 테스트 미실행
- 치명적인 오류 존재
- 필수 문서 미작성

---

## 10. Merge 방식

기본 병합 방식은 **일반 Merge**다.

작업 브랜치의 개별 커밋 이력을 유지한 상태로 `develop` 브랜치에 병합한다.

```text
일반 Merge
```

### 10.1 커밋 이력 유지 원칙

- Squash Merge를 사용하지 않는다.
- 작업 브랜치의 개별 커밋은 병합 후에도 그대로 유지한다.
- 하나의 커밋에는 하나의 논리적인 변경만 담는다.
- 의미 없는 중간 커밋이 남지 않도록 커밋 메시지를 명확하게 작성한다.
- Git Hook을 통해 각 커밋 메시지에 Jira 키가 정상적으로 추가되었는지 확인한다.
- 이미 원격에 공유된 브랜치의 커밋 이력을 임의로 변경하지 않는다.

### 10.2 병합 조건

다음 조건을 모두 확인한 후 병합한다.

- 최소 1명 이상 Approve
- Conflict 없음
- 컴파일 또는 빌드 성공
- 주요 기능 로컬 테스트 완료
- MR 체크리스트 완료
- 브랜치명에 Jira 키가 정확히 포함됨
- Git Hook이 커밋 메시지에 Jira 키를 정상 추가함
- 브랜치명과 MR 제목 맨 끝의 Jira 키가 일치함
- 커밋 메시지와 MR 제목의 작업 설명이 한국어로 작성됨
- API 및 문서 변경 사항 반영
- Breaking Change 영향 범위 확인
- 민감 정보 및 불필요한 파일 미포함

MR 병합만으로 Jira Task를 무조건 Done 처리하지 않는다.

```text
MR 병합
→ 기능 및 통합 검증
→ 인수조건 확인
→ 관련 문서 업데이트
→ Jira Done
```

---

## 11. 영역 간 연동 규칙

Frontend, Backend, AI 작업이 서로 영향을 주는 경우 연관 MR을 함께 관리한다.

```text
Backend 또는 AI 인터페이스 변경
                  ↓
Frontend 반영
                  ↓
통합 테스트
```

### 11.1 연관 MR이 필요한 변경

* Backend API Request·Response 변경
* Frontend에서 사용하는 DTO 및 타입 변경
* AI 위치 추정 결과 구조 변경
* WebRTC 메시지 형식 변경
* 인증 방식 변경
* 환경변수 추가 및 수정
* API Endpoint 변경
* DB Schema 변경
* 실내 지도 또는 경로 데이터 형식 변경

### 11.2 병합 순서

일반적인 병합 순서는 다음과 같다.

```text
1. Backend 또는 AI
2. Frontend
3. 통합 테스트
```

한 영역의 MR만 먼저 병합하면 다른 영역이 즉시 깨지는 경우, 관련 MR이 모두 준비된 이후 병합한다.

### 11.3 MR 설명에 연관 MR 명시

```markdown
## Related Merge Requests

- FE: !47
- BE: !42
- AI: !51
- Infra:
```

---

## 12. AI · VPS 작업 관리 규칙

AI·VPS 작업은 재현할 수 있도록 모델, 파라미터, 데이터 및 성능 결과를 기록한다.

### 관리 대상

* COLMAP 설정
* hloc 설정
* SuperPoint·LightGlue 설정
* 특징점 추출 및 매칭 코드
* PnP·RANSAC Pose 추정 코드
* 성능 평가 스크립트
* 테스트 케이스
* 샘플 입력·출력
* 모델 및 라이브러리 버전

### 커밋 금지 대상

* 대용량 원본 영상
* 개인정보가 포함된 촬영 원본
* 전체 학습 및 평가 데이터
* 모델 가중치
* API Key
* 서버 인증 키
* 개인 로컬 경로
* 실행 결과 및 캐시 파일

대용량 데이터의 위치와 준비 방법은 README 또는 별도 문서에 기록한다.

### AI 실험 정보

AI·VPS 성능에 영향을 주는 변경은 MR 설명에 다음 내용을 기록한다.

```markdown
## Experiment Information

- Target dataset:
- Model:
- Key parameters:
- Previous result:
- Updated result:
- Average inference time:
- Known limitations:
```

### 커밋 예시

```bash
feat: SuperPoint 특징점 추출 구현
feat: LightGlue 매칭 파이프라인 구현
feat: PnP Pose 추정 구현
perf: 위치 추정 추론 시간 단축
test: 위치 추정 벤치마크 테스트 추가
```

---

## 13. Jira 및 GitLab Issue 관리

업무 일정과 진행 상태는 Jira를 기준으로 관리한다.

### 기본 원칙

* 개발 시작 전 Jira Task를 확인한다.
* 작업 브랜치는 Jira Task 단위로 생성한다.
* 브랜치명에 Jira 키를 반드시 포함한다.
* 커밋 메시지의 Jira 키는 Git Hook이 자동으로 추가한다.
* MR 제목에는 Jira 키를 맨 끝에 직접 작성한다.
* 작업 범위가 커지면 기존 Jira Task를 무리하게 확장하지 않고 분리한다.
* Blocker가 발생하면 Jira에 원인과 필요한 조치를 기록한다.
* GitLab Issue를 기능 일정 관리의 주 수단으로 사용하지 않는다.

### GitLab Issue 사용 가능 범위

* CI/CD 장애
* 저장소 관리 문제
* GitLab 권한 및 설정 문제
* GitLab에서만 발생하는 기술적 문제

---

## 14. Merge Request 템플릿

다음 경로에 MR 템플릿을 생성한다.

```text
.gitlab/merge_request_templates/Default.md
```

템플릿의 제목과 항목은 팀의 영어 작성 원칙에 따라 영어로 작성한다.

```markdown
## Overview

> What was implemented or changed in this Merge Request?

## Jira Issue

- Jira Key:
- Jira Link:

## Changes

### Change Type

- [ ] New feature
- [ ] Bug fix
- [ ] Refactoring
- [ ] Test addition or update
- [ ] Documentation update
- [ ] Environment or build configuration
- [ ] Breaking change
- [ ] Other

## Implementation Details

-
-
-

## Test Results

- [ ] Verified that the feature works correctly in the local environment.
- [ ] Verified the primary success scenarios.
- [ ] Verified failure and exception scenarios.
- [ ] Verified that existing features have no regression issues.

### Test Steps

1.
2.
3.

## Related Merge Requests

- FE:
- BE:
- AI:
- Infra:

## Checklist

- [ ] Is the target branch `develop`?
- [ ] Does the branch name include the Jira key at the end?
- [ ] Git Hook 설정이 적용되어 있나요?
- [ ] 커밋 메시지에 Jira 키가 자동으로 추가되었나요?
- [ ] 커밋 메시지의 작업 설명이 한국어인가요?
- [ ] MR 제목의 작업 설명이 한국어인가요?
- [ ] MR 제목 맨 끝에 브랜치와 동일한 Jira 키가 있나요?
- [ ] Does the project compile or build successfully?
- [ ] Are unnecessary files excluded?
- [ ] Are API keys and passwords excluded from the source code?
- [ ] Was the API specification updated when the API changed?
- [ ] Were related documents updated when the database changed?
- [ ] Is the impact of the breaking change documented?
- [ ] Are related FE, BE, AI, or Infra MRs ready?
- [ ] Are the Jira acceptance criteria satisfied?

## Breaking Change

> Write `None` when this section is not applicable.

- Change:
- Impact:
- Migration or application steps:

## Screenshots

> Attach screenshots when the UI has changed.

## Notes

> Add any information reviewers should know.
```

---

## 15. 코드 리뷰 규칙

### 작성자

* MR 생성 전 변경 내용을 스스로 검토한다.
* Reviewer가 이해할 수 있도록 MR 설명을 작성한다.
* MR 제목의 작업 설명은 한국어로 작성한다.
* 리뷰 요청 전 컴파일과 테스트를 수행한다.
* 리뷰 의견을 반영하거나 반영하지 않는 이유를 댓글로 남긴다.
* 수정 후 Reviewer에게 재검토를 요청한다.
* 논의가 끝나지 않은 Thread를 임의로 Resolve하지 않는다.

### Reviewer

* Jira 인수조건과 실제 구현이 일치하는지 확인한다.
* 기능 오류, 예외 처리, 보안 및 데이터 정합성을 검토한다.
* API와 인터페이스 호환성을 확인한다.
* 단순 취향과 반드시 수정해야 하는 문제를 구분한다.
* 수정 요청에는 이유를 함께 작성한다.
* 문제가 없다면 Approve한다.

### 리뷰 우선순위

```text
1. 기능 요구사항 및 인수조건 충족
2. 오류 및 보안 문제
3. 데이터 정합성
4. API 및 인터페이스 호환성
5. 성능
6. 유지보수성
7. 가독성 및 스타일
```

---

## 16. 환경변수 관리 규칙

* 실제 `.env` 파일을 커밋하지 않는다.
* 비밀번호, API Key, Secret Key를 코드에 작성하지 않는다.
* 필요한 환경변수 이름은 `.env.example`에 작성한다.
* `.env.example`에는 실제 값을 작성하지 않는다.
* 개발, 테스트, 운영 환경 설정을 분리한다.
* 환경변수 추가 및 변경 시 MR 설명과 관련 문서를 함께 수정한다.

### `.env.example`

```env
# Frontend
VITE_API_BASE_URL=
VITE_WEBRTC_URL=

# Backend
DB_URL=
DB_USERNAME=
DB_PASSWORD=
JWT_SECRET=
REDIS_HOST=
REDIS_PORT=

# AI / VPS
AI_SERVER_URL=
MODEL_PATH=
LOCALIZATION_DB_PATH=
```

---

## 17. `.gitignore` 필수 항목

### 공통

```gitignore
.env
.env.*
!.env.example

.DS_Store
Thumbs.db

.idea/
.vscode/
*.iml

*.log
logs/
```

### Frontend

```gitignore
node_modules/
dist/
.vite/
coverage/
*.local
```

### Backend

```gitignore
target/
build/
.gradle/

application-local.yml
application-secret.yml

*.key
*.pem
```

### AI

```gitignore
__pycache__/
*.py[cod]

.venv/
venv/
env/

.ipynb_checkpoints/
.pytest_cache/

models/
weights/
datasets/
data/raw/
outputs/
runs/
cache/
```

데이터 디렉터리 구조만 유지해야 하는 경우 `.gitkeep`을 사용한다.

---

## 18. Release Tag 규칙

배포, 시연 및 최종 제출 시 `master` 브랜치에 태그를 생성한다.

### 형식

```text
v<major>.<minor>.<patch>-<stage>
```

예시:

```bash
v0.1.0-alpha
v0.5.0-demo
v1.0.0-final
```

### 규칙

* 테스트되지 않은 커밋에 태그를 생성하지 않는다.
* 태그 생성 전 `master`의 최종 커밋을 확인한다.
* 시연 버전과 최종 제출 버전을 구분한다.
* 공유된 태그를 임의로 삭제하거나 덮어쓰지 않는다.

### 생성 예시

```bash
git checkout master
git pull origin master
git tag -a v1.0.0-final -m "PinGo final release"
git push origin v1.0.0-final
```

---

## 19. 금지 사항

다음 작업은 금지한다.

* `master`, `develop` 직접 push
* Jira Task 없이 기능 개발 시작
* Jira 키가 없는 브랜치 생성
* Jira 키가 없는 브랜치 생성
* 커밋 메시지에 Jira 키를 직접 작성
* Jira 키가 없는 MR 생성
* 브랜치와 MR에서 서로 다른 Jira 키 사용
* Git Hook 미설정 상태를 방치
* 브랜치명에 한글 사용
* 커밋 메시지나 MR 제목에 의미 없는 설명 사용
* 하나의 브랜치에서 여러 개의 무관한 Jira Task 처리
* API Key 및 비밀번호 커밋
* 대용량 원본 데이터 및 모델 가중치 커밋
* 코드 리뷰 없이 병합
* 테스트하지 않은 코드를 `develop`에 병합
* 무단 `git push --force`
* 공유 브랜치의 커밋 이력 임의 변경
* 다른 팀원의 브랜치 삭제
* Conflict 내용을 이해하지 못한 상태에서 임의 해결

규칙 예외가 필요한 경우 PM 또는 해당 영역 담당자와 먼저 합의한다.

---

## 20. 전체 작업 흐름

### 20.1 최초 1회 Git Hook 설정

```bash
git checkout develop
git pull origin develop
git config core.hooksPath .githooks
git config core.hooksPath
```

정상 결과:

```text
.githooks
```

### 20.2 Jira Task 확인

```text
S15P11A206-70
언어 선택 화면 UI 구현
```

### 20.3 최신 develop 반영

```bash
git checkout develop
git pull origin develop
```

### 20.4 작업 브랜치 생성

```bash
git checkout -b feature/fe-language-select-S15P11A206-70
```

### 20.5 개발 및 변경 사항 확인

```bash
git status
git diff
```

### 20.6 커밋

```bash
git add <변경한 파일>
git commit -m "feat: 언어 선택 화면 구현"
```

### 20.7 원격 브랜치 push

```bash
git push -u origin feature/fe-language-select-S15P11A206-70
```

### 20.8 Merge Request 생성

```text
Source branch:
feature/fe-language-select-S15P11A206-70

Target branch:
develop

MR 제목:
[FE] feat: 언어 선택 화면 구현-S15P11A206-70
```

### 20.9 리뷰 및 수정

```text
Reviewer 지정
→ 코드 리뷰
→ 피드백 반영
→ 테스트
→ Approve
```

### 20.10 일반 Merge

```text
Squash commits 비활성화
Delete source branch 활성화
→ Merge
```

작업 브랜치의 개별 커밋 이력은 `develop` 브랜치에 그대로 유지한다.

### 20.11 로컬 브랜치 정리

```bash
git checkout develop
git pull origin develop
git branch -d feature/fe-language-select-S15P11A206-70
```

### 20.12 Jira 상태 확인

```text
MR 병합
→ 기능 검증
→ 문서 반영 확인
→ Jira 인수조건 확인
→ Done 처리
```

---

## 21. 최종 요약

> 커밋 메시지와 MR 제목의 작업 내용은 모두 한국어로 작성하며, `feat`, `fix` 등의 Type만 영어를 유지한다.

```text
브랜치
<type>/<part>-<task-slug>-<jira-key>

개발자가 입력하는 커밋 메시지
<type>: <한국어 작업 내용>

Git Hook 적용 후 커밋 메시지
[<jira-key>] <type>: <한국어 작업 내용>

Merge Request 제목
[<PART>] <type>: <한국어 작업 내용>-<jira-key>
```

예시:

```text
브랜치
feature/fe-language-select-S15P11A206-70

커밋 입력
feat: 언어 선택 화면 구현

커밋 저장 결과
[S15P11A206-70] feat: 언어 선택 화면 구현

Merge Request
[FE] feat: 언어 선택 화면 구현-S15P11A206-70
```
