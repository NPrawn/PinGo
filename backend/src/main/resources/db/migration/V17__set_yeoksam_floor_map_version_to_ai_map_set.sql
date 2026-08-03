-- 역삼역 도면의 version 을 AI 가 올려 둔 맵 세트 버전으로 맞춘다.
--
-- 프론트가 이 값을 그대로 VPS 요청의 mapVersion 으로 보낸다.
--
--   const mapVersion = maps.find((map) => map.version)?.version;   // CapturePortraitPage.tsx
--
-- V9 에서 넣은 'v1' 은 AI 에 없는 이름이라, 보내면 AI 가 503 MAP_NOT_LOADED 를 주고
-- 백엔드는 그것을 ai_server_unavailable 로 바꿔 내보낸다. AI 는 멀쩡한데 서버가 죽은
-- 것처럼 보여서, 실제로 이 값 때문에 원인 조사가 한 번 잘못된 방향으로 갔다.
--
-- 세트 버전으로 요청해야 AI 가 올려 둔 맵을 전부 뒤진다. 개별 맵 버전을 보내면 그 맵
-- 하나만 검색해서, B3 에서 찍은 사진을 B2 맵에만 물어보는 일이 생긴다.
--
-- **임시 조치다.** floor_map.version 은 원래 도면과 좌표 프레임의 버전이고, V9 에서
-- 폭·높이·축척·원점·회전각과 한 세트로 들어갔다. AI 맵 버전이 아니다. 프론트가 그
-- 필드를 VPS 맵 버전으로 쓰는 것이 문제의 뿌리이며, 이 마이그레이션은 값을 맞춰 줄 뿐
-- 원인을 없애지 않는다. AI 맵을 새로 만들 때마다 마이그레이션을 또 파야 하고, 도면
-- 버전이라는 원래 의미도 잃는다.
--
-- 후속으로 백엔드 설정값(ai.localization.map-version)을 두고 서버가 맵 버전을 정하도록
-- 바꾼다. 클라이언트는 어느 맵을 쓸지 알 이유가 없고, 백엔드는 자기가 어느 AI 를 보는지
-- 이미 안다. 그렇게 하면 환경마다 다른 값을 쓸 수 있고 DB 도 마이그레이션도 필요 없다.
--
-- 역삼역만 바꾼다. 'YS-' 는 역삼역 맵 세트의 접두사라 다른 역에 적용할 값이 아니다.

UPDATE floor_map fm
JOIN station_floor sf ON sf.floor_id = fm.floor_id
JOIN station s ON s.station_id = sf.station_id
SET fm.version = 'YS-MULTI-2026-07-24.1',
    fm.updated_at = NOW(6)
WHERE s.station_id = 1
  AND fm.is_active = 1;
