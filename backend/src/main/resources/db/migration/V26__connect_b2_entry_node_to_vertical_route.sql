-- B3에서 3번 출구로 이동할 때 B2_R004 방향으로 생기는 경로 꼬리를 제거한다.
--
-- V25에서 새 진입 노드 B2_R026(357)을 B2_R003-B2_R004 사이에 추가했지만,
-- 층 이동 후 들어오는 세로 경로는 여전히 B2_R023(353)-B2_R004(104)에만 연결되어
-- 있었다. 353과 357을 직접 연결해 경로가 새 진입 노드에서 복도 방향으로 자연스럽게
-- 꺾이도록 한다. (S15P11A206-369)

INSERT INTO route_edge
    (station_id, from_node_id, to_node_id, distance_m, estimated_time_sec,
     move_type, is_accessible, is_bidirectional, is_active, created_at, updated_at)
VALUES
    (1, 353, 357, 11.35, 9, 'walkway', 1, 1, 1, NOW(6), NOW(6));
