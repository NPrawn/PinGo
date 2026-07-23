# Backend 배포 및 Rollback 절차

## 1. 목적

본 문서는 PinGo Spring backend를 EC2 서버에 배포하고, 장애 발생 시 이전 정상 jar로 rollback하는 절차를 정리한다.

배포 자동화는 Jenkins `Backend CD` stage를 기준으로 한다. 수동 배포와 rollback은 장애 대응 또는 Jenkins 배포 실패 시 사용한다.

---

## 2. 서버 기준 정보

| 항목 | 값 |
| --- | --- |
| 서버 도메인 | `jenkins.example.invalid` |
| SSH 사용자 | `ubuntu` |
| Backend 실행 포트 | `8080` |
| Backend service | `pingo-backend` |
| Jenkins URL | `https://jenkins.example.invalid/jenkins/` |
| Jenkins 내부 포트 | `18080` |
| Nginx HTTPS 포트 | `443` |
| DB | Docker MySQL 8.4 |
| DB container | `pingo-mysql` |

---

## 3. 주요 경로

| 용도 | 경로 |
| --- | --- |
| 배포용 repository | `/opt/pingo/app` |
| Backend release jar | `/opt/pingo/backend/releases/pingo-backend.jar` |
| Backend 이전 jar 백업 | `/opt/pingo/backend/releases/pingo-backend.previous.jar` |
| Backend 환경변수 파일 | `/opt/pingo/backend/config/pingo-backend.env` |
| Backend application log | `/opt/pingo/backend/logs/application.log` |
| Backend error log | `/opt/pingo/backend/logs/error.log` |
| systemd service 파일 | `/etc/systemd/system/pingo-backend.service` |
| Nginx site 설정 | `/etc/nginx/sites-available/jenkins` |

---

## 4. Backend 실행 환경

Backend는 systemd service로 실행한다.

```bash
sudo systemctl status pingo-backend --no-pager
sudo systemctl start pingo-backend
sudo systemctl restart pingo-backend
sudo systemctl stop pingo-backend
```

서버 재시작 후 자동 실행 여부 확인:

```bash
sudo systemctl is-enabled pingo-backend
```

정상 기준:

```text
enabled
```

---

## 5. 환경변수 관리

운영 환경변수는 Git에 포함하지 않고 EC2 파일로 관리한다.

```text
/opt/pingo/backend/config/pingo-backend.env
```

파일 권한 기준:

```bash
sudo chmod 600 /opt/pingo/backend/config/pingo-backend.env
sudo ls -al /opt/pingo/backend/config
```

주의 사항:

- DB password, secret, token은 Git repository에 커밋하지 않는다.
- Jenkinsfile에는 secret 값을 직접 작성하지 않는다.
- 민감 정보가 포함된 로그를 Jira, GitLab MR, 문서에 그대로 첨부하지 않는다.

---

## 6. Jenkins CD 배포 흐름

Jenkins `Backend CD` stage는 다음 순서로 동작한다.

1. `backend/gradlew bootJar`로 backend jar를 생성한다.
2. 기존 `/opt/pingo/backend/releases/pingo-backend.jar`를 `pingo-backend.previous.jar`로 백업한다.
3. 새 jar를 `/opt/pingo/backend/releases/pingo-backend.jar`로 교체한다.
4. `pingo-backend` systemd service를 재시작한다.
5. `http://127.0.0.1:8080/api/health`로 health check를 수행한다.
6. health check가 성공하면 배포 성공으로 처리한다.
7. health check가 실패하면 Jenkins build를 실패 처리한다.

정상 Jenkins 로그 기준:

```text
BUILD SUCCESSFUL
sudo systemctl restart pingo-backend
OK
Backend health check succeeded
Finished: SUCCESS
```

---

## 7. 수동 배포 절차

Jenkins를 사용하지 않고 직접 배포해야 할 경우에만 사용한다.

### 7.1 최신 코드 반영

```bash
cd /opt/pingo/app
git switch develop
git pull origin develop
```

### 7.2 Backend jar 빌드

```bash
cd /opt/pingo/app
chmod +x backend/gradlew
./backend/gradlew -p backend clean bootJar
```

정상 기준:

```text
BUILD SUCCESSFUL
```

### 7.3 기존 jar 백업

```bash
sudo cp /opt/pingo/backend/releases/pingo-backend.jar \
  /opt/pingo/backend/releases/pingo-backend.previous.jar
```

### 7.4 신규 jar 배포

```bash
sudo install -m 644 \
  /opt/pingo/app/backend/build/libs/backend-0.0.1-SNAPSHOT.jar \
  /opt/pingo/backend/releases/pingo-backend.jar
```

### 7.5 서비스 재시작

```bash
sudo systemctl restart pingo-backend
sudo systemctl status pingo-backend --no-pager
```

정상 기준:

```text
Active: active (running)
```

---

## 8. 배포 후 검증

### 8.1 내부 health 확인

EC2 내부에서 확인한다.

```bash
curl -i http://127.0.0.1:8080/api/health
```

정상 기준:

```text
HTTP/1.1 200
OK
```

### 8.2 외부 health 확인

Nginx reverse proxy를 거쳐 외부 HTTPS로 확인한다.

```bash
curl -i https://jenkins.example.invalid/api/health
```

정상 기준:

```text
HTTP/1.1 200
OK
```

### 8.3 WSS handshake 확인

```bash
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: SGVsbG9Xb3JsZDEyMzQ1Ng==" \
  -H "Sec-WebSocket-Version: 13" \
  https://jenkins.example.invalid/ws/signaling
```

정상 기준:

```text
HTTP/1.1 101
Upgrade: websocket
Connection: upgrade
```

### 8.4 Backend WebSocket 로그 확인

```bash
tail -n 40 /opt/pingo/backend/logs/application.log
```

정상 기준:

```text
WebSocket connected
WebSocket disconnected
```

---

## 9. Rollback 절차

배포 후 health check 실패, 서비스 기동 실패, 주요 API 장애가 발생하면 이전 jar로 rollback한다.

### 9.1 현재 서비스 상태 확인

```bash
sudo systemctl status pingo-backend --no-pager
```

### 9.2 이전 jar 존재 확인

```bash
ls -al /opt/pingo/backend/releases/pingo-backend.previous.jar
```

이전 jar가 없으면 jar rollback을 수행할 수 없다. 이 경우 Git 이전 commit으로 재빌드하거나 Jenkins 이전 성공 build 산출물을 사용해야 한다.

### 9.3 현재 jar 보관

문제 분석을 위해 현재 jar를 별도 파일로 보관한다.

```bash
sudo cp /opt/pingo/backend/releases/pingo-backend.jar \
  /opt/pingo/backend/releases/pingo-backend.failed.jar
```

### 9.4 이전 jar 복구

```bash
sudo cp /opt/pingo/backend/releases/pingo-backend.previous.jar \
  /opt/pingo/backend/releases/pingo-backend.jar
```

### 9.5 서비스 재시작

```bash
sudo systemctl restart pingo-backend
sudo systemctl status pingo-backend --no-pager
```

### 9.6 Rollback 검증

```bash
curl -i http://127.0.0.1:8080/api/health
curl -i https://jenkins.example.invalid/api/health
```

정상 기준:

```text
HTTP/1.1 200
OK
```

---

## 10. 장애 확인 로그

Backend 장애 발생 시 다음 순서로 확인한다.

### 10.1 systemd 로그

```bash
sudo journalctl -u pingo-backend -n 120 --no-pager
```

### 10.2 Spring application log

```bash
tail -n 120 /opt/pingo/backend/logs/application.log
```

### 10.3 Spring error log

```bash
tail -n 120 /opt/pingo/backend/logs/error.log
```

### 10.4 Nginx 로그

```bash
sudo tail -n 120 /var/log/nginx/access.log
sudo tail -n 120 /var/log/nginx/error.log
```

### 10.5 Docker MySQL 상태

```bash
cd /opt/pingo/app
sudo docker compose ps
sudo docker logs --tail 120 pingo-mysql
```

---

## 11. Nginx 설정 검증 및 반영

Nginx 설정 수정 후에는 반드시 문법 검사를 먼저 수행한다.

```bash
sudo nginx -t
```

정상일 때만 reload한다.

```bash
sudo systemctl reload nginx
```

Nginx 설정 오류가 있을 때 `reload`하면 기존 정상 proxy가 깨질 수 있으므로 `nginx -t` 실패 상태에서는 reload하지 않는다.

---

## 12. 배포 전 체크리스트

- [ ] `develop` 브랜치 최신 상태 확인
- [ ] Jenkins CI 성공 확인
- [ ] Backend CD stage 실행 대상 확인
- [ ] EC2 MySQL `pingo-mysql` 실행 상태 확인
- [ ] `pingo-backend` service active 상태 확인
- [ ] 민감 정보가 Git 변경사항에 포함되지 않았는지 확인
- [ ] 배포 전 기존 jar 백업 가능 여부 확인

---

## 13. 배포 후 체크리스트

- [ ] Jenkins `Backend CD` stage 성공 확인
- [ ] 내부 health `http://127.0.0.1:8080/api/health` 성공 확인
- [ ] 외부 health `https://jenkins.example.invalid/api/health` 성공 확인
- [ ] WSS handshake `https://jenkins.example.invalid/ws/signaling` 성공 확인
- [ ] `pingo-backend` service active 상태 확인
- [ ] application log에 치명 오류가 없는지 확인
- [ ] Jira에 배포 결과와 검증 로그를 기록

---

## 14. 현재 제한 사항

- 현재 backend profile은 최소 배포 검증을 위해 `local`을 사용한다.
- 운영 profile 분리는 별도 작업으로 진행한다.
- Jenkins CD는 동일 EC2 서버에서 Jenkins와 backend가 함께 실행되는 구조를 기준으로 한다.
- 이전 jar 백업은 1개만 유지한다.
- 자동 rollback은 아직 구현하지 않았으며, 장애 시 본 문서의 수동 rollback 절차를 사용한다.
