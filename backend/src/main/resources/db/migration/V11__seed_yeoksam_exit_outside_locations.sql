-- 역삼역 출입구의 지상 좌표 시드 (exit_detail)
--
-- NearestExitService 는 exit_detail.outside_latitude/longitude 로 목적지에서 가장 가까운
-- 출구를 고른다. 그런데 exit_detail 은 V1 에서 만들어지고 V8 에서 비워진 뒤 채워진 적이 없어
-- 항상 EXIT_LOCATION_NOT_FOUND 로 떨어졌다. 이 마이그레이션이 그 좌표를 채운다.
--
-- 출처: 카카오 로컬 키워드 검색("역삼역 N번출구", category_group_code=SW8 미적용).
--       카카오가 "역삼역 2호선 N번출구"로 등록해 둔 지점의 좌표를 DECIMAL(10,7)에 맞춰 반올림했다.
--       GFC 연결 출입구는 카카오에 출구로 등록돼 있지 않아 "강남파이낸스센터"(부동산 > 빌딩)
--       좌표를 쓴다. 지상 출구가 아니라 건물 직결 통로라 정확히는 건물 위치다.
--
-- facility_id 는 auto_increment 라 DB 마다 다르므로 이름으로 찾아 넣는다.
-- 재적용·부분 적용 대비로 조건부 삽입한다.

INSERT INTO exit_detail (facility_id, exit_number, outside_latitude, outside_longitude)
SELECT f.facility_id, v.exit_number, v.outside_latitude, v.outside_longitude
FROM (
    SELECT '1번 출구'                          AS name_ko, '1'      AS exit_number, 37.5004796 AS outside_latitude, 127.0372633 AS outside_longitude
    UNION ALL SELECT '2번 출구',                       '2',      37.5004978, 127.0366865
    UNION ALL SELECT '3번 출구',                       '3',      37.5000837, 127.0353405
    UNION ALL SELECT '4번 출구',                       '4',      37.5005162, 127.0351598
    UNION ALL SELECT '5번 출구',                       '5',      37.5009213, 127.0364832
    UNION ALL SELECT '6번 출구',                       '6',      37.5012186, 127.0365512
    UNION ALL SELECT '7번 출구',                       '7',      37.5012545, 127.0369244
    UNION ALL SELECT '8번 출구',                       '8',      37.5011463, 127.0372184
    UNION ALL SELECT '강남파이낸스센터(GFC몰) 연결 출입구', 'GFC몰', 37.5000293, 127.0365008
) v
JOIN facility f
  ON f.station_id = 1
 AND f.facility_type = 'exit'
 AND f.name_ko = v.name_ko
WHERE NOT EXISTS (
    SELECT 1 FROM exit_detail ed WHERE ed.facility_id = f.facility_id
);
