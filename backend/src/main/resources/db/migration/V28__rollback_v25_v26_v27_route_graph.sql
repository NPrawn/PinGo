-- V25, V26, V27에서 변경한 B2 경로 그래프를 V24 적용 직후 상태로 되돌린다.
--
-- 적용 순서는 원래 변경의 역순이다.
--   1. V27이 추가한 B2_R027(358) 및 연결 간선 제거
--   2. V26이 추가한 B2_R023(353)-B2_R026(357) 간선 제거
--   3. V25가 추가한 B2_R026(357) 및 분할 간선 제거
--   4. V25가 삭제한 B2_R003(103)-B2_R004(104) 간선 복원
--
-- route_edge에는 (from_node_id, to_node_id) 유니크 제약이 없으므로, 재실행이나
-- 수동 복구로 생긴 중복까지 제거한 뒤 V24의 정규 값 한 건만 복원한다.

-- 운영 중 357/358을 참조한 데이터가 있으면 노드 삭제가 FK 오류로 실패한다.
-- 해당 참조는 V24에 이미 존재했던 인접 노드로 보존한다.
--   B2_R026(357) -> B2_R004(104): 기존 간선상에서 가장 가까운 V24 복도 노드
--   B2_R027(358) -> B2_F002(119): V27에서 연결한 기존 층 이동 노드
UPDATE facility
SET linked_node_id = CASE linked_node_id WHEN 357 THEN 104 WHEN 358 THEN 119 END,
    updated_at = NOW(6)
WHERE linked_node_id IN (357, 358);

UPDATE facility
SET accessible_node_id = CASE accessible_node_id WHEN 357 THEN 104 WHEN 358 THEN 119 END,
    updated_at = NOW(6)
WHERE accessible_node_id IN (357, 358);

UPDATE user_session
SET current_node_id = CASE current_node_id WHEN 357 THEN 104 WHEN 358 THEN 119 END
WHERE current_node_id IN (357, 358);

UPDATE consultation_session
SET current_node_id = CASE current_node_id WHEN 357 THEN 104 WHEN 358 THEN 119 END
WHERE current_node_id IN (357, 358);

UPDATE vps_reference_image
SET node_id = CASE node_id WHEN 357 THEN 104 WHEN 358 THEN 119 END
WHERE node_id IN (357, 358);

UPDATE localization_log
SET matched_node_id = CASE matched_node_id WHEN 357 THEN 104 WHEN 358 THEN 119 END
WHERE matched_node_id IN (357, 358);

UPDATE location_share
SET shared_node_id = CASE shared_node_id WHEN 357 THEN 104 WHEN 358 THEN 119 END
WHERE shared_node_id IN (357, 358);

-- FK로 route_node를 참조하는 간선을 먼저 제거한다. 이 조건은 V25~V27에서
-- 추가된 간선 전체(103-357, 357-104, 353-357, 119-358, 358-357)를 포함한다.
DELETE FROM route_edge
WHERE station_id = 1
  AND (from_node_id IN (357, 358) OR to_node_id IN (357, 358));

-- 자식 간선을 모두 제거한 다음 V27, V25 추가 노드를 역순으로 제거한다.
DELETE FROM route_node
WHERE station_id = 1
  AND node_id IN (358, 357);

-- V25가 제거했던 V24 시점의 양방향 walkway 간선을 정확히 한 건으로 복원한다.
DELETE FROM route_edge
WHERE station_id = 1
  AND ((from_node_id = 103 AND to_node_id = 104)
    OR (from_node_id = 104 AND to_node_id = 103));

INSERT INTO route_edge
    (edge_id, station_id, from_node_id, to_node_id, distance_m, estimated_time_sec,
     move_type, is_accessible, is_bidirectional, is_active, created_at, updated_at)
VALUES
    (230, 1, 103, 104, 12.50, 10, 'walkway', 1, 1, 1, NOW(6), NOW(6));
