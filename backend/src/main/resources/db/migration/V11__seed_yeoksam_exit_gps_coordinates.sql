-- One exit facility has at most one exit_detail row.
-- Existing duplicate rows intentionally make this migration fail instead of
-- silently discarding potentially valid administrator-managed data.
ALTER TABLE exit_detail
    ADD CONSTRAINT uk_exit_detail_facility UNIQUE (facility_id);

-- Yeoksam Station exits 1-8.
-- GPS coordinates are WGS84 coordinates of the outdoor subway entrances.
-- Source: OpenStreetMap subway_entrance nodes 3404837655-3404837662
-- verified on 2026-07-31.
-- facility_id is resolved by stable seed attributes because it is auto-generated.
INSERT INTO exit_detail (
    facility_id,
    exit_number,
    outside_latitude,
    outside_longitude,
    description_ko,
    description_en
)
SELECT
    f.facility_id,
    coordinates.exit_number,
    coordinates.latitude,
    coordinates.longitude,
    CONCAT('역삼역 ', coordinates.exit_number, '번 출구 외부 출입구'),
    CONCAT('Yeoksam Station Exit ', coordinates.exit_number, ' outdoor entrance')
FROM facility f
JOIN (
    SELECT '1' AS exit_number, 37.5003321 AS latitude, 127.0373635 AS longitude
    UNION ALL SELECT '2', 37.5003293, 127.0364610
    UNION ALL SELECT '3', 37.5001157, 127.0353612
    UNION ALL SELECT '4', 37.5004940, 127.0351646
    UNION ALL SELECT '5', 37.5008066, 127.0362557
    UNION ALL SELECT '6', 37.5010872, 127.0365349
    UNION ALL SELECT '7', 37.5011885, 127.0369034
    UNION ALL SELECT '8', 37.5010509, 127.0371723
) coordinates
    ON f.name_en = CONCAT('Exit ', coordinates.exit_number)
WHERE f.station_id = 1
  AND f.facility_type = 'exit'
ON DUPLICATE KEY UPDATE
    exit_number = VALUES(exit_number),
    outside_latitude = VALUES(outside_latitude),
    outside_longitude = VALUES(outside_longitude),
    description_ko = VALUES(description_ko),
    description_en = VALUES(description_en);
