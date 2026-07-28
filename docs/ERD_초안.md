# 외국인 관광객 대상 지하철 실내 내비게이션 ERD 초안

## 1. 문서 목적

본 문서는 외국인 관광객 대상 지하철 실내 내비게이션 서비스의 데이터 구조 초안을 정의한다.

MVP는 1개 역을 대상으로 하지만, 추후 여러 역으로 확장할 수 있도록 역, 층, 지도, 시설, 경로, 주변 장소, 상담, VPS 데이터를 분리해서 설계한다.

본 문서는 관련 설계와 개발의 기준으로 사용한다.

- API 명세서
- 백엔드 DB 설계
- 관리자 기능 설계
- 경로 탐색 로직 설계
- WebRTC 상담 세션 설계
- VPS 데이터 관리 설계

---

## 2. 설계 전제

### 2.1 서비스 전제

- 일반 사용자는 로그인하지 않는다.
- 상담자와 관리자는 로그인한다.
- DBMS는 MySQL을 기준으로 한다.
- MVP 대상 역은 1개지만, 데이터 구조는 여러 역을 지원할 수 있어야 한다.
- 실내 지도는 층별로 관리한다.
- 실내 지도는 이미지 지도 + 좌표 오버레이 방식으로 표시한다.
- 경로 탐색은 노드와 간선 기반으로 관리하며 백엔드 Dijkstra 알고리즘을 우선 사용한다.
- 역 주변 장소는 추천 출구와 연결한다.
- VPS 위치 인식 결과와 수동 위치 선택 결과는 모두 실내 위치로 처리한다.
- 상담 세션은 익명 사용자 세션과 상담자 계정을 연결한다.

### 2.2 주요 데이터 영역

| 영역 | 설명 |
| --- | --- |
| 역/지도 데이터 | 역, 층, 지도 이미지 |
| 시설 데이터 | 출구, 개찰구, 승강장, 엘리베이터 등 |
| 경로 데이터 | 노드, 간선, 접근성 속성 |
| 주변 장소 데이터 | 역 주변 관광지, 호텔, 음식점 등 |
| 사용자 세션 | 비로그인 사용자의 임시 이용 상태 |
| 상담 데이터 | 상담 요청, WebRTC 상담 세션, 상담 이벤트 |
| 계정 데이터 | 상담자, 관리자 |
| VPS 데이터 | VPS 맵, 기준 이미지, 위치 인식 로그 |
| 다국어 데이터 | 화면 문구, 시설명, 장소명 번역 |

---

## 3. 전체 ERD 개요

```mermaid
erDiagram
    STATION ||--o{ STATION_FLOOR : has
    STATION_FLOOR ||--o{ FLOOR_MAP : has
    STATION ||--o{ FACILITY : has
    STATION_FLOOR ||--o{ FACILITY : contains
    FACILITY ||--o| EXIT_DETAIL : may_be

    STATION ||--o{ ROUTE_NODE : has
    STATION_FLOOR ||--o{ ROUTE_NODE : contains
    ROUTE_NODE ||--o{ ROUTE_EDGE : from
    ROUTE_NODE ||--o{ ROUTE_EDGE : to

    STATION ||--o{ NEARBY_PLACE : has
    NEARBY_PLACE ||--o{ PLACE_EXIT_RECOMMENDATION : recommends
    FACILITY ||--o{ PLACE_EXIT_RECOMMENDATION : exit

    USER_SESSION ||--o{ CONSULTATION_SESSION : requests
    ACCOUNT ||--o{ CONSULTATION_SESSION : handles
    STATION ||--o{ CONSULTATION_SESSION : occurs_at
    CONSULTATION_SESSION ||--o{ CONSULTATION_EVENT : has

    USER_SESSION ||--o{ LOCATION_SHARE : creates
    ROUTE_NODE ||--o{ LOCATION_SHARE : points_to

    STATION ||--o{ VPS_MAP : has
    VPS_MAP ||--o{ VPS_REFERENCE_IMAGE : has
    USER_SESSION ||--o{ LOCALIZATION_LOG : creates
    STATION ||--o{ LOCALIZATION_LOG : occurs_at
    ROUTE_NODE ||--o{ LOCALIZATION_LOG : matched_to

    ACCOUNT ||--o{ ADMIN_AUDIT_LOG : creates
```

---

## 4. 엔티티 목록

| 구분 | 테이블 | 설명 | MVP 필요 여부 |
| --- | --- | --- | --- |
| 역/지도 | station | 지하철역 기본 정보 | 필수 |
| 역/지도 | station_floor | 역의 층 정보 | 필수 |
| 역/지도 | floor_map | 층별 지도 이미지 | 필수 |
| 시설 | facility | 출구, 승강장, 화장실 등 시설 | 필수 |
| 시설 | exit_detail | 출구 상세 정보 | 필수 |
| 경로 | route_node | 경로 탐색 노드 | 필수 |
| 경로 | route_edge | 노드 간 연결 간선 | 필수 |
| 주변 장소 | nearby_place | 역 주변 장소 | 필수 |
| 주변 장소 | place_exit_recommendation | 장소와 추천 출구 연결 | 필수 |
| 사용자 | user_session | 비로그인 사용자 임시 세션 | 필수 |
| 상담 | consultation_session | 상담 요청 및 세션 | 필수 |
| 상담 | consultation_event | 상담 중 발생 이벤트 | 중요 |
| 계정 | account | 상담자·관리자 통합 계정 (account_type으로 구분) | 필수 |
| VPS | vps_map | VPS 맵 버전 | 필수 |
| VPS | vps_reference_image | VPS 기준 이미지 | 중요 |
| VPS | localization_log | 위치 인식 시도 로그 | 중요 |
| 위치 공유 | location_share | 사용자 위치 공유 | 필수 |
| 다국어 | translation | 다국어 문구 | 중요 |
| 운영 | admin_audit_log | 관리자 수정 이력 | 권장 |

---

## 5. 테이블 상세

## 5.1 역/지도 데이터

### station

지하철역 기본 정보를 저장한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| station_id | bigint | 역 ID | PK |
| name_ko | varchar | 역 이름 한국어 | not null |
| name_en | varchar | 역 이름 영어 | not null |
| line_info | varchar | 노선 정보 | nullable |
| latitude | decimal | 역 대표 위도 | nullable |
| longitude | decimal | 역 대표 경도 | nullable |
| is_active | boolean | 사용 여부 | default true |
| created_at | datetime | 생성 시각 | not null |
| updated_at | datetime | 수정 시각 | not null |

#### 예시

| station_id | name_ko | name_en | line_info |
| --- | --- | --- | --- |
| 1 | 강남역 | Gangnam Station | 2호선, 신분당선 |

---

### station_floor

역의 층 정보를 저장한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| floor_id | bigint | 층 ID | PK |
| station_id | bigint | 역 ID | FK station.station_id |
| floor_code | varchar | 층 코드 | 예: B1, B2 |
| floor_name | varchar | 층 표시명 | nullable |
| floor_order | int | 층 정렬 순서 | not null |
| created_at | datetime | 생성 시각 | not null |
| updated_at | datetime | 수정 시각 | not null |

---

### floor_map

층별 지도 이미지 또는 지도 리소스를 저장한다.

MVP에서는 지도 파일을 서버 정적 파일로 저장하고, DB에는 접근 가능한 URL을 저장한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| map_id | bigint | 지도 ID | PK |
| floor_id | bigint | 층 ID | FK station_floor.floor_id |
| map_type | varchar | 지도 유형 | image, svg 등 |
| map_url | varchar | 지도 파일 URL | not null |
| width | int | 원본 지도 너비 | nullable |
| height | int | 원본 지도 높이 | nullable |
| scale_m_per_px | decimal | 픽셀당 실제 거리 | nullable |
| version | varchar | 지도 버전 | nullable |
| is_active | boolean | 사용 여부 | default true |
| created_at | datetime | 생성 시각 | not null |
| updated_at | datetime | 수정 시각 | not null |

---

## 5.2 시설 데이터

### facility

역 내부 시설을 저장한다. 출구도 facility의 한 유형으로 관리한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| facility_id | bigint | 시설 ID | PK |
| station_id | bigint | 역 ID | FK station.station_id |
| floor_id | bigint | 층 ID | FK station_floor.floor_id |
| facility_type | varchar | 시설 유형 | exit, gate, platform, elevator 등 |
| name_ko | varchar | 시설명 한국어 | not null |
| name_en | varchar | 시설명 영어 | nullable |
| map_x | decimal | 지도 X 좌표 | not null |
| map_y | decimal | 지도 Y 좌표 | not null |
| linked_node_id | bigint | 연결 경로 노드 | FK route_node.node_id, nullable |
| is_accessible | boolean | 접근성 이용 가능 여부 | default false |
| is_active | boolean | 사용 여부 | default true |
| created_at | datetime | 생성 시각 | not null |
| updated_at | datetime | 수정 시각 | not null |

#### facility_type 예시

| 값 | 설명 |
| --- | --- |
| exit | 출구 |
| gate | 개찰구 |
| platform | 승강장 |
| transfer_passage | 환승 통로 |
| stair | 계단 |
| escalator | 에스컬레이터 |
| elevator | 엘리베이터 |
| restroom | 화장실 |
| station_office | 역무실 |
| ticket_machine | 발매기 |
| card_charger | 교통카드 충전기 |
| locker | 물품보관함 |

---

### exit_detail

출구 시설에 대한 추가 정보를 저장한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| exit_id | bigint | 출구 상세 ID | PK |
| facility_id | bigint | 시설 ID | FK facility.facility_id |
| exit_number | varchar | 출구 번호 | 예: 1, 2, 3 |
| outside_latitude | decimal | 출구 외부 위도 | nullable |
| outside_longitude | decimal | 출구 외부 경도 | nullable |
| description_ko | text | 출구 설명 한국어 | nullable |
| description_en | text | 출구 설명 영어 | nullable |

#### 설계 이유

외부 지도 앱 연계 시 출구 위치가 필요할 수 있으므로, 출구 외부 좌표를 별도로 관리한다.

---

## 5.3 경로 데이터

### route_node

실내 경로 탐색에 사용하는 노드이다.

지도 좌표는 이미지 좌상단을 `(0, 0)`으로 하는 `map_x`, `map_y` 값을 사용한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| node_id | bigint | 노드 ID | PK |
| station_id | bigint | 역 ID | FK station.station_id |
| floor_id | bigint | 층 ID | FK station_floor.floor_id |
| node_type | varchar | 노드 유형 | normal, junction, facility 등 |
| name | varchar | 노드 이름 | nullable |
| map_x | decimal | 지도 X 좌표 | not null |
| map_y | decimal | 지도 Y 좌표 | not null |
| is_landmark | boolean | 랜드마크 후보 여부 | default false |
| created_at | datetime | 생성 시각 | not null |
| updated_at | datetime | 수정 시각 | not null |

#### node_type 예시

| 값 | 설명 |
| --- | --- |
| normal | 일반 이동 노드 |
| junction | 갈림길 |
| facility | 시설 연결 노드 |
| floor_transition | 층 이동 노드 |
| exit | 출구 연결 노드 |

---

### route_edge

노드 간 이동 가능한 연결 정보를 저장한다.

실제 경로 탐색에서는 좌표 간 직선거리보다 `distance_m` 값을 우선 사용한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| edge_id | bigint | 간선 ID | PK |
| station_id | bigint | 역 ID | FK station.station_id |
| from_node_id | bigint | 시작 노드 | FK route_node.node_id |
| to_node_id | bigint | 도착 노드 | FK route_node.node_id |
| distance_m | decimal | 이동 거리 m | not null |
| estimated_time_sec | int | 예상 이동 시간 | nullable |
| move_type | varchar | 이동 유형 | walkway, stair, elevator 등 |
| is_accessible | boolean | 휠체어/유모차 가능 여부 | default false |
| is_bidirectional | boolean | 양방향 여부 | default true |
| is_active | boolean | 사용 여부 | default true |
| created_at | datetime | 생성 시각 | not null |
| updated_at | datetime | 수정 시각 | not null |

#### move_type 예시

| 값 | 설명 |
| --- | --- |
| walkway | 평지 통로 |
| stair | 계단 |
| escalator | 에스컬레이터 |
| elevator | 엘리베이터 |
| gate | 개찰구 통과 |

---

## 5.4 주변 장소 및 출구 추천 데이터

### nearby_place

역 주변 장소 정보를 저장한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| place_id | bigint | 장소 ID | PK |
| station_id | bigint | 역 ID | FK station.station_id |
| name_ko | varchar | 장소명 한국어 | not null |
| name_en | varchar | 장소명 영어 | nullable |
| category | varchar | 장소 카테고리 | hotel, tourist_spot 등 |
| address | varchar | 주소 | nullable |
| latitude | decimal | 장소 위도 | nullable |
| longitude | decimal | 장소 경도 | nullable |
| external_map_url | varchar | 외부 지도 URL | nullable |
| is_active | boolean | 사용 여부 | default true |
| created_at | datetime | 생성 시각 | not null |
| updated_at | datetime | 수정 시각 | not null |

#### category 예시

| 값 | 설명 |
| --- | --- |
| tourist_spot | 관광지 |
| hotel | 호텔 |
| restaurant | 음식점 |
| shopping | 쇼핑몰 |
| bus_stop | 버스 정류장 |
| landmark | 랜드마크 |

---

### place_exit_recommendation

주변 장소와 추천 출구의 연결 정보를 저장한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| recommendation_id | bigint | 추천 ID | PK |
| place_id | bigint | 장소 ID | FK nearby_place.place_id |
| exit_facility_id | bigint | 추천 출구 시설 ID | FK facility.facility_id |
| priority | int | 추천 우선순위 | default 1 |
| reason_ko | varchar | 추천 이유 한국어 | nullable |
| reason_en | varchar | 추천 이유 영어 | nullable |
| walking_time_min | int | 출구 밖 예상 도보 시간 | nullable |
| is_primary | boolean | 대표 추천 여부 | default false |
| created_at | datetime | 생성 시각 | not null |
| updated_at | datetime | 수정 시각 | not null |

---

## 5.5 사용자 세션 데이터

### user_session

비로그인 사용자의 임시 세션 정보를 저장한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| user_session_id | varchar | 익명 세션 ID | PK |
| language | varchar | 선택 언어 | ko, en |
| selected_station_id | bigint | 선택 역 | FK station.station_id, nullable |
| current_node_id | bigint | 현재 위치 노드 | FK route_node.node_id, nullable |
| destination_type | varchar | 목적지 유형 | facility, place, shared_location |
| destination_id | bigint | 목적지 ID | nullable |
| last_gps_latitude | decimal | 마지막 GPS 위도 | nullable |
| last_gps_longitude | decimal | 마지막 GPS 경도 | nullable |
| created_at | datetime | 생성 시각 | not null |
| last_active_at | datetime | 마지막 활동 시각 | not null |
| expires_at | datetime | 세션 만료 시각 | 마지막 활동 기준 1시간, nullable |

#### 설계 이유

일반 사용자는 로그인하지 않지만 상담, 위치 인식, 경로 안내 흐름을 이어가기 위해 임시 세션이 필요하다.

#### 만료 정책

| 구분 | 정책 |
| --- | --- |
| 일반 만료 | `last_active_at` 기준 1시간이 지나면 만료한다 |
| 정상 종료 | 경로 안내가 정상적으로 끝나면 `DELETE /user-sessions/{userSessionId}`로 즉시 만료 처리한다 |
| 만료 예외 | 진행 중인 상담(`WAITING`, `ACCEPTED`, `CONNECTING`, `IN_PROGRESS`)이 연결된 세션은 만료시키지 않는다 |
| 만료 처리 방식 | 행을 삭제하지 않고 `expires_at`을 현재 시각으로 설정한다 |

만료를 행 삭제가 아니라 상태 처리로 정의한 이유는 `consultation_session.user_session_id`, `location_share.owner_session_id`, `localization_log.user_session_id`가 모두 `user_session`을 참조하는 not null 외래키이기 때문이다. 만료된 세션을 삭제하면 상담·위치 인식 이력이 함께 사라지거나 외래키 제약을 위반한다.

만료·종료된 세션 ID로 요청이 오면 `USER_SESSION_NOT_FOUND`를 반환하고, 클라이언트는 새 세션을 생성한 뒤 `language`를 다시 전송해 흐름을 이어간다. 이는 FR-U-001의 "선택한 언어가 이용 중 유지되어야 한다"는 완료 기준을 만족시키기 위한 것이다.

---

## 5.6 계정 및 상담 데이터

### account

상담자(counselor)와 관리자(admin) 계정을 하나의 테이블로 통합해서 저장한다. `account_type`으로 역할을 구분한다.

> 2026-07 통합 로그인(FR-C-001/FR-A-001) 구현 과정에서 기존에 분리했던 counselor/admin 테이블을 하나의 account 테이블로 병합했다. 로그인 ID 하나로 역할과 무관하게 계정을 조회해야 통합 로그인 엔드포인트를 단순하게 유지할 수 있기 때문이다. (Flyway `V3__merge_counselor_admin_into_account.sql`)

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| account_id | bigint | 계정 ID | PK |
| account_type | varchar | 계정 유형 | COUNSELOR, ADMIN |
| station_id | bigint | 담당 역 ID (상담자만 사용) | FK station.station_id, nullable |
| login_id | varchar | 로그인 ID | unique, not null |
| password_hash | varchar | 비밀번호 해시 | not null |
| name | varchar | 계정 이름 | not null |
| status | varchar | 상담 상태 (상담자만 사용) | AVAILABLE, BUSY, OFFLINE, nullable |
| is_active | boolean | 계정 활성 여부 | default true |
| created_at | datetime | 생성 시각 | not null |
| updated_at | datetime | 수정 시각 | not null |

#### account_type 예시

| 값 | 설명 |
| --- | --- |
| COUNSELOR | 상담자(역무원) 계정. station_id, status 사용 |
| ADMIN | 관리자 계정. station_id, status는 사용하지 않음(NULL) |

#### 설계 이유

기존에는 counselor, admin을 완전히 분리된 테이블로 설계했으나, 통합 로그인 API가 로그인 ID 하나로 역할과 무관하게 계정을 조회해야 해서 단일 테이블 + account_type 구분 방식으로 변경했다. 관리자 전용 필드가 늘어나면 추후 account를 부모 테이블로 두고 하위 프로필 테이블로 다시 분리하는 것도 검토할 수 있다.

---

### consultation_session

사용자의 상담 요청과 상담 상태를 저장한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| consultation_id | varchar | 상담 세션 ID | PK |
| user_session_id | varchar | 사용자 세션 ID | FK user_session.user_session_id |
| station_id | bigint | 상담 대상 역 | FK station.station_id |
| counselor_id | bigint | 상담자 ID | FK account.account_id (account_type=COUNSELOR), nullable |
| problem_type | varchar | 문제 유형 | not null |
| status | varchar | 상담 상태 | WAITING, ACCEPTED, ENDED 등 |
| current_node_id | bigint | 요청 시 현재 위치 | FK route_node.node_id, nullable |
| destination_type | varchar | 목적지 유형 | nullable |
| destination_id | bigint | 목적지 ID | nullable |
| video_consent | boolean | 영상 공유 동의 | default false |
| audio_consent | boolean | 음성 공유 동의 | default false |
| requested_at | datetime | 요청 시각 | not null |
| accepted_at | datetime | 수락 시각 | nullable |
| ended_at | datetime | 종료 시각 | nullable |

> 컬럼명은 마이그레이션 호환을 위해 `counselor_id`를 그대로 유지하지만, FK 대상은 `counselor` 테이블이 아닌 `account` 테이블이다 (`account_type = COUNSELOR`인 행만 참조).

#### problem_type 예시

| 값 | 설명 |
| --- | --- |
| CANNOT_FIND_LOCATION | 현재 위치를 찾을 수 없음 |
| WRONG_DIRECTION | 이동 방향을 모르겠음 |
| CANNOT_FIND_EXIT | 출구를 찾을 수 없음 |
| GATE_PROBLEM | 개찰구 문제 |
| ELEVATOR_NEEDED | 엘리베이터 위치 필요 |
| CARD_PROBLEM | 교통카드 문제 |
| OTHER | 기타 |

#### status 예시

| 값 | 설명 |
| --- | --- |
| WAITING | 상담 대기 |
| ACCEPTED | 상담 수락 |
| IN_PROGRESS | 상담 중 |
| ENDED | 상담 종료 |
| CANCELED | 사용자 취소 |
| REJECTED | 상담자 거절 |
| FAILED | 연결 실패 |

---

### consultation_event

상담 중 발생한 이벤트를 저장한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| event_id | bigint | 이벤트 ID | PK |
| consultation_id | varchar | 상담 세션 ID | FK consultation_session.consultation_id |
| sender_type | varchar | sender | user, counselor, system |
| event_type | varchar | 이벤트 유형 | message, arrow, set_destination 등 |
| payload_json | json | 이벤트 상세 데이터 | nullable |
| created_at | datetime | 생성 시각 | not null |

#### event_type 예시

| 값 | 설명 |
| --- | --- |
| message | 안내 메시지 |
| arrow | 화면 화살표 표시 |
| set_destination | 목적지 지정 |
| update_location | 현재 위치 수정 |
| call_started | 상담 연결 시작 |
| call_ended | 상담 종료 |

---

## 5.7 운영 데이터

### admin_audit_log

관리자 데이터 수정 이력을 저장한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| audit_log_id | bigint | 로그 ID | PK |
| admin_id | bigint | 관리자 ID | FK account.account_id (account_type=ADMIN), not null |
| action_type | varchar | 작업 유형 | create, update, delete |
| target_table | varchar | 대상 테이블 | not null |
| target_id | varchar | 대상 데이터 ID | not null |
| before_json | json | 변경 전 데이터 | nullable |
| after_json | json | 변경 후 데이터 | nullable |
| created_at | datetime | 생성 시각 | not null |

> 컬럼명은 마이그레이션 호환을 위해 `admin_id`를 그대로 유지하지만, FK 대상은 `admin` 테이블이 아닌 `account` 테이블이다 (`account_type = ADMIN`인 행만 참조).

---

## 5.8 VPS 및 위치 인식 데이터

### vps_map

대상 역의 VPS 맵 버전 정보를 저장한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| vps_map_id | bigint | VPS 맵 ID | PK |
| station_id | bigint | 역 ID | FK station.station_id |
| provider | varchar | 제공 방식 | colmap, multiset_ai, marker |
| version | varchar | VPS 맵 버전 | not null |
| status | varchar | 상태 | building, active, failed |
| description | text | 설명 | nullable |
| created_at | datetime | 생성 시각 | not null |
| updated_at | datetime | 수정 시각 | not null |

---

### vps_reference_image

VPS 기준 이미지와 촬영 위치를 저장한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| reference_image_id | bigint | 기준 이미지 ID | PK |
| vps_map_id | bigint | VPS 맵 ID | FK vps_map.vps_map_id |
| station_id | bigint | 역 ID | FK station.station_id |
| floor_id | bigint | 층 ID | FK station_floor.floor_id |
| node_id | bigint | 기준 위치 노드 | FK route_node.node_id, nullable |
| image_url | varchar | 이미지 URL | not null |
| capture_direction | decimal | 촬영 방향 | nullable |
| description | text | 설명 | nullable |
| created_at | datetime | 생성 시각 | not null |

---

### localization_log

사용자 위치 인식 시도 결과를 저장한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| localization_log_id | bigint | 로그 ID | PK |
| user_session_id | varchar | 사용자 세션 ID | FK user_session.user_session_id |
| station_id | bigint | 역 ID | FK station.station_id |
| method | varchar | 인식 방식 | vps, marker, manual, landmark |
| result_status | varchar | 결과 | success, low_confidence, failed |
| matched_node_id | bigint | 매칭된 노드 | FK route_node.node_id, nullable |
| confidence_score | decimal | 신뢰도 점수 | nullable |
| confidence_label | varchar | 신뢰도 표시 | high, medium, low |
| error_message | text | 실패 메시지 | nullable |
| created_at | datetime | 생성 시각 | not null |

#### 설계 이유

VPS 성공률, 실패율, 수동 위치 선택 비율을 분석하기 위한 로그이다.

---

## 5.9 위치 공유 데이터

### location_share

사용자 간 위치 공유 정보를 저장한다.

위치 공유는 최종 기능 요구사항 32개에 포함된 필수 기능이다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| share_id | varchar | 공유 ID | PK |
| owner_session_id | varchar | 공유 생성 사용자 | FK user_session.user_session_id |
| station_id | bigint | 역 ID | FK station.station_id |
| shared_node_id | bigint | 공유 위치 노드 | FK route_node.node_id |
| expires_at | datetime | 만료 시각 | not null |
| is_active | boolean | 활성 여부 | default true |
| created_at | datetime | 생성 시각 | not null |

---

## 5.10 다국어 데이터

### translation

화면 문구, 시설명, 장소명 등 다국어 리소스를 저장한다.

MVP에서는 한국어와 영어를 우선 지원한다.

| 컬럼 | 타입 예시 | 설명 | 제약 |
| --- | --- | --- | --- |
| translation_id | bigint | 번역 ID | PK |
| resource_type | varchar | 리소스 유형 | ui, facility, place, message |
| resource_key | varchar | 리소스 키 | not null |
| language_code | varchar | 언어 코드 | ko, en, ja, zh |
| text | text | 번역 문구 | not null |
| created_at | datetime | 생성 시각 | not null |
| updated_at | datetime | 수정 시각 | not null |

#### 설계 참고

MVP에서는 주요 테이블에 `name_ko`, `name_en`을 두고 빠르게 구현할 수 있다. 추후 다국어 확장이 필요하면 `translation` 테이블 중심으로 전환한다.

---

## 6. 핵심 관계 설명

### 6.1 역과 지도

```text
station 1 ─ N station_floor 1 ─ N floor_map
```

- 하나의 역은 여러 층을 가진다.
- 하나의 층은 하나 이상의 지도 버전을 가질 수 있다.

### 6.2 역과 시설

```text
station 1 ─ N facility
station_floor 1 ─ N facility
facility 1 ─ 0..1 exit_detail
```

- 모든 시설은 특정 역과 층에 속한다.
- 출구는 facility의 한 종류이며, 출구 상세 정보가 필요할 경우 exit_detail을 가진다.

### 6.3 경로 그래프

```text
route_node 1 ─ N route_edge
route_edge N ─ 1 route_node
```

- 경로 탐색은 노드와 간선 기반으로 수행한다.
- 간선에는 거리, 이동 수단, 접근성 여부가 저장된다.
- 빠른 경로, 계단 없는 경로, 엘리베이터 중심 경로는 `move_type`, `distance_m`, `estimated_time_sec` 값을 활용한다.
- 계단 없는 경로는 `move_type = stair` 간선을 제외한다.
- 엘리베이터 중심 경로는 `move_type = stair`, `move_type = escalator` 간선을 제외한다.

### 6.4 주변 장소와 출구 추천

```text
nearby_place 1 ─ N place_exit_recommendation N ─ 1 facility(exit)
```

- 하나의 주변 장소는 여러 출구 후보를 가질 수 있다.
- 대표 출구는 `is_primary` 또는 `priority`로 구분한다.

### 6.5 상담

```text
user_session 1 ─ N consultation_session
account(COUNSELOR) 1 ─ N consultation_session
consultation_session 1 ─ N consultation_event
```

- 비로그인 사용자도 익명 세션을 기준으로 상담 요청을 생성한다.
- 상담자가 요청을 수락하면 상담 세션에 상담자 계정(account, account_type=COUNSELOR)의 ID가 연결된다.
- 상담 중 화살표 표시, 목적지 지정, 메시지 전송은 consultation_event에 기록할 수 있다.

### 6.6 VPS 위치 인식

```text
station 1 ─ N vps_map 1 ─ N vps_reference_image
user_session 1 ─ N localization_log
```

- 역마다 여러 VPS 맵 버전을 가질 수 있다.
- 위치 인식 시도 결과는 localization_log에 저장한다.
- 자체 VPS, 외부 VPS, 수동 선택 결과 모두 동일한 로그 구조로 기록할 수 있다.

---

## 7. MVP 필수 테이블

MVP 구현에 필요한 최소 테이블은 다음과 같다.

| 우선순위 | 테이블 |
| --- | --- |
| 1 | station |
| 1 | station_floor |
| 1 | floor_map |
| 1 | facility |
| 1 | exit_detail |
| 1 | route_node |
| 1 | route_edge |
| 1 | nearby_place |
| 1 | place_exit_recommendation |
| 1 | user_session |
| 1 | account |
| 1 | consultation_session |
| 1 | vps_map |
| 1 | localization_log |
| 2 | consultation_event |
| 2 | vps_reference_image |
| 2 | admin_audit_log |
| 3 | location_share |
| 3 | translation |

---

## 8. MVP 구현 방안

관리자 API는 MVP에서 전체 구현하는 것을 기준으로 한다. 다만 개발 우선순위는 사용자 핵심 흐름을 먼저 완성한 뒤 관리자 기능을 순차적으로 붙이는 방식으로 진행한다.

### 8.1 관리자 기능 구현 범위

- 관리자 API를 통해 역, 층, 지도, 시설, 경로, 주변 장소, 상담자 계정을 등록·수정할 수 있어야 한다.
- 시연 안정성을 위해 초기 데이터는 seed로 미리 준비할 수 있지만, seed는 관리자 API를 대체하지 않는다.
- `account` 테이블(ADMIN 타입)은 MVP에 포함한다.
- `admin_audit_log`는 가능하면 구현하되, 일정이 부족할 경우 최근 수정 시각과 수정자 기록으로 축소할 수 있다.

### 8.2 다국어 간소화

- translation 테이블을 생략하고 주요 테이블에 `name_ko`, `name_en`만 둔다.
- UI 문구는 프론트엔드 언어 리소스로 관리한다.

### 8.3 VPS 데이터 간소화

- vps_reference_image는 파일 관리 문서로 대체하고, DB에는 localization_log만 남긴다.
- 자체 VPS가 불안정할 경우 QR/마커 또는 수동 선택 결과를 localization_log에 기록한다.

### 8.4 상담 이벤트 간소화

- consultation_event를 생략하고 WebRTC DataChannel 이벤트를 실시간 처리만 한다.
- 단, 상담 상태와 시작/종료 시각은 consultation_session에 남긴다.

---

## 9. 주요 인덱스 제안

| 테이블 | 인덱스 | 목적 |
| --- | --- | --- |
| station | name_ko, name_en | 역 검색 |
| facility | station_id, floor_id | 역/층별 시설 조회 |
| facility | facility_type | 시설 유형별 조회 |
| route_node | station_id, floor_id | 층별 경로 노드 조회 |
| route_edge | from_node_id, to_node_id | 경로 탐색 |
| nearby_place | station_id, category | 주변 장소 조회 |
| place_exit_recommendation | place_id | 장소별 추천 출구 조회 |
| consultation_session | station_id, status | 상담 요청 목록 조회 |
| consultation_session | user_session_id | 사용자 상담 조회 |
| localization_log | station_id, created_at | VPS 통계 |
| account | account_type, station_id, status | 상담 가능자 조회(역할·역별) |

---

## 10. 데이터 소유권 기준

데이터 소유권은 `PinGo_역할분배_최종기획안_v4.md`를 따른다.

| 데이터 영역 | 최종 책임 |
| --- | --- |
| station, station_floor, floor_map | 신재령 |
| facility, exit_detail, nearby_place, place_exit_recommendation | 신재령 |
| route_node, route_edge | 신재령 |
| user_session | 오서현 |
| consultation_session, consultation_event | 오서현 |
| account (counselor+admin 통합) | 오서현 |
| vps_map, vps_reference_image | 강민수 |
| localization_log | 이정우 |
| location_share | 이정우 |
| translation | 최주연 |

AI 모델·VPS 구축 데이터는 강민수가 책임지고, AI 서버 호출·응답 검증·상태 판정은 이정우가 책임진다. 신재령은 위치 결과를 지도 좌표계와 route_node에 연결하는 앵커링을 책임진다.

---

## 11. 아직 의사결정이 필요한 사항

다음 항목만 추후 확정한다.

1. 실제 시연 대표 동선 확정

## 12. 구현 중 검증할 사항

1. 실제 배포 도메인 확정
2. 추후 일본어·중국어 확장 시 `translation` 테이블 적용 시점 검토

다음 항목은 확정된 기준으로 설계한다.

| 항목 | 확정 기준 |
| --- | --- |
| DBMS | MySQL |
| 지도 좌표계 | 이미지 좌상단 `(0, 0)` 기준 `map_x`, `map_y` |
| 지도 이미지 저장 | 서버 정적 파일 저장 + DB URL 관리 |
| 경로 거리 | `route_edge.distance_m` 우선 |
| 사용자 세션 만료 | 마지막 활동 기준 24시간 |
| 상담 세션 ID | UUID 또는 ULID 기반 문자열 |
| VPS 이미지 저장 | 기본 저장하지 않음, 처리 후 즉시 폐기 |
| Audit log | 후순위 |
| 다국어 | MVP에서는 `name_ko`, `name_en` 컬럼 우선 |
