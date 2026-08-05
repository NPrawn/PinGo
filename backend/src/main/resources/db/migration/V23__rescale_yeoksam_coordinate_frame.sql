-- 역삼역 좌표 축척을 실측으로 보정한다 (S15P11A206-351)
--
-- `mpp` 0.19 는 승강장 205m 단일 측정에서 역산한 값이었고(V9 주석), 실측과 맞지 않았다.
-- B3 승강장에서 두 점을 잡아 재니 이렇다.
--
--   픽셀 거리 335.963px  ->  에디터 좌표 63.833m (335.963 x 0.19)
--   실측                    43m
--   보정계수 k = 43 / 63.833 = 0.67363          새 mpp = 0.19 x k = 0.128
--
-- **지금 좌표계는 실제보다 1.484배 크다.** 그래서 두 가지가 함께 어긋나 있었다.
--
--   1. 화면의 모든 거리가 1.484배 과장됐다. B3 서쪽 끝에서 3번 출구까지 205m 로 안내하는데
--      실제로는 138m 다.
--   2. WebXR 추적 중 내 점이 실제보다 느리게 움직였다. XR 은 실제 미터로 이동량을 주는데
--      그것을 부풀려진 좌표에 그대로 더하니, 1m 걸어도 지도에서는 1/0.19 = 5.3px 만
--      움직인다. 참값은 1/0.128 = 7.8px 이므로 67% 만 움직인 셈이다.
--
-- **세 층에 같은 k 를 쓴다.** 층별로 다른 값을 쓰면 B2·B3 가 공유하는 엘리베이터 A·B 가
-- 어긋난다 — 두 층에서 같은 캐노니컬 좌표여야 층 이동 간선이 같은 지점을 잇고 COLMAP 정합
-- 기준점 EV_A 도 성립한다. 같은 k 면 양쪽이 같이 줄어 일치가 유지되고 원점 (0,0) 도 그대로다.
--
-- **map_z 는 곱하지 않는다.** 층 높이(B1 5 / B2 0 / B3 -5, B0.5 7.5)는 픽셀에서 나온 값이
-- 아니라 사람이 넣은 실제 미터다. 곱하면 5m 층고가 3.37m 가 된다. 그대로 두면 수직 간선의
-- 3D 거리에서 수평 성분만 줄어든다.
--
-- **scale_m_per_px 도 같은 k 로 바꾸므로 평면도 위 그림은 움직이지 않는다.**
--
--   px = origin_px + R(θ)·(k·map) / (0.19·k)        <- k 가 약분된다
--
-- 노드가 화면에서 움직였으면 어딘가 k 를 빠뜨렸거나 두 번 곱한 것이다.
--
-- 함께 손대야 하는 것이 하나 더 있다. `application.yaml` 의 `vps.anchoring` 계수 —
-- COLMAP 좌표를 캐노니컬 미터로 옮기는 값이라 `m` 6개·`offset` 2개·`accuracy-m` 에
-- 같은 k 를 곱해야 한다. 이 마이그레이션과 같은 커밋에 들어 있다.

SET @k := 43.0 / 63.833;

-- 1) 노드 좌표. z 는 건드리지 않는다.
UPDATE route_node
SET map_x     = ROUND(map_x * @k, 3),
    map_y     = ROUND(map_y * @k, 3),
    updated_at = NOW(6)
WHERE station_id = 1;

-- 2) 시설 좌표.
UPDATE facility
SET map_x      = ROUND(map_x * @k, 3),
    map_y      = ROUND(map_y * @k, 3),
    updated_at = NOW(6)
WHERE station_id = 1;

-- 3) 간선 거리. **곱하지 않고 좌표에서 다시 계산한다.**
--
--    곱하기만 하면 지금 들어 있는 오차가 축소된 채 남는다. 시설 간선 15개가 좌표와 맞지
--    않는데(최악은 화장실 B2_F013 -> B2_R007 이 저장 16.14m, 좌표 9.23m), 편집기가
--    facilityNodes 배열의 좌표로 거리를 계산하고 DB 에는 facilities 배열의 좌표가 들어가서
--    생긴 차이다. 두 배열의 같은 시설이 서로 다른 좌표를 들고 있다.
--
--    3D 유클리드다. 층 높이가 들어간 수직 간선은 z 가 그대로이므로 수평 성분만 줄어든다.
UPDATE route_edge e
JOIN route_node f ON e.from_node_id = f.node_id
JOIN route_node t ON e.to_node_id = t.node_id
SET e.distance_m = ROUND(SQRT(
        POW(t.map_x - f.map_x, 2)
      + POW(t.map_y - f.map_y, 2)
      + POW(COALESCE(t.map_z, 0) - COALESCE(f.map_z, 0), 2)), 2),
    e.updated_at = NOW(6)
WHERE e.station_id = 1;

-- 4) 예상 시간. 기존 시드와 같은 규칙(거리 / 1.2m/s)으로 다시 매긴다.
--    계단·에스컬레이터·엘리베이터는 거리로 환산할 값이 아니라 그대로 둔다 — 엘리베이터 30초는
--    대기 시간을 포함해 사람이 넣은 값이다.
UPDATE route_edge
SET estimated_time_sec = GREATEST(1, ROUND(distance_m / 1.2)),
    updated_at         = NOW(6)
WHERE station_id = 1
  AND move_type = 'walkway';

-- 5) 층 지도 축척. 여기까지 바꿔야 그림이 제자리에 남는다.
UPDATE floor_map fm
JOIN station_floor sf ON fm.floor_id = sf.floor_id
SET fm.scale_m_per_px = ROUND(0.19 * @k, 6),
    fm.updated_at     = NOW(6)
WHERE sf.station_id = 1
  AND fm.scale_m_per_px = 0.190000;
