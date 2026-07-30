# Python hloc 구현 계획

> 최신화: 2026-07-30
> 상태: 검색·특징 추출·매칭·2D–3D 대응·PnP·품질 판정·다중 맵 API는 구현됨. 평가·운영 계측과 일부 입력 검증은 남아 있다.

> 확인 완료(2026-07-23): 현재 COLMAP sparse map은 `ALIKED_N16ROT`
> (`max_num_features=4096`) 특징과 `ALIKED_LIGHTGLUE` 매칭으로 구축됐다.
> DB descriptor는 128차원 float32이며, sparse model의 모든 2D observation
> index가 DB ALIKED keypoint와 정확히 일치한다. 따라서 특징 재추출이나
> reference model 재삼각화 없이 현재 sparse map을 serving model로 사용한다.

## 구조

```text
localization-server/
├─ app/
│  ├─ main.py                      # FastAPI 실행
│  ├─ api/
│  │  ├─ localization.py           # 위치추정 API
│  │  └─ health.py                 # 상태 확인 API
│  ├─ engine/
│  │  ├─ hloc_engine.py            # 전체 추론 흐름
│  │  ├─ feature_extractor.py      # Query ALIKED N16Rot·NetVLAD
│  │  ├─ image_retriever.py        # 유사 기준 이미지 Top-K 검색
│  │  ├─ feature_matcher.py        # Query–Reference LightGlue 매칭
│  │  ├─ correspondence_builder.py # 2D–3D 대응점 생성
│  │  ├─ pose_estimator.py         # PnP·RANSAC·pose refinement
│  │  └─ quality_evaluator.py      # 위치추정 품질 판정
│  ├─ maps/
│  │  ├─ map_context.py            # 맵별 메모리 데이터
│  │  ├─ map_loader.py             # 맵 아티팩트 로딩
│  │  └─ map_registry.py           # mapVersion 관리
│  ├─ schemas/
│  │  ├─ request.py
│  │  └─ response.py
│  └─ core/
│     ├─ config.py
│     ├─ exceptions.py
│     └─ logging.py
├─ map_builder/
│  ├─ validate_map.py              # 기존 sparse map 검증
│  ├─ build_retrieval_index.py     # NetVLAD descriptor 생성
│  ├─ evaluate_map.py              # 평가 이미지 위치추정
│  └─ create_manifest.py           # 맵 버전 정보 생성
├─ maps/
│  └─ {mapVersion}/
│     ├─ manifest.json
│     ├─ reference_sfm/
│     │  ├─ cameras.bin
│     │  ├─ images.bin
│     │  └─ points3D.bin
│     ├─ reference_features.db
│     ├─ global_descriptors.h5
│     └─ quality_report.json
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ evaluation/
├─ requirements.lock
├─ pyproject.toml
└─ Dockerfile
```

온라인 위치추정 흐름은 다음과 같다.

```text
사용자 이미지
→ 이미지 검증·전처리
→ NetVLAD 특징 추출
→ 유사 기준 이미지 Top-K 검색
→ ALIKED N16Rot 특징 추출
→ LightGlue 매칭
→ Query 2D–Map 3D 대응점 생성
→ PnP·RANSAC·pose refinement
→ 사용자 카메라 6DoF pose와 품질 지표 반환
```

Python 서비스의 책임은 다음으로 제한한다.

- COLMAP sparse map과 ALIKED reference feature 아티팩트 로딩
- Query 이미지의 retrieval, feature extraction, matching
- 2D–3D correspondence와 6DoF pose 계산
- 매칭 수, inlier 비율, 재투영 오차 등 기하 품질 반환

다음 항목은 Python 서비스에서 처리하지 않는다.

- 사용자 세션과 비즈니스 상태
- COLMAP 좌표를 실내 지도 좌표로 변환하는 작업
- 층 및 경로 노드 매핑
- WebXR 상대 위치 추적
- 최종 사용자 fallback 결정과 DB 로그 저장

## 구현 계획

### 체크포인트 1. 기존 맵 검증

- [x] `cameras.bin`, `images.bin`, `points3D.bin` 존재 확인
- [x] `pycolmap.Reconstruction`으로 sparse model 로딩 확인
- [x] COLMAP 구축에 사용한 원본 기준 이미지 766장 보존 확인
- [x] COLMAP DB의 ALIKED keypoint·descriptor 766개 image row 확인
- [x] LightGlue match와 two-view geometry 54,740개 pair 확인
- [x] stage metadata에서 `ALIKED_N16ROT`·`ALIKED_LIGHTGLUE` 확인
- [x] 등록 이미지 이름과 COLMAP DB image name 일치 확인
- [x] 등록 이미지 766장 모두 유효한 3D point observation 보유 확인
- [x] 1,505,366개 3D track observation의 `point2D_idx` 전수 검증

완료 기준:

```text
현재 ALIKED sparse map을 hloc reference model로 직접 사용할 수 있다.
```

검증 결과 keypoint 좌표 오차와 3D track 역참조 오류가 모두 0건이므로
기존 camera pose를 이용한 reference model 재삼각화는 수행하지 않는다.
검증은 `ai/tools/inspect_colmap_map.py`로 재현한다.

### 체크포인트 2. 맵 아티팩트 구성

- [x] 기존 sparse model을 `reference_sfm/`으로 구성
- [x] 원본 DB에서 image·ALIKED keypoint·descriptor만 `reference_features.db`로 정리
- [x] 기준 이미지 NetVLAD descriptor 생성
- [x] 기준 이미지 이름과 descriptor index 연결
- [x] `manifest.json` 생성
- [x] mapVersion, hloc commit, pycolmap 및 모델 설정 기록
- [x] 아티팩트 SHA-256 checksum 생성

완료 기준:

```text
하나의 mapVersion을 독립적으로 검증하고 로딩할 수 있다.
```

### 체크포인트 3. Query 이미지 전처리

- [x] JPEG·PNG magic byte 검증
- [x] 이미지 decode 실패 처리
- [x] 최대 파일 크기와 pixel 수 제한
- [x] EXIF orientation 적용
- [x] ALIKED local feature는 원본 해상도(`resize=None`) 사용으로 확정
- [x] NetVLAD 입력 resize를 ALIKED local feature 전처리와 분리
- [ ] resize가 필요한 단계에서만 비율에 맞게 camera intrinsics 변환
- [ ] 카메라 모델, 해상도 및 파라미터 검증

완료 기준:

```text
사용자 이미지를 hloc 입력 tensor와 pycolmap.Camera로 변환할 수 있다.
```

### 체크포인트 4. 이미지 검색

- [x] NetVLAD 모델을 서버 시작 시 1회 로딩
- [x] 기준 이미지 descriptor를 메모리에 로딩
- [x] Query NetVLAD descriptor 추출
- [x] Query–Reference descriptor 유사도 계산
- [x] 유사 기준 이미지 Top-K 선택
- [x] 검색 후보가 없는 경우 상태 처리
- [x] 초기 `topK=20` 적용
- [ ] 평가 결과를 바탕으로 `topK` 조정

완료 기준:

```text
사용자 이미지와 유사한 기준 이미지 이름 목록을 반환한다.
```

### 체크포인트 5. 특징점 추출과 매칭

- [x] ALIKED N16Rot 모델을 서버 시작 시 1회 로딩
- [x] Query ALIKED N16Rot feature extractor 구현
- [x] 기준 이미지 호환성 probe 확인: 1px 이내 2,078점,
      descriptor cosine median 0.9558
- [x] 검색된 기준 이미지의 feature 읽기
- [x] LightGlue 모델을 서버 시작 시 1회 로딩
- [x] Query–Reference 특징점 매칭
- [x] 기준 이미지별 match 개수 기록
- [x] 매칭 부족 상태 구분
- [x] Query feature를 공용 reference HDF5에 기록하지 않고 메모리에서 처리

완료 기준:

```text
Query 2D 특징점과 기준 이미지 2D 특징점의 대응을 얻는다.
```

### 체크포인트 6. 2D–3D 대응점 생성

- [x] 기준 이미지 keypoint index 조회
- [x] keypoint가 관측하는 COLMAP `point3D_id` 조회
- [x] Query keypoint와 COLMAP 3D point 연결
- [x] 3D point가 없는 match 제거
- [x] 중복 또는 충돌하는 2D–3D 대응점 정리
- [x] 서로 다른 기준 이미지의 supporting 정보 기록
- [x] 최소 correspondence 개수 검사

완료 기준:

```text
PnP 입력인 Query 2D point와 COLMAP 3D point 배열을 생성한다.
```

### 체크포인트 7. 6DoF pose 계산

- [x] `pycolmap.estimate_and_refine_absolute_pose()` 연결
- [x] PnP 및 RANSAC 설정 적용
- [x] pose refinement 적용
- [x] hloc의 `cam_from_world` 결과 검증
- [x] 카메라 중심 `C = -Rᵀt` 계산
- [x] API 출력용 `world_from_camera` pose로 변환
- [x] position과 quaternion 직렬화
- [x] PnP 실패 시 `POSE_ESTIMATION_FAILED` 반환
- [x] PnP 실패 시 가장 가까운 기준 카메라 pose를 반환하는 fallback 금지

완료 기준:

```text
COLMAP 좌표계에서 사용자 카메라의 위치와 방향을 계산한다.
```

### 체크포인트 8. 품질 판정

- [x] 전체 match 수 계산
- [x] 2D–3D correspondence 수 계산
- [x] RANSAC inlier 수 계산
- [x] inlier ratio 계산
- [x] median 재투영 오차 계산
- [x] supporting reference image 수 계산
- [x] `LOCALIZED`와 `LOW_GEOMETRIC_QUALITY` 구분
- [ ] 평가셋 결과를 기반으로 threshold 조정

초기 판정 기준:

```text
numInliers ≥ 25
inlierRatio ≥ 0.20
medianReprojectionError ≤ 8px
```

이 수치는 구현 시작값이며 실제 평가 결과 없이 운영 기준으로 확정하지 않는다.

완료 기준:

```text
pose 계산 성공과 신뢰할 수 있는 pose를 구분해 반환한다.
```

### 체크포인트 9. FastAPI 구현

- [x] FastAPI application factory와 readiness 상태 관리 구현
- [x] `POST /internal/v1/maps/{mapVersion}/localize`
- [x] `GET /health/live`
- [x] `GET /health/ready`
- [x] multipart 이미지와 camera metadata 요청 구현
- [x] request ID 생성 및 전파
- [x] 공통 오류 상태와 응답 schema 정의
- [x] 단계별 처리시간 응답 추가
- [x] 내부 인증 token 검증

주요 응답 상태:

```text
LOCALIZED
INVALID_IMAGE
INVALID_INTRINSICS
MAP_NOT_LOADED
NO_RETRIEVAL_CANDIDATE
INSUFFICIENT_MATCHES
POSE_ESTIMATION_FAILED
LOW_GEOMETRIC_QUALITY
OVERLOADED
INTERNAL_ERROR
```

완료 기준:

```text
HTTP 요청으로 이미지와 카메라 정보를 받아 COLMAP 기준 6DoF pose를 반환한다.
```

### 체크포인트 10. 모델과 맵 사전 로딩

- [x] ALIKED N16Rot·NetVLAD·LightGlue를 process 시작 시 로딩
- [x] FastAPI lifespan에서 `pycolmap.Reconstruction` 사전 로딩
- [x] 기준 이미지 global descriptor 메모리 로딩
- [x] 이미지 이름–COLMAP image ID index 생성
- [x] mapVersion별 불변 `MapContext` 생성
- [ ] 서버 시작 후 warm-up inference 실행
- [x] 맵 미설정·로딩 실패 시 readiness 실패 처리
- [x] 모델 로딩 실패 시 readiness 실패 처리

완료 기준:

```text
요청마다 모델과 맵을 다시 로딩하지 않는다.
```

### 체크포인트 11. 동시성과 임시 데이터

- [x] GPU당 동시 추론 1건으로 시작
- [x] 최대 대기 queue 2건 적용
- [x] queue 초과 시 `OVERLOADED` 즉시 반환
- [ ] GPU 하나당 Uvicorn worker 1개 적용
- [x] 요청별 mutable 전역 상태 공유 금지
- [x] Query 이미지를 메모리에서 처리하여 요청별 임시 디렉터리를 만들지 않음
- [x] Query 이미지와 중간 결과를 요청 종료 후 참조하지 않음
- [ ] CUDA OOM 상태 처리 및 readiness 반영

완료 기준:

```text
동시 요청에서도 Query feature, match 및 pose 결과가 서로 섞이지 않는다.
```

### 체크포인트 12. 테스트와 성능 검증

- [ ] 맵 구축에 사용하지 않은 평가 이미지 준비
- [ ] 평가 이미지의 실제 촬영 위치 ground truth 기록
- [ ] 위치추정 성공률 측정
- [ ] 위치 오차 median·p95 측정
- [ ] 방향 오차 측정
- [ ] 조명, 시점, 흔들림 조건별 평가
- [ ] 다른 장소 이미지 및 손상 이미지 테스트
- [ ] 동시 요청 부하 테스트
- [ ] 전체 추론시간 p95 4초 이내 목표 검증
- [ ] 모든 실패 상태가 timeout 전에 반환되는지 확인

완료 기준:

```text
reference에 포함되지 않은 평가 이미지에서 정확도와 처리시간 기준을 충족한다.
```

### 최종 완료 조건

- [x] 기존 ALIKED N16Rot·LightGlue sparse map을 reference model로 사용한다.
- [x] 사용자 이미지에서 COLMAP 좌표계 기준 6DoF pose를 계산한다.
- [x] 반환 위치는 기준 이미지 pose가 아니라 새로 추정한 Query 카메라 중심이다.
- [x] PnP 실패 시 기준 카메라 pose를 대체 결과로 반환하지 않는다.
- [x] AI 모델과 map artifact를 요청 전에 로딩한다.
- [x] pose와 함께 기하 품질 지표를 제공한다.
- [x] mapVersion 단위로 맵을 선택·교체할 수 있다.
- [x] 사용자 이미지를 추론 종료 후 보관하지 않는다.
- [x] FastAPI에서 내부 위치추정 API를 제공한다.
