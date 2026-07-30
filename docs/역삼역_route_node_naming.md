# 역삼역 Route Node 좌표계·네이밍 정의서 (S15P11A206-276)

> 최신화: 2026-07-30

역삼역(`station_id = 1`) B2·B3 경로 그래프의 좌표계 프레임과 노드 네이밍을 정의한다.
기본 그래프는 [`V4__seed_yeoksam_b2_b3_route_graph.sql`](../backend/src/main/resources/db/migration/V4__seed_yeoksam_b2_b3_route_graph.sql),
시설과 접근 간선 보완은 [`V5__seed_yeoksam_facility_and_access_route.sql`](../backend/src/main/resources/db/migration/V5__seed_yeoksam_facility_and_access_route.sql)을 기준으로 한다.
노드 매칭(제어점·시설 연결)·좌표 해석 시 이 문서를 기준으로 한다.

> **provisional 주의**: 축척(0.19 m/px)과 z(±5m)는 잠정값이다. COLMAP↔평면도 sim3 정합(277)과 실측 층고 확보 후 갱신한다.

---

## 1. 좌표계 프레임 (캐노니컬 미터)

평면도 이미지 픽셀 → 미터 좌표 변환 기준. 층마다 원점만 다르고 축척은 공통.

| 항목 | 값 |
|---|---|
| 단위 | meter |
| 원점 | 층간 엘리베이터 EVA (각 층의 EVA 위치) → (0, 0) |
| +X 방향 | 6번출구 방향 (승강장 축), 이미지에서 약 −21.28° |
| +Y 방향 | +X에 수직 |
| 축척(mpp) | 0.19 m/px (provisional, 승강장 205m 기준 역산) |
| z(map_z) | B2 = 0, B3 = −5 (명목값, 실제 층고 미확정) |

**층별 원점 픽셀 (원본 평면도 기준)**

| 층 | 이미지 | natW×natH | 원점 px | angle | mpp |
|---|---|---|---|---|---|
| B2 | 역삼역_B2.png | 1624×969 | (622, 512) | −21.28° | 0.19 |
| B3 | 역삼역_B3.png | 1659×948 | (597, 497) | −21.28° | 0.19 |

**변환식** (px → m): `dx = px−ox, dy = py−oy; c=cos(−21.28°), s=sin(−21.28°)`
`x = (dx·c + dy·s)·mpp`, `y = (−dx·s + dy·c)·mpp`

> **방위(동서남북)**: +X는 진북이 아니라 승강장 축이다. 지도 북쪽 정렬·나침반·AR heading이 필요하면 `northBearing`(프레임↔진북 오프셋)을 추후 확정해 표시 레이어에서 처리한다. 좌표 자체는 바뀌지 않는다.

---

## 2. 노드 매핑 (node_id ↔ name 코드 ↔ 의미)

`name`은 안정 식별 **코드(ASCII)**. 실제 참조 키는 `node_id`. 의미는 아래 표 기준.
`type` = `route_node.node_type` 코드.

### B2 (대합실, floor_code=B2)

| node_id | name(코드) | 의미 | type | (x, y) | 커버 |
|---|---|---|---|---|---|
| 101 | EVA | 층간 엘리베이터 A | floor_transition | (0.0, 0.0) | - |
| 102 | EVB | 층간 엘리베이터 B (계단 인접) | floor_transition | (−0.4, 27.2) | ✅ |
| 103 | EV4 | 4번출구 엘리베이터 | floor_transition | (−55.4, −14.8) | 밖 |
| 104 | EV3 | 3번출구 엘리베이터 | floor_transition | (−58.4, 42.5) | ✅ |
| 105 | ESC4 | 4번출구 에스컬레이터 | floor_transition | (−79.5, −14.2) | 밖 |
| 106 | ESC3 | 3번출구 에스컬레이터 | floor_transition | (−80.0, 40.4) | ✅ |
| 107 | WC | 화장실 | facility | (39.5, 25.8) | 밖 |
| 108 | INFO1 | 안내센터1 | facility | (118.4, 14.3) | 밖 |
| 109 | INFO2 | 안내센터2 | facility | (96.7, 13.0) | 밖 |
| 110 | NURS | 수유실 | facility | (89.1, 14.7) | 밖 |
| 111 | B2_N2 | 대합실 복도 (3번출구 분기 방향) | normal | (−56.7, 17.9) | ✅ |
| 112 | B2_N3 | 대합실 복도 (EVB 인접) | normal | (−12.4, 15.6) | ✅ |
| 113 | B2_N4 | 남쪽 복도 분기(화장실·안내센터 접근) | normal | (43.217, 10.504) | 밖 |

### B3 (승강장, floor_code=B3, z=−5)

| node_id | name(코드) | 의미 | type | (x, y) | 커버 |
|---|---|---|---|---|---|
| 201 | EVA | 층간 엘리베이터 A | floor_transition | (0.0, 0.0) | - |
| 202 | EVB | 층간 엘리베이터 B (계단 상단측) | floor_transition | (−0.4, 27.2) | ✅ |
| 203 | NURS | 수유실 | facility | (90.0, 17.7) | 밖 |
| 204 | B3_N2 | 승강장 서쪽 끝 | normal | (−91.8, 23.6) | ✅ |
| 205 | B3_N3 | 승강장 계단 하단 | normal | (−25.3, 25.6) | ✅ |

> EVA·EVB는 B2·B3에 같은 (x, y)로 존재하고 z(층)만 다른 **수직 엘리베이터 샤프트**다.

---

## 3. 간선 (route_edge)

| from → to | 거리(m) | move_type | is_accessible | 비고 |
|---|---|---|---|---|
| ESC3(106) → EV3(104) | 21.7 | walkway | 1 | B2 |
| B2_N2(111) → EV3(104) | 24.7 | walkway | 1 | B2 |
| B2_N3(112) → B2_N2(111) | 44.4 | walkway | 1 | B2 |
| EVB(102) → B2_N3(112) | 16.7 | walkway | 1 | B2 |
| B3_N2(204) → B3_N3(205) | 66.5 | walkway | 1 | B3 승강장 |
| B3_N3(205) → EVB(202) | 24.0 | stair | 0 | B3 계단 |
| EVB(102) → EVB(202) | 5.0 | elevator | 1 | **층간** B2↔B3 |
| WC(107) → B2_N4(113) | 15.74 | walkway | 1 | V5 화장실 접근 |
| B2_N4(113) → B2_N3(112) | 55.85 | walkway | 1 | V5 본체 복귀 |
| B2_N4(113) → INFO2(109) | 53.54 | walkway | 1 | V5 안내센터 접근 |
| INFO2(109) → INFO1(108) | 21.74 | walkway | 1 | V5 안내센터 연결 |

전부 bidirectional=1, active=1. `elevator_only` 경로는 STAIR/ESCALATOR 제외.

---

## 4. 코드 값 정의

**node_type** (`RouteNodeType`): `normal`(일반 복도) · `junction`(교차) · `facility`(시설) · `floor_transition`(엘베·에스컬·계단 등 수직전환) · `exit`(출구)

**move_type** (`RouteMoveType`): `walkway` · `stair` · `escalator` · `elevator` · `gate`

---

## 5. 커버리지 & 미결

- **간선 연결 구간**: B2 = EVB→3번출구 브랜치 및 V5 화장실·안내센터 접근, B3 = 서쪽끝→계단(EVB). EV4·ESC4·NURS·EVA 등은 아직 전체지도 참고용이며 간선이 없다.
- **접근성(elevator_only)**: 현재 커버 구간의 B3 승강장→EVB가 계단(STAIR)뿐이라 계단 없는 경로는 미지원. COLMAP 확장 시 엘베 접근 통로(walkway) 추가하면 해소.
- **시설 연결 상태**: V5가 `facility` seed와 `linked_node_id`를 추가했다. 다만 연결 노드 자체가 그래프에서 분리된 시설은 경로 도달이 불가능하다.
- **TODO**: ① 실제 층고로 z·층간 거리 갱신 ② `northBearing` 확정(방위/AR) ③ COLMAP sim3 정합(277) 후 축척 확정 ④ 분리된 시설 노드의 접근 간선 추가.
