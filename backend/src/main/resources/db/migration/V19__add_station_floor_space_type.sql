-- 층 코드(B2, B3 등)와 공간 역할(대합실, 승강장)은 역마다 일치하지 않는다.
-- 위치 라벨이 층 코드를 하드코딩하지 않도록 공간 유형을 별도 관리한다.
ALTER TABLE station_floor
    ADD COLUMN space_type VARCHAR(30) NOT NULL DEFAULT 'station_interior' AFTER floor_name;

UPDATE station_floor
SET space_type = CASE floor_code
    WHEN 'B3' THEN 'platform'
    ELSE 'concourse'
END
WHERE station_id = 1;
