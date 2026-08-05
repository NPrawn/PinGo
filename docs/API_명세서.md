# 외국인 관광객 대상 지하철 실내 내비게이션 API 명세서

> 최신화: 2026-08-02

## 1. 문서 목적

본 문서는 외국인 관광객 대상 지하철 실내 내비게이션 서비스의 API 계약을 정의한다.

본 문서는 프론트엔드, 백엔드, VPS, WebRTC, 관리자 기능 개발 시 요청/응답 구조를 맞추기 위한 기준 문서이다.

### 현재 구현 범위

| 상태 | API 영역 |
| --- | --- |
| 구현 | 인증·회원가입, 익명 사용자 세션, 역·층·지도·시설, 목적지 검색, 주변 장소·출구 추천, 실내 경로 2종, Kakao 외부 길찾기, 상담 생성·조회·취소·대기 SSE, 상담자 본인/관리자 계정 관리, VPS 위치추정, health, WebSocket signaling |
| 계획 | 랜드마크 후보·수동 위치 지정, 역 주변 장소 목록, 상담자용 상담 큐/수락/거절/종료, 위치 공유, 교통카드 추천, 관리자 상담자 생성 |

구현 여부와 최신 요청·응답 schema는 실행 중인 Swagger를 최종 확인 수단으로 사용한다.

---

## 2. 공통 규칙

### 2.1 Base URL

```text
개발 환경: http://localhost:{port}
배포 환경: https://jenkins.example.invalid
```

이 문서의 REST endpoint는 모두 `/api/...` 절대 경로로 표기한다.

### 2.2 응답 형식

모든 API는 JSON 형식을 기본으로 한다.

#### 성공 응답

```json
{
  "success": true,
  "data": {}
}
```

#### 실패 응답

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "오류 메시지"
}
```

**값이 `null`인 봉투 필드는 응답에서 빠진다.** `ApiResponse`에 `@JsonInclude(NON_NULL)`이 붙어 있어서, 성공 응답에는 `code`가 없고 실패 응답에는 `data`가 없다. 문서의 다른 예시에 `"message": null`처럼 적혀 있는 곳은 실제로는 그 필드가 나오지 않는다.

**이 규칙은 봉투에만 적용된다.** `data` 안쪽 DTO는 `null`도 그대로 실린다. 예를 들어 위치 인식 응답의 `position.forwardMap`은 값이 없으면 `null`로 나온다.

오류 코드 필드 이름은 **`code`**다. `errorCode`가 아니다.

### 2.3 공통 HTTP 상태 코드

| 코드 | 의미        |
| ---- | ----------- |
| 200  | 요청 성공   |
| 201  | 생성 성공   |
| 400  | 잘못된 요청 |
| 401  | 인증 필요   |
| 403  | 권한 없음   |
| 404  | 리소스 없음 |
| 405  | 지원하지 않는 요청 방식 |
| 409  | 상태 충돌   |
| 415  | 지원하지 않는 요청 형식 |
| 500  | 서버 오류   |

**405는 경로는 맞고 메서드가 다를 때, 415는 `Content-Type`을 서버가 읽을 수 없을 때다.** 둘 다 `code`가 각각 `METHOD_NOT_ALLOWED`·`UNSUPPORTED_MEDIA_TYPE`이다.

**404는 두 경우에 나온다.** 매핑된 엔드포인트가 없으면 `ENDPOINT_NOT_FOUND`, 엔드포인트는 있고 자원을 못 찾으면 도메인 코드(`FACILITY_NOT_FOUND` 등)다. 인증이 필요한 접두사 밖의 경로는 시큐리티가 먼저 막아 401이 나간다.

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

WebRTC signaling 참여자 검증은 일반 HTTP 인증과 별도로 상담별 `signalingAccessToken`을 사용한다. 상담자는 상담 수락 응답으로 받은 토큰을 사용하고, 익명 사용자는 상담 상태 조회 응답으로 받은 토큰을 사용한다. signaling token은 `tokenType=SIGNALING` claim을 포함해야 하며, WebSocket handshake에서 토큰이 누락되었거나 만료·변조·형식 오류가 있으면 `401 Unauthorized`로 연결을 거절한다.

### 2.5 확정 구현 선택

| 항목               | 확정안                                                              |
| ------------------ | ------------------------------------------------------------------- |
| 프론트엔드         | React + TypeScript + Vite                                           |
| UI 스타일링        | CSS Modules + CSS Variables                                        |
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
| 인증·상담·상담 요약·상담자·관리자 로그인                 | 오서현    |
| VPS 이미지 요청·AI Adapter·위치 인식 상태 판정·외부 지도·위치 공유·배포 네트워크·WebRTC signaling·DataChannel 계약 | 이정우    |
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

### POST `/api/auth/login`

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

> 이전 초안에서는 `/counselors/login`, `/admins/login`을 별도로 정의했으나(11.1, 13.1 참고), account 테이블 통합(ERD\_초안.md 5.6 참고)에 맞춰 `POST /api/auth/login` 하나로 합쳤다. 응답도 `counselor`/`admin` 중첩 객체가 아니라 평평한(flat) 구조이며, 관리자 세부 역할 구분 필드(`role`: admin/super_admin)는 아직 구현되지 않았다 — 필요해지면 추가 논의 필요.

## 2.9 상담자(역무원) 회원가입

### POST `/api/auth/signup`

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

### GET `/api/auth/check-login-id`

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

### POST `/api/user-sessions`

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

### GET `/api/user-sessions/{userSessionId}`

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

조회는 활동 시각을 갱신하지 않는다. `last_active_at`과 `expires_at`은 `PATCH /api/user-sessions/{userSessionId}` 호출 시에만 연장되므로, 이 API를 반복 호출해도 세션 만료를 늦출 수 없다.

만료·종료된 세션이거나 존재하지 않는 ID이면 `USER_SESSION_NOT_FOUND`를 반환한다. 클라이언트는 이 응답을 받으면 세션을 새로 생성하고 `language`를 다시 전송해 흐름을 이어간다.

역·목적지의 표시 이름이 필요하면 `GET /api/stations/{stationId}`(4.3), `GET /api/facilities/{facilityId}`(5.3)로 별도 조회한다. 세션 응답은 ID만 반환한다.

---

## 3.3 사용자 세션 갱신

### PATCH `/api/user-sessions/{userSessionId}`

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

### DELETE `/api/user-sessions/{userSessionId}`

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
  "code": "USER_SESSION_ALREADY_ENDED",
  "message": "이미 종료된 세션입니다."
}
```

세션 종료는 행 삭제가 아니라 `expires_at`을 현재 시각으로 설정하는 만료 처리다. `consultation_session`, `location_share`, `localization_log`가 `user_session`을 FK로 참조하므로 행을 삭제하지 않으며, 상담·위치 인식 이력은 그대로 보존된다.

진행 중인 상담(`WAITING`, `ACCEPTED`, `CONNECTING`, `IN_PROGRESS`)이 연결된 세션은 종료할 수 없으며 `USER_SESSION_IN_CONSULTATION`을 반환한다. 존재하지 않는 세션 ID는 `USER_SESSION_NOT_FOUND`를 반환한다.

종료·만료된 세션 ID로 다시 요청이 오면 클라이언트는 새 세션을 생성하고 `language`를 다시 전송해 흐름을 이어간다.

---

## 4. 역 API

## 4.1 주변 역 조회

### GET `/api/stations/nearby`

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

### GET `/api/stations/search`

역 이름으로 역을 검색한다.

등록된 역을 먼저 담고, 이어서 카카오 지하철역 검색 결과를 붙인다. 등록된 역만 조회하면 아직 실내
지도를 준비하지 않은 역이 "결과 없음"으로 보이기 때문이다. 카카오 결과는 `stationId`가 없고
`serviceReady=false`이며 실내 안내 대상이 아니다.

`keyword`를 생략하면 등록된 역 전체만 반환하고 외부 검색은 하지 않는다. 상담자 회원가입처럼 담당
역을 고르는 화면이 이 경로를 쓴다.

#### Query

| 이름     | 타입   | 필수 | 설명                                  |
| -------- | ------ | ---- | ------------------------------------- |
| keyword  | string | N    | 검색어. 생략 시 등록된 역 전체 반환   |
| language | string | N    | ko, en. **검색 결과를 바꾸지 않는다** — 두 이름 컬럼을 모두 보고 검색하며 이름도 둘 다 내려준다 |

#### Response

| 필드         | 설명                                                           |
| ------------ | -------------------------------------------------------------- |
| stationId    | 등록된 역의 ID. 외부 검색 결과는 `null`                        |
| provider     | `pingo`(등록된 역) 또는 `kakao`(외부 검색)                     |
| externalId   | 카카오 장소 ID. 등록된 역은 `null`                             |
| serviceReady | 실내 안내 가능 여부. 외부 검색 결과는 항상 `false`             |

```json
{
  "success": true,
  "data": [
    {
      "stationId": 1,
      "nameKo": "역삼역",
      "nameEn": "Yeoksam Station",
      "lineInfo": "2호선",
      "provider": "pingo",
      "externalId": null,
      "address": null,
      "latitude": 37.5007000,
      "longitude": 127.0365000,
      "serviceReady": true
    },
    {
      "stationId": null,
      "nameKo": "선릉역",
      "nameEn": null,
      "lineInfo": "2호선·수인분당선",
      "provider": "kakao",
      "externalId": "21160338",
      "address": "서울 강남구 테헤란로 340",
      "latitude": 37.5045200,
      "longitude": 127.0489130,
      "serviceReady": false
    }
  ],
  "message": null
}
```

카카오 검색이 실패하거나 `KAKAO_REST_API_KEY`가 없으면 등록된 역만 반환한다.

---

## 4.3 역 상세 조회

### GET `/api/stations/{stationId}`

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

### GET `/api/stations/{stationId}/maps`

역의 층별 지도 정보를 조회한다. 응답에는 **좌표 프레임**이 포함된다 — 노드·경로·현재위치 좌표는 캐노니컬 미터로 내려가므로, 지도 위에 그리려면 이 값으로 픽셀로 변환해야 한다.

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
      "width": 1626,
      "height": 967,
      "scaleMPerPx": 0.19,
      "originPxX": 594,
      "originPxY": 501,
      "frameAngleDeg": -21.28,
      "nominalZ": 0.0,
      "version": "v1"
    }
  ],
  "message": null
}
```

#### 좌표 프레임 필드

| 이름 | 타입 | 필수 | 설명 |
| ------------- | ------ | ---- | ---------------------------------------------- |
| width | number | N | 원본 지도 이미지 너비(px) |
| height | number | N | 원본 지도 이미지 높이(px) |
| scaleMPerPx | number | N | 픽셀당 실제 거리(m) |
| originPxX | number | N | 캐노니컬 원점 `(0,0)`에 대응하는 이미지 픽셀 x |
| originPxY | number | N | 캐노니컬 원점 `(0,0)`에 대응하는 이미지 픽셀 y |
| frameAngleDeg | number | N | 캐노니컬 +X축과 이미지 x축의 각도(도) |

프레임 4필드(`scaleMPerPx`, `originPxX`, `originPxY`, `frameAngleDeg`)가 **모두 있어야** 좌표 변환이 가능하다. 하나라도 `null`이면 지도 이미지는 표시할 수 있으나 좌표 오버레이는 할 수 없다. **층마다 값이 다르므로 층별로 사용해야 한다** — 원본 평면도 이미지의 크기·여백이 층마다 달라 원점 픽셀이 다르다.

> 역삼역(`stationId = 1`)은 B1·B2·B3 세 층의 지도가 프레임 값과 함께 시드돼 있다.
> **B1의 `originPxX`·`originPxY`는 미검증 추정값**이며 COLMAP 정합 후 확정한다(→ [`역삼역_route_node_naming.md`](역삼역_route_node_naming.md) §1). 확정 시 이 테이블만 갱신하면 되고 클라이언트 코드는 바뀌지 않는다.

#### 좌표 변환식

`px`/`py`는 **원본 이미지 픽셀**이다. 화면에 축소·확대해 그린다면 뷰 배율을 추가로 곱한다.

```js
// 미터(x, y) → 원본 이미지 픽셀(px, py)  [노드·경로·현재위치를 지도에 그릴 때]
function meterToPixel(x, y, frame) {
  const t = (frame.frameAngleDeg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  return {
    px: frame.originPxX + (c * x - s * y) / frame.scaleMPerPx,
    py: frame.originPxY + (s * x + c * y) / frame.scaleMPerPx,
  };
}

// 원본 이미지 픽셀(px, py) → 미터(x, y)  [지도를 눌러 위치를 지정할 때]
function pixelToMeter(px, py, frame) {
  const t = (frame.frameAngleDeg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  const dx = px - frame.originPxX, dy = py - frame.originPxY;
  return {
    x: (dx * c + dy * s) * frame.scaleMPerPx,
    y: (-dx * s + dy * c) * frame.scaleMPerPx,
  };
}
```

검증 예시 (역삼역 B2): `meterToPixel(0, 0, frameB2)` → `(622, 512)` = B2-B3 엘리베이터 B(원점), `meterToPixel(-0.4, 27.2, frameB2)` → `(672, 646)` = B2-B3 엘리베이터 A.

> 좌표계 결정 배경은 [`기술_의사결정_정리.md`](기술_의사결정_정리.md) §6.3, FE 연동 계약은 [`역삼역_FE_좌표연동_스펙.md`](역삼역_FE_좌표연동_스펙.md)를 기준으로 한다.

---

## 5.2 시설 목록 조회

### GET `/api/stations/{stationId}/facilities`

역 내부 시설 목록을 조회한다.

#### Query

| 이름         | 타입   | 필수 | 설명           |
| ------------ | ------ | ---- | -------------- |
| floorId      | number | N    | 특정 층 필터   |
| facilityType | string | N    | 시설 유형 필터 |
| language     | string | N    | ko, en. **응답을 바꾸지 않는다** — 이름을 둘 다 내려준다 |

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
      "mapX": 97.454,
      "mapY": -19.34,
      "linkedNodeId": 44,
      "isAccessible": false
    }
  ],
  "message": null
}
```

`mapX`·`mapY`는 **캐노니컬 미터**다(픽셀이 아니다). 음수가 정상이며, 원점 기준 상대 위치다. 지도에 그릴 때는 §5.1의 좌표 프레임으로 변환한다.

#### 출구의 `isAccessible`

출구 시설의 `isAccessible`은 **역 안에서 계단·에스컬레이터 없이 그 출구까지 갈 수 있는지**를 뜻한다. `elevator_only` 경로 옵션(§8.1)의 도달 가능 여부와 같은 기준이며, 두 값은 항상 일치해야 한다.

역삼역은 B1↔B2 구간에 엘리베이터가 없어 **3번·4번 출구(B2)만 `true`**이고, B1 출구 7개(1·2·5·6·7·8번·GFC몰 연결통로)는 `false`다.

이 값은 장소-출구 추천에서 "엘리베이터로 갈 수 있는 최근접 출구"를 고르는 후보 필터로 쓴다. 그래프에서 파생된 사실을 컬럼에 담은 것이므로, **간선을 바꾸는 마이그레이션에서는 이 플래그도 함께 다시 봐야 한다.**

---

## 5.3 시설 상세 조회

### GET `/api/facilities/{facilityId}`

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

## 5.4 출구 도착 판정

### POST `/api/facilities/{facilityId}/arrival-check`

사용자가 목적지로 정한 출구에 도착했는지 판정한다 (FR-U-011).

주변 출구를 훑지 않고 **요청받은 출구 하나만** 확인한다. 경로 안내의 끝에서 목적지가 이미 정해져 있는 상황을 전제하므로, 가까이 붙은 출구끼리 서로 오검출되지 않는다.

조회성 요청이지만 현재 위치를 본문으로 받으므로 POST를 쓴다.

#### Request

| 이름 | 타입 | 필수 | 설명 |
| ------- | ------ | ---- | ------------------------------ |
| floorId | number | Y | 현재 층 ID |
| mapX | number | Y | 현재 위치 X (캐노니컬 미터) |
| mapY | number | Y | 현재 위치 Y (캐노니컬 미터) |

```json
{
  "floorId": 3,
  "mapX": 100.354,
  "mapY": -39.875
}
```

좌표는 WebXR 상대 추적 결과나 위치 인식(VPS) 결과에서 온다. 층은 좌표로 유도하지 않고 현재 확정된 층을 그대로 보낸다.

**높이(z)는 받지 않는다.** 판정이 같은 층 안의 평면 거리로 이루어지고, 클라이언트가 높이를 추적하지 않기 때문이다.

#### Response

```json
{
  "success": true,
  "data": {
    "facilityId": 42,
    "nameKo": "6번 출구",
    "nameEn": "Exit 6",
    "floorId": 3,
    "arrived": true,
    "sameFloor": true,
    "distanceM": 4.12,
    "thresholdM": 10.0
  },
  "message": null
}
```

| 이름 | 타입 | 설명 |
| ---------- | ------- | ------------------------------------------------ |
| arrived | boolean | 도착 여부. **같은 층이고 거리가 임계값 이하**일 때만 true |
| sameFloor | boolean | 현재 위치와 출구가 같은 층인지 |
| distanceM | number | 출구까지의 평면 거리(m). 층이 다르면 `null` |
| thresholdM | number | 도착으로 판정하는 거리 임계값(m) |

#### 판정 규칙

```
층이 다르면            -> arrived = false (평면 거리와 무관)
같은 층이면 거리 = √((내X − 출구X)² + (내Y − 출구Y)²)
거리 ≤ thresholdM     -> arrived = true
```

층을 먼저 거르는 이유는 B1 출구 바로 아래 B2 지점이 평면상 가깝게 나오기 때문이다.

#### 임계값

기본 10m이며 `exit.arrival.threshold-m` 설정으로 바꿀 수 있다(환경변수 `EXIT_ARRIVAL_THRESHOLD_M`).

값의 범위가 좁다. **아래로는 위치 오차보다 커야 하고**(역삼역 B1 좌표 프레임이 미검증이라 최대 4.4m, provisional 축척에서 1~1.6m가 더해진다), **위로는 가장 가까운 출구 쌍의 절반보다 작아야 한다**(7번·8번 출구가 18.3m). 임계값이 오차보다 작으면 출구 앞에 서 있어도 도착이 뜨지 않는다.

B1 프레임이 확정되고 sim3 정합이 끝나면 5~6m로 조일 수 있다.

#### 오류

| 코드 | 상태 | 설명 |
| ------------------ | ---- | ------------------------ |
| FACILITY_NOT_FOUND | 404 | 시설이 없거나 비활성 |
| NOT_EXIT_FACILITY | 400 | 출구가 아닌 시설 |

#### 범위 밖

자동 판정이 어려울 때 사용자가 직접 `출구에 도착했어요`를 누르는 흐름은 클라이언트가 처리한다. 이 API는 판단만 제공하고 세션 상태를 바꾸지 않는다. 도착 후 외부 지도 연계는 §12(FR-U-012)를 쓴다.

---

## 6. 목적지 및 주변 장소 API

## 6.1 목적지 통합 검색

### GET `/api/destinations/search`

역 내부 시설과 역 주변 장소를 이름 키워드로 통합 검색한다. 활성 시설(`facility`)을 먼저, 이어서 활성 주변 장소(`place`)를 반환한다. `category`는 시설이면 `facilityType`, 장소면 장소 카테고리다.

#### Query

| 이름      | 타입   | 필수 | 설명                                    |
| --------- | ------ | ---- | --------------------------------------- |
| stationId | number | Y    | 역 ID                                   |
| keyword   | string | Y    | 검색어 (공백·누락 시 `INVALID_REQUEST`) |
| language  | string | N    | ko, en. **검색 결과를 바꾸지 않는다** — 두 이름 컬럼을 모두 보고 검색한다 |

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

### GET `/api/stations/{stationId}/places`

역 주변 장소 목록을 조회한다.

#### Query

| 이름     | 타입   | 필수 | 설명          |
| -------- | ------ | ---- | ------------- |
| category | string | N    | 장소 카테고리 |
| language | string | N    | ko, en. **응답을 바꾸지 않는다** |

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

### GET `/api/places/{placeId}/recommended-exits`

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

### POST `/api/vps/localize`

카메라 이미지 또는 프레임을 기반으로 사용자의 실내 위치를 인식한다.

#### Content-Type

```text
multipart/form-data
```

#### Request Parts

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| image | file | Y | 카메라 이미지. `image/jpeg`, `image/png`만 허용 |
| metadata | JSON | Y | 위치추정 요청 메타데이터 |

##### metadata

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| userSessionId | string | Y | 사용자 세션 ID |
| stationId | number | Y | 현재 역 ID |
| mapVersion | string | Y | AI 위치추정 맵 버전 |
| heading | number | N | 단말 방향 |
| capturedAt | string | N | 촬영 시각, ISO-8601 |
| camera | object | N | 카메라 내부 파라미터 |

##### camera

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| model | string | N | 카메라 모델. 예: `PINHOLE` |
| width | number | N | 촬영 이미지 너비(px) |
| height | number | N | 촬영 이미지 높이(px) |
| params | number[] | N | 카메라 내부 파라미터. 제공 시 4개 값 |
| intrinsicsSource | string | N | 카메라 내부 파라미터 출처 |

#### Response

```json
{
  "success": true,
  "data": {
    "requestId": "loc_01JABC",
    "resultStatus": "success",
    "mapVersion": "YS-2026-07-23.1",
    "position": {
      "floorId": 2,
      "floorCode": "B2",
      "mapX": -0.975,
      "mapY": 27.717,
      "mapZ": 0.0,
      "forwardMap": { "x": 0.930418, "y": -0.366501 },
      "accuracyM": 0.497
    },
    "startNodeId": 123,
    "startNodeLabel": "B2 · 대합실",
    "startNodeLabelEn": "B2 · Concourse",
    "fallbackOptions": [],
    "processingTimeMs": 2310
  },
  "message": null
}
```

#### 위치와 경로 진입 노드를 나눠 주는 이유

`position`은 **지도에 점으로 찍는 값**이다. 캐노니컬 미터 좌표(§5.1)이며 노드에 붙이지 않은 날 좌표다. 경로 노드는 20~30m 간격의 경유점이라 거기에 스냅해서 표시하면 실제 위치와 최대 10m 어긋난다.

`startNodeId`는 **경로 탐색 진입점**이다. `POST /api/routes/indoor/options`와 `/indoor`가 `startNodeId`를 요구하므로, `position`에서 가장 가까운 노드를 골라 함께 내려준다. 클라이언트는 그대로 넣어 쓰면 된다.

**다만 `position.mapX`·`mapY`도 함께 보내는 편이 낫다.** 여기서 고르는 노드는 목적지를 모르는 상태에서 거리만 보고 뽑은 것이라 목적지 반대쪽일 수 있고, 그러면 사용자가 뒤로 걷게 된다. 경로 API에 좌표를 실어 보내면 서버가 목적지까지의 총 거리로 다시 고른다. 자세한 것은 `POST /api/routes/indoor/options`의 `currentMapX` 설명에 있다.

`accuracyM`은 위치 정확도(m)이며 GPS 정확도 원처럼 쓰면 된다. **leave-one-out 평균**이다 — 기준점 위에서 잰 in-sample 잔차(B2 0.423 · B3 0.594)는 그 기준점으로 맞춘 값이라 낙관적이어서, 일반화 오차 쪽을 싣는다. 현재 값은 **B2 0.497 · B3 1.095**다.

`mapZ`는 그 층의 기준 높이이며 위치추정으로 얻은 값이 아니다. 정합 기준점이 모두 같은 층 바닥 높이라 높이 방향은 데이터가 결정해주지 않는다. 따라서 **같은 층 안에서 높이가 갈리는 구간(역삼역 B0.5, `map_z=7.5`)은 이 값으로 구분할 수 없다.**

#### `forwardMap` — 앵커 시점의 방향

**앵커를 잡은 순간 단말이 향한 방향**이다. `mapX`·`mapY`와 같은 캐노니컬 프레임의 **수평면 2D 단위벡터**이며 각도가 아니다.

FE가 WebXR 좌표를 지도에 정렬하려면 이 값이 필요하다(FE 좌표연동 스펙 §8.2·§8.5). FE는 같은 순간의 WebXR 전방(`forwardXr`)을 스스로 알고 있고, **둘의 각도 차가 XR↔지도 회전**이다. 그게 있어야 WebXR이 주는 이동량을 지도 위 이동으로 바꿀 수 있다. 지도 기준 방향은 VPS 포즈에만 들어 있어 클라이언트가 스스로 구할 수 없다.

| 항목 | 확정 |
| --- | --- |
| 위치 | `position` 안쪽. 좌표와 한 쌍이어야 의미가 있다 |
| 형태 | `{ "x": number, "y": number }`. 길이 1 |
| 정규화 | **백엔드가 한다.** 클라이언트가 다시 정규화할 필요 없다 |
| 축척 | 단위벡터라 캐노니컬 미터의 축척과 무관하다 |

**`null`일 수 있다.** AI가 회전(`rotationXyzw`)을 주지 않거나, 카메라가 바닥·천장을 정면으로 봐서 수평 방향이 정의되지 않을 때다. 이때도 **좌표는 그대로 채워진다** — 방향이 없으면 WebXR 정렬만 못 하고 지도에 위치를 찍는 것은 된다. 즉 `resultStatus`가 `success`라도 `forwardMap`은 `null` 검사가 필요하다.

방향이 틀려도 오류가 나지 않고 마커만 엉뚱한 쪽으로 움직인다. `null`이면 WebXR 정렬을 시작하지 않는 편이 안전하다.

#### 좌표 정합이 없는 층

`position`과 `startNodeId`는 **해당 역·층의 COLMAP 좌표 정합이 있을 때만** 채워진다. 현재 역삼역은 **B2·B3만** 정합돼 있고 **B1은 COLMAP 커버가 없다.**

**AI 위치 인식이 성공해도 앵커링을 못 하면 `resultStatus`가 `map_not_ready`로 내려간다.** `success`로 두면 좌표도 경로 진입점도 없는데 `fallbackOptions`까지 비어서 클라이언트가 갈 화면이 없어지기 때문이다. 즉 `success`면 `position`이 항상 채워져 있다고 보아도 된다.

앵커링이 실패하는 경우는 다음과 같다.

| 상황 | 예 |
| --- | --- |
| 해당 역·층의 정합 계수가 없음 | 역삼역 B1 |
| 요청한 역과 계수의 역이 다름 | 다른 역에서 `B2` 요청 |
| AI 가 카메라 중심을 주지 않음 | |
| 층이나 경로 노드를 찾지 못함 | |

#### 실패 또는 낮은 신뢰도 Response

위치 인식 요청 자체는 처리되었지만 현재 위치를 확정할 수 없는 경우에도 HTTP 200과 `success: true`를 반환한다.
프론트엔드는 `resultStatus`와 `fallbackOptions`를 기준으로 실패 화면(U-05) 또는 지도 수동 선택 화면(U-06)으로 분기한다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| requestId | string | 위치추정 요청 추적 ID |
| resultStatus | string | 위치 인식 처리 결과 |
| mapVersion | string | 위치추정에 사용된 AI 맵 버전 |
| position | object | 확정한 실내 위치(캐노니컬 미터). 확정하지 못했거나 해당 층 정합이 없으면 `null` |
| startNodeId | number | 경로 탐색 시작 노드 ID. 위치를 확정하지 못하면 `null` |
| startNodeLabel | string | 경로 시작 노드의 사용자용 한글 이름. 층과 공간 유형(대합실·승강장)으로 생성 |
| startNodeLabelEn | string | `startNodeLabel`과 같은 위치의 사용자용 영문 이름 |
| fallbackOptions | string[] | 사용자에게 제공할 대체 행동 목록 |
| processingTimeMs | number | AI 위치추정 처리 시간(ms). AI 호출 실패로 측정할 수 없으면 `null` 또는 생략 |

`position` 내부 필드.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| floorId | number | 층 ID |
| floorCode | string | 층 코드(`B1`·`B2`·`B3`) |
| mapX / mapY | number | 캐노니컬 좌표(m) |
| mapZ | number | 그 층의 기준 높이(m). 위치추정으로 얻은 값이 아니다 |
| forwardMap | object | 앵커 시점 단말이 향한 방향. `{ x, y }` 캐노니컬 수평면 단위벡터. **산출하지 못하면 `null`** |
| accuracyM | number | 위치 정확도(m). 정합의 leave-one-out 평균 |

##### resultStatus

| 값 | 의미 | 기본 fallbackOptions |
| --- | --- | --- |
| success | 위치를 확정함. `position`·`startNodeId` 가 채워진다 | - |
| low_confidence | 매칭 품질이 낮아 위치를 확정하지 못함. **`position`·`startNodeId` 는 `null`** 이며 `fallbackOptions` 로 분기한다 | `retry_capture`, `select_landmark`, `select_on_map`, `request_consultation` |
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
    "requestId": "loc_01JABC",
    "resultStatus": "low_confidence",
    "mapVersion": "YS-2026-07-23.1",
    "position": null,
    "startNodeId": null,
    "startNodeLabel": null,
    "fallbackOptions": [
      "retry_capture",
      "select_landmark",
      "select_on_map",
      "request_consultation"
    ],
    "processingTimeMs": 2310
  },
  "message": "위치를 정확히 찾지 못했습니다."
}
```

##### 매칭 실패 예시

```json
{
  "success": true,
  "data": {
    "requestId": "loc_01JABC",
    "resultStatus": "no_match",
    "mapVersion": "YS-2026-07-23.1",
    "position": null,
    "startNodeId": null,
    "startNodeLabel": null,
    "fallbackOptions": [
      "retry_capture",
      "select_landmark",
      "select_on_map",
      "request_consultation"
    ],
    "processingTimeMs": 2310
  },
  "message": "현재 위치와 일치하는 후보를 찾지 못했습니다."
}
```

##### AI 서버 장애 예시

```json
{
  "success": true,
  "data": {
    "requestId": "loc_01JABC",
    "resultStatus": "ai_server_unavailable",
    "mapVersion": "YS-2026-07-23.1",
    "position": null,
    "startNodeId": null,
    "startNodeLabel": null,
    "fallbackOptions": [
      "select_on_map",
      "request_consultation"
    ],
    "processingTimeMs": null
  },
  "message": "위치 인식 서버에 연결할 수 없습니다."
}
```

---

## 7.2 랜드마크 후보 조회

### GET `/api/stations/{stationId}/landmarks`

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

### POST `/api/localization/manual`

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

> **`language`** — 이용 불가 사유 문구(`unavailableMessage`)의 언어다. `ko`·`en`·`ja`·`zh` 중 하나이며 생략하면 `en`이다. 이 요청에는 세션 ID가 없어 서버가 사용자의 언어를 알 수 없으므로 클라이언트가 실어 보낸다. 목적지 검색·편의시설·역 검색 API의 `language`와 **형식이 같은 값**이지만, **경로 API에서만 응답이 실제로 달라진다** — 아래 표 참고. **현재 문구는 한국어와 영어만 있고 `ja`·`zh`는 영어로 내려간다**(FR-U-001 범위). 아래 `POST /api/routes/indoor`도 같다.
>
> | API | `language`가 응답을 바꾸는가 |
> | --- | --- |
> | 경로 옵션·경로 생성 | **예.** 서버가 `instruction`·`unavailableMessage` 문장을 이 언어로 조립한다 |
> | 역 검색 · 목적지 검색 · 시설 목록 · 주변 장소 | **아니오.** 이름을 `nameKo`·`nameEn`으로 **둘 다** 내려주고, 검색도 두 컬럼을 모두 본다 |
>
> 그래서 이름을 쓰는 API는 **조회 키에 언어를 넣을 필요가 없다.** 언어를 바꿔도 서버가 줄 내용이 같으므로 받은 것을 그대로 두고 표시할 이름만 고르면 된다. 키에 넣으면 언어를 바꿀 때마다 같은 결과를 다시 받는다. (S15P11A206-339)

출발 노드에서 도착 노드까지 가능한 경로 옵션을 조회한다. 도착지는 실내 노드 ID(`targetNodeId`)로 직접 지정하며, 외부 목적지 검색·출구 추천은 이 API 범위 밖이다. `waypointNodeIds`가 있으면 배열 순서대로 모든 경유지를 지난 뒤 도착지까지 이동하는 경로를 계산한다. 응답은 옵션별 요약이며 상세 `steps`·`pathNodes`는 포함하지 않는다.

#### Request

```json
{
  "stationId": 1,
  "startNodeId": 15,
  "targetNodeId": 44,
  "waypointNodeIds": [22, 31],
  "language": "en",
  "currentMapX": -34.897,
  "currentMapY": 23.328
}
```

> **`currentMapX`·`currentMapY`** — 위치추정이 준 사용자의 실제 좌표(`position.mapX`·`mapY`)다. **선택이며 둘 다 있어야 쓰인다.** 보내면 서버가 진입 노드를 목적지까지의 총 거리가 가장 짧은 것으로 다시 고른다. 보내지 않으면 `startNodeId`를 그대로 쓴다.
>
> `startNodeId`는 위치추정 시점에 정해지는데 그때는 목적지를 모르므로 **가장 가까운 노드**가 뽑힌다. 그 노드가 목적지 반대쪽이면 사용자를 뒤로 걷게 만든다. 역삼역 B3에서 3번 출구로 갈 때 실제로 그랬다 — 가장 가까운 노드로 가면 총 146.7m, 목적지 쪽 노드로 가면 134.4m로 12.3m 차이가 났다.
>
> 층은 `startNodeId`의 층을 쓴다. 후보는 그 층 노드로 한정한다.

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
      "unavailableMessage": null,
      "totalDistanceM": 180,
      "estimatedTimeSec": 240,
      "hasStairsOrEscalator": true
    },
    {
      "routeType": "elevator_only",
      "displayName": "엘리베이터 이용 경로",
      "available": false,
      "unavailableReason": "NO_ACCESSIBLE_ROUTE",
      "unavailableMessage": "The destination cannot be reached without using stairs or escalators.",
      "totalDistanceM": null,
      "estimatedTimeSec": null,
      "hasStairsOrEscalator": false
    }
  ],
  "message": null
}
```

`waypointNodeIds`는 선택 필드이며 생략하면 기존처럼 `startNodeId -> targetNodeId`만 계산한다. 최대 10개까지 보낼 수 있고, 출발지·도착지와 같은 역에 속하지 않는 경유지 노드는 `ROUTE_NODE_NOT_FOUND`로 거부한다.

이용 불가한 옵션도 목록에서 제외하지 않고 `available=false`와 `unavailableReason`으로 표현한다. `unavailableReason`은 `NO_ROUTE`(연결된 경로 없음) 또는 `NO_ACCESSIBLE_ROUTE`(계단·에스컬레이터 제외 시 도달 불가)이다. 경유지 요청에서는 어느 한 구간이라도 도달할 수 없으면 해당 옵션이 이용 불가로 내려간다. `unavailableMessage`는 같은 사유를 **요청 언어로 쓴 문구**이며 그대로 화면에 보여주면 된다. `unavailableReason`은 언어와 무관한 코드이므로 분기에는 이쪽을 쓴다. 이용 가능한 옵션은 둘 다 `null`이다. `estimatedTimeSec`은 경로상 모든 간선에 예상 시간이 있을 때만 채워지며, 하나라도 없으면 `null`이다.

`hasStairsOrEscalator`는 그 경로가 계단이나 에스컬레이터를 지나는지다(FR-U-009 "계단 포함 여부"). 상세 조회와 달리 옵션 조회에는 `steps`가 없어 클라이언트가 스스로 판단할 수 없으므로 함께 내려준다. `elevator_only`는 정의상 항상 `false`이고, `available=false`인 옵션도 `false`다. 실질적으로는 **`fastest`가 왜 `elevator_only`보다 짧은지를 설명하는 값**이다. 휠체어·유모차 기준으로는 에스컬레이터도 계단과 같은 장벽이라 하나로 묶는다.

---

## 8.2 경로 생성

### POST `/api/routes/indoor`

선택한 경로 옵션으로 실내 경로 상세를 생성한다. 도착지는 `targetNodeId`로 지정하며, `waypointNodeIds`가 있으면 배열 순서대로 경유지를 지난다. `routeType`이 `fastest`·`elevator_only`가 아니면 `UNSUPPORTED_ROUTE_TYPE`로 거부한다.

#### Request

```json
{
  "stationId": 1,
  "startNodeId": 15,
  "targetNodeId": 44,
  "waypointNodeIds": [22, 31],
  "routeType": "elevator_only",
  "language": "en",
  "currentMapX": -34.897,
  "currentMapY": 23.328
}
```

> **`currentMapX`·`currentMapY`** — 옵션 조회와 같다. **옵션 조회에서 보냈다면 여기서도 같은 값을 보내야** 옵션에서 본 거리와 상세 경로가 일치한다. 한쪽만 보내면 진입 노드가 달라져 총 거리가 어긋난다.
>
> 응답의 `startNodeId`는 **서버가 실제로 쓴 진입 노드**다. 좌표를 보내 다시 골랐다면 요청에 넣은 값과 다를 수 있다.

#### Response

```json
{
  "success": true,
  "data": {
    "routeType": "elevator_only",
    "displayName": "엘리베이터 이용 경로",
    "available": true,
    "unavailableReason": null,
    "unavailableMessage": null,
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
        "instruction": "30m 직진하세요.",
        "instructionTemplate": "{distance} 직진하세요.",
        "turn": "straight",
        "floorDelta": null
      }
    ],
    "pathNodes": [
      {
        "nodeId": 15,
        "floorId": 2,
        "mapX": 320.5,
        "mapY": 180.2,
        "mapZ": 0.0
      }
    ]
  },
  "message": null
}
```

도달할 수 없으면 `available=false`와 `unavailableReason`을 채우고 `steps`·`pathNodes`는 빈 배열로 반환한다. 경유지 요청에서는 어느 한 구간이라도 도달할 수 없으면 전체 경로를 이용 불가로 본다. `unavailableMessage`에는 같은 사유를 요청 언어로 쓴 문구가 들어간다. `mapX`·`mapY`는 실내 도면 렌더링용이며 경로 탐색 가중치에는 사용하지 않는다.

#### 단계별 안내 — `instruction`과 `turn`·`floorDelta`

**같은 것을 두 가지로 준다.** `instruction`을 그대로 화면에 써도 되고, `turn`·`floorDelta`를 보고 자기 문구와 아이콘을 만들어도 된다. 문장만 주면 언어가 서버에 묶여 `ja`·`zh`를 넣을 수 없고, 구조만 주면 지금 문장을 쓰고 있는 클라이언트가 깨진다.

| 필드 | 값 | 설명 |
| --- | --- | --- |
| `instruction` | 문장 | `language`에 따라 한국어 또는 영어. `ja`·`zh`는 영어로 내려간다 |
| `instructionTemplate` | 문장 | `instruction`과 같은 문장인데 거리 자리가 `{distance}`로 비어 있다. 아래 참고 |
| `turn` | `straight` · `left` · `right` · `around` | 이전 구간에서 이 구간으로 꺾이는 방향. **첫 단계이거나 구간이 너무 짧아 판단할 수 없으면 `null`이다** — `straight`와 구분된다 |
| `floorDelta` | 정수 | 오르내리는 층수. **위로 가면 양수.** 층 이동이 아니거나 층을 알 수 없으면 `null`. 같은 층 안의 계단이면 `0` |

`floorDelta`가 `0`인 경우는 역삼역 B1 개찰구 위 중간층으로 오르내리는 계단이다. 별도 층이 아니라 `floorId`가 B1이면서 `map_z=7.5`인 노드로 돼 있어 층 순서가 같다.

회전은 45도까지 직진, 150도를 넘으면 되돌아가는 것으로 본다. 경로 노드가 통로의 굽이를 따라 놓여 있어 걷는 사람이 회전이라고 느끼지 않는 완만한 꺾임이 많고, 그런 곳마다 안내가 나오면 오히려 헷갈린다.

**첫 단계에는 회전이 없다.** 사용자가 어느 방향을 보고 있는지는 위치추정 응답의 `position.forwardMap`에 있으나 이 요청에는 없다.

#### 한 단계가 간선 하나가 아니다

**연달아 직진하는 통로 구간은 한 단계로 묶여서 내려간다.** 간선 하나를 그대로 한 단계로 두면 긴 통로에서 같은 문장이 되풀이된다 — 역삼역 승강장은 복도 노드가 평균 7.7m 마다 있어 B3 서쪽 끝에서 8번 출구까지 `직진하세요`가 11번 연달아 나왔다. 노드가 있다는 것은 지도에 선을 그릴 꼭짓점이 있다는 뜻일 뿐이고 사용자가 거기서 무엇을 하지 않는다.

```
묶기 전                      묶은 뒤
1. 23m 직진하세요.            1. 197m 직진하세요.
2. 27m 직진하세요.            2. 계단으로 한 층 올라가세요.
3. 18m 직진하세요.            3. 36m 직진하세요.
   ... 11번 반복
4. 계단으로 한 층 올라가세요.
```

묶인 단계의 필드는 이렇게 채워진다.

| 필드 | 값 |
| --- | --- |
| `fromNodeId` | 묶인 구간의 **첫** 노드 |
| `toNodeId` | 묶인 구간의 **마지막** 노드 |
| `distanceM` | 묶인 간선들의 거리 합 |
| `estimatedTimeSec` | 시간 합. **하나라도 없으면 `null`** — 있는 것만 더하면 실제보다 짧은 수가 나가는데 받는 쪽은 부분 합인지 알 수 없다 |
| `turn` | 묶인 구간 **전체의 방향**(현) 기준. 첫 간선만 보고 판단하지 않는다 |

네 조건을 모두 만족할 때만 묶는다. ① 양쪽 다 `walkway` ② 직전 구간에서 45도 넘게 꺾이지 않음 ③ 구간의 첫 방향에서도 45도를 넘지 않음 ④ `map_z`가 같음.

③이 없으면 45도 미만으로 조금씩 꺾이는 길이 끝없이 묶인다 — 42도씩 세 번이면 126도를 돈 길이 직진 한 문장이 된다. ④는 역삼역 B1 중간층 방어다.

**`pathNodes`는 묶지 않는다.** 지도가 꼭짓점을 다 필요로 하므로 경로가 지나는 모든 노드가 그대로 들어간다. 그래서 `steps`의 개수와 `pathNodes`의 개수는 **일치하지 않는다.**

#### 걷는 동안 남은 거리 — `instructionTemplate`

묶은 결과 한 단계가 길어졌다. 그래서 `instruction`에 박힌 거리와 사용자가 실제로 남긴 거리가 크게 벌어진다 — 197m 구간을 절반 걸어도 문장은 계속 `197m 직진하세요`이고, 걷고 있는데 숫자가 그대로면 아무 일도 일어나지 않는 것처럼 보인다.

`instructionTemplate`은 **같은 문장에서 거리 자리만 `{distance}`로 비운 것**이다. 클라이언트가 남은 거리로 채워 쓴다.

```
instruction         : "197m 직진하세요."
instructionTemplate : "{distance} 직진하세요."
                       ↓ 남은 거리로 채운다
화면                : "164m 직진하세요."
```

**거리를 클라이언트가 문장 앞에 붙이는 방법은 쓸 수 없다.** 숫자 위치가 언어마다 다르다.

| 언어 | `instruction` | `instructionTemplate` |
| --- | --- | --- |
| `ko` 직진 | `197m 직진하세요.` | `{distance} 직진하세요.` |
| `ko` 회전 | `오른쪽으로 돌아 5m 이동하세요.` | `오른쪽으로 돌아 {distance} 이동하세요.` |
| `en` 직진 | `Go straight for 197m.` | `Go straight for {distance}.` |
| `en` 회전 | `Turn right and go 5m.` | `Turn right and go {distance}.` |
| 층 이동·개찰구 | `계단으로 한 층 올라가세요.` | 같은 값 (`{distance}` 없음) |

**거리가 들어가지 않는 문장은 `instruction`과 같은 값이다.** 층 이동과 개찰구가 그렇다. 자리가 있는지는 `{distance}` 포함 여부로 보면 되고, 없으면 거리를 따로 표시해야 한다.

`instruction`은 그대로 둔다. 문장을 그냥 쓰는 클라이언트는 손댈 것이 없다.

`mapZ`는 그 노드의 캐노니컬 높이(m)다. **같은 층 안에서 높이가 갈리는 구간을 구분하는 데 쓴다** — 역삼역 B0.5 중간층은 별도 층이 아니라 `floorId`가 B1이면서 `map_z=7.5`인 노드 6개로 돼 있어, 이 값이 없으면 바닥 구간과 중간층 구간이 도면 위 같은 평면에 겹쳐 그려진다. **관리자가 높이를 넣지 않은 노드는 `null`이다.**

---

## 9. 외부 지도 연계 API

## 9.1 카카오맵 길찾기 링크 생성

### POST `/api/external-maps/directions`

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

### POST `/api/consultations`

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

### GET `/api/consultations/{consultationId}`

사용자가 상담 요청 상태를 확인한다.

#### Response

```json
{
  "success": true,
  "data": {
    "consultationId": "cs_abc123",
    "status": "ACCEPTED",
    "counselorId": 7,
    "signalingRoomId": "room_cs_abc123",
    "signalingAccessToken": "signaling-token"
  },
  "message": null
}
```

---

## 10.3 상담 요청 취소

### DELETE `/api/consultations/{consultationId}`

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

## 10.4 상담 대기 상태 SSE 구독

### GET `/api/consultations/{consultationRequestId}/waiting-events`

상담 요청 ID 기준으로 상담 대기 상태 변경 이벤트를 Server-Sent Events로 구독한다.

#### 인증

비로그인 접근 허용

#### Path Variables

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `consultationRequestId` | string | Y | 상담 요청 ID |

#### Response

`text/event-stream`

#### Event Name

| 이벤트 | 설명 |
| --- | --- |
| `INIT` | SSE 연결 완료 확인 |
| `WAITING` | 상담자를 기다리는 중 |
| `ACCEPTED` | 상담자가 요청을 수락함 |
| `REJECTED` | 상담자가 요청을 거절함 |
| `CANCELED` | 사용자가 상담 요청을 취소함 |
| `NO_COUNSELOR` | 상담 가능한 상담자가 없음 |
| `FALLBACK` | WebRTC 영상·음성·채팅 fallback 상태 변경 |
| `DATA_CHANNEL` | DataChannel fallback 상담 이벤트 |

WebRTC fallback 이벤트는 별도 SSE endpoint를 만들지 않고 이 구독 채널로 전달한다. 현재 구현에서는 fallback 상세 상태를 `message`에 담고, `type`은 `FALLBACK`으로 전달한다.
DataChannel fallback 이벤트도 별도 SSE endpoint를 만들지 않고 이 구독 채널로 전달한다. 이 경우 SSE event name은 `DATA_CHANNEL`이고, event data는 DataChannel 이벤트 응답 구조를 따른다.

#### Event Data

```json
{
  "consultationRequestId": "consultation-1",
  "type": "ACCEPTED",
  "signalingRoomId": "room-1",
  "message": "상담자가 요청을 수락했습니다.",
  "timestamp": "2026-07-29T00:00:00Z"
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `consultationRequestId` | string | Y | 상담 요청 ID |
| `type` | string | Y | 상담 대기 이벤트 타입 |
| `signalingRoomId` | string | N | WebRTC signaling room ID. `ACCEPTED` 이벤트에서만 전달 |
| `message` | string | Y | 사용자 표시 메시지 |
| `timestamp` | string | Y | 이벤트 생성 시각 |

#### 비고

- 클라이언트는 상담 대기 화면 진입 시 이 SSE endpoint를 구독한다.
- 서버는 구독 직후 연결 확인을 위해 `INIT` 이벤트와 `connected` 데이터를 전송한다.
- `ACCEPTED` 이벤트를 받으면 `signalingRoomId`를 사용해 `/ws/signaling` WebSocket signaling에 참여한다.
- WebRTC 영상·음성 연결 실패 또는 채팅 전환 요청은 `POST /api/consultations/{consultationRequestId}/fallback-events`로 신고하고, 구독 중인 클라이언트는 이 SSE endpoint에서 전환 안내 메시지를 수신한다.
- DataChannel 실패 시 화살표, 안내 메시지, 목적지 변경 이벤트는 `POST /api/consultations/{consultationRequestId}/data-channel-events`로 신고하고, 구독 중인 클라이언트는 이 SSE endpoint에서 `DATA_CHANNEL` 이벤트로 수신한다.
- 연결이 끊기면 클라이언트는 동일한 `consultationRequestId`로 재구독할 수 있다.

---

## 10.5 WebRTC Fallback 이벤트 발행

### POST `/api/consultations/{consultationRequestId}/fallback-events`

WebRTC 상담 중 영상 연결 실패, 음성 상담 전환, 채팅 상담 전환 같은 fallback 상태를 서버에 알린다.

서버는 요청을 수신하면 내부 fallback 이벤트를 발행하고, 상담 대기 SSE 구독자에게 전환 상태 메시지를 전달한다.

#### 인증

비로그인 접근 허용

#### Path Variables

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `consultationRequestId` | string | Y | 상담 요청 ID |

#### Request

```json
{
  "type": "VIDEO_FAILED",
  "reason": "camera permission denied"
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `type` | string | Y | fallback 이벤트 타입 |
| `reason` | string | N | fallback 발생 사유 또는 클라이언트 진단 메시지 |

#### Fallback Event Type

| 값 | 설명 |
| --- | --- |
| `VIDEO_FAILED` | 영상 연결 또는 화면 공유 연결 실패 |
| `AUDIO_ONLY_REQUESTED` | 음성 상담으로 전환 요청 |
| `AUDIO_FAILED` | 음성 연결 실패 |
| `CHAT_ONLY_REQUESTED` | 채팅 상담으로 전환 요청 |
| `FALLBACK_CONFIRMED` | fallback 상담 방식 전환 확정 |

#### Response

```json
{
  "success": true,
  "data": null,
  "message": null
}
```

#### 실패 응답

`type` 누락 또는 지원하지 않는 enum 값은 `INVALID_REQUEST`로 응답한다.

```json
{
  "success": false,
  "data": null,
  "message": "요청 형식이 올바르지 않습니다.",
  "code": "INVALID_REQUEST"
}
```

#### SSE 전달 예시

```json
{
  "consultationRequestId": "consultation-1",
  "type": "FALLBACK",
  "signalingRoomId": null,
  "message": "영상 연결에 실패했습니다. 음성 상담으로 전환을 시도합니다.",
  "timestamp": "2026-07-30T00:00:00Z"
}
```

---

## 10.6 DataChannel Fallback 이벤트 발행

### POST `/api/consultations/{consultationRequestId}/data-channel-events`

DataChannel 연결 실패 또는 보조 전달이 필요한 경우 화살표, 안내 메시지, 목적지 변경 이벤트를 서버에 알린다.

서버는 요청을 수신하면 내부 DataChannel fallback 이벤트를 발행하고, 상담 대기 SSE 구독자에게 `DATA_CHANNEL` 이벤트로 전달한다.

#### 인증

비로그인 접근 허용

#### Path Variables

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `consultationRequestId` | string | Y | 상담 요청 ID |

#### Request

```json
{
  "type": "GUIDE_MESSAGE_SENT",
  "payload": {
    "message": "왼쪽으로 이동하세요."
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `type` | string | Y | DataChannel fallback 이벤트 타입 |
| `payload` | object | N | 이벤트별 상세 데이터 |

#### DataChannel Event Type

| 값 | 설명 |
| --- | --- |
| `ARROW_POINTED` | 상담자가 특정 방향 또는 위치를 화살표로 지시함 |
| `GUIDE_MESSAGE_SENT` | 상담자가 안내 메시지를 전송함 |
| `DESTINATION_CHANGE_REQUESTED` | 상담자가 목적지 변경을 요청함 |
| `DRAW_STROKE_START` | 상담자가 공유 화면 위에 선을 그리기 시작함 |
| `DRAW_STROKE_MOVE` | 그리는 중인 선의 좌표가 이어짐 |
| `DRAW_STROKE_END` | 선 하나를 다 그림 |
| `DRAW_CLEAR` | 그린 선을 모두 지움 |
| `MAP_SYNC` | 사용자가 보고 있는 지도(역·층·현재 위치·경로)를 상담자 화면에 전달함 |
| `CURRENT_LOCATION_CORRECTED` | 상담자가 지도에서 사용자의 실제 위치를 짚어 바로잡음 |

#### Response

```json
{
  "success": true,
  "data": null,
  "message": null
}
```

#### 실패 응답

`type` 누락 또는 지원하지 않는 enum 값은 `INVALID_REQUEST`로 응답한다.

```json
{
  "success": false,
  "data": null,
  "message": "요청 형식이 올바르지 않습니다.",
  "code": "INVALID_REQUEST"
}
```

#### SSE 전달 예시

Event Name: `DATA_CHANNEL`

```json
{
  "consultationRequestId": "consultation-1",
  "type": "GUIDE_MESSAGE_SENT",
  "payload": {
    "message": "왼쪽으로 이동하세요."
  },
  "timestamp": "2026-07-30T00:00:00Z"
}
```

---

## 10.7 상담 만족도 평가

### POST `/api/consultations/{consultationId}/rating`

사용자가 종료된 상담에 대해 1~5점의 만족도를 남긴다. 평가는 선택 사항이다.

#### 인증

비로그인 접근 허용. 본문의 `userSessionId`가 해당 상담을 요청한 세션과 일치해야 한다.

#### Request

```json
{
  "userSessionId": "usr_9f3a2b",
  "score": 5
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `userSessionId` | string | Y | 상담을 요청한 사용자 세션 ID |
| `score` | number | Y | 만족도 점수. 1~5 정수 |

#### Response

```json
{
  "success": true,
  "data": {
    "consultationId": "cs_abc123",
    "score": 5,
    "ratedAt": "2026-07-31T05:20:00Z"
  },
  "message": null
}
```

#### Error

| 상황 | HTTP | code |
| --- | --- | --- |
| 존재하지 않는 상담 | 404 | `CONSULTATION_NOT_FOUND` |
| 상담을 요청한 세션이 아님 | 403 | `CONSULTATION_SESSION_MISMATCH` |
| `ENDED` 상태가 아닌 상담 | 409 | `CONSULTATION_NOT_ENDED` |
| 이미 평가한 상담 | 409 | `CONSULTATION_ALREADY_RATED` |
| `score`가 1~5 범위 밖 | 400 | `INVALID_RATING_SCORE` |

#### 비고

- 평가는 상담당 1회만 가능하며 수정·취소할 수 없다.
- 평가 결과는 상담자 통계 집계에만 사용한다.
- 사용자 세션이 만료된 뒤에는 평가할 수 없으므로 상담 종료 화면에서 즉시 평가를 유도한다.

---

## 10.8 상담 자막 번역

### POST `/api/consultations/{consultationId}/translate`

상담 중 오가는 실시간 자막 한 줄을 상대 언어로 옮긴다. 사용자와 상담자가 서로 다른 언어를 쓰는 상황을 기본 전제로 한다(WebRTC Signaling 이벤트 명세서 13.2).

STT는 각 클라이언트가 브라우저에서 수행하고, 확정된 문장만 이 API로 보낸다. 말하는 도중의 중간 결과까지 보내면 요청이 초당 수 회 발생하고 화면의 글자도 계속 바뀌어 읽을 수 없다.

#### 인증

인증이 필요 없는 공개 API다. 사용자는 로그인하지 않으므로 토큰을 요구할 수 없다. 경로의 상담 식별자는 어느 상담에서 나온 요청인지 추적하기 위한 것이다.

#### Request

```json
{
  "text": "3번 출구는 왼쪽입니다",
  "targetLanguage": "en"
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `text` | string | Y | 옮길 문장. 최대 1000자 |
| `targetLanguage` | string | Y | 표시 언어. `ko`, `en`, `ja`, `zh`. `en-US`처럼 지역이 붙어도 언어만 본다 |

#### Response

`200 OK`

```json
{
  "success": true,
  "data": {
    "text": "Exit 3 is on the left",
    "targetLanguage": "en",
    "translated": true
  },
  "message": null
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `text` | string | 옮긴 문장. 옮기지 못했으면 원문 |
| `targetLanguage` | string | 실제로 적용한 언어 코드 |
| `translated` | boolean | 옮겼으면 true, 원문을 그대로 돌려줬으면 false |

#### 오류

| 상황 | HTTP | code |
| --- | --- | --- |
| `text`가 비었거나 1000자 초과 | 400 | `INVALID_REQUEST` |
| `targetLanguage`가 비었거나 16자 초과 | 400 | `INVALID_REQUEST` |

#### 비고

- **번역에 실패해도 200을 반환하고 원문을 돌려준다.** 오류로 응답하면 화면이 자막 자체를 띄우지 못해, 상대가 무슨 말을 했는지조차 알 수 없게 된다. 실패는 `translated: false`로 구분한다.
- 지원하지 않는 언어도 같은 이유로 오류가 아니라 원문을 돌려준다.
- 번역 모델은 상담 요약과 같은 GMS 엔드포인트를 쓰되 대기 시간을 짧게 잡는다(`translation.api.read-timeout-ms`). 늦게 도착한 번역은 이미 다음 말이 지나가 쓸모가 없다.

---

## 11. 상담자 API

## 11.1 상담자 로그인

로그인은 상담자/관리자 공통 통합 로그인 API(`POST /api/auth/login`, 2.8절 참고)를 사용한다. 별도의 `/counselors/login` 엔드포인트는 존재하지 않는다.

---

## 11.2 상담 요청 목록 조회

### GET `/api/counselors/consultations`

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
      "currentNodeId": 101,
      "currentLocationLabel": "B2 개찰구 앞",
      "destinationType": "place",
      "destinationId": 3,
      "destinationLabel": "COEX Mall",
      "requestedAt": "2026-07-16T03:00:00Z"
    }
  ],
  "message": null
}
```

`status`를 지정하지 않으면 담당 역의 모든 상담을 반환한다. 상담자 콘솔의 요청 목록과 상담 이력이 같은 응답을 사용한다.

`currentLocationLabel`, `destinationLabel`은 route_node-facility 연결이 정리되기 전까지 식별자 기반 임시 문자열(`Node 101`, `place 3`)이며, 좌표·시설 연결 이후 실제 명칭으로 바뀐다.

---
## 11.3 상담 요청 상세 조회

### GET `/api/counselors/consultations/{consultationId}`

상담자가 담당 역의 상담 요청 상세를 조회한다.

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
"stationId": 1,
"problemType": "CANNOT_FIND_EXIT",
"status": "ACCEPTED",
"currentLocationLabel": "B2 개찰구 앞",
"destinationLabel": "COEX Mall",
"videoConsent": true,
"audioConsent": true,
"requestedAt": "2026-07-16T03:00:00Z",
"signalingRoomId": "room_cs_abc123",
"signalingAccessToken": "signaling-token"
},
"message": null
}
```

`signalingRoomId`/`signalingAccessToken`은 상담이 `ACCEPTED`/`IN_PROGRESS`이고 **조회한 상담자가 실제로 배정된 상담자 본인일 때만** 값이 채워진다. 같은 역의 다른 상담자가 조회하면 나머지 필드(상태·문제유형 등)는 그대로 보이되 두 필드는 `null`로 반환된다 — 통화 참여 자격증명을 배정자 본인에게만 한정하기 위함이다.

#### Error

| 상황 | HTTP | code |
| --- | --- | --- |
| 존재하지 않는 상담 | 404 | `CONSULTATION_NOT_FOUND` |
| 담당 역 상담자가 아님 | 403 | `CONSULTATION_STATION_MISMATCH` |

--- 
## 11.4 상담 수락

### POST `/api/consultations/{consultationId}/accept`

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
    "signalingRoomId": "room_cs_abc123",
    "signalingAccessToken": "signaling-token"
  },
  "message": null
}
```

상담 수락은 상담자 상태가 `AVAILABLE`일 때만 가능하다. 수락이 성공하면 Backend는 해당 상담자의 상태를 `BUSY`로 변경한다. 수락 실패 시 상담자 상태는 변경하지 않는다.

---

## 11.5 상담 거절

### POST `/api/consultations/{consultationId}/reject`

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

## 11.6 상담 종료

### POST `/api/consultations/{consultationId}/end`

상담자가 수락한 상담을 종료한다.

#### Header

```http
Authorization: Bearer {accessToken}
```

요청 본문은 사용하지 않는다.

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

#### Error

| 상황 | HTTP | code |
| --- | --- | --- |
| 존재하지 않는 상담 | 404 | `CONSULTATION_NOT_FOUND` |
| `ACCEPTED`, `IN_PROGRESS`가 아닌 상담 | 409 | `CONSULTATION_NOT_ENDABLE` |
| 담당 역 상담자가 아님 | 403 | `CONSULTATION_STATION_MISMATCH` |
| 수락한 상담자가 아님 | 403 | `CONSULTATION_COUNSELOR_MISMATCH` |

상담 종료가 성공하면 Backend는 해당 `signalingRoomId`의 WebSocket room을 정리하고, 남아 있는 WebSocket session을 `4400 Signaling Room Closed`로 종료한다.
상담 종료가 성공하면 Backend는 상담자의 상태를 `AVAILABLE`로 복귀시킨다. 종료 실패 시 상담자 상태는 변경하지 않는다.

---

## 11.7 상담 전문 저장 및 요약 생성 요청

### POST `/api/consultations/{consultationId}/transcript`

상담자가 종료된 상담의 STT 전문과 안내 정보를 저장한다. Backend는 저장 직후 응답하고, 상담 요약은 백그라운드에서 비동기로 생성한다.

#### Header

```http
Authorization: Bearer {accessToken}
```

#### Request

```json
{
  "transcript": [
    { "seq": 1, "speaker": "USER", "content": "지금 여기가 어딘지 모르겠어요." },
    { "seq": 2, "speaker": "COUNSELOR", "content": "주변에 12번 기둥 보이시나요?" }
  ],
  "startLocationLabel": "B1 대합실 12번 기둥 부근",
  "guidedExitFacilityId": 25,
  "guidedExitLabel": "7번 출구",
  "routeType": "elevator_only"
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `transcript` | array | 조건부 | STT 발화 기록. 최초 저장 시 필수(1~500개). 재시도 호출에서는 생략한다 |
| `transcript[].seq` | number | Y | 발화 순서. 1부터 시작하며 상담 내 중복 불가 |
| `transcript[].speaker` | string | Y | `USER`, `COUNSELOR` 중 하나 |
| `transcript[].content` | string | Y | 발화 내용. 최대 2000자 |
| `startLocationLabel` | string | N | 상담 중 확정된 실제 출발 위치 라벨. 최대 200자 |
| `guidedExitFacilityId` | number | N | 안내한 출구의 시설 ID |
| `guidedExitLabel` | string | N | 안내한 출구 라벨. 최대 100자 |
| `routeType` | string | N | `fastest`, `elevator_only` 중 하나 |

요약 문장은 Backend가 전문을 근거로 생성한다. 라벨과 경로 옵션은 상담자 클라이언트가 보유한 값을 그대로 전달하며 생성 모델이 추론하지 않는다.

라벨 필드는 저장 시점의 표시 문자열을 스냅샷한다. `route_node`·`facility` 재시딩으로 ID가 변경되어도 과거 상담 이력이 깨지지 않게 하기 위함이다.

#### Response

`202 Accepted`

```json
{
  "success": true,
  "data": {
    "consultationId": "cs_abc123",
    "status": "PENDING"
  }
}
```

#### Error

| 상황 | HTTP | code |
| --- | --- | --- |
| 존재하지 않는 상담 | 404 | `CONSULTATION_NOT_FOUND` |
| 담당 역 상담자가 아님 | 403 | `CONSULTATION_STATION_MISMATCH` |
| 상담을 수락한 상담자가 아님 | 403 | `CONSULTATION_COUNSELOR_MISMATCH` |
| `ENDED` 상태가 아닌 상담 | 409 | `CONSULTATION_NOT_ENDED` |
| 이미 전문이 저장된 상담 | 409 | `CONSULTATION_SUMMARY_ALREADY_EXISTS` |
| `transcript`가 비어 있음 | 400 | `EMPTY_TRANSCRIPT` |
| `seq` 중복 또는 500개 초과 | 400 | `INVALID_REQUEST` |
| 지원하지 않는 `routeType` | 400 | `UNSUPPORTED_ROUTE_TYPE` |

#### 비고

- 전문 저장과 요약 생성은 분리된다. 요약 생성에 실패해도 전문은 보존되며 상태만 `FAILED`가 된다.
- 상담당 1건만 저장되며, `consultation_summary.consultation_id`의 UNIQUE 제약으로 보장한다.
- 전문과 요약은 상담자 전용 정보이며 사용자(관광객) 응답에는 포함하지 않는다.
- 요약 생성이 `FAILED`인 상담은 같은 endpoint를 본문 `{}`로 다시 호출해 재시도한다. 저장된 전문을 그대로 사용하므로 전문을 다시 보내지 않으며, 상태만 `PENDING`으로 돌아간다.
- `PENDING`이나 `COMPLETED` 상태에서 다시 호출하면 `CONSULTATION_SUMMARY_ALREADY_EXISTS`(409)를 반환한다. 재시도는 `FAILED`에서만 가능하다.

---

## 11.8 상담 요약 조회

### GET `/api/consultations/{consultationId}/summary`

상담자가 상담 요약과 STT 전문을 조회한다. 상담 이력 상세 화면에 필요한 정보를 한 번에 반환하며, 요약 생성이 끝나지 않았어도 `status`와 전문을 반환한다.

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
    "status": "COMPLETED",
    "counselorName": "김상담",
    "endedAt": "2026-07-18T09:24:00Z",
    "language": "ko",
    "summaryText": "12번 기둥 랜드마크로 위치를 재지정하고 엘리베이터 경로로 7번 출구까지 안내 완료",
    "startLocationLabel": "B1 대합실 12번 기둥 부근",
    "guidedExitFacilityId": 25,
    "guidedExitLabel": "7번 출구",
    "routeType": "elevator_only",
    "transcript": [
      { "seq": 1, "speaker": "USER", "content": "지금 여기가 어딘지 모르겠어요." },
      { "seq": 2, "speaker": "COUNSELOR", "content": "주변에 12번 기둥 보이시나요?" }
    ],
    "createdAt": "2026-07-18T09:26:00Z",
    "completedAt": "2026-07-18T09:26:04Z"
  }
}
```

`counselorName`, `endedAt`, `language`는 각각 `account`, `consultation_session`, `user_session`에서 조회한 값이다.

`status`가 `PENDING`이나 `FAILED`이면 `summaryText`와 `completedAt`은 `null`이다. 클라이언트는 `PENDING`일 때 3초 간격으로 최대 10회까지 재조회하고, 그 이후에도 `PENDING`이면 안내 문구를 표시한다.

#### status 값

| 값 | 설명 |
| --- | --- |
| PENDING | 요약 생성 중 |
| COMPLETED | 요약 생성 완료 |
| FAILED | 요약 생성 실패 |

#### Error

| 상황 | HTTP | code |
| --- | --- | --- |
| 존재하지 않는 상담 | 404 | `CONSULTATION_NOT_FOUND` |
| 담당 역 상담자가 아님 | 403 | `CONSULTATION_STATION_MISMATCH` |
| 전문이 저장되지 않은 상담 | 404 | `CONSULTATION_SUMMARY_NOT_FOUND` |

#### 비고

- 저장과 달리 조회는 같은 역 상담자면 모두 허용한다. 상담 인수인계 시 다른 상담자가 이전 상담 이력을 확인할 수 있어야 하기 때문이다.

---

## 11.9 상담자 본인 계정 조회

### GET `/api/counselors/me`

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

## 11.10 상담자 본인 계정 수정

### PATCH `/api/counselors/me`

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

## 12. WebRTC Signaling API

WebRTC signaling은 WebSocket 기반으로 구현한다. 상세 계약의 단일 기준은
[`WebRTC_Signaling_이벤트_명세서.md`](WebRTC_Signaling_이벤트_명세서.md)이다.

Backend는 `JOIN` 요청의 `sessionId`를 `room_{consultationId}` 형식으로 해석하고, 해당 상담 session이 `ACCEPTED` 또는 `IN_PROGRESS` 상태일 때만 room 입장을 허용한다. 미수락, 종료, 취소, 거절, 실패 상태의 상담 session은 `INVALID_SIGNALING_SESSION` 오류로 응답한다.

## 12.1 ICE 서버 설정 조회

### GET `/api/webrtc/ice-servers?token={signalingAccessToken}`

WebRTC `RTCPeerConnection` 생성에 필요한 ICE server 설정을 조회한다. 계정 JWT는 필요하지 않지만, 상담별 `signalingAccessToken`이 필요하다.

브라우저 환경에서는 query parameter 전달을 기본 방식으로 사용한다.

```text
GET /api/webrtc/ice-servers?token={signalingAccessToken}
```

header 지정이 가능한 클라이언트는 HTTP API와 동일하게 `Authorization` header를 사용할 수 있다.

```http
Authorization: Bearer {signalingAccessToken}
```

TURN 서버 정보는 운영 환경변수로 설정하며, credential이 설정되지 않은 경우 STUN 서버만 응답한다. TURN credential은 코드와 문서에 하드코딩하지 않는다.

#### Response

```json
{
  "success": true,
  "data": {
    "iceServers": [
      {
        "urls": ["stun:stun.l.google.com:19302"]
      },
      {
        "urls": ["turn:turn.example.com:3478?transport=udp"],
        "username": "turn-username",
        "credential": "turn-credential"
      }
    ]
  },
  "message": null
}
```

#### 환경변수

| 변수 | 설명 | 기본값 |
| --- | --- | --- |
| `WEBRTC_STUN_URLS` | STUN URL 목록. 쉼표로 여러 값을 전달할 수 있다. | `stun:stun.l.google.com:19302` |
| `WEBRTC_TURN_URLS` | TURN URL 목록. 쉼표로 여러 값을 전달할 수 있다. | 없음 |
| `WEBRTC_TURN_USERNAME` | TURN username | 없음 |
| `WEBRTC_TURN_CREDENTIAL` | TURN credential | 없음 |

#### 실패 응답

| 상태 코드 | 조건 |
| --- | --- |
| 401 | signaling token 누락, 만료, 변조, 형식 오류 |

---

## 12.2 WebSocket 연결

### WS `/ws/signaling?token={signalingAccessToken}`

#### 인증

WebSocket handshake 시 상담별 signaling token을 전달한다.

```text
ws://localhost:8080/ws/signaling?token={signalingAccessToken}
```

브라우저 환경에서 header 지정이 가능한 클라이언트는 HTTP API와 동일하게 `Authorization` header를 사용할 수 있다.

```http
Authorization: Bearer {signalingAccessToken}
```

token payload와 JOIN message는 아래 조건을 만족해야 한다.

| token senderType | 식별 기준 | JOIN 조건 |
| --- | --- | --- |
| `USER` | `consultationId`, `userSessionId` | token의 `consultationId`와 JOIN `sessionId`가 같은 상담을 가리켜야 하며, token의 senderType과 JOIN `senderType`이 `USER`로 일치해야 한다. |
| `COUNSELOR` | `consultationId`, `accountId` | token의 `consultationId`와 JOIN `sessionId`가 같은 상담을 가리켜야 하며, token의 senderType과 JOIN `senderType`이 `COUNSELOR`로 일치해야 한다. |

토큰이 없거나, 만료되었거나, JOIN message와 payload가 일치하지 않으면 Backend는 room에 등록하지 않고 `INVALID_SIGNALING_SESSION` 또는 `SIGNALING_INTERNAL_ERROR` 오류를 응답한다.

#### 메시지 타입

`JOIN`, `OFFER`, `ANSWER`, `ICE_CANDIDATE`, `LEAVE`, `ERROR`를 사용한다.
room과 역할은 query parameter가 아니라 모든 메시지의 `sessionId`, `senderType`으로 전달한다. query parameter의 `token`은 handshake 인증에만 사용한다.

#### 예시 메시지

```json
{
  "sessionId": "room_cs_abc123",
  "senderType": "USER",
  "type": "OFFER",
  "payload": {
    "sdp": "..."
  },
  "timestamp": "2026-07-30T00:00:00Z"
}
```

---

## 12.3 DataChannel 이벤트(계약, Frontend 미구현)

WebRTC 연결 후 상담자 조작 정보를 DataChannel로 전달하는 것이 목표다. 현재 Frontend에는
`RTCDataChannel` 송수신이 연결되지 않았으므로 상세 이벤트는
[`WebRTC_DataChannel_이벤트_명세서.md`](WebRTC_DataChannel_이벤트_명세서.md)의 계획 계약으로 관리한다.

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

로그인은 상담자/관리자 공통 통합 로그인 API(`POST /api/auth/login`, 2.8절 참고)를 사용한다. 별도의 `/admins/login` 엔드포인트는 존재하지 않는다.

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
  "spaceType": "concourse",
  "floorOrder": 2
}
```

`spaceType`은 `concourse`(대합실), `platform`(승강장), `station_interior`(기타 역사 내부) 중 하나다.
등록 시 생략하면 `station_interior`, 수정 시 생략하면 기존 값을 유지한다. 위치 인식 결과의 사용자용
출발지 라벨은 층 코드가 아니라 이 값을 기준으로 생성한다.

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

### POST `/api/admin/floors/{floorId}/maps`

층별 지도 이미지를 업로드한다. 파일은 서버 정적 디렉토리에 저장하고 DB에는 상대 URL(`/uploads/maps/{fileName}`)을 저장한다. 같은 층에 이미 활성 지도가 있으면 자동으로 비활성화하고 새 지도를 활성 지도로 등록한다. `version`은 `v1`, `v2` 순으로 자동 부여한다.

**`mapFile`은 선택 사항이다.** `map_url`이 nullable이므로(§5.1) 백엔드가 좌표 프레임만 내려주고 도면 이미지는 클라이언트 자산을 쓰는 구성이 가능하다. 역삼역 B1·B2·B3가 그렇게 등록돼 있다. 파일을 생략하면 `mapUrl`은 `null`로 저장한다. 다만 **파일과 좌표 프레임이 모두 없으면 `400 EMPTY_FLOOR_MAP`으로 거부한다.** 아무 내용 없는 행이 생기면서 기존 활성 지도만 비활성화되기 때문이다.

#### Content-Type

```text
multipart/form-data
```

#### Request

| 이름          | 타입   | 필수 | 설명                                           |
| ------------- | ------ | ---- | ---------------------------------------------- |
| mapType       | string | Y    | image, svg                                     |
| mapFile       | file   | N    | 지도 파일. 생략하면 `mapUrl`이 `null`인 프레임 전용 행 |
| width         | number | N    | 지도 너비                                      |
| height        | number | N    | 지도 높이                                      |
| scaleMPerPx   | number | N    | 픽셀당 실제 거리(m)                            |
| originPxX     | number | N    | 캐노니컬 원점 `(0,0)`에 대응하는 이미지 픽셀 x |
| originPxY     | number | N    | 캐노니컬 원점 `(0,0)`에 대응하는 이미지 픽셀 y |
| frameAngleDeg | number | N    | 캐노니컬 +X축과 이미지 x축의 각도(도)          |

프레임 4필드(`scaleMPerPx`, `originPxX`, `originPxY`, `frameAngleDeg`)는 업로드하는 **이 이미지 기준**으로 넣는다. 같은 층의 지도를 다른 이미지로 교체하면 원점 픽셀과 축척이 달라지므로 새 이미지에 맞춰 다시 측정해야 한다. 의미와 변환식은 §5.1 참고.

`originPxX`·`originPxY`는 이미지 좌상단 기준이라 0이나 음수도 유효하고, `frameAngleDeg`도 음수가 정상이다(역삼역 −21.28).

#### 좌표 프레임 규칙

새 지도를 올리면 그 층의 기존 활성 지도는 비활성화된다. 프레임이 조용히 사라지는 것을 막기 위해 두 가지를 검증한다.

| 상황 | 결과 |
| --- | --- |
| 4필드 전부 지정 | 통과 |
| 4필드 전부 생략 + 기존 지도에도 프레임 없음 | 통과 (오버레이 없는 지도) |
| **4필드 중 일부만 지정** | **`400 INCOMPLETE_COORDINATE_FRAME`** |
| **4필드 전부 생략 + 기존 활성 지도에 프레임 있음** | **`400 COORDINATE_FRAME_WOULD_BE_LOST`** |
| **4필드 전부 생략 + `mapFile`도 없음** | **`400 EMPTY_FLOOR_MAP`** |

**기존 프레임을 자동으로 물려주지 않는다.** 프레임은 특정 이미지에 대한 값이라, 다른 이미지에 그대로 적용하면 오버레이가 켜진 채로 틀린 위치에 그려진다. 조용히 틀린 좌표가 조용히 꺼진 기능보다 나쁘다. 이미지를 교체할 때는 새 이미지 기준으로 프레임을 다시 재서 함께 보내야 한다.

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

#### 오류

| 코드 | 상태 | 설명 |
| ----------------------------- | ---- | -------------------------------------------- |
| FLOOR_NOT_FOUND | 404 | 층이 없거나 역이 비활성 |
| UNSUPPORTED_MAP_TYPE | 400 | `image`·`svg` 외의 유형 |
| INVALID_MAP_FILE | 400 | 파일이 비어 있거나 올바르지 않음 |
| INCOMPLETE_COORDINATE_FRAME | 400 | 프레임 4필드 중 일부만 지정 |
| COORDINATE_FRAME_WOULD_BE_LOST | 400 | 기존 프레임이 있는데 새 요청에 프레임이 없음 |
| EMPTY_FLOOR_MAP | 400 | `mapFile`과 프레임 4필드가 모두 없음 |

---

### GET `/api/admin/floors/{floorId}/maps`

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
      "width": 1624,
      "height": 969,
      "scaleMPerPx": 0.19,
      "originPxX": 622,
      "originPxY": 512,
      "frameAngleDeg": -21.28,
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

### POST `/api/admin/facilities`

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

### GET `/api/admin/facilities`

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

### GET `/api/admin/facilities/{facilityId}`

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

### PATCH `/api/admin/facilities/{facilityId}`

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

### POST `/api/admin/route-nodes`

#### Request

```json
{
  "stationId": 1,
  "floorId": 2,
  "nodeType": "junction",
  "name": "B2 갈림길 1",
  "mapX": 300.0,
  "mapY": 200.0,
  "mapZ": 0.0,
  "isLandmark": true
}
```

`mapZ`는 캐노니컬 높이(m)이며 선택 입력이다. 층 바닥이 기준이고 역삼역은 **B1 = 5 · B2 = 0 · B3 = −5**다.

**되도록 넣는다.** 같은 층 안에서 높이가 갈리는 구간이 있기 때문이다 — 역삼역 B1 개찰구 위 중간층(B0.5)은 별도 층이 아니라 `floorId`가 B1이면서 `mapZ = 7.5`인 노드 6개로 모델링돼 있다. 값이 비어 있으면 위치 인식의 노드 스냅이 그 노드를 바닥에 있는 것으로 보고 잘못 고를 수 있다. 현재 역삼역 노드 142개는 모두 값이 있다.

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

### GET `/api/admin/route-nodes/{nodeId}`

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
    "mapZ": 0.0,
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

### POST `/api/admin/route-edges`

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

### GET `/api/admin/route-edges/{edgeId}`

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

### POST `/api/admin/nearby-places`

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

### GET `/api/admin/nearby-places?stationId={stationId}`

역별 주변 장소 목록을 조회한다. 관리자용이므로 비활성 장소도 포함한다. `stationId` 누락 시 `INVALID_REQUEST`.

### GET `/api/admin/nearby-places/{placeId}`

주변 장소 상세를 조회한다. 없으면 `PLACE_NOT_FOUND`.

### PATCH `/api/admin/nearby-places/{placeId}`

주변 장소를 수정한다. 소속 역(`stationId`)은 변경 대상이 아니다.

### DELETE `/api/admin/nearby-places/{placeId}`

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

### POST `/api/admin/place-exit-recommendations`

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

### GET `/api/admin/place-exit-recommendations?placeId={placeId}`

장소별 추천 목록을 우선순위(`priority` 오름차순) 순으로 조회한다. `placeId` 누락 시 `INVALID_REQUEST`, 장소가 없으면 `PLACE_NOT_FOUND`.

### DELETE `/api/admin/place-exit-recommendations/{recommendationId}`

장소-출구 추천을 삭제한다. 없으면 `EXIT_RECOMMENDATION_NOT_FOUND`.

---

## 13.10 상담자 계정 등록

### POST `/api/admin/counselors`

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

### POST `/api/location-shares`

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

### GET `/api/location-shares/{shareId}`

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

### POST `/api/transport-cards/recommend`

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

## 16. 오류 코드

실제 `ErrorCode` enum 기준이다. 응답의 오류 코드 필드 이름은 `code`다(2.2절 참고).

### 공통

| 코드 | HTTP | 설명 |
| --- | --- | --- |
| INVALID_REQUEST | 400 | 요청 형식이 올바르지 않음 |
| ENDPOINT_NOT_FOUND | 404 | 요청한 경로를 찾을 수 없음 |
| METHOD_NOT_ALLOWED | 405 | 지원하지 않는 요청 방식 |
| UNSUPPORTED_MEDIA_TYPE | 415 | 지원하지 않는 요청 형식 |
| INTERNAL_SERVER_ERROR | 500 | 서버 내부 오류 |

### 인증·계정

| 코드 | HTTP | 설명 |
| --- | --- | --- |
| INVALID_CREDENTIALS | 401 | 아이디 또는 비밀번호가 올바르지 않음 |
| UNAUTHENTICATED | 401 | 인증이 필요함 |
| ACCESS_DENIED | 403 | 접근 권한이 없음 |
| INACTIVE_ACCOUNT | 403 | 비활성화된 계정 |
| INVALID_CURRENT_PASSWORD | 400 | 현재 비밀번호가 올바르지 않음 |
| ACCOUNT_NOT_FOUND | 404 | 계정을 찾을 수 없음 |
| DUPLICATE_LOGIN_ID | 409 | 이미 사용 중인 로그인 ID |

### 사용자 세션

| 코드 | HTTP | 설명 |
| --- | --- | --- |
| INVALID_DESTINATION | 400 | 목적지 양식이 올바르지 않음 |
| USER_SESSION_NOT_FOUND | 404 | 사용자 세션을 찾을 수 없음 |
| USER_SESSION_ALREADY_ENDED | 409 | 이미 종료된 세션 |
| USER_SESSION_IN_CONSULTATION | 409 | 진행 중인 상담이 있어 세션을 종료할 수 없음 |

### 상담

| 코드 | HTTP | 설명 |
| --- | --- | --- |
| EMPTY_TRANSCRIPT | 400 | 상담 전문이 비어 있음 |
| INVALID_RATING_SCORE | 400 | 만족도 점수가 1~5 범위를 벗어남 |
| CONSULTATION_NOT_CANCELABLE | 400 | 취소할 수 없는 상담 상태 |
| CONSULTATION_STATION_MISMATCH | 403 | 담당 역의 상담 요청이 아님 |
| CONSULTATION_COUNSELOR_MISMATCH | 403 | 담당 상담자가 아님 |
| CONSULTATION_SESSION_MISMATCH | 403 | 해당 상담을 요청한 사용자가 아님 |
| CONSULTATION_NOT_FOUND | 404 | 상담 세션을 찾을 수 없음 |
| CONSULTATION_SUMMARY_NOT_FOUND | 404 | 상담 요약을 찾을 수 없음 |
| CONSULTATION_ALREADY_IN_PROGRESS | 409 | 이미 대기 중이거나 진행 중인 상담이 있음 |
| CONSULTATION_NOT_ACCEPTABLE | 409 | 수락할 수 없는 상담 상태 |
| CONSULTATION_NOT_REJECTABLE | 409 | 거절할 수 없는 상담 상태 |
| CONSULTATION_NOT_ENDABLE | 409 | 종료할 수 없는 상담 상태 |
| CONSULTATION_NOT_ENDED | 409 | 종료되지 않은 상담 |
| CONSULTATION_SUMMARY_ALREADY_EXISTS | 409 | 이미 상담 전문·요약이 저장됨 |
| CONSULTATION_ALREADY_RATED | 409 | 이미 평가한 상담 |
| COUNSELOR_NOT_AVAILABLE | 409 | 상담자가 상담 가능한 상태가 아님 |

### 역·층·시설

| 코드 | HTTP | 설명 |
| --- | --- | --- |
| UNSUPPORTED_FACILITY_TYPE | 400 | 지원하지 않는 시설 유형 |
| NOT_EXIT_FACILITY | 400 | 출구가 아닌 시설 |
| STATION_NOT_FOUND | 404 | 역을 찾을 수 없음 |
| FLOOR_NOT_FOUND | 404 | 층을 찾을 수 없음 |
| FACILITY_NOT_FOUND | 404 | 시설을 찾을 수 없음 |
| DUPLICATE_FLOOR_CODE | 409 | 해당 역에 동일한 층 코드가 존재함 |
| FLOOR_IN_USE | 409 | 사용 중인 층은 삭제할 수 없음 |

### 장소·출구 추천

| 코드 | HTTP | 설명 |
| --- | --- | --- |
| PLACE_NOT_FOUND | 404 | 주변 장소를 찾을 수 없음 |
| EXIT_RECOMMENDATION_NOT_FOUND | 404 | 장소-출구 추천을 찾을 수 없음 |
| EXIT_LOCATION_NOT_FOUND | 404 | 외부 좌표가 등록된 출구를 찾을 수 없음 |
| DUPLICATE_EXIT_RECOMMENDATION | 409 | 이미 등록된 장소-출구 추천 |

### 지도·파일

| 코드 | HTTP | 설명 |
| --- | --- | --- |
| INVALID_MAP_FILE | 400 | 지도 파일이 비어 있거나 올바르지 않음 |
| UNSUPPORTED_MAP_TYPE | 400 | 지원하지 않는 지도 유형 |
| INCOMPLETE_COORDINATE_FRAME | 400 | 좌표 프레임 4필드 중 일부만 지정됨 |
| COORDINATE_FRAME_WOULD_BE_LOST | 400 | 기존 좌표 프레임이 있는데 새 요청에 프레임이 없음 |
| EMPTY_FLOOR_MAP | 400 | 도면 파일과 좌표 프레임이 모두 없음 |
| EXTERNAL_PLACE_SEARCH_FAILED | 502 | 외부 장소 검색 실패 |
| FILE_STORAGE_FAILED | 500 | 파일 저장 실패 |

### 경로

| 코드 | HTTP | 설명 |
| --- | --- | --- |
| UNSUPPORTED_NODE_TYPE | 400 | 지원하지 않는 노드 유형 |
| UNSUPPORTED_MOVE_TYPE | 400 | 지원하지 않는 이동 유형 |
| UNSUPPORTED_ROUTE_TYPE | 400 | 지원하지 않는 경로 옵션 유형 |
| ROUTE_NODE_NOT_FOUND | 404 | 경로 노드를 찾을 수 없음 |
| ROUTE_EDGE_NOT_FOUND | 404 | 경로 간선을 찾을 수 없음 |
| ROUTE_NODE_IN_USE | 409 | 사용 중인 경로 노드는 삭제할 수 없음 |

---

## 17. MVP 필수 API 요약

| 구분        | API                                                                                                                                  |
| ----------- |--------------------------------------------------------------------------------------------------------------------------------------|
| 사용자 세션 | POST /api/user-sessions, GET /api/user-sessions/{userSessionId}, PATCH /api/user-sessions/{userSessionId}, DELETE /api/user-sessions/{userSessionId} |
| 역          | GET /api/stations/nearby, GET /api/stations/search, GET /api/stations/{stationId}                                                                |
| 지도/시설   | GET /api/stations/{stationId}/maps, GET /api/stations/{stationId}/facilities                                                                 |
| 목적지      | GET /api/destinations/search, GET /api/stations/{stationId}/places, GET /api/places/{placeId}/recommended-exits                                  |
| 위치 인식   | POST /api/vps/localize, POST /api/localization/manual                                                                                    |
| 경로        | POST /api/routes/indoor/options, POST /api/routes/indoor                                                    |
| 외부 지도   | POST /api/external-maps/directions                                                                                                       |
| 위치 공유   | POST /api/location-shares, GET /api/location-shares/{shareId}                                                                                |
| 인증        | POST /auth/login, POST /auth/signup, GET /auth/check-login-id                                                                        |
| 상담        | POST /consultations, GET /consultations/{consultationId}, DELETE /consultations/{consultationId}, POST /consultations/{consultationId}/rating |
| 상담자      | GET /counselors/consultations, POST /consultations/{id}/accept, POST /consultations/{id}/summary, GET /consultations/{id}/summary, GET /counselors/me, PATCH /counselors/me |
| WebRTC      | WS /ws/signaling                                                                                                                     |
| 교통카드    | POST /api/transport-cards/recommend                                                                                                      |
| 관리자      | 관리자 데이터 등록 API 전체 구현                                                                                                                 |

---

## 18. 확정된 구현 사항

| 항목                   | 결정                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| 프론트엔드             | React + TypeScript + Vite                                        |
| UI 스타일링            | CSS Modules + CSS Variables                                     |
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
2. 운영 도메인 `jenkins.example.invalid`의 배포별 HTTPS/WSS routing 검증
3. 카메라 이미지 즉시 폐기 로그 검증
