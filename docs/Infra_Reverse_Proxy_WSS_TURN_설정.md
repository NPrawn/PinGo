# PinGo HTTPS/WSS Reverse Proxy 및 STUN/TURN 설정

## 목적

PinGo 서비스의 운영 배포를 위해 Nginx reverse proxy, HTTPS/WSS 처리, STUN/TURN 서버 구성 기준을 정리한다.

## 구성 대상

- Nginx
- Backend Spring Boot
- Frontend 서버
- coturn

## Reverse Proxy 구조

운영 환경의 외부 요청은 Nginx가 먼저 받고, 요청 경로에 따라 프론트엔드 서버 또는 백엔드 서버로 전달한다.

```text
Nginx :80/:443
├─ /api/ → backend:8080
├─ /ws/  → backend:8080
└─ /     → frontend:3000
```

현재 설정은 Docker Compose 서비스명을 기준으로 한다.

- `frontend`: 프론트엔드 서버
- `backend`: 백엔드 Spring Boot 서버

## 설정 파일

Nginx 설정 파일 위치:

```text
infra/nginx/nginx.conf
infra/nginx/conf.d/pingo.conf
```

coturn 설정 예시 파일 위치:

```text
infra/coturn/turnserver.conf.example
```

## Nginx 라우팅

`/api/` 요청은 백엔드 서버로 전달한다.

```nginx
location /api/ {
    proxy_pass http://pingo_backend;
}
```

`/ws/` 요청은 WebSocket 연결을 위해 백엔드 서버로 전달한다.

```nginx
location /ws/ {
    proxy_pass http://pingo_backend;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
}
```

`/` 요청은 프론트엔드 서버로 전달한다.

```nginx
location / {
    proxy_pass http://pingo_frontend;
}
```

## WSS 설정

WebSocket 연결을 reverse proxy 뒤에서 정상 처리하기 위해 HTTP/1.1과 upgrade 헤더를 사용한다.

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
```

운영 환경에서 HTTPS 인증서가 적용되면 브라우저는 `wss://` 주소로 WebSocket에 연결한다.

## HTTPS 적용 기준

운영 서버에서는 Let's Encrypt 인증서를 사용한다.

예상 절차:

1. 도메인을 서버 public IP에 연결한다.
2. 서버 방화벽과 보안 그룹에서 80, 443 포트를 허용한다.
3. certbot으로 인증서를 발급한다.
4. Nginx에 443 SSL server block을 추가한다.
5. 80 포트 HTTP 요청은 HTTPS로 redirect한다.

실제 도메인, 인증서 경로, SSL 설정은 운영 서버 구성 시 확정한다.

## STUN/TURN 설정

WebRTC 연결을 위해 coturn을 사용한다.

실제 서버 적용 시 `infra/coturn/turnserver.conf.example`에서 다음 값을 운영 환경에 맞게 변경한다.

```conf
realm=pingo.example.com
user=pingo:CHANGE_ME_TURN_PASSWORD
external-ip=CHANGE_ME_PUBLIC_SERVER_IP
```

TURN 서버 주요 포트:

- `3478`: STUN/TURN
- `5349`: TURN over TLS
- `49152-65535`: relay 포트 범위

서버 방화벽과 클라우드 보안 그룹에서 위 포트를 허용해야 한다.

## 후속 작업

- 운영 도메인 확정
- HTTPS 인증서 발급
- Docker Compose 운영 구성 작성
- 프론트엔드 서버 포트 확정
- WebRTC 기능 연동 후 STUN/TURN 연결 테스트
