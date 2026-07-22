# Jenkins CI 설정 문서

> 프로젝트: PinGo
>
> 목적: GitLab Push/MR 이벤트 발생 시 Jenkins가 백엔드 빌드와 테스트를 자동 실행하도록 설정한다.

---

## 1. 현재 CI 구성

| 항목 | 값 |
| --- | --- |
| CI 도구 | Jenkins |
| Jenkins 서버 | EC2 |
| Jenkins 외부 URL | `https://jenkins.example.invalid/jenkins/` |
| Jenkins 내부 포트 | `18080` |
| Reverse Proxy | Nginx |
| Git 저장소 | `REDACTED_GITLAB_URL` |
| 기본 빌드 브랜치 | `develop` |
| 백엔드 빌드 도구 | Gradle |
| 테스트 DB | Docker MySQL 8.4 |

---

## 2. 동작 흐름

1. 개발자가 GitLab에 코드를 push하거나 MR을 생성한다.
2. GitLab Webhook이 Jenkins URL을 호출한다.
3. Jenkins가 `pingo-backend-ci` Job을 실행한다.
4. Jenkins가 GitLab 저장소의 `develop` 브랜치를 checkout한다.
5. Jenkins가 CI용 MySQL 컨테이너를 실행한다.
6. Jenkins가 백엔드 `compileJava`를 실행한다.
7. Jenkins가 백엔드 `test`를 실행한다.
8. Jenkins가 GitLab 커밋 상태를 업데이트한다.
9. 성공/실패 결과를 Jenkins Build History와 GitLab 커밋/MR 화면에 기록한다.

현재 설정은 Webhook 이벤트가 모든 브랜치에서 발생해도 Jenkins Pipeline은 `develop` 브랜치를 기준으로 빌드한다.

---

## 3. Jenkins 접속

브라우저 접속 URL:

```text
https://jenkins.example.invalid/jenkins/
```

Jenkins Location 설정:

```text
Manage Jenkins -> System -> Jenkins Location -> Jenkins URL
https://jenkins.example.invalid/jenkins/
```

---

## 4. EC2 Jenkins 서비스 설정

Jenkins는 기본 포트 대신 `18080` 포트를 사용한다.

systemd override 설정:

```ini
[Service]
Environment="JENKINS_OPTS=--httpPort=18080 --prefix=/jenkins"
```

설정 확인:

```bash
sudo systemctl status jenkins
sudo ss -ltnp | grep 18080
```

서비스 재시작:

```bash
sudo systemctl restart jenkins
```

---

## 5. Nginx HTTPS Reverse Proxy 설정

Jenkins는 내부에서 HTTP로 동작하고, 외부에서는 Nginx가 HTTPS로 프록시한다.

설정 파일:

```text
/etc/nginx/sites-available/jenkins
```

현재 설정:

```nginx
server {
    listen 443 ssl;
    server_name jenkins.example.invalid;

    ssl_certificate /etc/letsencrypt/live/example.invalid/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.invalid/privkey.pem;

    location /jenkins/ {
        proxy_pass http://127.0.0.1:18080/jenkins/;

        proxy_http_version 1.1;
        proxy_request_buffering off;
        proxy_buffering off;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Server $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Port 443;
    }
}
```

설정 검증 및 재시작:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

접속 확인:

```bash
curl -I https://localhost/jenkins/login -k
```

정상 응답 기준:

```text
HTTP/1.1 200 OK
Set-Cookie: JSESSIONID... Secure; HttpOnly; SameSite=Lax
```

HTTPS 접속에서는 `Secure` 쿠키가 붙는 것이 정상이다.

---

## 6. GitLab 연동 Credential

Jenkins에서 GitLab 저장소 checkout과 빌드 상태 업데이트를 위해 Credential을 등록한다.

| 항목 | 값 |
| --- | --- |
| Credential ID | `gitlab-read-repository` |
| 용도 | GitLab 저장소 checkout |
| 권한 | `read_repository` 권한이 있는 GitLab Access Token |

| 항목 | 값 |
| --- | --- |
| Credential ID | `gitlab-status-token` |
| 용도 | GitLab 커밋/MR 상태 업데이트 |
| 권한 | `api`, `read_repository` 권한이 있는 GitLab Access Token |

토큰은 Jenkins Credentials에 저장하고 문서나 코드에 직접 기록하지 않는다.

---

## 7. Jenkins GitLab Connection 설정

Jenkins가 GitLab에 빌드 상태를 전송하려면 GitLab Connection을 등록해야 한다.

설정 위치:

```text
Manage Jenkins -> System -> GitLab
```

설정값:

| 항목 | 값 |
| --- | --- |
| Connection name | `ssafy-gitlab` |
| GitLab host URL | `https://lab.ssafy.com` |
| Credentials | `gitlab-status-token` |

`Test Connection` 결과가 Success여야 한다.

---

## 8. Jenkins Job 설정

Job 이름:

```text
pingo-backend-ci
```

Job 유형:

```text
Pipeline
```

Build Trigger:

```text
빌드를 원격으로 유발
Authentication Token: REDACTED_BUILD_TOKEN
```

Pipeline Script는 repo root의 `Jenkinsfile`로 관리한다.

Frontend CI는 `frontend/package.json`이 있을 때만 조건부로 실행한다. 현재 frontend 코드가 없는 상태에서는 Frontend CI stage가 skip되는 것이 정상이다.

Frontend CI 기준:

- 패키지 매니저: npm
- Node.js: 20 LTS
- lockfile: `frontend/package-lock.json`
- 필수 명령: `npm ci`, `npm run build`
- 선택 명령: `npm run lint`, `npm run test`

---

## 9. Jenkins Pipeline Script

현재 Jenkins Job은 `Pipeline script from SCM` 방식으로 repo root의 `Jenkinsfile`을 사용한다.

```groovy
pipeline {
    agent any

    environment {
        SPRING_PROFILES_ACTIVE = 'local'
        SPRING_DATASOURCE_URL = 'jdbc:mysql://localhost:3306/pingo?serverTimezone=Asia/Seoul&characterEncoding=UTF-8&allowPublicKeyRetrieval=true&useSSL=false'
        SPRING_DATASOURCE_USERNAME = 'pingo'
        SPRING_DATASOURCE_PASSWORD = 'REDACTED'
    }

    stages {
        stage('Backend CI') {
            steps {
                gitlabCommitStatus(name: 'backend-ci') {
                    sh '''
                        docker rm -f pingo-ci-mysql || true
                        docker run -d --name pingo-ci-mysql \
                          -e MYSQL_DATABASE=pingo \
                          -e MYSQL_USER=pingo \
                          -e MYSQL_PASSWORD=REDACTED \
                          -e MYSQL_ROOT_PASSWORD=REDACTED \
                          -p 3306:3306 \
                          mysql:8.4

                        for i in $(seq 1 30); do
                          if docker exec pingo-ci-mysql mysqladmin ping -h localhost -uREDACTED -pREDACTED --silent; then
                            echo "MySQL is ready"
                            break
                          fi
                          echo "Waiting for MySQL..."
                          sleep 2
                        done

                        chmod +x backend/gradlew
                        ./backend/gradlew -p backend compileJava
                        ./backend/gradlew -p backend test
                    '''
                }
            }
            post {
                always {
                    sh 'docker rm -f pingo-ci-mysql || true'
                }
            }
        }

        stage('Frontend CI') {
            when {
                expression { fileExists('frontend/package.json') }
            }
            steps {
                gitlabCommitStatus(name: 'frontend-ci') {
                    dir('frontend') {
                        sh '''
                            npm ci
                            npm run build

                            if npm run | grep -q " lint"; then
                              npm run lint
                            fi

                            if npm run | grep -q " test"; then
                              npm run test -- --run
                            fi
                        '''
                    }
                }
            }
        }
    }
}
```

---

## 10. Docker 설정

Jenkins Pipeline은 테스트용 MySQL 컨테이너를 실행하므로 EC2에 Docker가 필요하다.

설치 확인:

```bash
docker --version
sudo systemctl status docker
```

Jenkins 사용자가 Docker를 실행할 수 있어야 한다.

```bash
id jenkins
```

정상 기준:

```text
groups=jenkins,docker
```

Jenkins 사용자를 Docker 그룹에 추가한 뒤에는 Jenkins를 재시작해야 한다.

```bash
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

---

## 11. GitLab Webhook 설정

GitLab 프로젝트 설정 위치:

```text
Settings -> Webhooks
```

Webhook URL:

```text
https://jenkins.example.invalid/jenkins/buildByToken/build?job=pingo-backend-ci&token=REDACTED_BUILD_TOKEN
```

설정값:

| 항목 | 값 |
| --- | --- |
| Secret token | 비움 |
| Trigger | Push events, Merge request events |
| Branches | All branches |
| SSL verification | 활성화 |

`/job/pingo-backend-ci/build?token=...` URL은 Jenkins CSRF Crumb 보호로 인해 403이 발생할 수 있다. 현재는 `Build Authorization Token Root Plugin`을 사용해 `/buildByToken/build` URL로 호출한다.

---

## 12. 정상 동작 확인

GitLab Webhook 테스트 결과:

```text
Hook executed successfully: HTTP 201
```

Jenkins Console Output 정상 기준:

```text
Started by remote host ...
Checkout
gitlabCommitStatus
MySQL is ready
BUILD SUCCESSFUL
Finished: SUCCESS
```

GitLab 커밋 또는 MR 화면 정상 기준:

```text
Pipeline passed
```

운영 기준:

```text
MR merge 전 GitLab 커밋/MR 화면의 pipeline/check 상태가 passed인지 확인한다.
```

---

## 13. 자주 발생한 문제와 해결

### Jenkins 외부 로그인 실패

원인:

- Nginx가 HTTPS가 아닌 HTTP로 443 포트를 열고 있었다.
- Jenkins가 `Secure` 쿠키를 발급했지만 브라우저 접속은 HTTP였기 때문에 세션이 유지되지 않았다.

해결:

- Nginx 443 포트를 실제 HTTPS로 설정한다.
- Jenkins URL을 `https://jenkins.example.invalid/jenkins/`로 설정한다.

### GitLab Webhook SSL 오류

에러:

```text
SSL_connect returned=1 ... record layer failure
```

원인:

- GitLab이 443 포트를 HTTPS로 접속하려고 했지만 서버가 HTTP로 응답했다.

해결:

- Nginx에 SSL 인증서를 적용한다.
- Webhook URL을 `https://...`로 설정한다.

### GitLab Webhook 403 Crumb 오류

에러:

```text
No valid crumb was included in the request
```

원인:

- Jenkins 기본 build URL이 CSRF Crumb 없이 호출되었다.

해결:

- `Build Authorization Token Root Plugin`을 설치한다.
- Webhook URL을 `/buildByToken/build` 형식으로 변경한다.

### Jenkins checkout 인증 실패

에러:

```text
HTTP Basic: Access denied
```

원인:

- Jenkins에 GitLab 저장소 접근 Credential이 없거나 토큰 권한이 부족하다.

해결:

- `read_repository` 권한이 있는 GitLab Access Token을 Jenkins Credential로 등록한다.
- Pipeline의 `credentialsId`를 `gitlab-read-repository`로 설정한다.

### Jenkins 테스트에서 MySQL 연결 실패

원인:

- Jenkins CI 환경에 MySQL이 실행되지 않았다.

해결:

- Pipeline에서 테스트 시작 전에 Docker MySQL 컨테이너를 실행한다.
- `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`를 CI 환경에 맞게 지정한다.

---

## 14. 향후 개선

현재 설정은 Jenkins 빌드 결과가 GitLab 커밋/MR 화면에 표시되는 수준까지 완료되었다. 이후 다음 작업을 별도 이슈로 분리해 개선한다.

- Jenkins UI Pipeline Script를 repo의 `Jenkinsfile`로 이전
- MR 브랜치 자체를 빌드하는 Multibranch Pipeline 구성
- GitLab MR에서 Jenkins 상태 체크를 필수 통과 조건으로 설정
- 테스트 DB 포트 충돌 방지를 위한 Docker network 구성
- 배포 자동화 CD Pipeline 추가
- Jenkins Credential과 Webhook Token 교체 주기 관리
- Jenkins 접근 계정과 권한 관리 문서화
