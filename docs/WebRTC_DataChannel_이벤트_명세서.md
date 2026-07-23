# WebRTC DataChannel 이벤트 명세서

## 1. 목적

본 문서는 PinGo 상담 기능에서 WebRTC 연결이 완료된 이후 사용자와 역무원 사이에 주고받는 실시간 상담 이벤트 계약을 정의한다.

WebRTC 연결 생성에 필요한 `JOIN`, `OFFER`, `ANSWER`, `ICE_CANDIDATE`는 `docs/WebRTC_Signaling_이벤트_명세서.md`에서 관리한다. 본 문서는 연결 이후 DataChannel을 통해 동기화되는 화면 그리기, 안내 메시지, 목적지 변경, 위치 수정, 경로 갱신, 번역 자막 이벤트를 다룬다.

---

## 2. 적용 범위

DataChannel은 다음 기능에 사용한다.

- 역무원이 사용자 공유 화면 위에 그린 펜 stroke 동기화
- 역무원의 안내 메시지 전달
- 역무원이 변경한 목적지 전달
- 역무원이 수정한 사용자 현재 위치 전달
- 변경된 목적지 또는 위치 기준 경로 갱신 요청
- STT/번역 결과 자막 전달
- 상담 중 상태 동기화

DataChannel은 WebRTC PeerConnection이 연결된 이후 생성된다. 연결 전 협상 메시지는 WebSocket signaling으로 처리한다.

---

## 3. 책임 경계

| 구분 | 책임 |
| --- | --- |
| Frontend | DataChannel 생성, 이벤트 송수신, 화면 공유 위 그리기 렌더링, 번역 자막 표시, 수신 이벤트 기반 UI 갱신 |
| Backend | 상담 세션 상태 관리, signaling 연결 지원, REST API를 통한 목적지/위치/경로 데이터 제공 |
| AI/Translation | 음성 입력 STT, 번역 결과 생성, 자막 이벤트로 사용할 텍스트 제공 |
| Infra | WSS, STUN/TURN, HTTPS reverse proxy, 외부망 WebRTC 연결 환경 제공 |

Backend signaling 서버는 DataChannel 이벤트를 기본적으로 중계하지 않는다. DataChannel이 실패한 경우에만 제한된 fallback 메시지를 WebSocket 또는 REST API로 처리할 수 있다.

---

## 4. 공통 Event Envelope

모든 DataChannel 이벤트는 다음 공통 구조를 따른다.

```json
{
  "sessionId": "room_cs_abc123",
  "eventId": "evt_01HZY6Q9Y6N8J7",
  "senderType": "COUNSELOR",
  "eventType": "DRAW_STROKE_START",
  "payload": {},
  "timestamp": "2026-07-23T10:00:00Z",
  "version": 1
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `sessionId` | string | Y | 상담 session ID |
| `eventId` | string | Y | 이벤트 중복 처리 방지를 위한 고유 ID |
| `senderType` | string | Y | `USER`, `COUNSELOR`, `SYSTEM` |
| `eventType` | string | Y | DataChannel 이벤트 타입 |
| `payload` | object | Y | 이벤트별 상세 데이터 |
| `timestamp` | string | Y | ISO-8601 UTC 기준 생성 시각 |
| `version` | number | Y | 이벤트 스키마 버전. 최초 버전은 `1` |

수신 측은 같은 `eventId`를 중복 수신하면 한 번만 처리한다.

---

## 5. Event Type

| 값 | 방향 | 설명 |
| --- | --- | --- |
| `DRAW_STROKE_START` | COUNSELOR -> USER | 펜 그리기 시작 |
| `DRAW_STROKE_MOVE` | COUNSELOR -> USER | 펜 이동 좌표 전달 |
| `DRAW_STROKE_END` | COUNSELOR -> USER | 펜 그리기 종료 |
| `DRAW_CLEAR` | COUNSELOR -> USER | 화면 위 그리기 전체 삭제 |
| `SEND_MESSAGE` | USER/COUNSELOR -> 상대방 | 상담 안내 메시지 전달 |
| `SET_DESTINATION` | COUNSELOR -> USER | 사용자 목적지 변경 |
| `UPDATE_USER_LOCATION` | COUNSELOR -> USER | 사용자 현재 위치 수정 |
| `REQUEST_ROUTE_REFRESH` | USER/COUNSELOR -> 상대방 | 경로 재탐색 요청 |
| `TRANSLATED_CAPTION` | USER/COUNSELOR/SYSTEM -> 상대방 | 번역 자막 전달 |
| `SYNC_STATUS` | USER/COUNSELOR/SYSTEM -> 상대방 | 상담 화면 상태 동기화 |

---

## 6. 좌표 기준

역무원의 펜 그리기 좌표는 사용자 공유 화면 기준 정규화 좌표를 사용한다.

```text
x: 0.0 ~ 1.0
y: 0.0 ~ 1.0
```

정규화 좌표를 사용하는 이유는 사용자 기기와 역무원 화면의 해상도, 비율, 확대 상태가 달라도 같은 위치에 그리기 결과를 표시하기 위해서다.

수신 측은 실제 렌더링 시 현재 공유 화면 영역의 width/height를 기준으로 픽셀 좌표를 계산한다.

```text
pixelX = normalizedX * renderedScreenWidth
pixelY = normalizedY * renderedScreenHeight
```

---

## 7. 펜 그리기 이벤트

### 7.1 DRAW_STROKE_START

역무원이 사용자 공유 화면 위에서 펜 입력을 시작할 때 전송한다.

```json
{
  "sessionId": "room_cs_abc123",
  "eventId": "evt_draw_start_001",
  "senderType": "COUNSELOR",
  "eventType": "DRAW_STROKE_START",
  "payload": {
    "strokeId": "stroke_abc123",
    "x": 0.42,
    "y": 0.31,
    "color": "#FF3B30",
    "width": 4
  },
  "timestamp": "2026-07-23T10:01:00Z",
  "version": 1
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `strokeId` | string | Y | 하나의 선을 식별하는 ID |
| `x` | number | Y | 시작 x 좌표. 0.0~1.0 |
| `y` | number | Y | 시작 y 좌표. 0.0~1.0 |
| `color` | string | Y | HEX 색상 |
| `width` | number | Y | 펜 굵기 |

### 7.2 DRAW_STROKE_MOVE

펜이 이동할 때 전송한다. 네트워크 부하를 줄이기 위해 여러 좌표를 배열로 묶어서 보낼 수 있다.

```json
{
  "sessionId": "room_cs_abc123",
  "eventId": "evt_draw_move_001",
  "senderType": "COUNSELOR",
  "eventType": "DRAW_STROKE_MOVE",
  "payload": {
    "strokeId": "stroke_abc123",
    "points": [
      { "x": 0.43, "y": 0.32 },
      { "x": 0.44, "y": 0.33 }
    ]
  },
  "timestamp": "2026-07-23T10:01:01Z",
  "version": 1
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `strokeId` | string | Y | `DRAW_STROKE_START`에서 생성한 stroke ID |
| `points` | array | Y | 이동 좌표 목록 |

### 7.3 DRAW_STROKE_END

펜 입력이 종료될 때 전송한다.

```json
{
  "sessionId": "room_cs_abc123",
  "eventId": "evt_draw_end_001",
  "senderType": "COUNSELOR",
  "eventType": "DRAW_STROKE_END",
  "payload": {
    "strokeId": "stroke_abc123"
  },
  "timestamp": "2026-07-23T10:01:02Z",
  "version": 1
}
```

### 7.4 DRAW_CLEAR

역무원이 화면 위 그리기를 전체 삭제할 때 전송한다.

```json
{
  "sessionId": "room_cs_abc123",
  "eventId": "evt_draw_clear_001",
  "senderType": "COUNSELOR",
  "eventType": "DRAW_CLEAR",
  "payload": {
    "reason": "COUNSELOR_CLEAR"
  },
  "timestamp": "2026-07-23T10:02:00Z",
  "version": 1
}
```

---

## 8. 안내 메시지 이벤트

### SEND_MESSAGE

사용자 또는 역무원이 상담 중 텍스트 안내를 전달할 때 사용한다.

```json
{
  "sessionId": "room_cs_abc123",
  "eventId": "evt_message_001",
  "senderType": "COUNSELOR",
  "eventType": "SEND_MESSAGE",
  "payload": {
    "message": "오른쪽 개찰구 방향으로 이동하세요.",
    "language": "ko"
  },
  "timestamp": "2026-07-23T10:03:00Z",
  "version": 1
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `message` | string | Y | 전달할 안내 문장 |
| `language` | string | Y | 메시지 언어. 예: `ko`, `en` |

---

## 9. 목적지 변경 이벤트

### SET_DESTINATION

역무원이 상담 중 사용자의 목적지를 변경할 때 전송한다.

```json
{
  "sessionId": "room_cs_abc123",
  "eventId": "evt_destination_001",
  "senderType": "COUNSELOR",
  "eventType": "SET_DESTINATION",
  "payload": {
    "destinationType": "FACILITY",
    "destinationId": 12,
    "name": "3번 출구",
    "floor": "B1",
    "x": 0.62,
    "y": 0.18
  },
  "timestamp": "2026-07-23T10:04:00Z",
  "version": 1
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `destinationType` | string | Y | `FACILITY`, `EXIT`, `PLACE`, `SHARED_LOCATION` |
| `destinationId` | number | N | 서버에 등록된 목적지 ID |
| `name` | string | Y | 화면 표시용 목적지명 |
| `floor` | string | N | 목적지 층 |
| `x` | number | N | 지도 좌표 x |
| `y` | number | N | 지도 좌표 y |

목적지 변경 이벤트를 수신한 사용자는 새 목적지를 화면에 반영하고 `REQUEST_ROUTE_REFRESH` 또는 REST 경로 탐색 API를 통해 경로를 갱신한다.

---

## 10. 현재 위치 수정 이벤트

### UPDATE_USER_LOCATION

역무원이 상담자 화면에서 사용자의 현재 위치를 수정할 때 전송한다.

```json
{
  "sessionId": "room_cs_abc123",
  "eventId": "evt_location_001",
  "senderType": "COUNSELOR",
  "eventType": "UPDATE_USER_LOCATION",
  "payload": {
    "mapId": "yeoksam_station",
    "floor": "B1",
    "x": 0.35,
    "y": 0.48,
    "nodeId": 21,
    "source": "COUNSELOR_MANUAL"
  },
  "timestamp": "2026-07-23T10:04:30Z",
  "version": 1
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `mapId` | string | Y | 지도 ID |
| `floor` | string | Y | 층 |
| `x` | number | Y | 지도 좌표 x |
| `y` | number | Y | 지도 좌표 y |
| `nodeId` | number | N | 매핑된 경로 노드 ID |
| `source` | string | Y | `COUNSELOR_MANUAL` |

현재 위치가 변경되면 사용자는 경로 재탐색을 수행해야 한다.

---

## 11. 경로 갱신 요청 이벤트

### REQUEST_ROUTE_REFRESH

위치 또는 목적지 변경 후 경로 재탐색이 필요하다는 것을 상대방에게 알릴 때 사용한다.

```json
{
  "sessionId": "room_cs_abc123",
  "eventId": "evt_route_refresh_001",
  "senderType": "COUNSELOR",
  "eventType": "REQUEST_ROUTE_REFRESH",
  "payload": {
    "reason": "DESTINATION_CHANGED",
    "routeOption": "FASTEST"
  },
  "timestamp": "2026-07-23T10:05:00Z",
  "version": 1
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `reason` | string | Y | `DESTINATION_CHANGED`, `USER_LOCATION_UPDATED`, `USER_OFF_ROUTE` |
| `routeOption` | string | N | `FASTEST`, `STEP_FREE`, `ELEVATOR_FIRST` |

---

## 12. 번역 자막 이벤트

### TRANSLATED_CAPTION

상담 중 사용자의 음성 또는 역무원의 음성을 STT/번역 처리한 결과를 상대방 화면에 자막으로 표시할 때 사용한다.

PinGo 상담의 기본 정책은 원본 음성을 상대방에게 직접 전달하지 않는 것이다. 각 클라이언트는 자기 음성을 수집하고, STT/번역 결과만 상대방에게 전달한다.

```json
{
  "sessionId": "room_cs_abc123",
  "eventId": "evt_caption_001",
  "senderType": "USER",
  "eventType": "TRANSLATED_CAPTION",
  "payload": {
    "sourceLanguage": "en",
    "targetLanguage": "ko",
    "originalText": "Where is exit 3?",
    "translatedText": "3번 출구가 어디인가요?",
    "isFinal": true
  },
  "timestamp": "2026-07-23T10:06:00Z",
  "version": 1
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `sourceLanguage` | string | Y | 발화 언어 |
| `targetLanguage` | string | Y | 번역 결과 언어 |
| `originalText` | string | N | 원문 텍스트 |
| `translatedText` | string | Y | 상대방에게 표시할 번역 자막 |
| `isFinal` | boolean | Y | 최종 문장 여부. `false`면 임시 자막 |

예시 흐름:

- 영어 사용자가 말하면 역무원 화면에는 한국어 자막을 표시한다.
- 한국어 역무원이 말하면 사용자 화면에는 영어 자막을 표시한다.
- `isFinal=false` 자막은 같은 발화의 중간 결과로 취급하고, `isFinal=true` 수신 시 최종 문장으로 고정한다.

---

## 13. 상태 동기화 이벤트

### SYNC_STATUS

상담 중 화면 상태를 상대방에게 알릴 때 사용한다.

```json
{
  "sessionId": "room_cs_abc123",
  "eventId": "evt_status_001",
  "senderType": "SYSTEM",
  "eventType": "SYNC_STATUS",
  "payload": {
    "status": "DATA_CHANNEL_CONNECTED",
    "message": "DataChannel connected."
  },
  "timestamp": "2026-07-23T10:00:30Z",
  "version": 1
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `status` | string | Y | 동기화 상태 |
| `message` | string | N | 개발/운영 확인용 메시지 |

상태 값 예시:

- `DATA_CHANNEL_CONNECTED`
- `DATA_CHANNEL_RECONNECTING`
- `DATA_CHANNEL_CLOSED`
- `SCREEN_SHARE_STARTED`
- `SCREEN_SHARE_STOPPED`
- `CAPTION_ENABLED`
- `CAPTION_DISABLED`

---

## 14. 실패 및 Fallback 기준

DataChannel 연결이 실패하거나 중간에 끊기면 다음 순서로 처리한다.

1. Frontend가 DataChannel 재연결을 시도한다.
2. 재연결 중에는 화면에 연결 복구 상태를 표시한다.
3. 펜 그리기 이벤트는 재연결 성공 전까지 전송하지 않는다.
4. 안내 메시지, 목적지 변경, 위치 수정처럼 상담 흐름에 중요한 이벤트는 WebSocket signaling 또는 REST API fallback을 사용할 수 있다.
5. 재연결 실패가 지속되면 채팅 또는 상담 재요청 화면으로 전환한다.

펜 그리기 이벤트는 실시간성이 중요하고 누락 시 복구 비용이 크지 않으므로 서버 저장을 기본으로 하지 않는다.

목적지 변경과 위치 수정은 상담 결과에 영향을 주므로 필요 시 서버 상태에도 반영한다.

---

## 15. 검증 기준

FR-Done 기준으로 다음 항목을 확인한다.

- 사용자와 역무원 브라우저 사이 DataChannel이 연결된다.
- 역무원이 그린 선이 사용자 공유 화면의 동일한 위치에 표시된다.
- 화면 크기가 달라도 정규화 좌표 기준으로 그리기 위치가 유지된다.
- `DRAW_CLEAR` 수신 시 사용자 화면의 그리기가 삭제된다.
- 역무원 안내 메시지가 사용자 화면에 표시된다.
- 목적지 변경 후 사용자 경로가 갱신된다.
- 사용자 현재 위치 수정 후 경로가 갱신된다.
- 영어 사용자 발화가 한국어 자막으로 역무원 화면에 표시된다.
- 한국어 역무원 발화가 영어 자막으로 사용자 화면에 표시된다.
- DataChannel 실패 시 재연결 또는 fallback 흐름이 동작한다.

---

## 16. 후속 작업

- Frontend DataChannel 송수신 구현
- 펜 그리기 canvas overlay 구현
- 번역 자막 표시 컴포넌트 구현
- 목적지 변경/현재 위치 수정 이벤트와 경로 API 연동
- WebRTC 두 브라우저 E2E 테스트 작성
- DataChannel 실패 및 fallback 테스트 작성
