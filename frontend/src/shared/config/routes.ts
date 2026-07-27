export const ROUTES = {
  HOME: '/',
  USER: '/user',
  // 실내 지도 화면. stationId, floorId를 쿼리 파라미터로 받는다. (예: /user/map?stationId=1)
  INDOOR_MAP: '/user/map',
  COUNSELOR: '/counselor',
  ADMIN: '/admin',
  // 권한 요청 실기기 검증용 테스트 페이지 (FR-U-002)
  PERMISSION_TEST: '/permission-test',
} as const;
