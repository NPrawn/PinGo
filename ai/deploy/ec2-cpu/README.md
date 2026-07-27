# CPU EC2 배포

이 구성은 GPU와 S3 없이 단일 EC2에서 Python 위치추정 서버를 운영한다.
AI API는 `127.0.0.1:8000`에만 publish하고 Spring이 같은 호스트에서 호출한다.

## 영속 디렉터리

```text
/opt/pingo/ai/
├─ maps/
│  ├─ YS-B2-2026-07-26.1/
│  └─ YS-B3-2026-07-26.1/
└─ model-cache/
```

두 디렉터리는 EC2 root volume 또는 별도 EBS volume에 둔다. 별도 EBS volume을
사용하면 `DeleteOnTermination=false`로 설정하고 주기적으로 EBS snapshot을 만든다.
instance store에는 맵과 모델을 두지 않는다.

## 최초 준비

```bash
sudo install -d -m 755 /opt/pingo/ai/maps
sudo install -d -m 755 -o 10001 -g 10001 /opt/pingo/ai/model-cache
cd /opt/pingo/source/ai
cp ec2-cpu.env.example .env
docker compose --env-file .env -f compose.cpu.yml build
docker compose --env-file .env -f compose.cpu.yml --profile tools \
  run --rm model-prepare
```

모델 다운로드 후에는 `/opt/pingo/ai/model-cache`를 tar로 백업하거나 EBS snapshot에
포함한다. 운영 컨테이너 기동 때 외부 모델 서버에 의존하지 않도록 한다.

## 맵 전송

개발 PC에서 serving map을 만든 후 EC2의 임시 경로로 전송한다.

```bash
rsync -av --progress \
  ai/runtime_maps/YS-B2-2026-07-26.1/ \
  ubuntu@EC2_HOST:/opt/pingo/ai/maps/.YS-B2-2026-07-26.1.incoming/
```

EC2에서 manifest와 checksum 검증이 끝난 뒤 최종 버전 디렉터리로 rename한다.
같은 `mapVersion` 디렉터리는 덮어쓰지 않는다. 롤백은 `.env`의
`AI_MAP_VERSIONS`에서 해당 층 버전을 이전 버전으로 바꾸고 컨테이너를
재시작한다. `AI_MAP_SET_VERSION`은 Spring이 호출하는 논리적 역 맵 버전이며,
B2/B3 아티팩트 버전과 분리한다.

## 실행과 확인

```bash
docker compose --env-file .env -f compose.cpu.yml up -d
curl -fsS http://127.0.0.1:8000/health/live
curl -fsS http://127.0.0.1:8000/health/ready
```

Spring은 외부 Nginx를 거치지 않고 다음 내부 주소를 호출한다.

```text
POST http://127.0.0.1:8000/internal/v1/maps/YS-2026-07-26.1/localize
```

맵 세트 버전으로 요청하면 B2/B3를 모두 비교한다. 특정 아티팩트 버전으로
요청하면 해당 층만 추론하므로 장애 분석과 하위 호환에 사용할 수 있다.

CPU 추론은 `AI_MAX_CONCURRENT_INFERENCES=1`, `AI_DEFAULT_TOP_K=5`부터 시작한다.
Top-K 20은 CPU에서 LightGlue를 최대 20회 실행하므로 초기 운영값으로 사용하지
않는다. 실제 평가 이미지로 정확도와 p95를 함께 측정한 뒤 Top-K를 조정한다.
