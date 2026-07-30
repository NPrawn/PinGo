# PinGo HTTPS/WSS Reverse Proxy 및 STUN/TURN 설정

> 최신화: 2026-07-30


## 목적

PinGo 서비스의 운영 배포를 위해 Nginx reverse proxy, HTTPS/WSS 처리, STUN/TURN 서버 구성 기준을 정리한다.

## 구성 대상

- Nginx
- Backend Spring Boot
- Frontend 정적 파일 또는 컨테이너형 Frontend
- coturn

## Reverse Proxy 구조

운영 환경의 외부 요청은 host Nginx가 먼저 받고 서비스 Nginx로 전달한다. 서비스 Nginx는 정적 Frontend와 Backend API/WSS를 경로별로 처리한다.

```text
Host Nginx :80/:443
└─ Service Nginx
   ├─ /api/ → Backend :8080
   ├─ /ws/  → Backend :8080
   └─ /     → Frontend 정적 파일
```

저장소에는 두 배포 형태의 템플릿이 함께 있다.

- `infra/nginx/conf.d/pingo.conf`: `frontend`, `backend` upstream을 사용하는 컨테이너형 템플릿
- `infra/nginx/host-pingo.conf.example`: host HTTPS Nginx가 내부 service Nginx로 전달하는 템플릿

현재 root `docker-compose.yml`은 MySQL과 coturn만 정의한다. Frontend/Backend/Nginx가 Compose에 포함돼 있다고 가정하지 않는다.

## 설정 파일

Nginx 설정 파일 위치:

```text
infra/nginx/nginx.conf
infra/nginx/conf.d/pingo.conf
infra/nginx/host-pingo.conf.example
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

아래 `/` proxy 예시는 컨테이너형 템플릿에만 해당한다. 현재 Jenkins Frontend CD는 빌드 산출물을 `/opt/pingo/frontend/releases/current`에 배포하므로 운영 service Nginx에서 해당 정적 경로를 제공해야 한다.

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

운영 도메인은 `jenkins.example.invalid`이며 HTTPS/WSS를 사용한다. 인증서의 실제 서버 경로와 갱신 상태는 저장소 밖 운영 설정에서 확인한다.

예상 절차:

1. 도메인을 서버 public IP에 연결한다.
2. 서버 방화벽과 보안 그룹에서 80, 443 포트를 허용한다.
3. certbot으로 인증서를 발급한다.
4. Nginx에 443 SSL server block을 추가한다.
5. 80 포트 HTTP 요청은 HTTPS로 redirect한다.

## STUN/TURN 설정

WebRTC 연결을 위해 coturn을 사용한다.

실제 서버 적용 시 coturn 환경값과 secret을 운영 환경에 맞게 주입한다. 운영 secret과 배포 여부는 저장소만으로 검증할 수 없다.

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

- 운영 인증서 경로·자동 갱신 상태 점검
- 정적 Frontend를 제공하는 service Nginx 설정과 Jenkins 배포 경로 일치 확인
- coturn secret·external IP·relay port 운영 설정 확인
- WebRTC 기능 연동 후 STUN/TURN 연결 테스트
