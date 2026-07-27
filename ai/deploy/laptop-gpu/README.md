# RTX 노트북 GPU 배포

Windows 노트북의 Docker Desktop와 NVIDIA GPU를 사용해 AI 위치추정 서버를
단일 CUDA worker로 실행한다. 모델과 serving map은 노트북 로컬 디스크에
보관하며 컨테이너에는 bind mount한다.

## 1. 사전 조건

- NVIDIA 드라이버가 설치되어 있어야 한다.
- Docker Desktop은 WSL 2 backend를 사용해야 한다.
- Docker Desktop이 실행 중이어야 한다.
- 노트북 절전과 최대 절전을 비활성화하고 전원을 연결한다.

PowerShell에서 호스트와 Docker의 GPU 인식을 각각 확인한다.

```powershell
nvidia-smi
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi
```

두 명령에서 모두 `NVIDIA GeForce RTX 4050 Laptop GPU`가 표시되어야 한다.

## 2. 환경 파일과 디렉터리 준비

`ai/` 디렉터리에서 환경 예시를 복사한다.

```powershell
Copy-Item laptop-gpu.env.example .env.laptop-gpu
New-Item -ItemType Directory -Force model-cache
```

`.env.laptop-gpu`에서 다음 값을 실제 환경에 맞게 수정한다.

```dotenv
AI_MAP_SET_VERSION=YS-2026-07-26.1
AI_MAP_VERSIONS=YS-B2-2026-07-26.1,YS-B3-2026-07-26.1
AI_INTERNAL_TOKEN=충분히-긴-임의의-내부-토큰
AI_MAPS_HOST_PATH=./runtime_maps
AI_MODEL_CACHE_HOST_PATH=./model-cache
```

`AI_MAPS_HOST_PATH` 아래에는 `AI_MAP_VERSIONS`에 선언한 디렉터리가 모두
있어야 한다. 각 디렉터리는 완성된 serving map 번들이어야 한다.

기본 `AI_HOST_BIND_ADDRESS=127.0.0.1`은 노트북 밖에서 접근할 수 없는 안전한
로컬 실행값이다. 원격 연결이 필요하면 `AI_HOST_BIND_ADDRESS`를 노트북의
Tailscale IPv4로 변경하고 해당 인터페이스의 TCP 8000만 허용한다. 공유기
포트포워딩으로 FastAPI를 공용 인터넷에 직접 노출하지 않는다.

## 3. 이미지 빌드와 모델 준비

CUDA 이미지를 빌드한다.

```powershell
docker compose --env-file .env.laptop-gpu -f compose.laptop-gpu.yml build
```

일반 런타임 의존성은 `requirements.txt`에서 관리한다. HLOC와 LightGlue는
서로 다른 LightGlue direct URL을 선언해 pip 충돌이 발생하므로 검증된 Git
commit만 `requirements.vcs.txt`에 분리하고 Docker에서 `--no-deps`로 설치한다.

컨테이너 안에서 PyTorch가 GPU를 인식하는지 확인한다.

```powershell
docker compose --env-file .env.laptop-gpu -f compose.laptop-gpu.yml `
  --profile tools run --rm model-prepare `
  python -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0))"
```

출력의 첫 줄은 `True`, 둘째 줄은 노트북 GPU 이름이어야 한다. 이어서 모델
가중치를 한 번 다운로드한다.

```powershell
docker compose --env-file .env.laptop-gpu -f compose.laptop-gpu.yml `
  --profile tools run --rm model-prepare
```

모델 준비가 끝나면 운영 컨테이너는 model cache를 읽기 전용으로 사용한다.

## 4. 서버 실행과 확인

```powershell
docker compose --env-file .env.laptop-gpu -f compose.laptop-gpu.yml `
  up -d ai-localization
docker compose --env-file .env.laptop-gpu -f compose.laptop-gpu.yml `
  logs -f ai-localization
```

첫 실행은 모델과 맵 warm loading 때문에 오래 걸릴 수 있다. 로그에서 준비
완료를 확인한 뒤 health endpoint를 호출한다.

```powershell
curl.exe -fsS http://127.0.0.1:8000/health/live
curl.exe -fsS http://127.0.0.1:8000/health/ready
docker exec pingo-ai-localization-gpu `
  python -c "import torch; print(torch.cuda.get_device_name(0))"
```

`/health/ready`가 성공하고 컨테이너 내부에서도 RTX GPU 이름이 표시되어야 한다.
GPU 메모리와 사용률은 별도 PowerShell에서 확인한다.

```powershell
nvidia-smi --loop=1
```

## 5. 운영 원칙

- Uvicorn worker와 GPU 동시 추론은 각각 1개를 유지한다.
- `AI_INTERNAL_TOKEN`을 비워 두거나 저장소에 커밋하지 않는다.
- Query 이미지와 모델 가중치, serving map을 Git에 추가하지 않는다.
- 성능은 warm-up 이후 동일 평가 이미지로 median과 p95를 측정한다.
- 노트북 재부팅 후 Docker Desktop과 컨테이너가 정상 기동했는지 확인한다.

서버를 중지할 때는 다음 명령을 사용한다.

```powershell
docker compose --env-file .env.laptop-gpu -f compose.laptop-gpu.yml down
```
