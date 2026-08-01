-- V12. 층별 캐노니컬 기준 높이 (S15P11A206-128)
--
-- 층 전환 판정에 쓴다. 클라이언트는 WebXR 의 앵커 대비 ΔY(미터)를 보고 층이 바뀌었는지
-- 판단하는데(역삼역_FE_좌표연동_스펙.md 8.4), 그러려면 층 사이가 몇 미터인지 알아야 한다.
-- 지금까지 이 값이 API 로 나가지 않아 클라이언트가 하드코딩할 수밖에 없었다.
--
-- 값은 캐노니컬 프레임의 z 다. 원점은 역삼역 B2-B3 엘리베이터 B 이고 B2 를 0 으로 둔다.
-- 명목값이며 실측 층고가 아니다. 층 전환은 부호와 대략적 크기만 쓰므로 이 정도로 충분하다
-- (계단 실측 ΔY 3.80m vs 명목 5m).
--
-- 주의 — 이 값은 그 층 '바닥' 하나뿐이다. 역삼역 B0.5 중간층은 별도 층이 아니라
-- floor_code=B1 안의 map_z=7.5 로 모델링돼 있어 이 컬럼으로는 구분할 수 없다.
-- 층 내부 높이는 route_node.map_z 를 봐야 한다.

ALTER TABLE station_floor
    ADD COLUMN nominal_z DECIMAL(10, 3) NULL COMMENT '캐노니컬 기준 높이(m). 층 바닥 기준이며 명목값' AFTER floor_order;

UPDATE station_floor
SET nominal_z = CASE floor_code
                    WHEN 'B1' THEN 5.000
                    WHEN 'B2' THEN 0.000
                    WHEN 'B3' THEN -5.000
                    END,
    updated_at = NOW(6)
WHERE station_id = 1
  AND floor_code IN ('B1', 'B2', 'B3');
