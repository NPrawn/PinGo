-- 역삼역(station_id=1) B2·B3 경로 그래프 seed (S15P11A206-276)
-- 좌표계: 평면도 캐노니컬 미터 프레임(원점=층간 엘리베이터 EVA, +X=6번출구 방향, 0.19 m/px, provisional)
-- COLMAP 커버 구간(B2: EVB~3번출구 브랜치, B3: 서쪽끝~계단)만 간선으로 연결. 나머지 시설 노드는 참고용(간선 없음).
-- z(map_z)는 명목값(B2=0, B3=-5m). 실제 층고/COLMAP sim3 정합(277) 후 갱신.
-- name = 안정 식별 코드(ASCII). 노드 의미 매핑·좌표계 프레임 규칙 상세는 docs/역삼역_route_node_naming.md 참고.

-- 1) 층: 지하 2층 / 지하 3층
INSERT INTO station_floor (station_id, floor_code, floor_name, floor_order, created_at, updated_at) VALUES
    (1, 'B2', '지하 2층', 2, NOW(6), NOW(6)),
    (1, 'B3', '지하 3층', 3, NOW(6), NOW(6));

-- 2) route_node 3D 지원용 z 컬럼 (라우팅은 미사용, AR/WebXR z 정합·향후 통합 3D용)
ALTER TABLE route_node ADD COLUMN map_z DECIMAL(10, 3) NULL AFTER map_y;

-- 3) 층 id 해석
SET @b2 := (SELECT floor_id FROM station_floor WHERE station_id = 1 AND floor_code = 'B2');
SET @b3 := (SELECT floor_id FROM station_floor WHERE station_id = 1 AND floor_code = 'B3');

-- 4) 노드 (node_id 명시 지정 → 간선 참조 안정화)
INSERT INTO route_node (node_id, station_id, floor_id, node_type, name, map_x, map_y, map_z, is_landmark, created_at, updated_at) VALUES
    -- B2 대합실 (concourse)
    (101, 1, @b2, 'floor_transition', 'EVA',   0.0,   0.0,   0.0, 1, NOW(6), NOW(6)),  -- 층간 엘리베이터 A
    (102, 1, @b2, 'floor_transition', 'EVB',  -0.4,  27.2,   0.0, 1, NOW(6), NOW(6)),  -- 층간 엘리베이터 B (계단 인접, B2<->B3)
    (103, 1, @b2, 'floor_transition', 'EV4', -55.4, -14.8,   0.0, 1, NOW(6), NOW(6)),  -- 4번출구 엘리베이터 (커버 밖)
    (104, 1, @b2, 'floor_transition', 'EV3', -58.4,  42.5,   0.0, 1, NOW(6), NOW(6)),  -- 3번출구 엘리베이터
    (105, 1, @b2, 'floor_transition', 'ESC4',-79.5, -14.2,   0.0, 1, NOW(6), NOW(6)),  -- 4번출구 에스컬레이터 (커버 밖)
    (106, 1, @b2, 'floor_transition', 'ESC3',-80.0,  40.4,   0.0, 1, NOW(6), NOW(6)),  -- 3번출구 에스컬레이터
    (107, 1, @b2, 'facility',         'WC',   39.5,  25.8,   0.0, 1, NOW(6), NOW(6)),  -- 화장실 (커버 밖)
    (108, 1, @b2, 'facility',         'INFO1',118.4, 14.3,   0.0, 1, NOW(6), NOW(6)),  -- 안내센터1 (커버 밖)
    (109, 1, @b2, 'facility',         'INFO2', 96.7, 13.0,   0.0, 1, NOW(6), NOW(6)),  -- 안내센터2 (커버 밖)
    (110, 1, @b2, 'facility',         'NURS',  89.1, 14.7,   0.0, 1, NOW(6), NOW(6)),  -- 수유실 (커버 밖)
    (111, 1, @b2, 'normal',           'B2_N2',-56.7, 17.9,   0.0, 0, NOW(6), NOW(6)),  -- 대합실 복도 (3번출구 분기 방향)
    (112, 1, @b2, 'normal',           'B2_N3',-12.4, 15.6,   0.0, 0, NOW(6), NOW(6)),  -- 대합실 복도 (EVB 인접)
    -- B3 승강장 (platform)
    (201, 1, @b3, 'floor_transition', 'EVA',   0.0,   0.0,  -5.0, 1, NOW(6), NOW(6)),  -- 층간 엘리베이터 A
    (202, 1, @b3, 'floor_transition', 'EVB',  -0.4,  27.2,  -5.0, 1, NOW(6), NOW(6)),  -- 층간 엘리베이터 B (계단 상단측, B2<->B3)
    (203, 1, @b3, 'facility',         'NURS',  90.0, 17.7,  -5.0, 1, NOW(6), NOW(6)),  -- 수유실 (커버 밖)
    (204, 1, @b3, 'normal',           'B3_N2',-91.8, 23.6,  -5.0, 0, NOW(6), NOW(6)),  -- 승강장 서쪽 끝
    (205, 1, @b3, 'normal',           'B3_N3',-25.3, 25.6,  -5.0, 0, NOW(6), NOW(6));  -- 승강장 계단 하단

-- 5) 간선 (커버 구간 + 층간). is_accessible: 계단=0, 그 외=1. bidirectional/active=1.
INSERT INTO route_edge (station_id, from_node_id, to_node_id, distance_m, estimated_time_sec, move_type, is_accessible, is_bidirectional, is_active, created_at, updated_at) VALUES
    -- B2 대합실 (EVB → 3번출구 브랜치)
    (1, 106, 104, 21.7, 18, 'walkway',  1, 1, 1, NOW(6), NOW(6)),  -- ESC3 - EV3
    (1, 111, 104, 24.7, 21, 'walkway',  1, 1, 1, NOW(6), NOW(6)),  -- B2_N2 - EV3
    (1, 112, 111, 44.4, 37, 'walkway',  1, 1, 1, NOW(6), NOW(6)),  -- B2_N3 - B2_N2
    (1, 102, 112, 16.7, 14, 'walkway',  1, 1, 1, NOW(6), NOW(6)),  -- EVB - B2_N3
    -- B3 승강장 (서쪽끝 → 계단)
    (1, 204, 205, 66.5, 55, 'walkway',  1, 1, 1, NOW(6), NOW(6)),  -- B3_N2 - B3_N3 (플랫폼)
    (1, 205, 202, 24.0, 40, 'stair',    0, 1, 1, NOW(6), NOW(6)),  -- B3_N3 - EVB (계단)
    -- 층간 (B2.EVB <-> B3.EVB 엘리베이터 샤프트, 수직거리 추정 5m)
    (1, 102, 202,  5.0, 30, 'elevator', 1, 1, 1, NOW(6), NOW(6));
