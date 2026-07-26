# AI 위치추정 서비스

`ai/`에는 Python 기반 6DoF 위치추정 서비스와 COLMAP 맵을 검증하고
배포용으로 패키징하는 도구가 포함되어 있다.

## Git에 포함할 항목

- `app/`: FastAPI 및 위치추정 엔진 소스 코드
- `tools/`: 맵 검증 및 패키징 도구
- `tests/`: 단위·통합 테스트
- 의존성 잠금 파일, Dockerfile, 설정 예시 및 문서
- 원본 이미지나 모델 데이터가 포함되지 않은 소형 manifest와 검증 보고서

## 아티팩트 저장소 및 AI 서버에 배포할 항목

버전이 지정된 서빙용 맵은 `runtime_maps/{mapVersion}` 아래에 생성한 후
오브젝트 스토리지에 업로드하거나 AI 서버로 복사한다. 서빙용 맵은 다음
항목으로 구성된다.

- `reference_sfm/`: `cameras.bin`, `images.bin`, `points3D.bin` 및 rig 메타데이터
- `reference_features.db`: 기준 이미지 이름, ALIKED keypoint 및 descriptor
- `global_descriptors.*`: 기준 이미지로 생성한 검색용 descriptor
- `manifest.json` 및 파일 checksum

다음 항목은 맵 구축 입력 또는 중간 산출물이므로 Git이나 런타임 서버에
포함하지 않는다.

- `pipeline_output/raw_frames/`
- `pipeline_output/masks/` 및 `mask_worker_parts/`
- `pipeline_output/colmap_*/dense/`
- `reference_features.db` 패키징 후 남는 원본 전체 `database.db`
- 단계 상태 파일과 임시 매칭 데이터

맵 재현이 필요하면 전체 `pipeline_output/`을 복구 가능한 아티팩트 저장소에
보관한다. 런타임 서버에는 서빙용 맵만 배포한다.

## 현재 기준 맵

현재 맵은 최대 keypoint 4,096개를 사용하는 `ALIKED_N16ROT`과
`ALIKED_LIGHTGLUE`로 구축되었다. Sparse observation과 feature DB의 연결도
검증했다. 자세한 결과는
[pipeline_output/verification_report.json](pipeline_output/verification_report.json)에서
확인할 수 있다.

다음 명령으로 검증을 다시 실행할 수 있다.

```bash
python tools/inspect_colmap_map.py \
  --pipeline-output pipeline_output \
  --output pipeline_output/verification_report.json
```

Query feature extractor는 `aliked-n16rot`, keypoint 최대 4,096개, 원본 이미지
해상도(`resize=None`) 설정을 사용한다. 기준 이미지를 이용한 호환성 검사에서
공간적으로 대응하는 feature의 descriptor cosine similarity 중앙값이 0.95
이상으로 측정되었다. 이 맵에 SuperPoint descriptor 또는 크기를 변경한 Query
descriptor를 혼합해서는 안 된다.

맵 빌드 의존성을 설치하고 HLOC 공식 NetVLAD 설정으로 기준 이미지 검색용
descriptor를 생성한다.

```bash
pip install -e ".[map-build]"
pip install --no-deps \
  "git+https://github.com/cvg/Hierarchical-Localization.git@c13273bd0ecc2917a35910fd843712a1c6243193"
python tools/build_retrieval_index.py
```

생성 결과는 기준 이미지 이름을 key로 사용하는 4,096차원 L2 정규화 HDF5다.
이후 다음 명령으로 서버 업로드용 번들을 만든다.

```bash
python tools/build_serving_map.py \
  --map-version YS-2026-07-23.1 \
  --global-descriptors pipeline_output/global_descriptors.h5
```

생성된 `runtime_maps/YS-2026-07-23.1/` 디렉터리는 하나의 불변 단위로
업로드한다. Manifest의 파일 크기와 SHA-256 checksum이 모두 일치하고 sparse
model, reference feature, global descriptor의 이미지 이름이 일치해야 로딩된다.
`build_serving_map.py`는 원본 전체 DB에서 기준 feature 테이블만 내보내므로
이미지 pair match 및 two-view geometry는 서빙용 DB에 포함되지 않는다.

## 백엔드 없는 단일 이미지 위치추정

로컬 serving map이 있으면 사진 파일 하나로 retrieval, LightGlue matching,
2D–3D correspondence, PnP를 차례로 실행할 수 있다.

```bash
python tools/localize_image.py path/to/query.jpg \
  --top-k 20 \
  --focal-length-px 1700
```

`--map`을 생략하면 `runtime_maps/` 아래의 B2/B3 맵을 모두 발견해 전역 검색하고,
Query NetVLAD·ALIKED 특징을 한 번만 추출한 뒤 각 층에서 기하 검증을 수행한다.
특정 층만 확인할 때는 `--floor B2` 또는 `--floor B3`를 사용한다.

`--focal-length-px`를 생략하면 이미지 긴 변의 1.2배를 임시 근삿값으로 사용한다.
이 기본값은 파이프라인 연결을 확인하는 smoke test용이며, 실제 위치 정확도를
평가할 때는 촬영 기기의 보정된 focal length를 전달해야 한다. 출력 좌표는 실내
지도 좌표가 아니라 COLMAP world 좌표다.
