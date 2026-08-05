-- V23 좌표 축척 보정 원복 (S15P11A206-351)
--
-- V23은 이미 운영 DB에 적용됐으므로 V23 파일이나 flyway_schema_history를 수정하지 않는다.
-- 이 마이그레이션은 V23의 좌표·축척 보정을 역으로 적용한다.
--
-- 주의:
-- V23이 map_x/map_y를 소수점 3자리로 반올림했고 route_edge.distance_m을 재계산했기
-- 때문에 이 원복은 V23 이전의 기하학적 축척을 복구하지만, 백업이 없으면 모든 원본
-- distance_m 값을 비트 단위로 복구할 수 없다. 정확한 원본 복구에는 V23 직전 백업이 필요하다.

SET @k := 43.0 / 63.833;

-- 1) V23에서 축소한 역삼역 경로 노드 좌표를 이전 축척으로 되돌린다.
UPDATE route_node
SET map_x     = ROUND(map_x / @k, 3),
    map_y     = ROUND(map_y / @k, 3),
    updated_at = NOW(6)
WHERE station_id = 1;

-- 2) V23에서 축소한 역삼역 시설 좌표를 이전 축척으로 되돌린다.
UPDATE facility
SET map_x     = ROUND(map_x / @k, 3),
    map_y     = ROUND(map_y / @k, 3),
    updated_at = NOW(6)
WHERE station_id = 1;

-- 3) 복원된 좌표 기준으로 간선의 평면·층간 거리를 다시 계산한다.
UPDATE route_edge e
JOIN route_node f ON e.from_node_id = f.node_id
JOIN route_node t ON e.to_node_id = t.node_id
SET e.distance_m = ROUND(SQRT(
        POW(t.map_x - f.map_x, 2)
      + POW(t.map_y - f.map_y, 2)
      + POW(COALESCE(t.map_z, 0) - COALESCE(f.map_z, 0), 2)), 2),
    e.updated_at = NOW(6)
WHERE e.station_id = 1;

-- 4) V23에서 다시 매긴 walkway 예상 시간을 복원된 거리 기준으로 다시 계산한다.
--    수동 입력 시간을 사용하는 계단·에스컬레이터·엘리베이터는 변경하지 않는다.
UPDATE route_edge
SET estimated_time_sec = GREATEST(1, ROUND(distance_m / 1.2)),
    updated_at         = NOW(6)
WHERE station_id = 1
  AND move_type = 'walkway';

-- 5) V23에서 0.19 * k 로 변경한 지도 축척을 이전 값으로 되돌린다.
UPDATE floor_map fm
JOIN station_floor sf ON fm.floor_id = sf.floor_id
SET fm.scale_m_per_px = 0.190000,
    fm.updated_at     = NOW(6)
WHERE sf.station_id = 1
  AND ABS(fm.scale_m_per_px - ROUND(0.19 * @k, 6)) < 0.000001;
