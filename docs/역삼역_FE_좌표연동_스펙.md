# 역삼역 FE 좌표 연동 스펙 (S15P11A206-276)

FE(김은지)가 2D 평면도 위에 **노드·경로·현재위치**를 렌더하기 위한 계약.
좌표 정의 원본은 [`역삼역_route_node_naming.md`](역삼역_route_node_naming.md).

> 핵심: 이미지에 좌표를 미리 박아서 주는 게 아니라, **① 평면도 이미지(정적) + ② 좌표 프레임(변환 규칙) + ③ 미터 좌표 데이터(API)** 를 주면 FE가 프레임으로 미터→픽셀 변환해 이미지 위에 그린다.

---

## 1. 자산 — 평면도 이미지 (정적)

| 층 | 파일 | 크기(px) |
|---|---|---|
| B2 대합실 | 역삼역_B2.png | 1624 × 969 |
| B3 승강장 | 역삼역_B3.png | 1659 × 948 |

- 좌표 프레임은 **이 원본 픽셀 크기 기준**. FE가 다른 크기로 렌더하면 `표시크기/원본크기` 배율을 곱해 스케일할 것.
- 이미지 제공 경로는 지도관리(`floor_map`/FR-A-002)에서 서빙. (호스팅 URL은 인프라와 협의)

## 2. 좌표 프레임 (변환 규칙) — 층별

```json
{
  "B2": { "imageWidth": 1624, "imageHeight": 969, "originPx": [622, 512], "angleDeg": -21.28, "mpp": 0.19, "z": 0 },
  "B3": { "imageWidth": 1659, "imageHeight": 948, "originPx": [597, 497], "angleDeg": -21.28, "mpp": 0.19, "z": -5 }
}
```
- `originPx`: 미터 원점(0,0)의 이미지 픽셀 위치 (= 층간 엘리베이터 EVA)
- `angleDeg`: 이미지 기준 +X축(승강장·6번출구 방향) 각도
- `mpp`: meter per pixel (provisional, 277 정합 후 확정)
- `z`: 층 높이(명목값, 실제 층고 미확정)

## 3. 변환 헬퍼 (그대로 사용 가능)

```js
const FRAME = {
  B2: { ox: 622, oy: 512, angleDeg: -21.28, mpp: 0.19, z: 0 },
  B3: { ox: 597, oy: 497, angleDeg: -21.28, mpp: 0.19, z: -5 },
};

// 미터(x,y) → 원본이미지 픽셀(px,py)  [노드·경로·현재위치를 지도에 그릴 때]
function meterToPixel(x, y, floor) {
  const f = FRAME[floor];
  const t = (f.angleDeg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return { px: f.ox + (c * x - s * y) / f.mpp, py: f.oy + (s * x + c * y) / f.mpp };
}

// 픽셀(px,py) → 미터(x,y)  [지도 클릭 → 좌표, 수동 위치 선택 등]
function pixelToMeter(px, py, floor) {
  const f = FRAME[floor];
  const t = (f.angleDeg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const dx = px - f.ox, dy = py - f.oy;
  return { x: (dx * c + dy * s) * f.mpp, y: (-dx * s + dy * c) * f.mpp };
}
```
검증: `meterToPixel(-0.4, 27.2, "B2")` → `(672, 646)` (EVB), `meterToPixel(0,0,"B2")` → `(622,512)` (EVA).

## 4. 데이터 계약 (API, 미터 좌표)

**경로 조회/생성** (구현됨, `route/` 도메인):
- `POST /api/routes/indoor/options` → 2종 경로 요약 `[{ routeType, available, totalDistanceM, totalTimeSec, unavailableReason }]`
  - `routeType`: `fastest` | `elevator_only`
- `POST /api/routes/indoor` → 상세 경로
  - `steps[]`: `{ order, fromNodeId, toNodeId, distanceM, estimatedTimeSec, moveType, instruction }`
  - `pathNodes[]`: `{ nodeId, floorId, mapX, mapY }` ← **이 mapX/mapY(미터)를 `meterToPixel`로 변환해 경로선 그림**

**현재위치**(위치추정, FR-U-004 / 이정우 담당)는 최종적으로 `{ x, y, floor, ... }` **미터**로 내려옴 → 같은 `meterToPixel`로 마커 표시.

노드 필드 의미: `nodeId`(안정 키), `name`(ASCII 코드 — 의미는 naming 문서 §2), `type`(node_type), `mapX/mapY`(미터), floor.

## 5. 렌더 절차 (FE)

1. 층 선택 → 해당 평면도 이미지 로드
2. 경로 API 호출 → `pathNodes` 미터좌표 수신
3. 각 좌표 `meterToPixel(x,y,floor)` → (표시배율 곱해) 이미지 위 픽셀
4. 노드·경로선·현재위치 마커 렌더
5. 지도 클릭으로 위치 지정 시 `pixelToMeter`로 역변환

## 6. 주의 / 미결

- **표시 스케일**: 프레임 픽셀은 원본 크기(§1) 기준. 렌더 크기가 다르면 배율 보정.
- **z(높이)**: 현재 API 응답 미노출(엔티티에 `map_z` 필드 추가 필요). 우선 프레임의 층별 `z` 사용. AR 화살표 높이용.
- **방위(동서남북)**: +X는 진북이 아니라 승강장 축. 나침반·북쪽정렬·AR heading이 필요하면 `northBearing`(프레임↔진북 오프셋) 확정 후 표시 레이어에서 회전. **좌표는 안 바뀜.**
- **커버 구간만 라우팅**: 간선 연결된 노드만 경로 대상(B2 EVB~3번출구, B3 서쪽끝~계단). 나머지 시설 노드는 표시용.
- **provisional**: mpp(0.19)·z는 잠정. 277(COLMAP sim3) + 실측 층고 후 프레임 값만 갱신하면 FE 로직 변경 없이 반영됨.

## 7. 백엔드 결정 필요 (FE와 협의)

- **(권장) 미터 + 프레임**: 응답은 미터, 프레임은 이 문서로 1회 공유. FE가 변환.
- **(대안) 픽셀 동봉**: 백엔드가 응답에 픽셀좌표도 계산해 넣음. FE 변환 불필요하나 응답이 특정 이미지에 결합.
