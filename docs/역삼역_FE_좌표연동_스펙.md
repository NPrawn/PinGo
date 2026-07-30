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

---

## 8. [제안] WebXR 상대 위치 추적 정렬 (S15P11A206-294)

> **상태: 제안. 신재령·이정우 합의 필요.** 결정 배경은 `기술_의사결정_정리.md` 11장. 아래 변환식의 축·부호는 **실기기 검증 전이며 확정 값이 아니다.**

### 8.1 두 좌표계의 차이

| | 지도 미터 프레임 (§2) | WebXR reference space |
|---|---|---|
| 원점 | 층간 엘리베이터 EVA `(0,0)` | **세션을 시작한 순간의 단말 위치** |
| 방향 기준 | +X = 승강장·6번출구 축 | **세션을 시작한 순간의 단말 방향** |
| 단위 | 미터 | 미터 |
| 평면 축 | `(x, y)` | `(X, Z)` — `Y`가 상하 |

원점과 방향이 매번 달라지므로, XR 좌표를 그대로 쓸 수 없고 **앵커 1쌍으로 정렬**해야 한다.

### 8.2 앵커

위치 확정(VPS 인식 성공 또는 지도 수동 선택) 시점에 다음을 한 쌍으로 저장한다.

| 값 | 출처 |
|---|---|
| `anchor.x`, `anchor.y`, `anchor.floorId` | 확정된 지도 미터 좌표 (`candidates[].mapX/mapY` 또는 `pixelToMeter` 결과) |
| `anchor.xr` = `(X, Z)` | 같은 시점 `XRFrame.getViewerPose()`의 위치 |
| `anchor.forwardXr` | 같은 시점 단말 전방의 XR 평면 단위벡터. `yawDegOf`가 반환하는 ψ에 대해 `(-sin ψ, -cos ψ)`. WebXR 뷰어의 전방이 `-Z`이기 때문이다 |
| `anchor.forwardMap` | 같은 시점 단말 전방의 지도 미터 평면 단위벡터 — **출처 미정, §8.5 참고** |

### 8.3 변환식 (일부 검증됨)

**전방이 `-Z`라는 전제는 실측으로 확인됐다.** 2026-07-30 2차 실기기 검증에서 약 28.7m 직진 시 `Δz`가 단조 감소했다(`WebXR_검증_결과.md` 3.4). 따라서 아래 `dZ`의 부호 반전 없음이 맞다.

**측면 축의 거울 여부는 아직 확인되지 않았다.** 오른쪽 90° 회전 후 직진에서 `Δx`가 양수인지 확인해야 하며, 이 결과에 따라 아래 거울 보정 적용 여부가 갈린다.


```js
// 앵커 시점의 전방 벡터 두 개로 회전을 정한다.
// 각도를 쓰면 0도 기준과 회전 방향 규약을 추가로 합의해야 하므로 벡터로 계산한다.
// 재인식으로 앵커가 갱신될 때까지 cosA·sinA는 고정이다.
const f1 = anchor.forwardXr; // (-sin ψ, -cos ψ)
const f2 = anchor.forwardMap; // 지도 미터 평면 단위벡터
const cosA = f1.x * f2.x + f1.y * f2.y; // 내적
const sinA = f1.x * f2.y - f1.y * f2.x; // 2D 외적

function xrToMeter(pose, anchor) {
  const dX = pose.x - anchor.xr.X;
  const dZ = pose.z - anchor.xr.Z; // 부호 반전 없음
  return {
    x: anchor.x + (cosA * dX - sinA * dZ),
    y: anchor.y + (sinA * dX + cosA * dZ),
    floorId: anchor.floorId, // pose에서 유도하지 않는다. 현재 확정된 층을 그대로 전달한다(8.4)
  };
}
```

**이전 판(각도 뺄셈) 폐기 이유**: `yawOffset = mapYaw - xrYaw`를 그대로 회전 행렬에 넣었는데, 두 각도의 0도 기준과 증가 방향이 정의돼 있지 않았다. `yawDegOf`가 반환하는 값은 `+Y` 축 기준 우수 회전각 ψ이고 이때 전방은 `(-sin ψ, -cos ψ)`다. 지도 방위를 같은 방식으로 정의해 회전각을 풀면 필요한 회전은 `ψ - θ`인데 문서에는 `θ - ψ`가 들어가 있었다. 부호가 반대였다. 전방 벡터 방식은 이 규약 문제 자체를 없앤다.

`dZ`는 부호를 뒤집지 않는다. WebXR 뷰어의 전방이 `-Z`이므로 세션 시작 방향으로 걸으면 `dZ`가 음수가 되지만, 이는 그 방향이 지도 위에서 그려지는 방향일 뿐 오류가 아니다.

반사(축 뒤집힘)를 넣지 않은 근거는 두 프레임의 방향성이 같다는 것이다. `meterToPixel`의 변환 행렬식이 `+1`이라 미터 프레임은 평면도 이미지와 같은 방향성이고, XR을 위에서 내려다본 `(X, Z)` 평면도 `오른쪽·아래` 방향성이다. **이 부분만은 계산상 추론이며 실측 전이다**(`WebXR_검증_결과.md` 체크리스트 16번).

가정이 틀렸다면, 즉 두 평면이 거울 관계라면 보정은 다음과 같다. **`sinA` 부호만 뒤집는 것으로는 맞지 않는다.** 그 경우 대응은 `지도벡터 = 회전 × 반사 × XR벡터`이므로, 반사를 먼저 적용한 뒤 회전을 산출해야 한다.

```js
// parity 가정이 틀렸을 때만 적용한다
const f1m = { x: f1.x, y: -f1.y }; // 반사 후의 XR 전방
const cosA = f1m.x * f2.x + f1m.y * f2.y;
const sinA = f1m.x * f2.y - f1m.y * f2.x;
// xrToMeter 안에서도 dZ를 반전해 사용한다
//   x: anchor.x + (cosA * dX - sinA * (-dZ))
//   y: anchor.y + (sinA * dX + cosA * (-dZ))
```

`sinA`만 뒤집으면 `y` 성분이 반대로 나온다. 수치 검산으로 확인했다.

### 8.4 층 전환과 높이

**절대 높이는 쓰지 않는다.** `local` 공간의 원점 `Y`는 세션 시작 시점 단말 높이(손에 든 높이)라 알 수 없다. 따라서 `pose.y` 값 자체로는 층을 계산할 수 없다.

**변화량은 쓴다.** 앵커 시점 대비 ΔY는 원점 높이와 무관하게 구해지므로 층 전환 감지에 사용한다.

| 값 | 용도 |
|---|---|
| `pose.y` 절대값 | 사용하지 않음 |
| ΔY (앵커 대비) | 층 전환(상승·하강) 감지 |
| `floorId` | 위치 재인식·수동 선택·경로 단계로 확정 |

층 전환 판정은 **경로 단계와 ΔY를 결합**한다. 경로에 `moveType = stair`·`escalator`·`elevator` 간선이 있으므로, 해당 구간을 지나는 중에 프레임 `z` 차이(B2=0, B3=−5)와 부호·크기가 대체로 일치하는 ΔY가 관측되면 층 전환으로 판정한다. 명목값이 provisional이어도 부호와 대략적 크기만 쓰므로 실측 층고 확정 전에도 동작한다.

ΔY 단독으로는 "몇 층인지"를 정할 수 없고 "올라가는 중/내려가는 중"만 정할 수 있다.

층 전환 구간은 추적이 가장 취약한 구간이므로 실측 결과(`WebXR_검증_결과.md` 3.3의 17~19번)에 따라 이 규칙을 다시 조정한다.

### 8.5 미결 — 앵커 시점의 `forwardMap` 출처

`POST /api/vps/localize` 응답 `candidates[]`에는 `nodeId`, `floorId`, `label`, `mapX`, `mapY`, `confidenceScore`만 있고 **방향 값이 없다.** 정렬에는 앵커 시점에 단말이 지도 프레임에서 향한 방향이 반드시 필요하다. 선택지는 다음 셋이다.

| 안 | 내용 | 비고 |
|---|---|---|
| **(권장) 응답에 방향 추가** | `candidates[]`에 지도 프레임 기준 방위 필드 추가 | `HLOC_COLMAP_SPRING_파이프라인_설계서.md` 8.1에 "`forward_colmap`에 `R_anchor`를 적용해 지도 평면에 투영" 산출 방법이 이미 정의돼 있다. AI·BE 계약 추가 필요 |
| 나침반 + `northBearing` | `deviceorientation`으로 진북 기준 방위를 얻고 `northBearing`으로 프레임 방위로 환산 | §6의 `northBearing` 확정 필요. 실내 자기 간섭으로 정확도 낮음 |
| 이동 방향 추정 | 사용자가 몇 미터 걷는 동안의 XR 변위와 경로 진행 방향을 맞춤 | 사용자가 경로 방향으로 걷는다는 가정이 필요. 앵커 직후 오차가 큼 |

**수동 위치 선택(U-06)으로 위치를 확정한 경우에는 어느 안에서도 방위를 알 수 없다.** 이 경우 추적 시작 조건을 어떻게 둘지도 함께 정해야 한다.

권장안을 협의할 때 **각도가 아니라 방향 단위벡터로 받는 것**을 요청한다. 각도로 받으면 0도 기준과 증가 방향을 다시 합의해야 하지만 벡터는 그 논쟁이 없다.

### 8.6 이 절이 바꾸지 않는 것

- §2 프레임 값, §3 변환 헬퍼, §4 API 계약은 변경하지 않는다.
- `mpp`·`z`의 provisional 상태와 미터·픽셀 단위 계약도 그대로다.
