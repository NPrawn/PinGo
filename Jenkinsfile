pipeline {
    agent any

    options {
        disableConcurrentBuilds()
    }

    environment {
        SPRING_PROFILES_ACTIVE = 'local'
        // Jenkins Credentials(Username with password)에서 주입: DB_CREDS_USR / DB_CREDS_PSW
        DB_CREDS = credentials('pingo-db')
        // Jenkins Credentials(Secret text)에서 주입
        AI_LOCALIZATION_BASE_URL = credentials('pingo-ai-localization-url')
        BACKEND_RELEASE_JAR = '/opt/pingo/backend/releases/pingo-backend.jar'
        BACKEND_BACKUP_JAR = '/opt/pingo/backend/releases/pingo-backend.previous.jar'
        BACKEND_SERVICE_NAME = 'pingo-backend'
        BACKEND_HEALTH_URL = 'http://127.0.0.1:8080/api/health'
        FRONTEND_RELEASE_DIR = '/opt/pingo/frontend/releases/current'
        FRONTEND_BACKUP_DIR = '/opt/pingo/frontend/releases/previous'
        // SERVICE_DOMAIN은 Jenkins 전역 환경변수로 설정
        FRONTEND_HEALTH_URL = "https://${env.SERVICE_DOMAIN}/"
    }

    stages {
        stage('Backend CI') {
            steps {
                gitlabCommitStatus(name: 'backend-ci') {
                    sh '''
                        docker rm -f pingo-ci-mysql || true
                        docker run -d --name pingo-ci-mysql \
                          -e MYSQL_DATABASE=pingo \
                          -e MYSQL_USER="$DB_CREDS_USR" \
                          -e MYSQL_PASSWORD="$DB_CREDS_PSW" \
                          -e MYSQL_RANDOM_ROOT_PASSWORD=yes \
                          -p 3306 \
                          mysql:8.4

                        CI_MYSQL_PORT=$(docker port pingo-ci-mysql 3306/tcp | awk -F: 'NR == 1 {print $NF}')
                        export SPRING_DATASOURCE_USERNAME="$DB_CREDS_USR"
                        export SPRING_DATASOURCE_PASSWORD="$DB_CREDS_PSW"
                        export SPRING_DATASOURCE_URL="jdbc:mysql://localhost:${CI_MYSQL_PORT}/pingo?serverTimezone=Asia/Seoul&characterEncoding=UTF-8&allowPublicKeyRetrieval=true&useSSL=false"
                        echo "CI MySQL host port: ${CI_MYSQL_PORT}"

                        for i in $(seq 1 30); do
                          if docker exec pingo-ci-mysql mysqladmin ping -h localhost -u"$DB_CREDS_USR" -p"$DB_CREDS_PSW" --silent; then
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
                            export VITE_API_BASE_URL=""
			    export VITE_WS_BASE_URL="wss://${SERVICE_DOMAIN}"
			    export VITE_APP_ENV="production"

			    echo "Frontend build env:"
			    printenv | grep '^VITE_'

			    npm run build

			    grep -R "wss://${SERVICE_DOMAIN}" dist/assets >/dev/null

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

        stage('Backend CD') {
            steps {
                gitlabCommitStatus(name: 'backend-cd') {
                    sh '''
                        chmod +x backend/gradlew
                        ./backend/gradlew -p backend bootJar

                        if [ -f "${BACKEND_RELEASE_JAR}" ]; then
                          sudo cp "${BACKEND_RELEASE_JAR}" "${BACKEND_BACKUP_JAR}"
                        fi

                        sudo install -m 644 backend/build/libs/backend-0.0.1-SNAPSHOT.jar "${BACKEND_RELEASE_JAR}"
                        sudo install -d "/etc/systemd/system/${BACKEND_SERVICE_NAME}.service.d"
                        AI_LOCALIZATION_DROP_IN="$(mktemp)"
                        printf '[Service]\nEnvironment="AI_LOCALIZATION_BASE_URL=%s"\n' "${AI_LOCALIZATION_BASE_URL}" > "${AI_LOCALIZATION_DROP_IN}"
                        sudo install -m 644 "${AI_LOCALIZATION_DROP_IN}" "/etc/systemd/system/${BACKEND_SERVICE_NAME}.service.d/10-ai-localization.conf"
                        rm -f "${AI_LOCALIZATION_DROP_IN}"
                        sudo systemctl daemon-reload
                        sudo systemctl restart "${BACKEND_SERVICE_NAME}"

                        for i in $(seq 1 30); do
                          if curl -fsS "${BACKEND_HEALTH_URL}"; then
                            echo "Backend health check succeeded"
                            exit 0
                          fi
                          echo "Waiting for backend health..."
                          sleep 2
                        done

                        echo "Backend health check failed"
                        sudo systemctl status "${BACKEND_SERVICE_NAME}" --no-pager || true
                        exit 1
                    '''
                }
            }
        }

        stage('Frontend CD') {
            when {
                expression { fileExists('frontend/package.json') }
            }
            steps {
                gitlabCommitStatus(name: 'frontend-cd') {
                    sh '''
                        test -f frontend/dist/index.html

                        if [ -d "${FRONTEND_RELEASE_DIR}" ]; then
                          sudo rm -rf "${FRONTEND_BACKUP_DIR}"
                          sudo cp -a "${FRONTEND_RELEASE_DIR}" "${FRONTEND_BACKUP_DIR}"
                        fi

                        sudo rm -rf "${FRONTEND_RELEASE_DIR}"
                        sudo install -d -o www-data -g www-data "${FRONTEND_RELEASE_DIR}"
                        sudo cp -a frontend/dist/. "${FRONTEND_RELEASE_DIR}/"
                        sudo chown -R www-data:www-data "${FRONTEND_RELEASE_DIR}"

                        curl -fsSI "${FRONTEND_HEALTH_URL}"
                        echo "Frontend health check succeeded"
                    '''
                }
            }
        }
    }
}
