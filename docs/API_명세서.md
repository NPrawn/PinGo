# 외국인 관광객 대상 지하철 실내 내비게이션 API 명세서

## 1. 문서 목적

본 문서는 외국인 관광객 대상 지하철 실내 내비게이션 서비스의 API 초안을 정의한다.

본 문서는 프론트엔드, 백엔드, VPS, WebRTC, 관리자 기능 개발 시 요청/응답 구조를 맞추기 위한 기준 문서이다.

---

## 2. 공통 규칙

### 2.1 Base URL

```text
개발 환경: http://localhost:{port}/api
배포 환경: https://{domain}/api
```

### 2.2 응답 형식

모든 API는 JSON 형식을 기본으로 한다.

#### 성공 응답

```json
{
  "success": true,
  "data": {},
  "message": null
}
```

#### 실패 응답

```json
{
  "success": false,
  "data": null,
  "message": "오류 메시지",
  "errorCode": "ERROR_CODE"
}
```

### 2.3 공통 HTTP 상태 코드

| 코드 | 의미        |
| ---- | ----------- |
| 200  | 요청 성공   |
| 201  | 생성 성공   |
| 400  | 잘못된 요청 |
| 401  | 인증 필요   |
| 403  | 권한 없음   |
| 404  | 리소스 없음 |
| 409  | 상태 충돌   |
| 500  | 서버 오류   |

### 2.4 인증 정책

| 사용자 유형 | 인증 방식                       |
| ----------- | ------------------------------- |
| 일반 사용자 | 비로그인, `userSessionId` 기반  |
| 상담자      | 로그인 후 JWT Access Token 사용 |
| 관리자      | 로그인 후 JWT Access Token 사용 |

MVP에서는 JWT Access Token을 HTTP Authorization Header로 전달한다.

```http
Authorization: Bearer {accessToken}
```

### 2.5 확정 구현 선택

| 항목               | 확정안                                                              |
| ------------------ | ------------------------------------------------------------------- |
| 프론트엔드         | React + TypeScript + Vite                                           |
| UI 스타일링        | Tailwind CSS                                                        |
| 아이콘             | lucide-react                                                        |
| 백엔드 프레임워크  | Spring Boot 기준                                                    |
| DBMS               | MySQL                                                               |
| ORM/DB 접근        | Spring Data JPA                                                     |
| 인증 방식          | JWT Access Token                                                    |
| JWT 만료 시간      | 6시간                                                               |
| Refresh Token      | MVP에서는 생략                                                      |
| 사용자 세션 만료   | 마지막 활동 기준 1시간                                              |
| 상담 세션 ID       | UUID 또는 ULID 기반 문자열                                          |
| WebRTC signaling   | WebSocket                                                           |
| STUN/TURN          | 무료 STUN 우선, 연결 불안정 시 TURN 추가                            |
| 지도 표현 방식     | 이미지 지도 + 좌표 오버레이                                         |
| 지도 파일 관리     | 서버 정적 파일에 저장하고 DB에는 상대 URL(`/uploads/maps/...`) 저장 |
| 경로 탐색          | 백엔드 Dijkstra                                                     |
| 카메라 이미지 처리 | 위치 인식 처리 후 즉시 폐기 원칙                                    |
| 외부 지도 연계     | 카카오맵 우선                                                       |
| 관리자 API         | MVP에서 전체 구현                                                   |
| 배포 방식          | Nginx reverse proxy + HTTPS                                         |
| HTTPS 인증서       | Let's Encrypt 기준                                                  |
| 다국어 응답        | `nameKo`, `nameEn`을 함께 응답하고 프론트에서 선택                  |

### 2.6 API 책임 기준

API 책임자는 `PinGo_역할분배_최종기획안_v4.md`를 따른다.

| API 영역                                                                         | 최종 책임 |
| -------------------------------------------------------------------------------- | --------- |
| 역·지도·시설·목적지 검색·출구 추천·경로                                          | 신재령    |
| 인증·상담·상담자·관리자 로그인·WebRTC signaling·DataChannel 계약                 | 오서현    |
| VPS 이미지 요청·AI Adapter·위치 인식 상태 판정·외부 지도·위치 공유·배포 네트워크 | 이정우    |
| 카메라·IMU·실시간 방향 보정·화면 표시                                            | 김은지    |
| 교통카드 추천 UX·정적 룰·문구                                                    | 최주연    |

VPS 위치 인식 API에서 이정우는 AI 서버 호출, 응답 검증, timeout, 상태 판정을 책임진다. 신재령은 검증된 위치 결과의 좌표 앵커링과 유효 노드 매핑을 책임진다. 실시간 IMU 기반 방향 보정은 프론트엔드 책임이며 백엔드 API는 지속적인 센서 스트림을 처리하지 않는다.

### 2.7 공통 데이터 타입

#### 좌표

```json
{
  "latitude": 37.4979,
  "longitude": 127.0276
}
```

#### 실내 위치

```json
{
  "stationId": 1,
  "floorId": 2,
  "nodeId": 15,
  "label": "B2 개찰구 앞",
  "mapX": 320.5,
  "mapY": 180.2
}
```

#### 신뢰도

```json
{
  "confidenceScore": 0.87,
  "confidenceLabel": "high"
}
```

`confidenceLabel` 값은 `high`, `medium`, `low` 중 하나를 사용한다.

## 2.8 인증 API (통합 로그인)

상담자와 관리자는 별도 엔드포인트가 아닌 하나의 통합 로그인 API를 공유한다. 응답의 `accountType` 값(`COUNSELOR` | `ADMIN`)으로 프론트엔드가 역할을 구분해 라우팅한다.

### POST `/auth/login`

#### Request

```json
{
  "loginId": "counselor01",
  "password": "password"
}
```

#### Response (상담자)

```json
{
  "success": true,
  "data": {
    "accessToken": "access-token",
    "accountType": "COUNSELOR",
    "accountId": 7,
    "name": "역무원",
    "stationId": 1,
    "status": "AVAILABLE"
  },
  "message": null
}
```

#### Response (관리자)

```json
{
  "success": true,
  "data": {
    "accessToken": "access-token",
    "accountType": "ADMIN",
    "accountId": 1,
    "name": "관리자",
    "stationId": null,
    "status": null
  },
  "message": null
}
```

> 이전 초안에서는 `/counselors/login`, `/admins/login`을 별도로 정의했으나(11.1, 13.1 참고), account 테이블 통합(ERD\_초안.md 5.6 참고)에 맞춰 `POST /auth/login` 하나로 합쳤다. 응답도 `counselor`/`admin` 중첩 객체가 아니라 평평한(flat) 구조이며, 관리자 세부 역할 구분 필드(`role`: admin/super_admin)는 아직 구현되지 않았다 — 필요해지면 추가 논의 필요.

## 2.9 상담자(역무원) 회원가입

### POST `/auth/signup`

상담자만 자가 회원가입이 가능하다. 관리자 계정은 회원가입 API로 생성하지 않는다(13.10 참고). 가입 즉시 로그인 가능한 상태가 아니라 **승인 대기(비활성)** 상태로 생성되며, 관리자 승인 후에만 로그인할 수 있다.

#### Request

```json
{
  "loginId": "counselor02",
  "password": "password123",
  "name": "김상담",
  "stationId": 1
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "accountId": 8,
    "loginId": "counselor02",
    "name": "김상담",
    "stationId": 1
  },
  "message": null
}
```

> 생성된 계정은 `is_active = false` 상태다. 관리자 승인 전 로그인 시도는 `INACTIVE_ACCOUNT`로 거부된다. 이미 사용 중인 `loginId`로 요청하면 `DUPLICATE_LOGIN_ID`(409), 존재하지 않는 `stationId`면 `STATION_NOT_FOUND`(404)로 거부된다.

## 2.10 중복 아이디 체크

### GET `/auth/check-login-id`

회원가입 폼에서 아이디를 입력하는 시점에 실시간으로 중복 여부를 확인하기 위한 API다. 이 API를 호출하지 않고 바로 `/auth/signup`을 호출해도 되며, 최종 중복 검증은 signup API 쪽에서 다시 수행한다(위 참고).

#### Query

| 이름    | 타입   | 필수 | 설명             |
| ------- | ------ | ---- | ---------------- |
| loginId | string | Y    | 확인할 로그인 ID |

#### Response

```json
{
  "success": true,
  "data": true,
  "message": null
}
```

`data`는 사용 가능하면 `true`, 이미 사용 중이면 `false`다.

---

## 3. 사용자 세션 API

## 3.1 사용자 세션 생성

### POST `/user-sessions`

비로그인 사용자의 임시 세션을 생성한다.

#### Request

```json
{
  "language": "en"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "userSessionId": "usr_9f3a2b",
    "language": "en",
    "expiresAt": "2026-07-16T12:00:00Z"
  },
  "message": null
}
```

---

## 3.2 사용자 세션 조회

### GET `/user-sessions/{userSessionId}`

저장해 둔 세션 ID로 현재 세션 상태를 조회한다. 새로고침·앱 재실행 등으로 클라이언트가 들고 있던 상태가 사라졌을 때 복구 용도로 사용한다.

#### Response

```json
{
  "success": true,
  "data": {
    "userSessionId": "usr_9f3a2b",
    "language": "en",
    "selectedStationId": 1,
    "currentNodeId": 15,
    "destinationType": "place",
    "destinationId": 3,
    "expiresAt": "2026-07-16T13:00:00Z"
  },
  "message": null
}
```

응답 필드 구성은 3.3 사용자 세션 갱신과 동일하며, 아직 설정되지 않은 항목은 `null`로 내려간다.

조회는 활동 시각을 갱신하지 않는다. `last_active_at`과 `expires_at`은 `PATCH /user-sessions/{userSessionId}` 호출 시에만 연장되므로, 이 API를 반복 호출해도 세션 만료를 늦출 수 없다.

만료·종료된 세션이거나 존재하지 않는 ID이면 `USER_SESSION_NOT_FOUND`를 반환한다. 클라이언트는 이 응답을 받으면 세션을 새로 생성하고 `language`를 다시 전송해 흐름을 이어간다.

역·목적지의 표시 이름이 필요하면 `GET /stations/{stationId}`(4.3), `GET /facilities/{facilityId}`(5.3)로 별도 조회한다. 세션 응답은 ID만 반환한다.

---

## 3.3 사용자 세션 갱신

### PATCH `/user-sessions/{userSessionId}`

사용자의 선택 언어, 현재 역, 현재 위치, 목적지 등을 갱신한다.

#### 호출 시점

| 갱신 항목 | 호출 시점 |
| --- | --- |
| language | 언어 변경 시 |
| selectedStationId | 역 선택 시 |
| destinationType, destinationId | 목적지 선택 시 |
| currentNodeId | 위치 확정 시 (VPS 인식 확정, 수동 위치 확정, 상담자 위치 수정) |
| lastGpsLatitude, lastGpsLongitude | 경로 안내 화면에서만 전송한다. 직전 전송 위치 대비 10m 이상 이동했고 마지막 전송 후 5초가 지난 경우 전송하며, 위치 변화가 없어도 15초마다 1회 전송한다. |

경로 안내 화면을 벗어나면 GPS 전송을 중단한다.

#### Request

```json
{
  "language": "en",
  "selectedStationId": 1,
  "currentNodeId": 15,
  "destinationType": "place",
  "destinationId": 3,
  "lastGpsLatitude": 37.4979,
  "lastGpsLongitude": 127.0276
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "userSessionId": "usr_9f3a2b",
    "language": "en",
    "selectedStationId": 1,
    "currentNodeId": 15,
    "destinationType": "place",
    "destinationId": 3,
    "expiresAt": "2026-07-16T13:00:00Z"
  },
  "message": null
}
```

부분 갱신 API이므로 요청에 포함된 필드만 반영하고, 응답은 갱신 후 세션의 현재 상태 전체를 반환한다. 아직 설정되지 않은 항목은 `null`로 내려가며 응답 필드 구성은 요청 내용과 무관하게 항상 동일하다.

호출할 때마다 `last_active_at`이 갱신되고 `expires_at`이 연장되므로, 클라이언트는 응답의 `expiresAt`으로 다음 호출 시점을 판단한다. 요청 본문이 비어 있어도(`{}`) 활동 시각 갱신 용도로 사용할 수 있다.

`destinationType`과 `destinationId`는 항상 함께 전달해야 한다. 둘 중 하나만 전달하면 `INVALID_DESTINATION`을 반환한다. 만료·종료된 세션 ID로 요청하면 `USER_SESSION_NOT_FOUND`를 반환한다.

---

## 3.4 사용자 세션 종료

### DELETE `/user-sessions/{userSessionId}`

경로 안내가 정상적으로 끝났을 때 세션을 즉시 종료한다. 앱 종료·네트워크 끊김처럼 종료 요청이 도달하지 않는 경우는 세션 만료 정책(18. 확정된 구현 사항 참고)으로 처리한다.

#### Response

```json
{
  "success": true,
  "data": true,
  "message": "세션이 종료되었습니다."
}
```

이미 종료·만료된 세션이면 `data`가 `false`로 내려간다.

```json
{
  "success": false,
  "data": false,
  "message": "이미 종료된 세션입니다.",
  "errorCode": "USER_SESSION_ALREADY_ENDED"
}
```

세션 종료는 행 삭제가 아니라 `expires_at`을 현재 시각으로 설정하는 만료 처리다. `consultation_session`, `location_share`, `localization_log`가 `user_session`을 FK로 참조하므로 행을 삭제하지 않으며, 상담·위치 인식 이력은 그대로 보존된다.

진행 중인 상담(`WAITING`, `ACCEPTED`, `CONNECTING`, `IN_PROGRESS`)이 연결된 세션은 종료할 수 없으며 `USER_SESSION_IN_CONSULTATION`을 반환한다. 존재하지 않는 세션 ID는 `USER_SESSION_NOT_FOUND`를 반환한다.

종료·만료된 세션 ID로 다시 요청이 오면 클라이언트는 새 세션을 생성하고 `language`를 다시 전송해 흐름을 이어간다.

---

## 4. 역 API

## 4.1 주변 역 조회

### GET `/stations/nearby`

GPS 좌표를 기준으로 주변 역 후보를 조회한다.

#### Query

| 이름      | 타입   | 필수 | 설명      |
| --------- | ------ | ---- | --------- |
| latitude  | number | Y    | 현재 위도 |
| longitude | number | Y    | 현재 경도 |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "stationId": 1,
      "nameKo": "강남역",
      "nameEn": "Gangnam Station",
      "lineInfo": "2호선, 신분당선",
      "distanceM": 120
    }
  ],
  "message": null
}
```

---

## 4.2 역 검색

### GET `/stations/search`

역 이름으로 역을 검색한다.

#### Query

| 이름     | 타입   | 필수 | 설명   |
| -------- | ------ | ---- | ------ |
| keyword  | string | Y    | 검색어 |
| language | string | N    | ko, en |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "stationId": 1,
      "nameKo": "강남역",
      "nameEn": "Gangnam Station",
      "lineInfo": "2호선, 신분당선"
    }
  ],
  "message": null
}
```

---

## 4.3 역 상세 조회

### GET `/stations/{stationId}`

선택한 역의 기본 정보와 층 정보를 조회한다.

#### Response

```json
{
  "success": true,
  "data": {
    "stationId": 1,
    "nameKo": "강남역",
    "nameEn": "Gangnam Station",
    "lineInfo": "2호선, 신분당선",
    "floors": [
      {
        "floorId": 1,
        "floorCode": "B1",
        "floorName": "지하 1층",
        "floorOrder": 1
      }
    ]
  },
  "message": null
}
```

---

## 5. 지도 및 시설 API

## 5.1 층별 지도 조회

### GET `/stations/{stationId}/maps`

역의 층별 지도 정보를 조회한다.

#### Response

```json
{
  "success": true,
  "data": [
    {
      "mapId": 1,
      "floorId": 1,
      "floorCode": "B1",
      "mapType": "image",
      "mapUrl": "/uploads/maps/3f2a1b.png",
      "width": 1200,
      "height": 800,
      "scaleMPerPx": 0.05,
      "version": "v1"
    }
  ],
  "message": null
}
```

---

## 5.2 시설 목록 조회

### GET `/stations/{stationId}/facilities`

역 내부 시설 목록을 조회한다.

#### Query

| 이름         | 타입   | 필수 | 설명           |
| ------------ | ------ | ---- | -------------- |
| floorId      | number | N    | 특정 층 필터   |
| facilityType | string | N    | 시설 유형 필터 |
| language     | string | N    | ko, en         |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "facilityId": 10,
      "stationId": 1,
      "floorId": 1,
      "facilityType": "exit",
      "nameKo": "5번 출구",
      "nameEn": "Exit 5",
      "mapX": 820.4,
      "mapY": 120.7,
      "linkedNodeId": 44,
      "isAccessible": true
    }
  ],
  "message": null
}
```

---

## 5.3 시설 상세 조회

### GET `/facilities/{facilityId}`

시설 상세 정보를 조회한다.

#### Response

```json
{
  "success": true,
  "data": {
    "facilityId": 10,
    "stationId": 1,
    "floorId": 1,
    "facilityType": "exit",
    "nameKo": "5번 출구",
    "nameEn": "Exit 5",
    "mapX": 820.4,
    "mapY": 120.7,
    "linkedNodeId": 44,
    "isAccessible": true,
    "exitDetail": {
      "exitNumber": "5",
      "outsideLatitude": 37.4982,
      "outsideLongitude": 127.0281,
      "descriptionKo": null,
      "descriptionEn": null
    }
  },
  "message": null
}
```

출구가 아닌 시설은 `exitDetail`이 `null`이다.

---

## 6. 목적지 및 주변 장소 API

## 6.1 목적지 통합 검색

### GET `/destinations/search`

역 내부 시설과 역 주변 장소를 이름 키워드로 통합 검색한다. 활성 시설(`facility`)을 먼저, 이어서 활성 주변 장소(`place`)를 반환한다. `category`는 시설이면 `facilityType`, 장소면 장소 카테고리다.

#### Query

| 이름      | 타입   | 필수 | 설명                                    |
| --------- | ------ | ---- | --------------------------------------- |
| stationId | number | Y    | 역 ID                                   |
| keyword   | string | Y    | 검색어 (공백·누락 시 `INVALID_REQUEST`) |
| language  | string | N    | ko, en                                  |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "destinationType": "facility",
      "destinationId": 10,
      "nameKo": "5번 출구",
      "nameEn": "Exit 5",
      "category": "exit"
    },
    {
      "destinationType": "place",
      "destinationId": 3,
      "nameKo": "코엑스몰",
      "nameEn": "COEX Mall",
      "category": "shopping"
    }
  ],
  "message": null
}
```

---

## 6.2 역 주변 장소 목록 조회

### GET `/stations/{stationId}/places`

역 주변 장소 목록을 조회한다.

#### Query

| 이름     | 타입   | 필수 | 설명          |
| -------- | ------ | ---- | ------------- |
| category | string | N    | 장소 카테고리 |
| language | string | N    | ko, en        |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "placeId": 3,
      "nameKo": "코엑스몰",
      "nameEn": "COEX Mall",
      "category": "shopping",
      "address": "서울특별시 강남구 영동대로 513",
      "latitude": 37.5118,
      "longitude": 127.0592
    }
  ],
  "message": null
}
```

---

## 6.3 추천 출구 조회

### GET `/places/{placeId}/recommended-exits`

역 주변 장소와 연결된 추천 출구를 우선순위(`priority` 오름차순)로 조회한다. 관리자가 등록한 장소-출구 추천(`place_exit_recommendation`)을 기준으로 하며, 추천 출구 시설이 비활성/삭제된 경우 결과에서 제외한다. `exitLocation`은 출구 상세(`exit_detail`)의 외부 좌표이며 좌표가 없으면 `null`이다. 장소가 없거나 비활성이면 `PLACE_NOT_FOUND`.

#### Response

```json
{
  "success": true,
  "data": [
    {
      "recommendationId": 1,
      "placeId": 3,
      "exitFacilityId": 10,
      "exitNameKo": "5번 출구",
      "exitNameEn": "Exit 5",
      "priority": 1,
      "isPrimary": true,
      "reasonKo": "목적지와 가장 가까운 출구입니다.",
      "reasonEn": "This is the closest exit to your destination.",
      "walkingTimeMin": 6,
      "exitLocation": {
        "latitude": 37.4982,
        "longitude": 127.0281
      }
    }
  ],
  "message": null
}
```

---

## 7. VPS 및 위치 인식 API

## 7.1 현재 위치 인식

### POST `/vps/localize`

카메라 이미지 또는 프레임을 기반으로 사용자의 실내 위치를 인식한다.

#### Content-Type

```text
multipart/form-data
```

#### Request

| 이름          | 타입   | 필수 | 설명           |
| ------------- | ------ | ---- | -------------- |
| userSessionId | string | Y    | 사용자 세션 ID |
| stationId     | number | Y    | 현재 역 ID     |
| image         | file   | Y    | 카메라 이미지  |
| heading       | number | N    | 단말 방향      |

#### Response

```json
{
  "success": true,
  "data": {
    "resultStatus": "success",
    "candidates": [
      {
        "nodeId": 15,
        "floorId": 2,
        "label": "B2 개찰구 앞",
        "mapX": 320.5,
        "mapY": 180.2,
        "confidenceScore": 0.87,
        "confidenceLabel": "high"
      }
    ]
  },
  "message": null
}
```

#### 실패 또는 낮은 신뢰도 Response

위치 인식 요청 자체는 처리되었지만 현재 위치를 확정할 수 없는 경우에도 HTTP 200과 `success: true`를 반환한다.
프론트엔드는 `resultStatus`와 `fallbackOptions`를 기준으로 실패 화면(U-05) 또는 지도 수동 선택 화면(U-06)으로 분기한다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| resultStatus | string | 위치 인식 처리 결과 |
| candidates | array | 표시 가능한 위치 후보. 후보가 없으면 빈 배열 |
| fallbackOptions | string[] | 사용자에게 제공할 대체 행동 목록 |

##### resultStatus

| 값 | 의미 | 기본 fallbackOptions |
| --- | --- | --- |
| success | 위치 후보를 정상 반환함 | - |
| low_confidence | 후보는 있으나 신뢰도가 낮아 사용자 확인 또는 대체 선택이 필요함 | `retry_capture`, `select_landmark`, `select_on_map`, `request_consultation` |
| no_match | 이미지와 매칭되는 위치 후보를 찾지 못함 | `retry_capture`, `select_landmark`, `select_on_map`, `request_consultation` |
| timeout | AI 서버 또는 위치 인식 처리가 제한 시간 내 완료되지 않음 | `retry_capture`, `select_on_map`, `request_consultation` |
| ai_server_unavailable | AI 서버 호출이 불가능함 | `select_on_map`, `request_consultation` |
| overloaded | 위치 인식 요청이 몰려 현재 처리할 수 없음 | `retry_capture`, `select_on_map`, `request_consultation` |
| invalid_image | 이미지가 비어 있거나 분석 가능한 품질이 아님 | `retry_capture`, `select_on_map` |
| invalid_intrinsics | 카메라 초점거리 등 위치 추정에 필요한 메타데이터가 올바르지 않음 | `retry_capture`, `select_on_map` |
| map_not_ready | 해당 역 또는 층의 VPS 맵이 준비되지 않음 | `select_on_map`, `request_consultation` |
| internal_error | 서버 내부 오류로 위치 인식에 실패함 | `retry_capture`, `select_on_map`, `request_consultation` |

##### AI 위치 인식 상태 매핑

AI 서버는 내부 API에서 대문자 `status`와 `failureReason`을 반환한다. 백엔드는 이를 프론트엔드용 `resultStatus`로 정규화해 응답한다.

| AI status / failureReason | 백엔드 resultStatus | 설명 |
| --- | --- | --- |
| `LOCALIZED` | `success` | 위치 인식 성공 |
| `INVALID_IMAGE` | `invalid_image` | 이미지 없음, 크기 초과, 지원하지 않는 이미지 형식 또는 분석 불가 이미지 |
| `INVALID_INTRINSICS` | `invalid_intrinsics` | 초점거리 등 위치 추정 메타데이터 부족 또는 오류 |
| `MAP_NOT_LOADED` | `map_not_ready` | 요청한 맵 또는 맵 세트가 로드되지 않음 |
| `NO_RETRIEVAL_CANDIDATE` | `no_match` | 검색 후보 이미지 없음 |
| `INSUFFICIENT_MATCHES` | `no_match` | 매칭 수 부족 |
| `POSE_ESTIMATION_FAILED` | `no_match` | 포즈 추정 실패 |
| `LOW_GEOMETRIC_QUALITY` | `low_confidence` | 위치 후보는 있으나 기하 품질이 낮아 확정 불가 |
| `OVERLOADED` | `overloaded` | 동시 처리 제한으로 요청 거절 |
| `INTERNAL_ERROR` + `ENGINE_NOT_READY` | `ai_server_unavailable` | AI 엔진 준비 실패 |
| `INTERNAL_ERROR` | `internal_error` | 그 외 AI 내부 오류 |

##### fallbackOptions

| 값 | 의미 |
| --- | --- |
| retry_capture | 다시 촬영 |
| select_landmark | 랜드마크 선택 |
| select_on_map | 지도에서 현재 위치 수동 선택 |
| request_consultation | 상담 요청 |

##### 낮은 신뢰도 예시

```json
{
  "success": true,
  "data": {
    "resultStatus": "low_confidence",
    "candidates": [],
    "fallbackOptions": [
      "retry_capture",
      "select_landmark",
      "select_on_map",
      "request_consultation"
    ]
  },
  "message": "위치를 정확히 찾지 못했습니다."
}
```

##### 매칭 실패 예시

```json
{
  "success": true,
  "data": {
    "resultStatus": "no_match",
    "candidates": [],
    "fallbackOptions": [
      "retry_capture",
      "select_landmark",
      "select_on_map",
      "request_consultation"
    ]
  },
  "message": "현재 위치와 일치하는 후보를 찾지 못했습니다."
}
```

##### AI 서버 장애 예시

```json
{
  "success": true,
  "data": {
    "resultStatus": "ai_server_unavailable",
    "candidates": [],
    "fallbackOptions": [
      "select_on_map",
      "request_consultation"
    ]
  },
  "message": "위치 인식 서버에 연결할 수 없습니다."
}
```

---

## 7.2 랜드마크 후보 조회

### GET `/stations/{stationId}/landmarks`

위치 인식 실패 시 사용자가 선택할 수 있는 랜드마크 후보를 조회한다.

#### Query

| 이름    | 타입   | 필수 | 설명  |
| ------- | ------ | ---- | ----- |
| floorId | number | N    | 층 ID |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "nodeId": 20,
      "name": "B2 개찰구 앞 안내판",
      "floorId": 2,
      "mapX": 300.0,
      "mapY": 210.0
    }
  ],
  "message": null
}
```

---

## 7.3 수동 위치 확정

### POST `/localization/manual`

사용자가 지도에서 직접 선택한 위치를 현재 위치로 확정한다.

#### Request

```json
{
  "userSessionId": "usr_9f3a2b",
  "stationId": 1,
  "floorId": 2,
  "nodeId": 15,
  "mapX": 320.5,
  "mapY": 180.2
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "currentIndoorLocation": {
      "stationId": 1,
      "floorId": 2,
      "nodeId": 15,
      "label": "선택한 위치",
      "mapX": 320.5,
      "mapY": 180.2
    }
  },
  "message": null
}
```

---

## 8. 경로 API

## 8.1 경로 옵션 조회

### POST `/api/routes/indoor/options`

출발 노드에서 도착 노드까지 가능한 경로 옵션을 조회한다. 도착지는 실내 노드 ID(`targetNodeId`)로 직접 지정하며, 외부 목적지 검색·출구 추천은 이 API 범위 밖이다. 응답은 옵션별 요약이며 상세 `steps`·`pathNodes`는 포함하지 않는다.

#### Request

```json
{
  "stationId": 1,
  "startNodeId": 15,
  "targetNodeId": 44
}
```

#### routeType 기준

| routeType     | 화면 표시명          | 처리 기준                                                                          |
| ------------- | -------------------- | ---------------------------------------------------------------------------------- |
| fastest       | 빠른 경로            | 모든 active edge 허용 (가중치는 `distanceM`, 즉 최단 거리 기준)                    |
| elevator_only | 엘리베이터 이용 경로 | `moveType = stair`, `moveType = escalator` 제외 (일반 통로·엘리베이터·개찰구 허용) |

`elevator_only`는 엘리베이터 간선만 사용하는 경로가 아니라, 계단·에스컬레이터 없이 도달 가능한 경로를 의미한다.

#### Response

```json
{
  "success": true,
  "data": [
    {
      "routeType": "fastest",
      "displayName": "빠른 경로",
      "available": true,
      "unavailableReason": null,
      "totalDistanceM": 180,
      "estimatedTimeSec": 240
    },
    {
      "routeType": "elevator_only",
      "displayName": "엘리베이터 이용 경로",
      "available": false,
      "unavailableReason": "NO_ACCESSIBLE_ROUTE",
      "totalDistanceM": null,
      "estimatedTimeSec": null
    }
  ],
  "message": null
}
```

이용 불가한 옵션도 목록에서 제외하지 않고 `available=false`와 `unavailableReason`으로 표현한다. `unavailableReason`은 `NO_ROUTE`(연결된 경로 없음) 또는 `NO_ACCESSIBLE_ROUTE`(계단·에스컬레이터 제외 시 도달 불가)이다. `estimatedTimeSec`은 경로상 모든 간선에 예상 시간이 있을 때만 채워지며, 하나라도 없으면 `null`이다.

---

## 8.2 경로 생성

### POST `/api/routes/indoor`

선택한 경로 옵션으로 실내 경로 상세를 생성한다. 도착지는 `targetNodeId`로 지정하며, `routeType`이 `fastest`·`elevator_only`가 아니면 `UNSUPPORTED_ROUTE_TYPE`로 거부한다.

#### Request

```json
{
  "stationId": 1,
  "startNodeId": 15,
  "targetNodeId": 44,
  "routeType": "elevator_only"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "routeType": "elevator_only",
    "displayName": "엘리베이터 이용 경로",
    "available": true,
    "unavailableReason": null,
    "startNodeId": 15,
    "targetNodeId": 44,
    "totalDistanceM": 230,
    "estimatedTimeSec": 360,
    "steps": [
      {
        "order": 1,
        "fromNodeId": 15,
        "toNodeId": 18,
        "distanceM": 30,
        "estimatedTimeSec": 45,
        "moveType": "walkway",
        "instruction": "30m 직진하세요."
      }
    ],
    "pathNodes": [
      {
        "nodeId": 15,
        "floorId": 2,
        "mapX": 320.5,
        "mapY": 180.2
      }
    ]
  },
  "message": null
}
```

도달할 수 없으면 `available=false`와 `unavailableReason`을 채우고 `steps`·`pathNodes`는 빈 배열로 반환한다. `mapX`·`mapY`는 실내 도면 렌더링용이며 경로 탐색 가중치에는 사용하지 않는다. 방향(좌/우) 안내는 좌표 기반 계산이 필요하여 현재 범위에서 제외한다.

---

## 8.3 경로 재계산

### POST `/routes/indoor/recalculate`

경로 안내 중 현재 위치가 바뀌었을 때 경로를 다시 계산한다.

> 재계산은 별도 작업(Task)으로 분리되어 있으며 현재 미구현이다.

#### Request

```json
{
  "routeId": "rt_12345",
  "stationId": 1,
  "currentNodeId": 20,
  "targetNodeId": 44,
  "routeType": "fastest"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "routeId": "rt_67890",
    "distanceM": 150,
    "estimatedTimeSec": 210,
    "steps": []
  },
  "message": null
}
```

---

## 9. 외부 지도 연계 API

## 9.1 카카오맵 길찾기 링크 생성

### POST `/external-maps/directions`

사용자의 실제 현재 GPS 위치를 출발지로 사용하여 카카오맵 도보 길찾기 링크를 생성한다.

#### Request

```json
{
  "provider": "kakao",
  "origin": {
    "latitude": 37.4982,
    "longitude": 127.0281
  },
  "destination": {
    "placeId": 3,
    "name": "COEX Mall",
    "latitude": 37.5118,
    "longitude": 127.0592,
    "address": "서울특별시 강남구 영동대로 513"
  },
  "mode": "walking"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "provider": "kakao",
    "appUrl": "kakaomap://route?sp=37.4982,127.0281&ep=37.5118,127.0592&by=foot",
    "webUrl": "https://map.kakao.com/link/by/walk/%ED%98%84%EC%9E%AC%20%EC%9C%84%EC%B9%98,37.4982,127.0281/COEX%20Mall,37.5118,127.0592"
  },
  "message": null
}
```

---

## 10. 상담 API

## 10.1 상담 요청 생성

### POST `/consultations`

사용자가 상담 요청을 생성한다.

#### Request

```json
{
  "userSessionId": "usr_9f3a2b",
  "stationId": 1,
  "problemType": "CANNOT_FIND_EXIT",
  "currentNodeId": 15,
  "destinationType": "place",
  "destinationId": 3,
  "videoConsent": true,
  "audioConsent": true
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "consultationId": "cs_abc123",
    "status": "WAITING",
    "requestedAt": "2026-07-16T03:00:00Z"
  },
  "message": null
}
```

---

## 10.2 상담 상태 조회

### GET `/consultations/{consultationId}`

사용자가 상담 요청 상태를 확인한다.

#### Response

```json
{
  "success": true,
  "data": {
    "consultationId": "cs_abc123",
    "status": "ACCEPTED",
    "counselorId": 7,
    "signalingRoomId": "room_cs_abc123"
  },
  "message": null
}
```

---

## 10.3 상담 요청 취소

### DELETE `/consultations/{consultationId}`

사용자가 상담 요청을 취소한다.

#### Response

```json
{
  "success": true,
  "data": {
    "consultationId": "cs_abc123",
    "status": "CANCELED"
  },
  "message": null
}
```

---

## 11. 상담자 API

## 11.1 상담자 로그인

로그인은 상담자/관리자 공통 통합 로그인 API(`POST /auth/login`, 2.8절 참고)를 사용한다. 별도의 `/counselors/login` 엔드포인트는 존재하지 않는다.

---

## 11.2 상담 요청 목록 조회

### GET `/counselor/consultations`

상담자가 담당 역의 상담 요청 목록을 조회한다.

#### Header

```http
Authorization: Bearer {accessToken}
```

#### Query

| 이름   | 타입   | 필수 | 설명                 |
| ------ | ------ | ---- | -------------------- |
| status | string | N    | WAITING, ACCEPTED 등 |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "consultationId": "cs_abc123",
      "stationId": 1,
      "problemType": "CANNOT_FIND_EXIT",
      "status": "WAITING",
      "currentLocationLabel": "B2 개찰구 앞",
      "destinationLabel": "COEX Mall",
      "requestedAt": "2026-07-16T03:00:00Z"
    }
  ],
  "message": null
}
```

---

## 11.3 상담 수락

### POST `/consultations/{consultationId}/accept`

상담자가 상담 요청을 수락한다.

#### Header

```http
Authorization: Bearer {accessToken}
```

#### Response

```json
{
  "success": true,
  "data": {
    "consultationId": "cs_abc123",
    "status": "ACCEPTED",
    "signalingRoomId": "room_cs_abc123"
  },
  "message": null
}
```

---

## 11.4 상담 거절

### POST `/consultations/{consultationId}/reject`

상담자가 상담 요청을 거절한다.

#### Response

```json
{
  "success": true,
  "data": {
    "consultationId": "cs_abc123",
    "status": "REJECTED"
  },
  "message": null
}
```

---

## 11.5 상담 종료

### POST `/consultations/{consultationId}/end`

사용자 또는 상담자가 상담을 종료한다.

#### Request

```json
{
  "endedBy": "counselor"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "consultationId": "cs_abc123",
    "status": "ENDED"
  },
  "message": null
}
```

---

## 11.6 상담자 본인 계정 조회

### GET `/counselors/me`

로그인한 상담자가 자신의 계정 정보를 조회한다.

#### Header

```http
Authorization: Bearer {accessToken}
```

#### Response

```json
{
  "success": true,
  "data": {
    "accountId": 7,
    "loginId": "counselor01",
    "name": "김상담",
    "stationId": 1,
    "isActive": true,
    "status": "AVAILABLE",
    "createdAt": "2026-07-20T09:00:00"
  },
  "message": null
}
```

---

## 11.7 상담자 본인 계정 수정

### PATCH `/counselors/me`

로그인한 상담자가 자신의 이름, 비밀번호, 상담 가능 상태를 수정한다. 담당 역 지정과 계정 활성화·비활성화는 이 API로 변경할 수 없으며, 관리자 전용 API(13.6 상담자 계정 관리 참고)에서만 처리한다.

#### Header

```http
Authorization: Bearer {accessToken}
```

#### Request

```json
{
  "name": "박상담",
  "currentPassword": "oldPassword1!",
  "newPassword": "newPassword1!",
  "status": "BUSY"
}
```

모든 필드는 선택이며, 보낸 필드만 변경된다. `newPassword`를 보낼 때는 `currentPassword`를 반드시 함께 보내야 한다.

| 필드            | 타입   | 필수   | 설명                                   |
| --------------- | ------ | ------ | -------------------------------------- |
| name            | string | N      | 최대 100자                             |
| currentPassword | string | 조건부 | `newPassword` 지정 시 필수             |
| newPassword     | string | N      | 영문·숫자·특수문자 포함 8~20자         |
| status          | string | N      | `AVAILABLE`, `BUSY`, `OFFLINE` 중 하나 |

#### Response

```json
{
  "success": true,
  "data": {
    "accountId": 7,
    "loginId": "counselor01",
    "name": "박상담",
    "stationId": 1,
    "isActive": true,
    "status": "BUSY",
    "createdAt": "2026-07-20T09:00:00"
  },
  "message": null
}
```

#### 실패 응답 예시 — 현재 비밀번호 불일치

```json
{
  "success": false,
  "code": "INVALID_CURRENT_PASSWORD",
  "message": "현재 비밀번호가 올바르지 않습니다.",
  "data": null
}
```

> `currentPassword`가 없거나 틀리면 `newPassword`를 보냈어도 비밀번호는 변경되지 않고 `INVALID_CURRENT_PASSWORD`(400)를 반환한다. `name`/`status`만 보낸 경우에는 `currentPassword` 없이도 정상 처리된다.

---

## 12. WebRTC Signaling API 초안

WebRTC signaling은 WebSocket 기반으로 구현한다.

## 12.1 WebSocket 연결

### WS `/ws/signaling?roomId={signalingRoomId}&role={user|counselor}`

#### 메시지 타입

| type          | 설명          |
| ------------- | ------------- |
| offer         | WebRTC offer  |
| answer        | WebRTC answer |
| ice_candidate | ICE candidate |
| join          | 방 입장       |
| leave         | 방 퇴장       |
| error         | 오류          |

#### 예시 메시지

```json
{
  "type": "offer",
  "roomId": "room_cs_abc123",
  "sender": "user",
  "payload": {
    "sdp": "..."
  }
}
```

---

## 12.2 DataChannel 이벤트

WebRTC 연결 후 상담자 조작 정보는 DataChannel로 전달한다.

| eventType       | 설명                      |
| --------------- | ------------------------- |
| draw_arrow      | 사용자 화면에 화살표 표시 |
| set_destination | 사용자 목적지 변경        |
| update_location | 사용자 현재 위치 수정     |
| send_message    | 짧은 안내 메시지 표시     |
| sync_status     | 상담 상태 동기화          |

### draw_arrow 예시

```json
{
  "eventType": "draw_arrow",
  "payload": {
    "x": 180,
    "y": 240,
    "direction": "left",
    "durationMs": 3000
  }
}
```

### set_destination 예시

```json
{
  "eventType": "set_destination",
  "payload": {
    "targetType": "facility",
    "targetId": 12,
    "label": "엘리베이터"
  }
}
```

---

## 13. 관리자 API

관리자 API는 MVP에서 전체 구현한다.

## 13.1 관리자 로그인

로그인은 상담자/관리자 공통 통합 로그인 API(`POST /auth/login`, 2.8절 참고)를 사용한다. 별도의 `/admins/login` 엔드포인트는 존재하지 않는다.

---

## 13.2 역 관리

| Method | Endpoint                      | 설명              |
| ------ | ----------------------------- | ----------------- |
| POST   | `/admin/stations`             | 역 등록           |
| GET    | `/admin/stations`             | 활성 역 목록 조회 |
| GET    | `/admin/stations/{stationId}` | 역과 층 상세 조회 |
| PATCH  | `/admin/stations/{stationId}` | 역 정보 수정      |
| DELETE | `/admin/stations/{stationId}` | 역 비활성화       |

### 역 등록·수정 Request

#### Request

```json
{
  "nameKo": "강남역",
  "nameEn": "Gangnam Station",
  "lineInfo": "2호선, 신분당선",
  "latitude": 37.4979,
  "longitude": 127.0276
}
```

### 역 등록 Response

```json
{
  "success": true,
  "data": {
    "stationId": 1
  },
  "message": null
}
```

---

## 13.3 층 관리

| Method | Endpoint                             | 설명                   |
| ------ | ------------------------------------ | ---------------------- |
| POST   | `/admin/stations/{stationId}/floors` | 해당 역에 층 등록      |
| GET    | `/admin/stations/{stationId}/floors` | 해당 역의 층 목록 조회 |
| PATCH  | `/admin/floors/{floorId}`            | 층 정보 수정           |
| DELETE | `/admin/floors/{floorId}`            | 층 삭제                |

### 층 등록·수정 Request

#### Request

```json
{
  "floorCode": "B2",
  "floorName": "지하 2층",
  "floorOrder": 2
}
```

### 층 등록 Response

```json
{
  "success": true,
  "data": {
    "floorId": 2
  },
  "message": null
}
```

동일한 역에는 같은 `floorCode`를 중복 등록할 수 없다. 지도·시설·경로 노드 등에서 참조 중인 층은 삭제할 수 없다.

---

## 13.4 지도 등록·조회

### POST `/admin/floors/{floorId}/maps`

층별 지도 이미지를 업로드한다. 파일은 서버 정적 디렉토리에 저장하고 DB에는 상대 URL(`/uploads/maps/{fileName}`)을 저장한다. 같은 층에 이미 활성 지도가 있으면 자동으로 비활성화하고 새 지도를 활성 지도로 등록한다. `version`은 `v1`, `v2` 순으로 자동 부여한다.

#### Content-Type

```text
multipart/form-data
```

#### Request

| 이름        | 타입   | 필수 | 설명             |
| ----------- | ------ | ---- | ---------------- |
| mapType     | string | Y    | image, svg       |
| mapFile     | file   | Y    | 지도 파일        |
| width       | number | N    | 지도 너비        |
| height      | number | N    | 지도 높이        |
| scaleMPerPx | number | N    | 픽셀당 실제 거리 |

#### Response

```json
{
  "success": true,
  "data": {
    "mapId": 1
  },
  "message": null
}
```

---

### GET `/admin/floors/{floorId}/maps`

관리자 화면에서 등록된 지도를 미리보기 위해 해당 층의 활성 지도 목록을 조회한다.

#### Response

```json
{
  "success": true,
  "data": [
    {
      "mapId": 1,
      "floorId": 2,
      "floorCode": "B2",
      "mapType": "image",
      "mapUrl": "/uploads/maps/3f2a1b.png",
      "width": 1200,
      "height": 800,
      "scaleMPerPx": 0.05,
      "version": "v1"
    }
  ],
  "message": null
}
```

---

## 13.5 시설·출구 관리

시설(출구·개찰구·승강장·엘리베이터 등)을 등록·조회·수정·삭제한다. `facilityType`은 ERD\_초안.md 의 시설 유형(`exit`, `gate`, `platform`, `transfer_passage`, `stair`, `escalator`, `elevator`, `restroom`, `station_office`, `ticket_machine`, `card_charger`, `locker`) 중 하나여야 하며, 그 외 값은 `UNSUPPORTED_FACILITY_TYPE`로 거부한다. `facilityType`이 `exit`이고 `exitDetail`이 있으면 출구 상세를 함께 저장한다. 삭제는 물리 삭제 대신 `is_active=false` 처리한다.

| Method | Endpoint                         | 설명                                                                  |
| ------ | -------------------------------- | --------------------------------------------------------------------- |
| POST   | `/admin/facilities`              | 시설 등록                                                             |
| GET    | `/admin/facilities`              | 시설 목록 조회 (`stationId` 필수, `floorId`·`facilityType` 선택 필터) |
| GET    | `/admin/facilities/{facilityId}` | 시설 상세 조회 (출구면 `exitDetail` 포함)                             |
| PATCH  | `/admin/facilities/{facilityId}` | 시설 수정                                                             |
| DELETE | `/admin/facilities/{facilityId}` | 시설 비활성화                                                         |

### POST `/admin/facilities`

#### Request

```json
{
  "stationId": 1,
  "floorId": 2,
  "facilityType": "exit",
  "nameKo": "5번 출구",
  "nameEn": "Exit 5",
  "mapX": 820.4,
  "mapY": 120.7,
  "linkedNodeId": 44,
  "isAccessible": true,
  "exitDetail": {
    "exitNumber": "5",
    "outsideLatitude": 37.4982,
    "outsideLongitude": 127.0281
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "facilityId": 10
  },
  "message": null
}
```

### GET `/admin/facilities`

#### Query

| 이름         | 타입   | 필수 | 설명           |
| ------------ | ------ | ---- | -------------- |
| stationId    | number | Y    | 역 ID          |
| floorId      | number | N    | 층 필터        |
| facilityType | string | N    | 시설 유형 필터 |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "facilityId": 10,
      "stationId": 1,
      "floorId": 2,
      "facilityType": "exit",
      "nameKo": "5번 출구",
      "nameEn": "Exit 5",
      "mapX": 820.4,
      "mapY": 120.7,
      "linkedNodeId": 44,
      "isAccessible": true
    }
  ],
  "message": null
}
```

### GET `/admin/facilities/{facilityId}`

#### Response

```json
{
  "success": true,
  "data": {
    "facilityId": 10,
    "stationId": 1,
    "floorId": 2,
    "facilityType": "exit",
    "nameKo": "5번 출구",
    "nameEn": "Exit 5",
    "mapX": 820.4,
    "mapY": 120.7,
    "linkedNodeId": 44,
    "isAccessible": true,
    "exitDetail": {
      "exitNumber": "5",
      "outsideLatitude": 37.4982,
      "outsideLongitude": 127.0281,
      "descriptionKo": null,
      "descriptionEn": null
    }
  },
  "message": null
}
```

### PATCH `/admin/facilities/{facilityId}`

수정 요청은 `stationId`·`floorId`를 제외한 필드로 구성한다. `facilityType`이 `exit`가 아닌 값으로 변경되면 기존 `exitDetail`은 삭제된다.

#### Request

```json
{
  "facilityType": "exit",
  "nameKo": "5번 출구",
  "nameEn": "Exit 5",
  "mapX": 820.4,
  "mapY": 120.7,
  "linkedNodeId": 44,
  "isAccessible": true,
  "exitDetail": {
    "exitNumber": "5",
    "outsideLatitude": 37.4982,
    "outsideLongitude": 127.0281
  }
}
```

---

## 13.6 경로 노드 관리

경로 탐색용 노드를 등록·조회·수정·삭제한다. `nodeType`은 ERD\_초안.md 의 노드 유형(`normal`, `junction`, `facility`, `floor_transition`, `exit`) 중 하나여야 하며, 그 외 값은 `UNSUPPORTED_NODE_TYPE`로 거부한다. 노드는 물리 삭제하며, 간선·시설 등에서 참조 중이면 `ROUTE_NODE_IN_USE`로 삭제를 막는다.

| Method | Endpoint                      | 설명                                                   |
| ------ | ----------------------------- | ------------------------------------------------------ |
| POST   | `/admin/route-nodes`          | 노드 등록                                              |
| GET    | `/admin/route-nodes`          | 노드 목록 조회 (`stationId` 필수, `floorId` 선택 필터) |
| GET    | `/admin/route-nodes/{nodeId}` | 노드 상세 조회                                         |
| PATCH  | `/admin/route-nodes/{nodeId}` | 노드 수정                                              |
| DELETE | `/admin/route-nodes/{nodeId}` | 노드 삭제                                              |

### POST `/admin/route-nodes`

#### Request

```json
{
  "stationId": 1,
  "floorId": 2,
  "nodeType": "junction",
  "name": "B2 갈림길 1",
  "mapX": 300.0,
  "mapY": 200.0,
  "isLandmark": true
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "nodeId": 15
  },
  "message": null
}
```

### GET `/admin/route-nodes/{nodeId}`

#### Response

```json
{
  "success": true,
  "data": {
    "nodeId": 15,
    "stationId": 1,
    "floorId": 2,
    "nodeType": "junction",
    "name": "B2 갈림길 1",
    "mapX": 300.0,
    "mapY": 200.0,
    "isLandmark": true
  },
  "message": null
}
```

---

## 13.7 경로 간선 관리

노드 간 이동 간선을 등록·조회·수정·삭제한다. `moveType`은 ERD\_초안.md 의 이동 유형(`walkway`, `stair`, `escalator`, `elevator`, `gate`) 중 하나여야 하며, 그 외 값은 `UNSUPPORTED_MOVE_TYPE`로 거부한다. `fromNodeId`와 `toNodeId`는 같은 역의 노드여야 하고 서로 달라야 한다. 삭제는 `is_active=false` 처리한다.

| Method | Endpoint                      | 설명                              |
| ------ | ----------------------------- | --------------------------------- |
| POST   | `/admin/route-edges`          | 간선 등록                         |
| GET    | `/admin/route-edges`          | 간선 목록 조회 (`stationId` 필수) |
| GET    | `/admin/route-edges/{edgeId}` | 간선 상세 조회                    |
| PATCH  | `/admin/route-edges/{edgeId}` | 간선 수정                         |
| DELETE | `/admin/route-edges/{edgeId}` | 간선 비활성화                     |

### POST `/admin/route-edges`

#### Request

```json
{
  "stationId": 1,
  "fromNodeId": 15,
  "toNodeId": 16,
  "distanceM": 20,
  "estimatedTimeSec": 30,
  "moveType": "walkway",
  "isAccessible": true,
  "isBidirectional": true
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "edgeId": 30
  },
  "message": null
}
```

### GET `/admin/route-edges/{edgeId}`

#### Response

```json
{
  "success": true,
  "data": {
    "edgeId": 30,
    "stationId": 1,
    "fromNodeId": 15,
    "toNodeId": 16,
    "distanceM": 20,
    "estimatedTimeSec": 30,
    "moveType": "walkway",
    "isAccessible": true,
    "isBidirectional": true
  },
  "message": null
}
```

---

## 13.8 주변 장소 관리

주변 장소(역 외부 목적지)를 등록·조회·수정·삭제한다. 좌표(위경도)는 실외 GPS·관리자 입력값을 그대로 저장하며 서버에서 계산하지 않는다. 위도는 −90~90, 경도는 −180~180 범위를 벗어나면 `INVALID_REQUEST`. 단건 조회·수정·삭제는 **활성 장소만** 대상으로 하며, 비활성 장소는 `PLACE_NOT_FOUND`. 삭제는 물리 삭제 대신 `is_active=false` 처리하고, **연결된 장소-출구 추천도 함께 삭제**한다.

### POST `/admin/nearby-places`

주변 장소를 등록한다. 성공 시 `201`과 생성된 `placeId`를 반환한다.

#### Request

```json
{
  "stationId": 1,
  "nameKo": "코엑스몰",
  "nameEn": "COEX Mall",
  "category": "shopping",
  "address": "서울특별시 강남구 영동대로 513",
  "latitude": 37.5118,
  "longitude": 127.0592,
  "externalMapUrl": null
}
```

### GET `/admin/nearby-places?stationId={stationId}`

역별 주변 장소 목록을 조회한다. 관리자용이므로 비활성 장소도 포함한다. `stationId` 누락 시 `INVALID_REQUEST`.

### GET `/admin/nearby-places/{placeId}`

주변 장소 상세를 조회한다. 없으면 `PLACE_NOT_FOUND`.

### PATCH `/admin/nearby-places/{placeId}`

주변 장소를 수정한다. 소속 역(`stationId`)은 변경 대상이 아니다.

### DELETE `/admin/nearby-places/{placeId}`

주변 장소를 비활성화(`is_active=false`)한다.

#### Response (상세·목록 요소 공통)

```json
{
  "success": true,
  "data": {
    "placeId": 10,
    "stationId": 1,
    "nameKo": "코엑스몰",
    "nameEn": "COEX Mall",
    "category": "shopping",
    "address": "서울특별시 강남구 영동대로 513",
    "latitude": 37.5118,
    "longitude": 127.0592,
    "externalMapUrl": null,
    "active": true
  },
  "message": null
}
```

---

## 13.9 장소-출구 추천 관리

주변 장소와 추천 출구(시설)를 연결·조회·삭제한다. 대상 장소는 **활성 장소**여야 하며 아니면 `PLACE_NOT_FOUND`. `exitFacilityId`는 **장소와 같은 역의 활성 출구(`facilityType=exit`) 시설**이어야 하며, 각각 없음/출구 아님/다른 역이면 `FACILITY_NOT_FOUND`·`UNSUPPORTED_FACILITY_TYPE`·`INVALID_REQUEST`로 거부한다. 동일한 `(placeId, exitFacilityId)` 조합을 중복 등록하면 `DUPLICATE_EXIT_RECOMMENDATION`. `isPrimary=true`로 등록하면 같은 장소의 **기존 대표 추천은 자동 해제**되어 대표는 항상 하나만 유지된다. `priority`는 0 이상이어야 한다. 추천은 물리 삭제한다. (수정은 삭제 후 재등록으로 대체하며 PATCH는 제공하지 않는다.)

### POST `/admin/place-exit-recommendations`

장소-출구 추천을 등록한다. 성공 시 `201`과 생성된 `recommendationId`를 반환한다.

#### Request

```json
{
  "placeId": 3,
  "exitFacilityId": 10,
  "priority": 1,
  "reasonKo": "목적지와 가장 가까운 출구입니다.",
  "reasonEn": "This is the closest exit to your destination.",
  "walkingTimeMin": 6,
  "isPrimary": true
}
```

### GET `/admin/place-exit-recommendations?placeId={placeId}`

장소별 추천 목록을 우선순위(`priority` 오름차순) 순으로 조회한다. `placeId` 누락 시 `INVALID_REQUEST`, 장소가 없으면 `PLACE_NOT_FOUND`.

### DELETE `/admin/place-exit-recommendations/{recommendationId}`

장소-출구 추천을 삭제한다. 없으면 `EXIT_RECOMMENDATION_NOT_FOUND`.

---

## 13.10 상담자 계정 등록

### POST `/admin/counselors`

#### Request

```json
{
  "stationId": 1,
  "loginId": "counselor01",
  "password": "password",
  "name": "역무원"
}
```

---

## 14. 위치 공유 API

위치 공유는 최종 기능 요구사항 32개에 포함된 필수 기능이다.

## 14.1 위치 공유 링크 생성

### POST `/location-shares`

#### Request

```json
{
  "ownerSessionId": "usr_9f3a2b",
  "stationId": 1,
  "sharedNodeId": 15,
  "expiresInMinutes": 30
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "shareId": "share_xyz",
    "shareUrl": "https://example.com/share/share_xyz",
    "expiresAt": "2026-07-16T03:30:00Z"
  },
  "message": null
}
```

---

## 14.2 공유 위치 조회

### GET `/location-shares/{shareId}`

#### Response

```json
{
  "success": true,
  "data": {
    "shareId": "share_xyz",
    "stationId": 1,
    "sharedLocation": {
      "nodeId": 15,
      "floorId": 2,
      "label": "B2 개찰구 앞",
      "mapX": 320.5,
      "mapY": 180.2
    },
    "expiresAt": "2026-07-16T03:30:00Z"
  },
  "message": null
}
```

---

## 15. 교통카드 추천 API

교통카드 추천은 최종 기능 요구사항 32개에 포함된 필수 기능이다.

## 15.1 교통카드 추천

### POST `/transport-cards/recommend`

#### Request

```json
{
  "stayDays": 2,
  "visitOutsideSeoul": false,
  "dailyTransitCount": 4,
  "airportTransfer": true,
  "places": ["강남", "홍대"]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "recommendedCard": "기후동행카드",
    "reason": "서울 내 대중교통 이용 횟수가 많아 정액권이 유리할 수 있습니다.",
    "alternatives": ["일반 Tmoney", "1일권"],
    "purchasePlaces": ["지하철역 고객안전실", "일부 편의점"],
    "cautions": ["서울 외 지역 이용 가능 여부를 확인하세요."]
  },
  "message": null
}
```

---

## 16. 오류 코드 초안

| 코드                          | 설명                                    |
| ----------------------------- | --------------------------------------- |
| INVALID_REQUEST               | 요청 형식이 잘못됨                      |
| DUPLICATE_LOGIN_ID            | 이미 사용 중인 로그인 ID                |
| STATION_NOT_FOUND             | 역을 찾을 수 없음                       |
| FACILITY_NOT_FOUND            | 시설을 찾을 수 없음                     |
| UNSUPPORTED_FACILITY_TYPE     | 지원하지 않는 시설 유형                 |
| FLOOR_NOT_FOUND               | 층을 찾을 수 없음                       |
| INVALID_MAP_FILE              | 지도 파일이 비어 있거나 올바르지 않음   |
| UNSUPPORTED_MAP_TYPE          | 지원하지 않는 지도 유형                 |
| FILE_STORAGE_FAILED           | 파일 저장 실패                          |
| PLACE_NOT_FOUND               | 주변 장소를 찾을 수 없음                |
| EXIT_RECOMMENDATION_NOT_FOUND | 장소-출구 추천을 찾을 수 없음           |
| DUPLICATE_EXIT_RECOMMENDATION | 이미 등록된 장소-출구 추천              |
| USER_SESSION_NOT_FOUND        | 사용자 세션을 찾을 수 없음              |
| INVALID_DESTINATION           | 목적지 유형과 ID 중 하나만 전달됨       |
| USER_SESSION_ALREADY_ENDED    | 이미 종료·만료된 세션                   |
| USER_SESSION_IN_CONSULTATION  | 진행 중인 상담이 있어 세션을 종료할 수 없음 |
| LOCALIZATION_FAILED           | 위치 인식 실패                          |
| ROUTE_NOT_FOUND               | 경로를 찾을 수 없음                     |
| ROUTE_NODE_NOT_FOUND          | 경로 노드를 찾을 수 없음                |
| ROUTE_EDGE_NOT_FOUND          | 경로 간선을 찾을 수 없음                |
| ROUTE_NODE_IN_USE             | 사용 중인 경로 노드는 삭제할 수 없음    |
| UNSUPPORTED_NODE_TYPE         | 지원하지 않는 노드 유형                 |
| UNSUPPORTED_MOVE_TYPE         | 지원하지 않는 이동 유형                 |
| UNSUPPORTED_ROUTE_TYPE        | 지원하지 않는 경로 옵션 유형            |
| CONSULTATION_NOT_FOUND        | 상담 세션을 찾을 수 없음                |
| INVALID_CREDENTIALS           | 로그인 ID 또는 비밀번호가 올바르지 않음 |
| INVALID_CURRENT_PASSWORD      | 현재 비밀번호가 올바르지 않음           |
| ACCOUNT_NOT_FOUND             | 계정을 찾을 수 없음                     |
| INACTIVE_ACCOUNT              | 비활성화된 계정으로 로그인 시도         |
| WEBRTC_SIGNALING_FAILED       | WebRTC signaling 실패                   |
| EXTERNAL_MAP_LINK_FAILED      | 외부 지도 링크 생성 실패                |

---

## 17. MVP 필수 API 요약

| 구분        | API                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| 사용자 세션 | POST /user-sessions, GET /user-sessions/{userSessionId}, PATCH /user-sessions/{userSessionId}, DELETE /user-sessions/{userSessionId} |
| 역          | GET /stations/nearby, GET /stations/search, GET /stations/{stationId}                                   |
| 지도/시설   | GET /stations/{stationId}/maps, GET /stations/{stationId}/facilities                                    |
| 목적지      | GET /destinations/search, GET /stations/{stationId}/places, GET /places/{placeId}/recommended-exits     |
| 위치 인식   | POST /vps/localize, POST /localization/manual                                                           |
| 경로        | POST /routes/indoor/options, POST /routes/indoor, POST /routes/indoor/recalculate                       |
| 외부 지도   | POST /external-maps/directions                                                                          |
| 위치 공유   | POST /location-shares, GET /location-shares/{shareId}                                                   |
| 상담        | POST /consultations, GET /consultations/{consultationId}, DELETE /consultations/{consultationId}        |
| 인증        | POST /auth/login, POST /auth/signup, GET /auth/check-login-id                                           |
| 상담자      | GET /counselor/consultations, POST /consultations/{id}/accept, GET /counselors/me, PATCH /counselors/me |
| WebRTC      | WS /ws/signaling                                                                                        |
| 교통카드    | POST /transport-cards/recommend                                                                         |
| 관리자      | 관리자 데이터 등록 API 전체 구현                                                                        |

---

## 18. 확정된 구현 사항

| 항목                   | 결정                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| 프론트엔드             | React + TypeScript + Vite                                        |
| UI 스타일링            | Tailwind CSS                                                     |
| 아이콘                 | lucide-react                                                     |
| 실제 백엔드 프레임워크 | Spring Boot                                                      |
| DBMS                   | MySQL                                                            |
| ORM/DB 접근            | Spring Data JPA                                                  |
| 인증 방식              | JWT Access Token                                                 |
| JWT 만료 시간          | 6시간                                                            |
| Refresh Token          | MVP에서는 생략                                                   |
| 사용자 세션 만료       | 마지막 활동 기준 1시간                                          |
| 사용자 세션 종료 | 경로 안내 정상 종료 시 즉시 만료 처리. 진행 중 상담(WAITING·ACCEPTED·CONNECTING·IN_PROGRESS)이 있으면 만료하지 않는다 | 
| 상담 세션 ID           | UUID 또는 ULID 기반 문자열                                       |
| WebRTC signaling       | WebSocket                                                        |
| STUN/TURN              | 무료 STUN 우선, 연결 불안정 시 TURN 추가                         |
| 지도 표현 방식         | 이미지 지도 + 좌표 오버레이                                      |
| 지도 파일 업로드 방식  | 서버 정적 파일에 저장하고 DB에는 URL 저장                        |
| 경로 탐색              | 백엔드 Dijkstra                                                  |
| 카메라 이미지 처리     | 서버 장기 저장 없이 처리 후 즉시 폐기                            |
| 이미지 폐기 로그       | 이미지 원본은 저장하지 않고 요청 ID, 처리 결과, 폐기 시각만 기록 |
| 외부 지도 우선 연동    | 카카오맵                                                         |
| 관리자 API             | MVP에서 전체 구현                                                |
| 배포 방식              | Nginx reverse proxy + HTTPS                                      |
| HTTPS 인증서           | Let's Encrypt 기준                                               |
| API 응답 다국어 처리   | `nameKo`, `nameEn` 함께 응답                                     |

## 19. 아직 의사결정이 필요한 사항

1. 실제 시연 대표 동선 확정

## 20. 구현 중 검증할 사항

1. 카카오맵 URL Scheme 또는 웹 링크의 최종 형식 검증
2. 실제 배포 도메인 확정
3. 카메라 이미지 즉시 폐기 로그 검증
