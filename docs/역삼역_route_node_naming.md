# 역삼역 Route Node 좌표계·네이밍 정의서 (S15P11A206-276)

> 최신화: 2026-07-30

역삼역(`station_id = 1`) 경로 그래프의 좌표계 프레임과 노드 네이밍을 정의한다.
노드 매칭(제어점·시설 연결)·좌표 해석 시 이 문서를 기준으로 한다.

> **이 문서는 전체 구간 재구축 데이터(B1·B2·B3, 노드 142개·간선 205개) 기준이다.**
> 아직 DB에 반영되지 않았다 — 현재 DB는 B2·B3 일부 구간(노드 18개·간선 11개)이다.
>
> | | 노드 | 간선 | 층 |
> |---|---|---|---|
> | **이 문서 (재구축)** | 142 | 205 | B1·B2·B3 |
> | 현재 DB (V4·V5) | 18 | 11 | B2·B3 일부 |
>
> - **`node_id`는 전부 `TBD`다.** 재시드에서 확정한다. 기존 18개 노드와의 대응은 §2.3에 있다.
> - 현재 DB 조회·디버깅이 목적이면 [`V4__seed_yeoksam_b2_b3_route_graph.sql`](../backend/src/main/resources/db/migration/V4__seed_yeoksam_b2_b3_route_graph.sql) + [`V5__seed_yeoksam_facility_and_access_route.sql`](../backend/src/main/resources/db/migration/V5__seed_yeoksam_facility_and_access_route.sql)을 직접 볼 것.
> - 원본 데이터: `역삼역_11_30.json` (version 17). 재시드 마이그레이션이 이 JSON에서 생성된다.

> **provisional 주의**: 축척(0.19 m/px)과 z(±5m)는 잠정값이다. COLMAP↔평면도 sim3 정합(277)과 실측 층고 확보 후 갱신한다.

---

## 1. 좌표계 프레임 (캐노니컬 미터)

평면도 이미지 픽셀 → 미터 좌표 변환 기준. 층마다 원점만 다르고 축척·회전각은 공통.

| 항목 | 값 |
|---|---|
| 단위 | meter |
| 원점 | **B2-B3 층간 엘리베이터 B** → (0, 0) |
| +X 방향 | 6번출구 방향 (승강장 축), 이미지에서 약 −21.28° |
| +Y 방향 | +X에 수직 |
| 축척(mpp) | 0.19 m/px (provisional, 승강장 205m 기준 역산) |
| z(map_z) | B1 = 5, B2 = 0, B3 = −5 (명목값, 실제 층고 미확정) |

원점을 층간 엘리베이터로 잡은 이유는 **여러 층에 같은 평면 위치로 존재하는 수직 구조물**이기 때문이다. 층별 평면도를 서로 정렬하는 기준이 되고, COLMAP 사진에서도 식별할 수 있어 sim3 제어점으로 쓸 수 있다.

> **명칭 주의 — 현재 DB와 A·B가 반대다.** 이 문서의 명명이 기준이고, 재시드 때 DB를 여기에 맞춘다.
> **좌표는 동일하고 A·B 라벨만 반대**이므로 좌표 프레임은 바뀌지 않고 sim3 정합 결과(277)도 유효하다.
>
> | 좌표 | 이 문서 (기준) | 현재 DB (V4) |
> |---|---|---|
> | (0, 0) — 원점 | `B2-B3 엘리베이터 B` | `EVA` (node 101 / 201) |
> | (−0.4, 27.2) | `B2-B3 엘리베이터 A` | `EVB` (node 102 / 202) |
>
> 재시드 전까지 코드·주석·쿼리에서 `EVA`/`EVB`를 만나면 위 표로 옮겨 읽을 것. 특히 [`ai/tools/colmap_align.py`](../ai/tools/colmap_align.py)의 제어점 주석이 `EVB` 표기를 쓴다.

**층별 원점 픽셀 (원본 평면도 기준)**

| 층 | 이미지 | natW×natH | 원점 px | angle | mpp |
|---|---|---|---|---|---|
| B1 | 역삼역_B1.png | 1626×967 | (594, 501) ※미검증 | −21.28° | 0.19 |
| B2 | 역삼역_B2.png | 1624×969 | (622, 512) | −21.28° | 0.19 |
| B3 | 역삼역_B3.png | 1659×948 | (597, 497) | −21.28° | 0.19 |

> **B1 원점은 미검증 추정값이다.** B1에는 원점 기준 엘리베이터가 없어 평면도에 추정으로 얹었다. 층별 평면도가 같은 역 윤곽을 공유하므로 이미지 정합으로 검증할 수 있는데, 예비 측정에서 현재 값과 최대 4.4m 차이가 나왔다(측정법 자체의 오차 ±2m). **B1 내부 좌표는 서로 일관되므로 B1 단독 경로탐색·지도표시에는 영향이 없고, 층 전환 시 위치 정합에만 영향이 있다.** COLMAP 제어점에 B1을 포함해 sim3 잔차로 확정한다.

**변환식** (px → m): `dx = px−ox, dy = py−oy; c=cos(−21.28°), s=sin(−21.28°)`
`x = (dx·c + dy·s)·mpp`, `y = (−dx·s + dy·c)·mpp`

**B0.5 특례 (중간층)**: B1 개찰구 위쪽 중간 레벨은 **별도 층이 아니라 B1 안의 z = 7.5**로 모델링한다. `floor_code`는 `B1`이고 평면도·원점 픽셀도 B1을 그대로 쓴다. 같은 층 안에 높이가 다른 노드가 있으므로 **간선 거리는 3D 유클리드(x, y, z)로 계산**하고, 이 높이차를 넘는 간선의 `move_type`은 `walkway`가 아니라 `stair`/`escalator`여야 한다(그래야 `elevator_only` 경로가 이 구간을 올바르게 제외한다).

> **방위(동서남북)**: +X는 진북이 아니라 승강장 축이다. 지도 북쪽 정렬·나침반·AR heading이 필요하면 `northBearing`(프레임↔진북 오프셋)을 추후 확정해 표시 레이어에서 처리한다. 좌표 자체는 바뀌지 않는다.

---

## 2. 노드 (route_node)

`name`이 안정 식별 **코드(ASCII)**다. 실제 참조 키는 `node_id`이며 재시드 시 확정된다.
좌표는 캐노니컬 미터(§1 프레임). `z`는 층 높이이고, B1 안의 `z = 7.5`는 B0.5 중간층이다.

| 층 | 복도 노드 | 시설 노드 | 합 |
|---|---|---|---|
| B1 | 15 | 31 | 46 |
| B2 | 17 | 36 | 53 |
| B3 | 33 | 10 | 43 |
| **합** | **65** | **77** | **142** |

### 2.1 복도 노드

`node_type`은 `normal`(일반 복도) 또는 `junction`(교차). 이름은 `B{층}_R{순번}`.

**B1** (15개)

| name | node_type | x | y | z | node_id |
|---|---|---|---|---|---|
| `B1_R001` | normal | 113.924 | -26.944 | 5 | TBD |
| `B1_R002` | junction | 112.579 | -19.566 | 5 | TBD |
| `B1_R003` | normal | 118.58 | -19.268 | 5 | TBD |
| `B1_R004` | normal | 123.5 | -19.136 | 5 | TBD |
| `B1_R005` | normal | 147.245 | -19.573 | 5 | TBD |
| `B1_R006` | junction | 103.468 | 4.157 | 5 | TBD |
| `B1_R007` | junction | 114.59 | 5.049 | 5 | TBD |
| `B1_R008` | normal | 123.388 | 5.034 | 5 | TBD |
| `B1_R009` | normal | 102.203 | 25.074 | 5 | TBD |
| `B1_R010` | junction | 113.477 | 18.379 | 5 | TBD |
| `B1_R011` | junction | 121.616 | 18.746 | 5 | TBD |
| `B1_R012` | normal | 113.498 | 47.443 | 5 | TBD |
| `B1_R013` | normal | 118.619 | 48.035 | 5 | TBD |
| `B1_R014` | junction | 124.413 | 47.233 | 5 | TBD |
| `B1_R015` | normal | 144.494 | 48.682 | 5 | TBD |

**B2** (17개)

| name | node_type | x | y | z | node_id |
|---|---|---|---|---|---|
| `B2_R001` | junction | -58.243 | 15.649 | 0 | TBD |
| `B2_R002` | normal | -32.929 | 15.442 | 0 | TBD |
| `B2_R003` | normal | -13.861 | 14.584 | 0 | TBD |
| `B2_R004` | normal | -0.088 | 15.87 | 0 | TBD |
| `B2_R005` | normal | 6.691 | 9.59 | 0 | TBD |
| `B2_R006` | normal | 27.841 | 9.926 | 0 | TBD |
| `B2_R007` | normal | 43.544 | 10.18 | 0 | TBD |
| `B2_R008` | normal | 75.253 | 9.914 | 0 | TBD |
| `B2_R009` | normal | 96.589 | 8.794 | 0 | TBD |
| `B2_R010` | normal | 112.477 | 9.884 | 0 | TBD |
| `B2_R011` | normal | 130.154 | 11.289 | 0 | TBD |
| `B2_R012` | normal | 153.054 | 9.757 | 0 | TBD |
| `B2_R013` | normal | 124.975 | 19.293 | 0 | TBD |
| `B2_R014` | normal | 137.963 | 20.312 | 0 | TBD |
| `B2_R015` | normal | 152.747 | 19.707 | 0 | TBD |
| `B2_R016` | normal | -59.077 | -10.673 | 0 | TBD |
| `B2_R017` | normal | -60.149 | 38.865 | 0 | TBD |

**B3** (33개)

| name | node_type | x | y | z | node_id |
|---|---|---|---|---|---|
| `B3_R001` | normal | -91.253 | 23.183 | -5 | TBD |
| `B3_R002` | normal | -67.857 | 22.993 | -5 | TBD |
| `B3_R003` | normal | -41.085 | 22.97 | -5 | TBD |
| `B3_R004` | normal | -23.477 | 23.008 | -5 | TBD |
| `B3_R005` | normal | -4.888 | 22.595 | -5 | TBD |
| `B3_R006` | normal | 2.974 | 22.729 | -5 | TBD |
| `B3_R007` | normal | 22.598 | 23.105 | -5 | TBD |
| `B3_R008` | normal | 30.475 | 23.555 | -5 | TBD |
| `B3_R009` | normal | 49.121 | 24.331 | -5 | TBD |
| `B3_R010` | normal | 74.392 | 24.234 | -5 | TBD |
| `B3_R011` | normal | 96.171 | 23.286 | -5 | TBD |
| `B3_R012` | normal | 106.264 | 22.653 | -5 | TBD |
| `B3_R013` | normal | 125.057 | 23.067 | -5 | TBD |
| `B3_R014` | normal | 152.541 | 24.549 | -5 | TBD |
| `B3_R015` | normal | 160.945 | 24.788 | -5 | TBD |
| `B3_R016` | normal | 180.499 | 25.673 | -5 | TBD |
| `B3_R017` | normal | -89.491 | 3.607 | -5 | TBD |
| `B3_R018` | normal | -67.473 | 4.663 | -5 | TBD |
| `B3_R019` | normal | -45.091 | 4.459 | -5 | TBD |
| `B3_R020` | normal | -31.213 | 5.301 | -5 | TBD |
| `B3_R021` | normal | -23.425 | 5.861 | -5 | TBD |
| `B3_R022` | normal | -3.999 | 6.064 | -5 | TBD |
| `B3_R023` | normal | 5.911 | 6.058 | -5 | TBD |
| `B3_R024` | normal | 23.305 | 5.866 | -5 | TBD |
| `B3_R025` | normal | 31.017 | 6.21 | -5 | TBD |
| `B3_R026` | normal | 49.955 | 4.521 | -5 | TBD |
| `B3_R027` | normal | 75.643 | 4.331 | -5 | TBD |
| `B3_R028` | normal | 97.385 | 6.427 | -5 | TBD |
| `B3_R029` | normal | 107.318 | 6.947 | -5 | TBD |
| `B3_R030` | normal | 129.855 | 7.477 | -5 | TBD |
| `B3_R031` | normal | 151.774 | 7.536 | -5 | TBD |
| `B3_R032` | normal | 162.004 | 7.63 | -5 | TBD |
| `B3_R033` | normal | 182.507 | 6.446 | -5 | TBD |

### 2.2 시설 노드

이름은 `B{층}_F{순번}`. `accessible`은 휠체어 접근 가능 여부다.
시설도 그래프 노드로 두므로 `facility.linked_node_id`는 **그 시설 자신의 노드**를 가리킨다.

**B1** (31개)

| name | 이름(ko) | node_type | facility_type | x | y | z | acc | node_id |
|---|---|---|---|---|---|---|---|---|
| `B1_F001` | 6번 출구 계단 | floor_transition | stair | 101.027 | -31.457 | 5 | × | TBD |
| `B1_F002` | 6번 출구 | exit | exit | 100.354 | -39.875 | 5 | × | TBD |
| `B1_F003` | B0.5→B1 에스컬레이터 출발점 B | floor_transition | escalator | 112.048 | -14.93 | 7.5 | × | TBD |
| `B1_F004` | 5번 출구 계단 | floor_transition | stair | 104.489 | -19.357 | 5 | × | TBD |
| `B1_F005` | 5번 출구 | exit | exit | 97.454 | -19.34 | 5 | × | TBD |
| `B1_F006` | B0.5-B1 계단 2 | floor_transition | stair | 117.81 | -14.342 | 7.5 | × | TBD |
| `B1_F007` | B1→B0.5 에스컬레이터 도착점 B | floor_transition | escalator | 123.676 | -14.351 | 7.5 | × | TBD |
| `B1_F008` | 7번 출구 계단 | floor_transition | stair | 148.48 | -26.993 | 5 | × | TBD |
| `B1_F009` | 8번 출구 계단 | floor_transition | stair | 151.292 | -18.507 | 5 | × | TBD |
| `B1_F010` | 7번 출구 | exit | exit | 149.166 | -33.989 | 5 | × | TBD |
| `B1_F011` | 8번 출구 | exit | exit | 159.425 | -18.779 | 5 | × | TBD |
| `B1_F012` | B0.5→B1 에스컬레이터 도착점 B | floor_transition | escalator | 113.026 | -2.06 | 5 | × | TBD |
| `B1_F013` | B1-B0.5 계단 2 | floor_transition | stair | 118.837 | -3.237 | 5 | × | TBD |
| `B1_F014` | B1-B2 에스컬레이터 B | floor_transition | escalator | 133.136 | 0.293 | 5 | × | TBD |
| `B1_F015` | B1→B0.5 에스컬레이터 출발점 B | floor_transition | escalator | 123.767 | -1.827 | 5 | × | TBD |
| `B1_F016` | B1-B2 계단 B | floor_transition | stair | 132.772 | 6.14 | 5 | × | TBD |
| `B1_F017` | 약국 | facility | pharmacy | 135.08 | 12.646 | 5 | × | TBD |
| `B1_F018` | 강남파이낸스센터(GFC몰) 연결 출입구 | exit | exit | 100.27 | 28.399 | 5 | × | TBD |
| `B1_F019` | B1→B0.5 에스컬레이터 출발점 A | floor_transition | escalator | 113.403 | 29.691 | 5 | × | TBD |
| `B1_F020` | B0.5→B1 에스컬레이터 도착점 A | floor_transition | escalator | 123.646 | 30.877 | 5 | × | TBD |
| `B1_F021` | B1-B2 에스컬레이터 A | floor_transition | escalator | 133.751 | 26.53 | 5 | × | TBD |
| `B1_F022` | B1-B0.5 계단 1 | floor_transition | stair | 118.419 | 30.88 | 5 | × | TBD |
| `B1_F023` | B1-B2 계단 A | floor_transition | stair | 132.462 | 20.676 | 5 | × | TBD |
| `B1_F024` | B1→B0.5 에스컬레이터 도착점 A | floor_transition | escalator | 113.574 | 43.65 | 7.5 | × | TBD |
| `B1_F025` | 2번 출구 계단 | floor_transition | stair | 105.672 | 47.58 | 5 | × | TBD |
| `B1_F026` | 2번 출구 | exit | exit | 99.725 | 48.451 | 5 | × | TBD |
| `B1_F027` | B0.5-B1 계단 1 | floor_transition | stair | 118.851 | 41.882 | 7.5 | × | TBD |
| `B1_F028` | B0.5→B1 에스컬레이터 출발점 A | floor_transition | escalator | 123.508 | 43.42 | 7.5 | × | TBD |
| `B1_F029` | 1번 출구 계단 | floor_transition | stair | 131.691 | 48.932 | 5 | × | TBD |
| `B1_F030` | 1번 출구 | exit | exit | 146.703 | 66.238 | 5 | × | TBD |
| `B1_F031` | 7·8번 출구 계단 | floor_transition | stair | 136.197 | -19.669 | 5 | × | TBD |

**B2** (36개)

| name | 이름(ko) | node_type | facility_type | x | y | z | acc | node_id |
|---|---|---|---|---|---|---|---|---|
| `B2_F001` | 약국 A | facility | pharmacy | -50.079 | 6.468 | 0 | × | TBD |
| `B2_F002` | B2-B3 계단 6 | floor_transition | stair | -9.571 | 28.108 | 0 | × | TBD |
| `B2_F003` | B2-B3 계단 8 | floor_transition | stair | -9.108 | 1.397 | 0 | × | TBD |
| `B2_F004` | 교통카드 충전기 A | facility | card_charger | -12.433 | 23.863 | 0 | ○ | TBD |
| `B2_F005` | 승차권 발매기 | facility | ticket_machine | -15.641 | 23.533 | 0 | ○ | TBD |
| `B2_F006` | B2-B3 엘리베이터 A | floor_transition | elevator | -0.4 | 27.2 | 0 | ○ | TBD |
| `B2_F007` | B2-B3 계단 5 | floor_transition | stair | 7.989 | 28.83 | 0 | × | TBD |
| `B2_F008` | 개찰구 A | gate | gate | -3.893 | 24.329 | 0 | ○ | TBD |
| `B2_F009` | B2-B3 엘리베이터 B | floor_transition | elevator | 0 | 0 | 0 | ○ | TBD |
| `B2_F010` | B2-B3 계단 7 | floor_transition | stair | 8.164 | 1.881 | 0 | × | TBD |
| `B2_F011` | 개찰구 B | gate | gate | -0.552 | 6.358 | 0 | ○ | TBD |
| `B2_F012` | 물품보관함 | facility | locker | 33.852 | 3.985 | 0 | × | TBD |
| `B2_F013` | 화장실 | facility | restroom | 39.5 | 25.8 | 0 | ○ | TBD |
| `B2_F014` | 약국 B | facility | pharmacy | 42.945 | 4.849 | 0 | × | TBD |
| `B2_F015` | 편의점 | facility | convenience_store | 75.39 | 4.846 | 0 | × | TBD |
| `B2_F016` | 안내센터 A | facility | info | 96.7 | 13 | 0 | ○ | TBD |
| `B2_F017` | 교통카드 충전기 B | facility | card_charger | 117.142 | 4.726 | 0 | × | TBD |
| `B2_F018` | 안내센터 B | facility | info | 118.4 | 14.3 | 0 | ○ | TBD |
| `B2_F019` | 외화 환전기 | facility | currency_exchange_machine | 112.05 | 4.111 | 0 | × | TBD |
| `B2_F020` | B2-B3 계단 2 | floor_transition | stair | 122.767 | 28.292 | 0 | × | TBD |
| `B2_F021` | B2-B3 계단 3 | floor_transition | stair | 139.58 | 0.177 | 0 | × | TBD |
| `B2_F022` | B2-B3 계단 4 | floor_transition | stair | 122.959 | 0.968 | 0 | × | TBD |
| `B2_F023` | 개찰구 C | gate | gate | 130.22 | 3.923 | 0 | ○ | TBD |
| `B2_F024` | 개찰구 D | gate | gate | 130.012 | 24.742 | 0 | ○ | TBD |
| `B2_F025` | B1-B2 에스컬레이터 B | floor_transition | escalator | 153.58 | -0.547 | 0 | × | TBD |
| `B2_F026` | B1-B2 계단 B | floor_transition | stair | 153.512 | 4.496 | 0 | × | TBD |
| `B2_F027` | 뽑기방 | facility | claw_machine_arcade | 160.676 | 13.746 | 0 | × | TBD |
| `B2_F028` | B1-B2 에스컬레이터 A | floor_transition | escalator | 154.45 | 30.055 | 0 | × | TBD |
| `B2_F029` | B1-B2 계단 A | floor_transition | stair | 153.346 | 25.038 | 0 | × | TBD |
| `B2_F030` | B2-B3 계단 1 | floor_transition | stair | 137.253 | 28.072 | 0 | × | TBD |
| `B2_F031` | 4번 출구 엘리베이터 | floor_transition | elevator | -55.4 | -14.8 | 0 | ○ | TBD |
| `B2_F032` | 4번 출구 에스컬레이터 | floor_transition | escalator | -65.495 | -13.173 | 0 | × | TBD |
| `B2_F033` | 4번 출구 | exit | exit | -77.166 | -13.641 | 0 | × | TBD |
| `B2_F034` | 3번 출구 엘리베이터 | floor_transition | elevator | -58.4 | 42.5 | 0 | ○ | TBD |
| `B2_F035` | 3번 출구 에스컬레이터 | floor_transition | escalator | -70.554 | 41.697 | 0 | × | TBD |
| `B2_F036` | 3번 출구 | exit | exit | -79.138 | 41.157 | 0 | × | TBD |

**B3** (10개)

| name | 이름(ko) | node_type | facility_type | x | y | z | acc | node_id |
|---|---|---|---|---|---|---|---|---|
| `B3_F001` | B2-B3 계단 6 | floor_transition | stair | -25.3 | 25.601 | -5 | × | TBD |
| `B3_F002` | B2-B3 엘리베이터 A | floor_transition | elevator | -0.401 | 27.2 | -5 | ○ | TBD |
| `B3_F003` | B2-B3 계단 5 | floor_transition | stair | 21.56 | 27.36 | -5 | × | TBD |
| `B3_F004` | B2-B3 계단 2 | floor_transition | stair | 105.207 | 27.57 | -5 | × | TBD |
| `B3_F005` | B2-B3 계단 1 | floor_transition | stair | 150.602 | 28.811 | -5 | × | TBD |
| `B3_F006` | B2-B3 계단 8 | floor_transition | stair | -22.985 | 0.709 | -5 | × | TBD |
| `B3_F007` | B2-B3 엘리베이터 B | floor_transition | elevator | 0.0 | 0.0 | -5 | ○ | TBD |
| `B3_F008` | B2-B3 계단 7 | floor_transition | stair | 21.789 | 1.58 | -5 | × | TBD |
| `B3_F009` | B2-B3 계단 4 | floor_transition | stair | 105.368 | 1.635 | -5 | × | TBD |
| `B3_F010` | B2-B3 계단 3 | floor_transition | stair | 151.648 | 3.221 | -5 | × | TBD |

### 2.3 기존 `node_id` 재사용 계획

**이 문서의 데이터가 기준이다.** 아래 표는 기존 DB 값을 검토하려는 것이 아니라,
현재 DB에 있는 18개 `route_node` 행을 어떤 신규 노드로 **UPDATE**할지 정한 것이다.

`route_node`는 `user_session.current_node_id`·`consultation_session.current_node_id`가 참조하므로
**DELETE하면 안 된다.** 그래서 기존 행을 재사용하고, 나머지 124개는 INSERT한다.

`V4 (x, y)` 열은 참고용이다 — UPDATE 후에는 신규 좌표가 값이 된다.
`이동` 열은 그 행의 좌표가 얼마나 바뀌는지를 뜻한다.

| node_id | 현 DB name | 층 | 현 DB (x, y) | → UPDATE 대상 | 신규 (x, y) | 이동 |
|---|---|---|---|---|---|---|
| 101 | `EVA` | B2 | (0.0, 0.0) | `B2_F009` (B2-B3 엘리베이터 B) | (0, 0) | 0.00 m |
| 102 | `EVB` | B2 | (-0.4, 27.2) | `B2_F006` (B2-B3 엘리베이터 A) | (-0.4, 27.2) | 0.00 m |
| 103 | `EV4` | B2 | (-55.4, -14.8) | `B2_F031` (4번 출구 엘리베이터) | (-55.4, -14.8) | 0.00 m |
| 104 | `EV3` | B2 | (-58.4, 42.5) | `B2_F034` (3번 출구 엘리베이터) | (-58.4, 42.5) | 0.00 m |
| 105 | `ESC4` | B2 | (-79.5, -14.2) | `B2_F032` (4번 출구 에스컬레이터) | (-65.495, -13.173) | 14.04 m |
| 106 | `ESC3` | B2 | (-80.0, 40.4) | `B2_F035` (3번 출구 에스컬레이터) | (-70.554, 41.697) | 9.53 m |
| 107 | `WC` | B2 | (39.5, 25.8) | `B2_F013` (화장실) | (39.5, 25.8) | 0.00 m |
| 108 | `INFO1` | B2 | (118.4, 14.3) | `B2_F018` (안내센터 B) | (118.4, 14.3) | 0.00 m |
| 109 | `INFO2` | B2 | (96.7, 13.0) | `B2_F016` (안내센터 A) | (96.7, 13) | 0.00 m |
| 110 | `NURS` | B2 | (89.1, 14.7) | **미정** (아래 참고) | — | — |
| 111 | `B2_N2` | B2 | (-56.7, 17.9) | `B2_R001` | (-58.243, 15.649) | 2.73 m |
| 112 | `B2_N3` | B2 | (-12.4, 15.6) | `B2_R003` | (-13.861, 14.584) | 1.78 m |
| 113 | `B2_N4` | B2 | (43.217, 10.504) | `B2_R007` | (43.544, 10.18) | 0.46 m |
| 201 | `EVA` | B3 | (0.0, 0.0) | `B3_F007` (B2-B3 엘리베이터 B) | (0.0, 0.0) | 0.00 m |
| 202 | `EVB` | B3 | (-0.4, 27.2) | `B3_F002` (B2-B3 엘리베이터 A) | (-0.401, 27.2) | 0.00 m |
| 203 | `NURS` | B3 | (90.0, 17.7) | **미정** (아래 참고) | — | — |
| 204 | `B3_N2` | B3 | (-91.8, 23.6) | `B3_R001` | (-91.253, 23.183) | 0.69 m |
| 205 | `B3_N3` | B3 | (-25.3, 25.6) | `B3_F001` (B2-B3 계단 6) | (-25.3, 25.601) | 0.00 m |

기존 18행을 UPDATE하고 나머지 **124개는 INSERT**한다.

**수유실 (node 110 · 203)** — 재구축 데이터에 수유실 노드가 없다. 수유실은 시설로 다루지 않기로
했으므로(`FacilityType`에도 코드가 없다) 이 두 행은 다른 신규 노드에 재사용하거나
`is_active = 0`으로 남긴다. **어느 쪽이든 DELETE하지 않는다.**

**좌표가 2m 이상 이동하는 행** — UPDATE 시 값이 크게 바뀌므로 파급을 확인할 것.

| node_id | 현 DB name | 이동 | 사유 |
|---|---|---|---|
| 105 | `ESC4` (B2) | 14.04 m | 에스컬레이터는 B2와 지상을 잇는 경사 구조물이라 양 끝이 10~14m 떨어져 있다. 현 DB는 출구 쪽 끝, 이 문서는 **B2 쪽 끝**을 노드로 둔다 |
| 106 | `ESC3` (B2) | 9.53 m | 에스컬레이터는 B2와 지상을 잇는 경사 구조물이라 양 끝이 10~14m 떨어져 있다. 현 DB는 출구 쪽 끝, 이 문서는 **B2 쪽 끝**을 노드로 둔다 |

에스컬레이터와 출구를 **별개 노드**로 두는 것이 이 문서의 방식이다 (`B2_F032` 4번 출구 에스컬레이터 / `B2_F033` 4번 출구는 서로 다른 노드).
그래서 기존 `ESC3`·`ESC4`는 에스컬레이터 노드로 UPDATE하고, 출구는 새 노드로 INSERT한다.

파급: **`FR-U-011` 출구 근접 판정이 미터 임계값**이므로 좌표가 10~14m 이동하면 영향을 받는다. 3·4번 출구는 `elevator_only`로 도달 가능한 유일한 출구여서 특히 확인이 필요하다.

---

## 3. 간선 (route_edge)

전부 `bidirectional = 1`, `active = 1`. 거리는 **3D 유클리드(x, y, z)** 다.

### 3.1 이름 규칙 · 종류별 개수

| edgeKey 규칙 | 종류 | 의미 | 개수 |
|---|---|---|---|
| `B{층}_E{순번}` | 복도 간선 | 복도 노드 ↔ 복도 노드 | 71 |
| `B{층}_FE{순번}` | `facility_access` | 복도 노드 ↔ 시설 노드 (접근 통로) | 87 |
| `B{층}_FL{순번}` | `facility_link` | 시설 노드 ↔ 시설 노드 (직결) | 33 |
| `V_B{from}_B{to}_{순번}` | `vertical_transition` | 층간 이동 | 14 |
| | | **합** | **205** |

`move_type` 분포:

| move_type | 개수 |
|---|---|
| `walkway` | 180 |
| `stair` | 14 |
| `escalator` | 9 |
| `elevator` | 2 |

층별 간선 수:

| 층 | 복도 | facility_access | facility_link |
|---|---|---|---|
| B1 | 20 | 37 | 17 |
| B2 | 20 | 30 | 16 |
| B3 | 31 | 20 | 0 |

복도·시설 간선 전체 목록은 표로 옮기지 않는다 — 기계적으로 생성된 데이터이고,
확정 원본은 재시드 마이그레이션 SQL이다. 층간 간선만 아래에 전부 적는다
(짝을 손으로 맞춰 검증한 데이터라서 사람이 확인할 대상이다).

### 3.2 층간 간선 (전체 14개)

같은 수직 구조물의 위·아래 노드를 잇는다. 짝은 평면도 위치로 하나씩 확인했다.

| edgeKey | 구조물 | from | to | move_type | 거리 | acc |
|---|---|---|---|---|---|---|
| `V_B2_B3_001` | B2-B3 엘리베이터 B | `B2_F009` (B2) | `B3_F007` (B3) | elevator | 5.0 m | ○ |
| `V_B2_B3_002` | B2-B3 엘리베이터 A | `B2_F006` (B2) | `B3_F002` (B3) | elevator | 5 m | ○ |
| `V_B2_B3_003` | B2-B3 계단 6 | `B2_F002` (B2) | `B3_F001` (B3) | stair | 16.69 m | × |
| `V_B2_B3_004` | B2-B3 계단 5 | `B2_F007` (B2) | `B3_F003` (B3) | stair | 14.54 m | × |
| `V_B2_B3_005` | B2-B3 계단 8 | `B2_F003` (B2) | `B3_F006` (B3) | stair | 14.77 m | × |
| `V_B2_B3_006` | B2-B3 계단 7 | `B2_F010` (B2) | `B3_F008` (B3) | stair | 14.52 m | × |
| `V_B2_B3_007` | B2-B3 계단 4 | `B2_F022` (B2) | `B3_F009` (B3) | stair | 18.3 m | × |
| `V_B2_B3_008` | B2-B3 계단 3 | `B2_F021` (B2) | `B3_F010` (B3) | stair | 13.41 m | × |
| `V_B2_B3_009` | B2-B3 계단 2 | `B2_F020` (B2) | `B3_F004` (B3) | stair | 18.27 m | × |
| `V_B2_B3_010` | B2-B3 계단 1 | `B2_F030` (B2) | `B3_F005` (B3) | stair | 14.27 m | × |
| `V_B1_B2_001` | B1-B2 에스컬레이터 B | `B1_F014` (B1) | `B2_F025` (B2) | escalator | 21.06 m | × |
| `V_B1_B2_002` | B1-B2 계단 B | `B1_F016` (B1) | `B2_F026` (B2) | stair | 21.4 m | × |
| `V_B1_B2_003` | B1-B2 계단 A | `B1_F023` (B1) | `B2_F029` (B2) | stair | 21.91 m | × |
| `V_B1_B2_004` | B1-B2 에스컬레이터 A | `B1_F021` (B1) | `B2_F028` (B2) | escalator | 21.58 m | × |

휠체어 이용 가능한 층간 이동은 **2개(엘리베이터)** 뿐이고 나머지 12개는 계단·에스컬레이터다.
**B1↔B2에는 엘리베이터가 없다** — 계단 2개, 에스컬레이터 2개뿐이다.
따라서 `elevator_only` 경로는 B1을 경유할 수 없고, 3·4번 출구(B2에서 지상으로 직결)까지만 도달한다.

---

## 4. 코드 값 정의

**node_type** (`RouteNodeType`): `normal`(일반 복도) · `junction`(교차) · `facility`(시설) · `floor_transition`(엘베·에스컬·계단 등 수직전환) · `exit`(출구)

**move_type** (`RouteMoveType`): `walkway` · `stair` · `escalator` · `elevator` · `gate`

**facility_type** (`FacilityType`): `exit` · `gate` · `platform` · `transfer_passage` · `stair` · `escalator` · `elevator` · `restroom` · `station_office` · `ticket_machine` · `card_charger` · `locker` · `info`

### 재시드 데이터가 요구하는 코드값 추가

전체 구간 재구축 데이터에 **현재 enum에 없는 코드값**이 있다. 재시드 전에 enum과 DB 제약을 맞춰야 한다.

| enum | 추가 필요 | 개수 | 비고 |
|---|---|---|---|
| `FacilityType` | `pharmacy` | 3 | 약국 |
| `FacilityType` | `convenience_store` | 1 | 편의점 |
| `FacilityType` | `currency_exchange_machine` | 1 | 환전기 |
| `FacilityType` | `claw_machine_arcade` | 1 | 인형뽑기 |
| `RouteNodeType` | `gate` | 4 | 개찰구 노드. `gate`는 `RouteMoveType`에만 있고 `RouteNodeType`에는 없다 |

`gate`를 `RouteNodeType`에 추가하는 대신 개찰구 노드를 `junction`으로 두는 선택지도 있으나, 개찰구는 **통과 시 태그가 필요한 지점**이어서 경로 안내 문구·요금 안내에서 구분이 필요하므로 별도 타입을 권한다.

### 간선 구분 (`edgeClass`)

재구축 데이터는 시설 관련 간선을 두 종류로 구분한다. **현재 DB 스키마에는 이 구분이 없다** — 재시드 시 컬럼 추가 또는 구분 없이 저장할지 결정해야 한다.

| edgeClass | 의미 | 개수 |
|---|---|---|
| `facility_access` | 복도 노드 ↔ 시설 노드 접근 통로 | 87 |
| `facility_link` | 시설 노드 ↔ 시설 노드 직결 | 33 |

경로 탐색은 두 종류를 구분하지 않는다(둘 다 일반 간선으로 취급). 구분은 **호출·표시 단계**에서 "시설로 들어가는 통로"와 "시설 간 이동"을 나눠 안내하기 위한 것이다.

---

## 5. 커버리지 & 미결

### 현재 DB (V4·V5) 커버리지

- **간선 연결 구간**: B2 = EVB→3번출구 브랜치 및 V5 화장실·안내센터 접근, B3 = 서쪽끝→계단(EVB). EV4·ESC4·NURS·EVA 등은 아직 전체지도 참고용이며 간선이 없다.
- **접근성(`elevator_only`)**: 현재 커버 구간의 B3 승강장→EVB가 계단(STAIR)뿐이라 계단 없는 경로는 미지원.
- **시설 연결 상태**: V5가 `facility` seed와 `linked_node_id`를 추가했다. 다만 연결 노드 자체가 그래프에서 분리된 시설은 경로 도달이 불가능하다.

### 재구축(재시드) 데이터 규모

| 항목 | 현재 DB | 재구축 |
|---|---|---|
| 노드 | 18 | **142** (복도 65 + 시설 77) |
| 간선 | 11 | **205** (복도 71 + `facility_access` 87 + `facility_link` 33 + 층간 14) |
| 층 | B2·B3 | **B1·B2·B3** (+ B1 내 z=7.5 중간층) |
| 연결 요소 | 다수 분리 | **1** (전체 연결) |

`elevator_only` 도달 범위를 시뮬레이션한 결과, **재구축 데이터에서도 엘리베이터만으로는 3·4번 출구까지만 도달**한다. B0.5 중간층과 B1 북측 복도는 계단·에스컬레이터만 있어 도달할 수 없다. 이는 데이터 오류가 아니라 역삼역의 실제 시설 상태이므로, FR-U-009의 "도달 불가 시 안내" 요구사항으로 처리한다.

### 미결

| # | 항목 | 해소 조건 |
|---|---|---|
| ① | 실제 층고로 z·층간 거리 갱신 | 실측 층고 확보 |
| ② | `northBearing` 확정 (방위·AR heading) | FE가 회전 지도/AR을 쓸지 결정 + 출구 2곳 GPS |
| ③ | 축척(0.19 m/px) 확정 | COLMAP sim3 정합(277) 잔차 확인. 단일 측정 역산값이라 비균일 가능성 있음 |
| ④ | **B1 원점 픽셀 확정** | COLMAP 제어점에 B1 포함 후 sim3 잔차 (§1 참고) |
| ⑤ | `FacilityType`·`RouteNodeType` 코드값 추가 | §4 참고. **재시드를 막는 항목** — 없으면 노드 4개·시설 6개가 저장 실패 |
| ⑥ | `edgeClass` 저장 여부 | §4 참고. 재시드 전 |
| ⑦ | 기존 `node_id` 재사용 확정 | 계획은 **§2.3에 정리됨**. 수유실(110·203)만 미정 |
| ⑧ | `FR-U-011` 출구 근접 임계값 재확인 | ESC3·ESC4 좌표가 10~14m 이동한다 (§2.3 참고) |

### 결정된 항목

| 항목 | 결정 |
|---|---|
| 엘리베이터 A·B 라벨 | **이 문서의 명명을 기준으로 한다** (§1 표). 재시드 때 DB를 맞춘다 |
| 수유실 | 시설로 다루지 않는다. `FacilityType`에 코드를 두지 않고, 기존 노드 110·203은 재사용하거나 비활성 (§2.3) |
| B3 엘리베이터 B 좌표 | **수정 완료.** 수직 샤프트이므로 B2와 같은 (0, 0)으로 맞췄다 (기존 0.594/1.353에서 1.48m 이동). `V_B2_B3_001` 거리도 5.21m → 5.0m로 정정 |
