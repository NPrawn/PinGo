-- floor_map 에 좌표 프레임 컬럼 추가 + 역삼역 층별 지도 seed (S15P11A206-313)
--
-- 배경: 노드·경로·현재위치 좌표는 캐노니컬 미터로 내려간다. 이를 평면도 픽셀로 그리려면
--       원점 픽셀·회전각·축척이 필요한데, 지금은 API 가 제공하지 않아 Frontend 가 하드코딩하고 있다.
--       게다가 floor_map 에 행이 하나도 없어서 GET /api/stations/{id}/maps 가 빈 배열을 반환한다.
--
-- 변환식 (미터 -> 원본 이미지 픽셀):
--   t = frame_angle_deg 를 라디안으로, c = cos(t), s = sin(t)
--   px = origin_px_x + (c*x - s*y) / scale_m_per_px
--   py = origin_px_y + (s*x + c*y) / scale_m_per_px
--
-- z 는 넣지 않는다. 위 변환에 z 가 쓰이지 않고, B0.5(같은 floor_code=B1 안의 map_z 5 와 7.5)
-- 때문에 층 단위 z 는 일부 노드에 대해 틀린 값이 된다. 높이가 필요하면 route_node.map_z 를 쓴다.
--
-- 상세: docs/역삼역_FE_좌표연동_스펙.md · docs/API_명세서.md 5.1

-- 1) 좌표 프레임 컬럼. 프레임이 확정되지 않은 역의 지도도 등록할 수 있어야 하므로 nullable 이다.
--    값이 없으면 지도 표시는 되고 좌표 오버레이만 동작하지 않는다.
ALTER TABLE floor_map
    ADD COLUMN origin_px_x     DECIMAL(10, 3) NULL COMMENT '캐노니컬 원점(0,0)에 대응하는 이미지 픽셀 x' AFTER scale_m_per_px,
    ADD COLUMN origin_px_y     DECIMAL(10, 3) NULL COMMENT '캐노니컬 원점(0,0)에 대응하는 이미지 픽셀 y' AFTER origin_px_x,
    ADD COLUMN frame_angle_deg DECIMAL(10, 4) NULL COMMENT '캐노니컬 +X축과 이미지 x축의 각도(도)'      AFTER origin_px_y;

-- 2) map_url 을 nullable 로 바꾼다.
--    이 테이블의 행은 원래 '지도 이미지'를 뜻했는데, 이제 '좌표 프레임'도 함께 담는다.
--    이미지 없이 프레임만 있는 행이 성립하므로(아래 3번 seed 가 그렇다) URL 을 비울 수 있어야 한다.
--    관리자 업로드 경로는 항상 URL 을 채우므로 기존 동작에는 영향이 없다.
ALTER TABLE floor_map
    MODIFY COLUMN map_url VARCHAR(500) NULL COMMENT '지도 파일 URL. NULL 이면 클라이언트가 자체 이미지를 사용한다';

-- 3) 층 id 해석. floor_id 는 DB 인스턴스마다 다르므로 코드로 조회한다. B1·B2·B3 는 V8 에서 생성됐다.
SET @b1 := (SELECT floor_id FROM station_floor WHERE station_id = 1 AND floor_code = 'B1');
SET @b2 := (SELECT floor_id FROM station_floor WHERE station_id = 1 AND floor_code = 'B2');
SET @b3 := (SELECT floor_id FROM station_floor WHERE station_id = 1 AND floor_code = 'B3');

-- 4) 역삼역 층별 좌표 프레임 seed.
--    이미 활성 지도가 등록된 층은 건너뛴다(운영 환경에서 관리자가 올려둔 지도를 덮지 않기 위함).
--
--    map_url 은 NULL 이다. 어떤 이미지를 표시할지는 아직 정해지지 않았고, 지금 시점에
--    존재하지 않는 경로를 넣으면 클라이언트가 404 를 받는다. 이미지가 준비되면
--    관리자 업로드(POST /admin/floors/{floorId}/maps)로 등록하거나 이 행을 UPDATE 한다.
--
--    width/height 는 origin_px 의 기준이 되는 원본 평면도 크기다. 층마다 다르다.
--    클라이언트가 다른 크기로 렌더하면 표시크기/원본크기 배율을 곱해 스케일한다.
INSERT INTO floor_map (floor_id, map_type, map_url, width, height, scale_m_per_px, origin_px_x, origin_px_y, frame_angle_deg, version, is_active, created_at, updated_at)
SELECT @b1, 'image', NULL, 1626, 967, 0.190000, 594.000, 501.000, -21.2800, 'v1', 1, NOW(6), NOW(6)
WHERE @b1 IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM floor_map WHERE floor_id = @b1 AND is_active = 1);

INSERT INTO floor_map (floor_id, map_type, map_url, width, height, scale_m_per_px, origin_px_x, origin_px_y, frame_angle_deg, version, is_active, created_at, updated_at)
SELECT @b2, 'image', NULL, 1624, 969, 0.190000, 622.000, 512.000, -21.2800, 'v1', 1, NOW(6), NOW(6)
WHERE @b2 IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM floor_map WHERE floor_id = @b2 AND is_active = 1);

INSERT INTO floor_map (floor_id, map_type, map_url, width, height, scale_m_per_px, origin_px_x, origin_px_y, frame_angle_deg, version, is_active, created_at, updated_at)
SELECT @b3, 'image', NULL, 1659, 948, 0.190000, 597.000, 497.000, -21.2800, 'v1', 1, NOW(6), NOW(6)
WHERE @b3 IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM floor_map WHERE floor_id = @b3 AND is_active = 1);

-- provisional 주의:
--   B1 origin_px (594, 501) 은 미검증 추정값이다. B1 에는 원점 기준 엘리베이터가 없어 평면도에
--   추정으로 얹었고, 평면도 윤곽 정합에서 최대 4.4m 차이가 나왔다. S15P11A206-314 에서 확정한다.
--   scale_m_per_px 0.19 도 승강장 205m 단일 측정 역산값이라 COLMAP sim3 정합(277) 후 확정한다.
--   두 값 모두 확정되면 이 테이블을 UPDATE 하면 되고 Frontend 코드는 건드리지 않는다.
