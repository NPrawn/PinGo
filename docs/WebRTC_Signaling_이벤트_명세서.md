# WebRTC Signaling 이벤트 명세서

> 최신화: 2026-07-30
> 구현 상태: Backend WebSocket relay와 envelope 검증은 구현됨. Frontend PeerConnection 연동과 상담 도메인 기반 session 권한 검증은 미완료다.

## 1. 목적

본 문서는 PinGo 사용자와 상담자 간 WebRTC 연결을 생성하기 위해 WebSocket으로 교환하는 signaling 이벤트 계약을 정의한다.

REST API는 Swagger와 `docs/API_명세서.md`를 기준으로 관리하고, WebSocket signaling 및 DataChannel 이벤트는 별도 문서로 관리한다.

---

## 2. 연결 Endpoint

### Local

```text
ws://localhost:8080/ws/signaling
```

### Production

```text
wss://{service-domain}/ws/signaling
```

운영 환경에서는 HTTPS reverse proxy를 통해 `/ws/` 요청이 backend로 전달된다.

---

## 3. 책임 경계

| 구분 | 책임 |
| --- | --- |
| Frontend | WebRTC PeerConnection 생성, 사용자 화면 공유 track 생성, offer/answer 생성, ICE candidate 수집, signaling message 송수신, DataChannel 생성, 음성 입력 수집 및 번역 자막 표시 |
| Backend | WebSocket 연결 수락, signaling session 검증, signaling room 등록/정리, 사용자와 상담자 간 signaling message relay, 비정상 메시지 오류 응답 |
| Infra | HTTPS/WSS reverse proxy, STUN/TURN 서버, 외부망 NAT 연결 검증 |

Backend는 SDP와 ICE candidate 내용을 해석하거나 수정하지 않는다. Backend는 `sessionId`와 `senderType` 기준으로 같은 room의 상대방에게 signaling message를 relay한다. 단, `JOIN` 시 signaling session 검증을 통과해야 room에 등록되며, `OFFER`, `ANSWER`, `ICE_CANDIDATE`는 해당 `sessionId`와 `senderType`으로 `JOIN`된 WebSocket session에서 보낸 경우에만 relay한다.

상담 중 사용자의 화면은 WebRTC media track으로 상담자에게 공유한다. 단, 사용자와 상담자의 원본 음성은 서로에게 직접 전달하지 않는다. 음성 입력은 STT 및 번역 처리 후 상대방 화면에 자막으로 표시하는 것을 기본 정책으로 한다.

---

## 4. 공통 Message Envelope

모든 signaling message는 아래 공통 구조를 따른다.

```json
{
  "sessionId": "room_cs_abc123",
  "senderType": "USER",
  "type": "OFFER",
  "payload": {},
  "timestamp": "2026-07-23T10:00:00Z"
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `sessionId` | string | Y | 상담 signaling room/session ID |
| `senderType` | string | Y | 메시지 발신자 타입 |
| `type` | string | Y | signaling 이벤트 타입 |
| `payload` | object | N | 이벤트별 상세 데이터 |
| `timestamp` | string | Y | ISO-8601 UTC 기준 메시지 생성 시각 |

---

## 5. Sender Type

| 값 | 설명 |
| --- | --- |
| `USER` | 외국인 관광객 사용자 |
| `COUNSELOR` | 상담자 또는 역무원 |
| `SYSTEM` | 서버가 생성한 시스템 메시지 |

---

## 6. Message Type

| 값 | 방향 | 설명 |
| --- | --- | --- |
| `JOIN` | FE -> BE | signaling room 입장 |
| `LEAVE` | FE -> BE | signaling room 퇴장 |
| `OFFER` | USER/COUNSELOR -> BE -> 상대방 | WebRTC SDP offer 전달 |
| `ANSWER` | USER/COUNSELOR -> BE -> 상대방 | WebRTC SDP answer 전달 |
| `ICE_CANDIDATE` | USER/COUNSELOR -> BE -> 상대방 | ICE candidate 전달 |
| `ERROR` | BE -> FE | signaling 오류 응답 |

---

## 7. 이벤트별 Payload

### 7.1 JOIN

room에 입장할 때 전송한다.

Backend는 `JOIN` 요청을 받은 뒤 signaling session 검증을 먼저 수행한다. 검증에 실패하면 room에 등록하지 않고 `ERROR` 메시지를 응답한다.

```json
{
  "sessionId": "room_cs_abc123",
  "senderType": "USER",
  "type": "JOIN",
  "payload": {
    "displayName": "anonymous-user",
    "mediaMode": "SCREEN_SHARE_WITH_CAPTIONS",
    "sourceLanguage": "en",
    "targetLanguage": "ko",
    "captionEnabled": true
  },
  "timestamp": "2026-07-23T10:00:00Z"
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `displayName` | string | N | 상담 화면 표시용 이름 |
| `mediaMode` | string | N | `SCREEN_SHARE`, `SCREEN_SHARE_WITH_CAPTIONS`, `CHAT` 중 하나 |
| `sourceLanguage` | string | N | 발화자의 언어. 예: `en`, `ko` |
| `targetLanguage` | string | N | 상대방에게 표시할 번역 언어. 예: `ko`, `en` |
| `captionEnabled` | boolean | N | 번역 자막 사용 여부 |

### 7.2 LEAVE

사용자 또는 상담자가 room에서 나갈 때 전송한다.

```json
{
  "sessionId": "room_cs_abc123",
  "senderType": "COUNSELOR",
  "type": "LEAVE",
  "payload": {
    "reason": "CONSULTATION_ENDED"
  },
  "timestamp": "2026-07-23T10:05:00Z"
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `reason` | string | N | `USER_CANCELLED`, `COUNSELOR_LEFT`, `CONSULTATION_ENDED`, `NETWORK_CLOSED` |

### 7.3 OFFER

WebRTC SDP offer를 상대방에게 전달한다.

`OFFER`는 동일한 `sessionId`와 `senderType`으로 `JOIN`이 완료된 WebSocket session에서 보낸 경우에만 relay된다. `JOIN`하지 않은 session이 전송하면 Backend는 `SIGNALING_SESSION_NOT_JOINED` 오류를 응답한다.

```json
{
  "sessionId": "room_cs_abc123",
  "senderType": "USER",
  "type": "OFFER",
  "payload": {
    "sdp": "v=0...",
    "sdpType": "offer"
  },
  "timestamp": "2026-07-23T10:00:05Z"
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `sdp` | string | Y | WebRTC Session Description |
| `sdpType` | string | Y | `offer` |

### 7.4 ANSWER

WebRTC SDP answer를 상대방에게 전달한다.

`ANSWER`는 동일한 `sessionId`와 `senderType`으로 `JOIN`이 완료된 WebSocket session에서 보낸 경우에만 relay된다. `JOIN`하지 않은 session이 전송하면 Backend는 `SIGNALING_SESSION_NOT_JOINED` 오류를 응답한다.

```json
{
  "sessionId": "room_cs_abc123",
  "senderType": "COUNSELOR",
  "type": "ANSWER",
  "payload": {
    "sdp": "v=0...",
    "sdpType": "answer"
  },
  "timestamp": "2026-07-23T10:00:08Z"
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `sdp` | string | Y | WebRTC Session Description |
| `sdpType` | string | Y | `answer` |

### 7.5 ICE_CANDIDATE

ICE candidate를 상대방에게 전달한다.

`ICE_CANDIDATE`는 동일한 `sessionId`와 `senderType`으로 `JOIN`이 완료된 WebSocket session에서 보낸 경우에만 relay된다. `JOIN`하지 않은 session이 전송하면 Backend는 `SIGNALING_SESSION_NOT_JOINED` 오류를 응답한다.

```json
{
  "sessionId": "room_cs_abc123",
  "senderType": "USER",
  "type": "ICE_CANDIDATE",
  "payload": {
    "candidate": "candidate:...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  },
  "timestamp": "2026-07-23T10:00:10Z"
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `candidate` | string | Y | ICE candidate 문자열 |
| `sdpMid` | string | N | media stream 식별자 |
| `sdpMLineIndex` | number | N | media line index |

### 7.6 ERROR

Backend가 잘못된 메시지나 room 상태 오류를 응답할 때 사용한다.

```json
{
  "sessionId": "room_cs_abc123",
  "senderType": "SYSTEM",
  "type": "ERROR",
  "payload": {
    "code": "INVALID_SIGNALING_MESSAGE",
    "message": "Invalid signaling message type.",
    "retryable": false
  },
  "timestamp": "2026-07-23T10:00:11Z"
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `code` | string | Y | 오류 코드 |
| `message` | string | Y | 사용자 또는 개발자 확인용 메시지 |
| `retryable` | boolean | Y | 동일 요청 재시도 가능 여부 |

---

## 8. 오류 코드

| 코드 | 설명 | retryable | 현재 구현 |
| --- | --- | --- | --- |
| `INVALID_SIGNALING_MESSAGE` | JSON 형식, 필수 필드, enum 값이 잘못됨 | false | Y |
| `INVALID_SIGNALING_SESSION` | signaling session 검증에 실패함 | false | Y |
| `SIGNALING_SESSION_NOT_JOINED` | `JOIN`하지 않은 WebSocket session이 relay 메시지를 보냄 | false | Y |
| `SIGNALING_PEER_NOT_CONNECTED` | 상대방이 아직 연결되지 않음 | true | Y |
| `SIGNALING_SESSION_NOT_FOUND` | 존재하지 않는 sessionId | false | N |
| `SIGNALING_SESSION_CLOSED` | 이미 종료된 session | false | N |
| `SIGNALING_ROOM_FULL` | 사용자와 상담자가 이미 모두 입장한 room | false | N |
| `SIGNALING_INTERNAL_ERROR` | 서버 내부 오류 | true | Y |

---

## 9. Session 규칙

- `sessionId`는 상담 요청이 수락되거나 상담 room이 생성될 때 서버가 발급한다.
- `JOIN`은 signaling session 검증을 통과한 경우에만 room 등록으로 이어진다.
- 하나의 `sessionId`에는 기본적으로 `USER` 1명과 `COUNSELOR` 1명만 입장할 수 있다.
- 동일 `sessionId`에서 같은 `senderType`이 다시 `JOIN`하면 현재 WebSocket session으로 교체된다.
- `OFFER`, `ANSWER`, `ICE_CANDIDATE`는 동일한 `sessionId`와 `senderType`으로 `JOIN`된 WebSocket session에서 보낸 경우에만 relay된다.
- `LEAVE` 또는 비정상 연결 종료 시 Backend는 room cleanup을 수행한다.
- 현재 구현은 인메모리 room registry 기준이다. 서버 재시작 시 room 정보는 유지되지 않는다.
- 현재 signaling session validator 기본 구현은 모든 session을 허용한다. 상담 session 존재 여부, 수락 상태, 종료 session, 참여자 권한 검증은 상담 상태 도메인 연동 시 구체 구현으로 교체한다.
- Backend의 현재 검증 범위는 공통 envelope와 enum·JOIN 상태까지다. SDP와 ICE candidate payload 내부 값은 relay 서버가 검증하지 않는다.

---

## 10. 처리 순서 예시

```text
USER      -> BE -> COUNSELOR : JOIN
COUNSELOR -> BE -> USER      : JOIN
USER      -> BE -> COUNSELOR : OFFER
COUNSELOR -> BE -> USER      : ANSWER
USER      -> BE -> COUNSELOR : ICE_CANDIDATE
COUNSELOR -> BE -> USER      : ICE_CANDIDATE
USER      -> BE -> COUNSELOR : LEAVE
```

---

## 11. DataChannel과의 경계

이 문서는 WebRTC 연결 생성을 위한 signaling만 다룬다.

상담 중 화면 동기화 이벤트는 WebRTC 연결 이후 DataChannel로 처리한다.

DataChannel 대상 예시:

- 화살표 전송
- 펜 그리기 stroke 전송
- 그리기 초기화
- 안내 메시지 전송
- 목적지 변경
- 사용자 현재 위치 수정
- 경로 갱신 요청

DataChannel 이벤트 계약은 별도 문서에서 관리한다.

상담자가 공유된 사용자 화면 위에 펜으로 표시하는 기능은 signaling이 아니라 DataChannel 이벤트로 처리한다. Backend signaling 서버는 펜 좌표, 선 색상, 선 굵기, 지우기 이벤트를 해석하지 않는다.

펜 그리기 좌표는 사용자와 상담자의 화면 크기가 달라도 같은 위치에 표시될 수 있도록 공유 화면 기준 정규화 좌표를 사용한다.

```text
x: 0.0 ~ 1.0
y: 0.0 ~ 1.0
```

예시:

```json
{
  "eventType": "DRAW_STROKE",
  "payload": {
    "strokeId": "stroke_abc123",
    "points": [
      { "x": 0.42, "y": 0.31 },
      { "x": 0.44, "y": 0.33 }
    ],
    "color": "#FF3B30",
    "width": 4
  }
}
```

후속 DataChannel 이벤트 명세에서는 최소 다음 이벤트를 정의한다.

- `DRAW_STROKE_START`
- `DRAW_STROKE_MOVE`
- `DRAW_STROKE_END`
- `DRAW_CLEAR`

---

## 12. 상담 화면 공유 및 번역 자막 정책

### 12.1 화면 공유

상담 연결 시 상담자는 사용자의 현재 화면을 볼 수 있어야 한다.

화면 공유는 signaling message의 `payload`로 화면 데이터를 보내는 방식이 아니다. Frontend가 사용자의 화면 또는 앱 화면을 WebRTC media track으로 생성하고, 해당 track을 `RTCPeerConnection`에 추가한다.

Backend는 화면 공유 track을 직접 처리하지 않는다. Backend는 `OFFER`, `ANSWER`, `ICE_CANDIDATE` 메시지를 relay하여 화면 공유 media track이 연결될 수 있도록 signaling만 담당한다.

### 12.2 음성 전달 정책

사용자와 상담자는 서로 다른 언어를 사용하는 상황을 기본 전제로 한다.

원본 음성은 상대방에게 직접 전달하지 않는다. 즉, 사용자 마이크 음성 track과 상담자 마이크 음성 track은 상대방에게 그대로 송출하지 않는 것을 기본 정책으로 한다.

대신 각 클라이언트는 자기 음성을 수집하고, STT 및 번역 처리를 통해 상대방 화면에 번역 자막을 표시한다.

예시:

- 사용자가 영어로 말하면 상담자 화면에는 한국어 자막이 표시된다.
- 상담자가 한국어로 말하면 사용자 화면에는 영어 자막이 표시된다.

### 12.3 번역 자막 이벤트 경계

번역 자막은 WebRTC 연결 생성을 위한 signaling 이벤트가 아니다.

따라서 `JOIN`, `OFFER`, `ANSWER`, `ICE_CANDIDATE`와 같은 signaling message type에 원문 음성 데이터나 번역 자막 본문을 섞지 않는다.

번역 자막은 후속 실시간 상담 이벤트 계약에서 별도로 정의한다. 전송 방식은 후속 구현에서 다음 중 하나로 결정한다.

- WebSocket 기반 caption 이벤트
- WebRTC DataChannel 기반 caption 이벤트

번역 자막 이벤트가 별도로 정의될 때 최소 포함해야 하는 필드는 다음과 같다.

```json
{
  "sessionId": "room_cs_abc123",
  "senderType": "USER",
  "eventType": "TRANSLATED_CAPTION",
  "payload": {
    "sourceLanguage": "en",
    "targetLanguage": "ko",
    "originalText": "Where is exit 3?",
    "translatedText": "3번 출구가 어디인가요?",
    "isFinal": true
  },
  "timestamp": "2026-07-23T10:01:00Z"
}
```

이 문서에서는 번역 자막의 상세 이벤트 계약을 확정하지 않고, signaling 계약과 분리한다는 원칙만 확정한다.
