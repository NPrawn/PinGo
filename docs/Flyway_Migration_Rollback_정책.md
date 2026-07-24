# Flyway Migration Rollback 정책

## 1. 목적

본 문서는 Jenkins CD 배포 이후 Flyway migration이 MySQL에 적용된 상태에서 애플리케이션 jar만 이전 버전으로 rollback할 때 발생할 수 있는 schema 호환성 문제를 방지하기 위한 정책을 정의한다.

PinGo backend는 Flyway로 DB schema 변경을 관리한다. Flyway migration은 한 번 운영 DB에 적용되면 단순 jar rollback처럼 쉽게 되돌릴 수 없으므로, migration 작성과 배포 전 검증 기준을 별도로 관리한다.

---

## 2. 기본 원칙

### 2.1 애플리케이션 rollback과 DB rollback은 다르다

Backend jar rollback은 이전 jar 파일로 교체하고 `pingo-backend` 서비스를 재시작하면 된다.

반면 DB migration rollback은 이미 변경된 schema와 데이터에 영향을 주므로 자동으로 수행하지 않는다.

```text
애플리케이션 jar rollback: 가능
DB migration 자동 rollback: 금지
```

### 2.2 DB migration은 backward-compatible하게 작성한다

운영 DB에 적용되는 migration은 가능한 한 이전 버전의 애플리케이션도 동작할 수 있도록 작성한다.

즉, 새 버전 배포 후 문제가 생겨 이전 jar로 rollback하더라도 기존 코드가 DB schema 변경 때문에 즉시 실패하지 않아야 한다.

### 2.3 파괴적 변경은 한 번에 적용하지 않는다

컬럼 삭제, 컬럼명 변경, 타입 변경처럼 기존 코드와 호환되지 않을 수 있는 변경은 한 번의 배포에 포함하지 않는다.

필요하면 여러 배포 단계로 나눠서 진행한다.

---

## 3. 위험한 Migration 패턴

다음 변경은 rollback 위험이 높으므로 운영 배포 전에 반드시 별도 검토한다.

| 패턴 | 위험 |
| --- | --- |
| `DROP TABLE` | 이전 jar가 해당 테이블을 사용하면 즉시 실패 |
| `DROP COLUMN` | 이전 jar가 해당 컬럼을 조회/저장하면 실패 |
| `RENAME TABLE` | 이전 jar의 테이블 참조와 불일치 |
| `RENAME COLUMN` | 이전 jar의 컬럼 참조와 불일치 |
| 컬럼 타입 변경 | 기존 데이터 변환 실패 또는 애플리케이션 타입 불일치 |
| `NOT NULL` 컬럼 즉시 추가 | 기존 insert 로직이 값을 넣지 않으면 실패 |
| 기본값 없는 필수 컬럼 추가 | 기존 데이터와 기존 코드 모두 실패 가능 |
| enum/check 제약 강화 | 기존 데이터 또는 기존 코드 값이 거부될 수 있음 |
| 대량 데이터 삭제 | rollback 시 데이터 복구가 어려움 |

위 변경이 꼭 필요하면 단일 migration으로 처리하지 않고 expand/contract 방식으로 나눈다.

---

## 4. 안전한 Migration 패턴

다음 변경은 상대적으로 rollback 안정성이 높다.

| 패턴 | 설명 |
| --- | --- |
| nullable 컬럼 추가 | 기존 insert 로직에 영향이 적음 |
| 기본값 있는 컬럼 추가 | 기존 데이터와 insert 흐름을 보호 |
| 새 테이블 추가 | 기존 코드와 충돌 가능성이 낮음 |
| 새 인덱스 추가 | schema 호환성 영향이 적음 |
| 기존 컬럼 유지 후 새 컬럼 추가 | 이전 jar와 새 jar가 일정 기간 공존 가능 |
| 데이터 보존형 migration | 기존 데이터 손실 없이 진행 |

안전한 migration이라도 데이터 양, lock 시간, 인덱스 생성 비용은 별도로 확인한다.

---

## 5. Expand/Contract 방식

파괴적 변경이 필요할 때는 다음 단계로 나눠 진행한다.

### 5.1 Expand 단계

기존 기능을 깨지 않으면서 새 schema를 추가한다.

예:

- 새 컬럼 추가
- 새 테이블 추가
- 새 인덱스 추가
- 기존 컬럼과 새 컬럼을 함께 유지
- 새 코드가 양쪽 schema를 모두 처리

이 단계에서는 rollback하더라도 이전 jar가 기존 schema를 계속 사용할 수 있어야 한다.

### 5.2 전환 단계

애플리케이션 코드가 새 schema를 사용하도록 전환한다.

예:

- 새 컬럼에 쓰기 시작
- 기존 데이터 backfill
- 읽기 경로를 새 컬럼 기준으로 변경
- 기존 컬럼은 즉시 삭제하지 않음

### 5.3 Contract 단계

충분히 안정화되고 rollback 가능성이 낮아진 뒤 기존 schema를 제거한다.

예:

- 더 이상 사용하지 않는 컬럼 삭제
- 더 이상 사용하지 않는 테이블 삭제
- 임시 호환 코드 제거

Contract 단계는 별도 이슈와 별도 배포로 진행한다.

---

## 6. Rollback 정책

### 6.1 기본 rollback 범위

장애 발생 시 기본 rollback은 backend jar만 대상으로 한다.

```text
pingo-backend.jar -> pingo-backend.previous.jar
```

Flyway가 이미 적용한 DB migration은 자동으로 되돌리지 않는다.

### 6.2 DB migration 이후 장애 발생 시 대응

DB migration 이후 장애가 발생하면 다음 순서로 판단한다.

1. 이전 jar로 rollback해도 새 schema와 호환되는지 확인한다.
2. 호환된다면 jar rollback을 수행한다.
3. 호환되지 않는다면 DB rollback을 시도하지 않고 forward fix를 우선 검토한다.
4. 데이터 손실 위험이 있는 경우 PM과 담당 백엔드가 함께 수동 대응 여부를 결정한다.

### 6.3 DB rollback 금지 기준

다음 상황에서는 DB rollback을 자동으로 수행하지 않는다.

- 운영 데이터가 이미 새 schema 기준으로 저장된 경우
- migration이 데이터 삭제를 포함한 경우
- migration이 컬럼 타입 변환을 포함한 경우
- rollback SQL이 검증되지 않은 경우
- 이전 jar와 현재 DB 상태의 호환성이 불명확한 경우

---

## 7. Flyway 파일 관리 규칙

### 7.1 이미 merge된 migration 파일 수정 금지

`develop`에 merge된 Flyway migration 파일은 수정하지 않는다.

이미 적용된 migration 파일을 수정하면 Flyway checksum mismatch가 발생할 수 있다.

수정이 필요한 경우 기존 파일을 고치지 않고 새 migration 파일을 추가한다.

### 7.2 version 충돌 방지

새 migration 파일은 version 번호가 겹치지 않게 생성한다.

예:

```text
V1__init_schema.sql
V2__add_station_floor_tables.sql
V3__add_consultation_tables.sql
```

같은 브랜치에서 여러 명이 migration을 추가하면 merge 전에 version 충돌을 확인한다.

### 7.3 파일명은 변경 의도를 드러낸다

좋은 예:

```text
V4__add_location_share_expired_at.sql
V5__add_route_edge_accessibility.sql
```

나쁜 예:

```text
V4__update.sql
V5__fix.sql
```

---

## 8. Migration 포함 MR 체크리스트

Flyway migration 파일이 포함된 MR은 다음 항목을 확인한다.

- [ ] 이전 jar와 새 schema가 호환되는가?
- [ ] `DROP TABLE`, `DROP COLUMN`, `RENAME`이 포함되지 않았는가?
- [ ] `NOT NULL` 컬럼 추가 시 기본값 또는 backfill 전략이 있는가?
- [ ] 기존 데이터가 손실되지 않는가?
- [ ] 기존 insert/update 로직이 실패하지 않는가?
- [ ] migration 파일 version이 기존 파일과 충돌하지 않는가?
- [ ] 이미 merge된 migration 파일을 수정하지 않았는가?
- [ ] local 또는 CI DB에서 Flyway migration이 성공했는가?
- [ ] rollback 시 jar만 되돌려도 서비스가 유지되는가?
- [ ] 위험 변경이 있다면 expand/contract 단계로 나눴는가?

---

## 9. Jenkins CD에서의 처리 기준

Jenkins CD는 backend jar 배포와 service restart를 담당한다.

Jenkins CD는 Flyway migration을 별도로 rollback하지 않는다. Spring Boot 기동 시 Flyway가 자동으로 migration을 적용하며, health check 실패 시 Jenkins build는 실패 처리된다.

권장 운영 기준:

- migration 파일이 포함된 MR은 reviewer가 rollback 호환성을 확인한다.
- migration 파일 변경이 있는 배포는 Jenkins 로그와 backend application log를 확인한다.
- migration 적용 후 장애가 발생하면 DB rollback이 아니라 forward fix를 우선 검토한다.
- 파괴적 migration은 자동 배포 전에 팀 합의를 거친다.

---

## 10. 장애 시 확인 항목

Flyway 관련 장애가 발생하면 다음을 확인한다.

### 10.1 backend 로그

```bash
tail -n 120 /opt/pingo/backend/logs/application.log
tail -n 120 /opt/pingo/backend/logs/error.log
```

### 10.2 systemd 로그

```bash
sudo journalctl -u pingo-backend -n 120 --no-pager
```

### 10.3 Flyway schema history

MySQL에 접속해 Flyway 적용 이력을 확인한다.

```sql
SELECT installed_rank, version, description, type, script, checksum, installed_on, success
FROM flyway_schema_history
ORDER BY installed_rank;
```

### 10.4 checksum mismatch 발생 시

checksum mismatch가 발생하면 먼저 다음을 확인한다.

- 이미 적용된 migration 파일을 수정했는가?
- DB에 적용된 migration과 Git의 migration 파일이 다른가?
- local DB만 꼬인 문제인가, 운영 DB 문제인가?

운영 DB에서 임의로 `flyway repair`를 실행하지 않는다. 필요하면 담당 백엔드와 PM이 영향 범위를 확인한 뒤 진행한다.

---

## 11. 예시

### 11.1 안전한 컬럼 추가

```sql
ALTER TABLE users ADD COLUMN preferred_language VARCHAR(10) NULL;
```

이전 jar는 새 컬럼을 몰라도 기존 기능을 계속 수행할 수 있다.

### 11.2 위험한 컬럼 삭제

```sql
ALTER TABLE users DROP COLUMN language;
```

이전 jar가 `language` 컬럼을 사용하면 rollback 후 즉시 실패할 수 있다.

### 11.3 안전한 단계적 변경

1차 migration:

```sql
ALTER TABLE users ADD COLUMN preferred_language VARCHAR(10) NULL;
```

1차 코드 배포:

```text
기존 language 컬럼과 새 preferred_language 컬럼을 함께 처리
```

2차 migration:

```text
데이터 backfill 수행
```

3차 migration:

```sql
ALTER TABLE users DROP COLUMN language;
```

3차 migration은 충분히 안정화된 뒤 별도 이슈로 진행한다.

---

## 12. 현재 결정

- PinGo Jenkins CD는 DB migration 자동 rollback을 수행하지 않는다.
- Backend rollback은 jar rollback까지만 기본 지원한다.
- Flyway migration은 backward-compatible하게 작성한다.
- 파괴적 schema 변경은 expand/contract 방식으로 나눈다.
- migration 포함 MR은 본 문서의 체크리스트를 통과해야 한다.
