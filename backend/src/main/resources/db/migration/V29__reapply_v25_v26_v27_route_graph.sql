-- V28에서 되돌린 V25, V26, V27의 B2 경로 그래프 변경만 다시 적용한다.
--
-- 프론트의 층 이동 완료 위치는 VPS 오류를 피하기 위해 기존 B2_R023(353)을 유지한다.
-- B2_R027(358)은 경로 그래프를 연결하는 중간 노드로만 복원한다.

SET @b2 := (SELECT floor_id
            FROM station_floor
            WHERE station_id = 1
              AND floor_code = 'B2');

-- V25: B2_R003(103)-B2_R004(104) 직결 간선을 B2_R026(357)에서 분할한다.
INSERT INTO route_node
    (node_id, station_id, floor_id, node_type, name,
     map_x, map_y, map_z, is_landmark, created_at, updated_at)
VALUES
    (357, 1, @b2, 'normal', 'B2_R026',
     -5.617, 14.349, 0, 0, NOW(6), NOW(6));

DELETE FROM route_edge
WHERE station_id = 1
  AND ((from_node_id = 103 AND to_node_id = 104)
    OR (from_node_id = 104 AND to_node_id = 103));

INSERT INTO route_edge
    (station_id, from_node_id, to_node_id, distance_m, estimated_time_sec,
     move_type, is_accessible, is_bidirectional, is_active, created_at, updated_at)
VALUES
    (1, 103, 357, 8.25, 7, 'walkway', 1, 1, 1, NOW(6), NOW(6)),
    (1, 357, 104, 4.26, 4, 'walkway', 1, 1, 1, NOW(6), NOW(6));

-- V26: B2_R023(353)에서 새 복도 진입 노드 B2_R026(357)으로 연결한다.
INSERT INTO route_edge
    (station_id, from_node_id, to_node_id, distance_m, estimated_time_sec,
     move_type, is_accessible, is_bidirectional, is_active, created_at, updated_at)
VALUES
    (1, 353, 357, 11.35, 9, 'walkway', 1, 1, 1, NOW(6), NOW(6));

-- V27: 계단 도착점(119)과 복도 진입점(357) 사이의 B2_R027(358)을 복원한다.
INSERT INTO route_node
    (node_id, station_id, floor_id, node_type, name,
     map_x, map_y, map_z, is_landmark, created_at, updated_at)
VALUES
    (358, 1, @b2, 'normal', 'B2_R027',
     -4.986, 27.654, 0, 0, NOW(6), NOW(6));

INSERT INTO route_edge
    (station_id, from_node_id, to_node_id, distance_m, estimated_time_sec,
     move_type, is_accessible, is_bidirectional, is_active, created_at, updated_at)
VALUES
    (1, 119, 358, 4.61, 4, 'walkway', 1, 1, 1, NOW(6), NOW(6)),
    (1, 358, 357, 13.32, 11, 'walkway', 1, 1, 1, NOW(6), NOW(6));
