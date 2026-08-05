-- 출구에 "계단 없이 갈 때 안내할 노드"를 둔다 (S15P11A206-345)
--
-- 배경: 역삼역 3·4번 출구는 에스컬레이터와 엘리베이터가 나란히 있는데, 그래프에서 출구 노드
--       (3번 = 153, 4번 = 150)에 닿는 길은 에스컬레이터 쪽 하나뿐이다. 엘리베이터 노드
--       (151·148)는 복도에 붙은 잎이고 출구 노드로 이어지지 않는다 — 타면 지상으로 올라가므로
--       실제로 이어지지 않는 것이 맞다. 두 노드는 20m 떨어져 있어 간선으로 이으면 없는 통로가
--       생긴다.
--
--       그래서 elevator_only 는 지금 두 갈래 다 틀린다. 에스컬레이터 간선이 walkway 로 들어가
--       있어 그대로 지나가고(화면에는 "계단 없음"으로 뜬다), 그 간선을 escalator 로 바로잡으면
--       출구에 닿을 길이 사라져 "접근 가능한 경로 없음"이 된다. 엘리베이터가 있는데도 그렇다.
--
-- 해결: 출구마다 접근 경로용 도착 노드를 따로 둔다. elevator_only 는 이 노드로 안내하고
--       fastest 는 출구 노드로 안내한다. 휠체어·유모차 사용자에게는 엘리베이터가 곧 그 출구로
--       나가는 길이므로, 엘리베이터가 종점인 것이 맞다.
--
--       **두 유형은 값이 같아져도 구분한다.** 3번 출구는 엘리베이터가 복도에서 4.03m,
--       에스컬레이터 경유 출구가 19.38m 라 엘리베이터 쪽이 오히려 짧다. 그래도 fastest 를
--       엘리베이터로 보내지 않는다 — 두 카드는 "어느 이동 수단으로 나가는가"를 고르는 것이고,
--       거리로 하나가 다른 하나를 삼키면 고를 것이 없어진다.
--
-- 값이 없는 출구는 NULL 이다. 계단 없이 나갈 수 없다는 뜻이며, 그때 elevator_only 는 종전대로
-- 출구 노드로 풀린다. B1 출구 7 개가 여기 해당한다(B1↔B2 구간에 엘리베이터가 없다).

ALTER TABLE facility
    ADD COLUMN accessible_node_id BIGINT NULL
        COMMENT '계단·에스컬레이터를 쓸 수 없을 때 안내할 도착 노드. NULL 이면 접근 대안이 없다'
        AFTER linked_node_id,
    ADD CONSTRAINT fk_facility_accessible_node
        FOREIGN KEY (accessible_node_id) REFERENCES route_node (node_id);

-- linked_node_id 로 매칭한다. V10 과 같은 이유다 — 노드 ID 는 시드에 명시돼 있어 안정적이다.
--   3번 출구(node 153) -> 3번 출구 엘리베이터(node 151)
--   4번 출구(node 150) -> 4번 출구 엘리베이터(node 148)
UPDATE facility
SET accessible_node_id = 151,
    updated_at         = NOW(6)
WHERE station_id = 1
  AND facility_type = 'exit'
  AND linked_node_id = 153;

UPDATE facility
SET accessible_node_id = 148,
    updated_at         = NOW(6)
WHERE station_id = 1
  AND facility_type = 'exit'
  AND linked_node_id = 150;
