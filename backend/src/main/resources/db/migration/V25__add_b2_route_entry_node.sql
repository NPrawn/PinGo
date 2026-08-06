-- B2 하드코딩 시작 위치가 복도 경로에 곧게 진입하도록 중간 노드를 추가한다.
--
-- 기존에는 B2_R003(-13.861, 14.584)과 B2_R004(-1.362, 14.228)가 12.5m짜리
-- 단일 간선으로 이어져 있었다. 시작 위치에서 가장 가까운 B2_R004로 경로가 붙으면서
-- 복도 오른쪽으로 튀었다가 되돌아오는 것처럼 보였으므로, 실측 표시 지점에 진입 노드를
-- 두고 기존 간선을 둘로 나눈다. (S15P11A206-369)

SET @b2 := (SELECT floor_id
            FROM station_floor
            WHERE station_id = 1
              AND floor_code = 'B2');

INSERT INTO route_node
    (node_id, station_id, floor_id, node_type, name,
     map_x, map_y, map_z, is_landmark, created_at, updated_at)
VALUES
    (357, 1, @b2, 'normal', 'B2_R026',
     -5.617, 14.349, 0, 0, NOW(6), NOW(6));

-- B2_R003-B2_R004 직결 간선을 새 진입 노드에서 분할한다.
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
