# WebRTC DataChannel 이벤트 명세서

> 최신화: 2026-08-11
> 구현 상태: `RTCDataChannel` 송수신이 동작한다. 그리기·지도 동기화·목적지 변경·위치 수정이 상담자
> 화면과 사용자 화면 사이를 오간다. 채널이 열리지 않은 상담에서는 REST + SSE 우회로를 쓰며, 그
> 방향은 상담자→사용자 한 쪽뿐이다(14장).
>
> 5장·8장·9장·10장을 실제 구현에 맞춰 고쳤다. 이름과 필드가 달라진 곳은 각 절에 개정 이력을 남겼다.
> 11~13장은 enum에 없는 이벤트라 미구현 설계로 표시했다. (S15P11A206-382)

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

**권위 있는 목록은 백엔드 enum이다.** `ConsultationDataChannelEventType`에 없는 종류는 REST 우회로
요청이 400으로 거절되고, 그러면 DataChannel이 닫힌 상담의 이벤트 전달이 통째로 막힌다. 아래 표는
그 enum과 일치시킨 것이다.

| 값 | 방향 | 구현 | 설명 |
| --- | --- | --- | --- |
| `DRAW_STROKE_START` | COUNSELOR -> USER | O | 펜 그리기 시작 |
| `DRAW_STROKE_MOVE` | COUNSELOR -> USER | O | 펜 이동 좌표 전달 |
| `DRAW_STROKE_END` | COUNSELOR -> USER | O | 펜 그리기 종료 |
| `DRAW_CLEAR` | COUNSELOR -> USER | O | 화면 위 그리기 전체 삭제 |
| `MAP_SYNC` | USER -> COUNSELOR | O | 사용자가 보고 있는 지도 상태 스냅숏 (8장) |
| `DESTINATION_CHANGE_REQUESTED` | COUNSELOR -> USER | O | 사용자 목적지 변경 (9장) |
| `CURRENT_LOCATION_CORRECTED` | COUNSELOR -> USER | O | 사용자 현재 위치 수정 (10장) |
| `ARROW_POINTED` | COUNSELOR -> USER | X | enum에만 있고 아직 보내는 화면이 없다 |
| `GUIDE_MESSAGE_SENT` | COUNSELOR -> USER | X | enum에만 있고 아직 보내는 화면이 없다 |

> **개정 이력 (S15P11A206-382).** 이 표에 있던 `SEND_MESSAGE`·`SET_DESTINATION`·
> `UPDATE_USER_LOCATION`·`REQUEST_ROUTE_REFRESH`·`TRANSLATED_CAPTION`·`SYNC_STATUS`는 enum에 없는
> 이름이었다. 구현이 `MAP_SYNC`·`DESTINATION_CHANGE_REQUESTED`·`CURRENT_LOCATION_CORRECTED`로
> 정해지는 동안 이 문서가 따라오지 않았다. 11~13장은 그 옛 이름으로 쓰인 절이라 **미구현 설계**로
> 표시해 두었다.

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

## 8. 지도 상태 동기화 이벤트

### MAP_SYNC

사용자 화면이 **자기가 지금 그리고 있는 것**을 상담자에게 보낸다. 상담자 콘솔은 이것으로 왼쪽의
자기 지도와 오른쪽의 사용자 화면 거울을 함께 그린다.

**보내는 것은 내부 상태가 아니라 화면에 그린 값이다.** (S15P11A206-382) 예전에는 현재 위치·경로
연결선·표시 층이 갈라져 있었다 — 사용자 지도는 경로 위에 얹은 자리를 그리는데 상담자에게는 날것의
좌표가 갔고, 사용자가 층 버튼으로 다른 층을 열어 봐도 상담자는 서 있는 층을 보고 있었다. 상담자가
짚어 주는 자리를 사용자가 자기 화면에서 찾을 수 없게 만드는 종류의 어긋남이다.

위치가 바뀔 때, 방향이 바뀔 때, 배치·표시 상태·시점이 바뀔 때 각각 다시 보낸다. 방향은 위치와 별도
주기로 오므로(회전은 위치 확정 트리거가 아니다) 따로 실어야 제자리에서 몸만 돌린 것이 전달된다.

```json
{
  "sessionId": "room_cs_abc123",
  "eventId": "evt_mapsync_001",
  "senderType": "USER",
  "eventType": "MAP_SYNC",
  "payload": {
    "stationId": 1,
    "floorId": 2,
    "current": { "floorId": 2, "mapX": -6.2, "mapY": 7.8 },
    "headingDeg": -68.7,
    "destination": { "floorId": 2, "mapX": -12.4, "mapY": 15.6 },
    "destinationLabel": "3번 출구",
    "destinationNodeId": 341,
    "pathNodes": [
      { "nodeId": 209, "floorId": 2, "mapX": 0, "mapY": 0 },
      { "nodeId": 341, "floorId": 2, "mapX": -12.4, "mapY": 15.6 }
    ],
    "connectCurrentToRoute": false,
    "view": { "x": 0.13, "y": -0.27, "scale": 3.59, "rotation": -41 },
    "facilityView": "all",
    "selectedFacilityId": null,
    "screen": {
      "width": 390,
      "height": 844,
      "lower": { "x": 0, "y": 0.545, "width": 1, "height": 0.455 },
      "map": { "x": 0.041, "y": 0.5616, "width": 0.9179, "height": 0.3555 },
      "cameraSource": { "width": 1920, "height": 1080 }
    }
  },
  "timestamp": "2026-08-11T10:03:00Z",
  "version": 1
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `stationId` | number | Y | 역 ID |
| `floorId` | number \| null | Y | **사용자가 보고 있는 층.** 서 있는 층이 아니다 — 층 버튼으로 다른 층을 열어 본 상태가 담긴다 |
| `current` | object \| null | Y | 사용자 지도가 그리는 현재 위치. **경로 위에 얹은 자리**이며 얹지 못했으면 날것의 좌표다 |
| `headingDeg` | number \| null | Y | 사용자가 바라보는 방향(도). 지도 미터 프레임 기준. 모르면 null |
| `destination` | object \| null | Y | 목적지 좌표 |
| `destinationLabel` | string \| null | Y | 화면에 적힌 목적지 이름 |
| `destinationNodeId` | number \| null | Y | 목적지인 경로 노드. 어느 시설 아이콘이 목적지인지 표시하는 데 쓴다 |
| `pathNodes` | array | Y | 경로가 지나는 노드. 상담자 지도가 같은 선을 그린다 |
| `connectCurrentToRoute` | boolean \| null | Y | 내 점과 경로 사이를 이을지. 얹었으면 이을 자리가 없다 |
| `view` | object \| null | Y | 지도를 확대·이동·회전해 둔 상태 |
| `facilityView` | string \| null | Y | 시설 표시 상태. `all`·`none`·`facilityType` 하나 |
| `selectedFacilityId` | number \| null | Y | 이름표를 띄워 둔 시설 |
| `screen` | object \| null | Y | 사용자 화면이 나뉜 자리. 거울의 비율을 이 값으로 맞춘다 |

`current`·`destination`·`pathNodes`의 좌표는 6장의 정규화 좌표가 아니라 **백엔드 지도 미터 좌표**
(`mapX`·`mapY`)다. 정규화 좌표를 쓰는 것은 펜 그리기뿐이다.

#### view

지도 시점이다. `x`·`y`는 **지도 상자의 폭·높이로 나눈 값**이라 크기가 다른 화면에 그대로 옮길 수
있다 — 비율이 같기만 하면 된다. 거울 상자는 `screen`으로 받은 비율로 만들어지므로 그 조건이 성립한다.

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `x` | number | Y | 상자 폭으로 나눈 가로 이동량 |
| `y` | number | Y | 상자 높이로 나눈 세로 이동량 |
| `scale` | number | Y | 확대 배율 |
| `rotation` | number | Y | 지도 회전각(도) |

이 값이 없으면 거울이 자기 추종을 돌린다. 사용자가 지도를 밀어 추종을 풀면 그쪽 화면은 회전까지 그
자리에 멈추는데 거울은 계속 도므로 두 화면이 전혀 다른 곳을 보게 된다.

#### screen

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `width`·`height` | number | Y | 사용자 화면 크기(CSS px) |
| `lower` | object | Y | 지도가 놓인 아래쪽 영역. 이 위쪽이 카메라다. 화면 기준 0~1 |
| `map` | object | Y | 도면이 그려지는 자리. 화면 기준 0~1 |
| `cameraSource` | object \| null | Y | XR 카메라 원본 크기. 보내는 트랙이 320×240 고정이라 되돌리는 데 쓴다. `camera-access`가 없으면 null |

#### 하위 호환

`null`은 **옛 사용자 화면이라 알 수 없다**는 뜻이며, 받는 쪽이 이전 동작으로 떨어진다.

| 필드 | null일 때 상담자 화면의 처리 |
| --- | --- |
| `connectCurrentToRoute` | 잇는다 (옛 동작). 잇지 않는 쪽으로 떨어지면 경로가 끊겨 보인다 |
| `facilityView` | 시설을 그리지 않는다. 모르는 상태를 짐작해 그리면 사용자 화면에 없는 아이콘이 뜬다 |
| `view` | 스스로 추종한다 |

**새 이벤트 타입을 만들지 않고 필드만 늘린다.** 5장의 enum에 없는 종류는 400으로 거절되어 REST
우회로가 통째로 막힌다. 백엔드의 `payload`는 `JsonNode`라 필드 추가는 안전하다.

---

## 8-1. 안내 메시지 이벤트 (미구현 설계)

> `SEND_MESSAGE`는 5장의 enum에 없다. 보내면 REST 우회로에서 400으로 거절된다. 아래는 설계안이며
> 구현되지 않았다. (S15P11A206-382에서 확인)

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

### DESTINATION_CHANGE_REQUESTED

역무원이 상담 중 사용자의 목적지를 변경할 때 전송한다. 상담자가 **지도에서 시설 아이콘을 짚는** 것이
유일한 입력 경로다.

> **개정 이력 (S15P11A206-382).** 이 절은 `SET_DESTINATION`이라는 이름과 `name`·`floor`·`x`·`y`
> 필드로 쓰여 있었다. 실제 구현은 아래와 같으며 이름도 필드도 다르다.

```json
{
  "sessionId": "room_cs_abc123",
  "eventId": "evt_destination_001",
  "senderType": "COUNSELOR",
  "eventType": "DESTINATION_CHANGE_REQUESTED",
  "payload": {
    "facilityId": 12,
    "nameKo": "3번 출구",
    "linkedNodeId": 341,
    "floorId": 2,
    "mapX": -12.4,
    "mapY": 15.6
  },
  "timestamp": "2026-08-11T10:04:00Z",
  "version": 1
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `facilityId` | number | Y | 상담자가 짚은 시설 |
| `nameKo` | string | Y | 시설 이름 |
| `linkedNodeId` | number \| null | Y | 경로 계산에 쓰는 노드. 연결된 노드가 없으면 null |
| `floorId` | number | Y | 층 ID |
| `mapX`·`mapY` | number | Y | 지도 미터 좌표 |

**좌표를 함께 보낸다.** 이름만 보내면 받는 쪽이 그 이름으로 시설을 다시 찾아야 하는데, 표기가 조금만
달라도 엉뚱한 곳을 가리키거나 아무것도 찾지 못한다. 상담자는 사용자와 같은 도면을 보고 있으므로
좌표를 그대로 넘길 수 있다.

**`linkedNodeId`가 null이면 사용자 화면이 이 이벤트를 버린다.** 경로는 노드로만 계산되므로 노드를
모르는 시설은 목적지가 될 수 없다. 이름만 바꾸면 도착 노드와 경로가 함께 비워져 경로선과 목적지
마커가 통째로 사라진다.

수신한 사용자는 목적지와 도착 노드를 함께 옮기고 REST 경로 탐색 API로 경로를 다시 받는다. 바뀐 값은
곧 새 `MAP_SYNC`로 상담자에게 돌아가 양쪽이 같은 곳을 가리킨다.

---

## 10. 현재 위치 수정 이벤트

### CURRENT_LOCATION_CORRECTED

위치 인식이 빗나갔을 때 역무원이 지도에서 사용자의 실제 위치를 짚어 바로잡는다. 페이로드 모양은
9장과 같다(둘 다 "상담자가 지도에서 짚은 시설").

> **개정 이력 (S15P11A206-382).** 이 절은 `UPDATE_USER_LOCATION`이라는 이름과
> `mapId`·`floor`·`x`·`y`·`nodeId`·`source` 필드로 쓰여 있었다. 실제 구현은 아래와 같다.

```json
{
  "sessionId": "room_cs_abc123",
  "eventId": "evt_location_001",
  "senderType": "COUNSELOR",
  "eventType": "CURRENT_LOCATION_CORRECTED",
  "payload": {
    "facilityId": 7,
    "nameKo": "B3 승강장",
    "linkedNodeId": 204,
    "floorId": 2,
    "mapX": 0,
    "mapY": 0
  },
  "timestamp": "2026-08-11T10:04:30Z",
  "version": 1
}
```

필드는 9장의 표와 같다.

**`linkedNodeId`가 null이면 사용자 화면이 이 이벤트를 버린다.** 노드를 모르면 경로를 다시 계산할 수
없다.

**위치를 옮기는 것이 방향을 지우는 일은 아니다.** 사용자가 서 있는 자리를 고쳐 줘도 몸을 돌린 것은
아니므로 방향은 그대로 유효하다. 방향까지 지우면 앵커를 만들 수 없어 그때부터 추적이 통째로 죽는다.

> **알려진 제약 (S15P11A206-382).** 사용자 화면이 이 이벤트로 스토어만 갱신하고 **XR 앵커를 다시
> 세우지 않는다.** 앵커가 있는 동안 표시 좌표는 전부 앵커에서 파생되므로, 추적이 살아 있으면 수정이
> 화면에 반영되지 않는다. 앵커를 다시 세우는 수정은 별도 작업으로 분리했다 — 30초 재인식이 수정을
> 되돌리는 문제를 함께 정해야 한다.

---

## 11. 경로 갱신 요청 이벤트 (미구현 설계)

> `REQUEST_ROUTE_REFRESH`는 5장의 enum에 없다. 보내면 REST 우회로에서 400으로 거절된다. 아래는
> 설계안이며 구현되지 않았다. (S15P11A206-382에서 확인)

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

## 12. 번역 자막 이벤트 (미구현 설계)

> `TRANSLATED_CAPTION`는 5장의 enum에 없다. 보내면 REST 우회로에서 400으로 거절된다. 아래는
> 설계안이며 구현되지 않았다. (S15P11A206-382에서 확인)

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

## 13. 상태 동기화 이벤트 (미구현 설계)

> `SYNC_STATUS`는 5장의 enum에 없다. 보내면 REST 우회로에서 400으로 거절된다. 아래는
> 설계안이며 구현되지 않았다. (S15P11A206-382에서 확인)

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
4. 영상 연결 실패, 음성 상담 전환 요청, 채팅 상담 전환 요청은 REST fallback API로 Backend에 신고한다.
5. 안내 메시지, 목적지 변경, 위치 수정처럼 상담 흐름에 중요한 이벤트는 WebSocket signaling 또는 REST API fallback을 사용할 수 있다.
6. 재연결 실패가 지속되면 음성 상담 또는 채팅 상담 화면으로 전환한다.

펜 그리기 이벤트는 실시간성이 중요하고 누락 시 복구 비용이 크지 않으므로 서버 저장을 기본으로 하지 않는다.

목적지 변경과 위치 수정은 상담 결과에 영향을 주므로 필요 시 서버 상태에도 반영한다.

현재 Backend fallback 구현은 다음 REST API와 상담 대기 SSE 채널을 사용한다.

```text
POST /api/consultations/{consultationRequestId}/fallback-events
POST /api/consultations/{consultationRequestId}/data-channel-events
GET  /api/consultations/{consultationRequestId}/waiting-events
```

WebRTC 영상·음성·채팅 fallback 이벤트 타입은 다음 값을 사용한다.

| 값 | 설명 |
| --- | --- |
| `VIDEO_FAILED` | 영상 연결 또는 화면 공유 연결 실패 |
| `AUDIO_ONLY_REQUESTED` | 음성 상담으로 전환 요청 |
| `AUDIO_FAILED` | 음성 연결 실패 |
| `CHAT_ONLY_REQUESTED` | 채팅 상담으로 전환 요청 |
| `FALLBACK_CONFIRMED` | fallback 상담 방식 전환 확정 |

Backend는 fallback 이벤트를 수신하면 기존 상담 대기 SSE 구독자에게 전환 안내 메시지를 전달한다. 현재 SSE `type`은 `FALLBACK` 값을 사용하고, 상세 fallback 상태는 `message`로 전달한다.

DataChannel fallback 이벤트 타입은 다음 값을 사용한다.

| 값 | 설명 |
| --- | --- |
| `ARROW_POINTED` | 상담자가 특정 방향 또는 위치를 화살표로 지시함 |
| `GUIDE_MESSAGE_SENT` | 상담자가 안내 메시지를 전송함 |
| `DESTINATION_CHANGE_REQUESTED` | 상담자가 목적지 변경을 요청함 |

Backend는 DataChannel fallback 이벤트를 수신하면 기존 상담 대기 SSE 구독자에게 `DATA_CHANNEL` event name으로 전달한다. event data에는 `consultationRequestId`, `type`, `payload`, `timestamp`가 포함된다.

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
