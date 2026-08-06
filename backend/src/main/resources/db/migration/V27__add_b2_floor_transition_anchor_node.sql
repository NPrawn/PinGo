-- 층 이동 완료 후 사용하는 임시 B2 좌표를 실제 경로 그래프 노드로 만든다.
--
-- 프론트는 계단 6을 올라온 뒤 (-4.986, 27.654)에 사용자를 배치하면서 node_id는
-- B2_R023(353, -1.441, 24.902)으로 기록했다. 좌표와 노드가 약 4.5m 어긋나 경로가
-- 353 쪽으로 붙었다가 B2_R026(357)으로 돌아오는 짧은 꼬리가 생겼다.
-- 하드코딩 좌표 자체를 노드로 만들고 계단 도착점(119)-새 복도 진입점(357) 사이에 둔다.
-- (S15P11A206-369)

SET @b2 := (SELECT floor_id
            FROM station_floor
            WHERE station_id = 1
              AND floor_code = 'B2');

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
