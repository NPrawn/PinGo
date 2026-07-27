-- 역삼역(station_id=1) B2·B3 시설(facility) seed + 화장실·안내센터 접근 복도 노드/간선 추가 (S15P11A206-287)
-- 좌표계: V4와 동일한 캐노니컬 미터 프레임(원점=EVA, +X=6번출구, 0.19 m/px provisional). facility.map_x/y도 동일 프레임.
-- 그래프 추가: 화장실(107)은 막다른 접근이라 남쪽 복도 노드 113(B2_N4)을 신설해 화장실·안내센터(109)·본체(112)와 연결.
-- 전부 신규 행 추가(안전 패턴, Flyway 정책 §4). 기존 V1~V4 무수정. 거리는 좌표 유클리드 기반 provisional(277 정합 후 갱신).

-- 0) 층 id 해석 (V4에서 생성됨)
SET @b2 := (SELECT floor_id FROM station_floor WHERE station_id = 1 AND floor_code = 'B2');
SET @b3 := (SELECT floor_id FROM station_floor WHERE station_id = 1 AND floor_code = 'B3');

-- 1) 접근 복도 노드 추가 (남쪽 복도 분기: 화장실 spur + 안내센터 라인)
INSERT INTO route_node (node_id, station_id, floor_id, node_type, name, map_x, map_y, map_z, is_landmark, created_at, updated_at) VALUES
    (113, 1, @b2, 'normal', 'B2_N4', 43.217, 10.504, 0.0, 0, NOW(6), NOW(6));  -- 남쪽 복도 분기

-- 2) 간선 추가 (walkway, 양방향, 무장애). 거리 provisional.
INSERT INTO route_edge (station_id, from_node_id, to_node_id, distance_m, estimated_time_sec, move_type, is_accessible, is_bidirectional, is_active, created_at, updated_at) VALUES
    (1, 107, 113, 15.74, 13, 'walkway', 1, 1, 1, NOW(6), NOW(6)),  -- 화장실 - B2_N4 (막다른 진입)
    (1, 113, 112, 55.85, 47, 'walkway', 1, 1, 1, NOW(6), NOW(6)),  -- B2_N4 - B2_N3 (본체 복귀)
    (1, 113, 109, 53.54, 45, 'walkway', 1, 1, 1, NOW(6), NOW(6)),  -- B2_N4 - 안내센터2 (남쪽 라인)
    (1, 109, 108, 21.74, 18, 'walkway', 1, 1, 1, NOW(6), NOW(6));  -- 안내센터2 - 안내센터1

-- 3) facility seed
-- facility_type 코드는 FacilityType enum 기준. is_accessible: 휠체어(무장애) 접근 가능 여부(에스컬레이터·계단=0).
-- map_x/y: 사용자 배치 시설은 에디터 마커 좌표, 엘베·에스컬·계단은 연결 노드 좌표.
INSERT INTO facility (station_id, floor_id, facility_type, name_ko, name_en, map_x, map_y, linked_node_id, is_accessible, is_active, created_at, updated_at) VALUES
    -- B2 대합실
    (1, @b2, 'restroom',       '화장실',               'Restroom',              39.500,  25.800, 107, 1, 1, NOW(6), NOW(6)),
    (1, @b2, 'ticket_machine', '발권기',               'Ticket Machine',       -15.641,  23.533, 112, 1, 1, NOW(6), NOW(6)),
    (1, @b2, 'info',           '안내센터',             'Information Center',     96.700,  13.000, 109, 1, 1, NOW(6), NOW(6)),
    (1, @b2, 'info',           '안내센터',             'Information Center',    118.400,  14.300, 108, 1, 1, NOW(6), NOW(6)),
    (1, @b2, 'card_charger',   '교통카드충전기',       'Transit Card Charger', -12.433,  23.863, 112, 1, 1, NOW(6), NOW(6)),
    (1, @b2, 'gate',           '개찰구',               'Gate',                  -5.651,  24.133, 102, 1, 1, NOW(6), NOW(6)),
    (1, @b2, 'gate',           '개찰구',               'Gate',                  -0.552,   6.358, 112, 1, 1, NOW(6), NOW(6)),
    (1, @b2, 'elevator',       '엘리베이터 A',         'Elevator A',             0.000,   0.000, 101, 1, 1, NOW(6), NOW(6)),
    (1, @b2, 'elevator',       '엘리베이터 B',         'Elevator B',            -0.400,  27.200, 102, 1, 1, NOW(6), NOW(6)),
    (1, @b2, 'elevator',       '3번출구 엘리베이터',   'Exit 3 Elevator',       -58.400,  42.500, 104, 1, 1, NOW(6), NOW(6)),
    (1, @b2, 'elevator',       '4번출구 엘리베이터',   'Exit 4 Elevator',       -55.400, -14.800, 103, 1, 1, NOW(6), NOW(6)),
    (1, @b2, 'escalator',      '3번출구 에스컬레이터', 'Exit 3 Escalator',      -80.000,  40.400, 106, 0, 1, NOW(6), NOW(6)),
    (1, @b2, 'escalator',      '4번출구 에스컬레이터', 'Exit 4 Escalator',      -79.500, -14.200, 105, 0, 1, NOW(6), NOW(6)),
    -- B3 승강장
    (1, @b3, 'elevator',       '엘리베이터 B',         'Elevator B',            -0.400,  27.200, 202, 1, 1, NOW(6), NOW(6)),
    (1, @b3, 'stair',          '계단',                 'Stairs',                -25.300,  25.600, 205, 0, 1, NOW(6), NOW(6));
