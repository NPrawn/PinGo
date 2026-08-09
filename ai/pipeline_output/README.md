# 로컬 파이프라인 산출물

이 디렉터리에서는 본 README와 소형 검증 보고서만 Git으로 관리하며,
나머지 파이프라인 산출물은 의도적으로 Git 추적에서 제외한다.

## 로컬 디렉터리 구조

```text
pipeline_output/
├─ raw_frames/                     # 영상에서 추출한 원본 frame
├─ images/                         # 선별된 COLMAP 기준 이미지 766장
├─ masks/                          # 동적 객체 제거용 mask
├─ mask_worker_parts/              # mask 생성 중간 산출물
├─ detections.json                 # 맵 구축 메타데이터
├─ selection.csv
├─ selection_summary.json
├─ mask_report.csv
└─ colmap_aliked_lightglue_v4_2fps/
   ├─ database.db                  # feature·match·geometry를 포함한 전체 구축 DB
   ├─ sparse/0/                    # 기준으로 사용하는 sparse model
   ├─ dense/                       # 구축·시각화 산출물이며 서빙에는 사용하지 않음
   └─ .stages/                     # 파이프라인 재현용 단계 메타데이터
```

## 보관 및 배포 원칙

- 맵을 다시 구축할 가능성이 있다면 전체 디렉터리를 아티팩트 저장소에 보관한다.
- 이미지, DB, sparse·dense binary 및 대용량 생성 보고서는 Git에 커밋하지 않는다.
- `dense/`, `raw_frames/`, mask는 위치추정 서버에 복사하지 않는다.
- `sparse/0`, 기준 ALIKED feature 및 검색용 descriptor를 버전이 지정된 서빙용
  맵으로 패키징하여 `ai/runtime_maps/` 아래에 생성한다.

원본 파이프라인 산출물은 수정하지 않는 입력 데이터로 취급한다. 패키징 도구는
필요한 데이터를 복사하거나 별도 파일로 내보내야 하며 원본을 직접 변경하면 안 된다.

## 검증 결과

- `verification_report.json`: DB와 sparse observation index의 연결 무결성
- `query_compatibility_report.json`: 원본 이미지 해상도에서 공식 ALIKED N16Rot
  Query descriptor와 기준 feature의 호환성
