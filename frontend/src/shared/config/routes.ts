export const ROUTES = {
  HOME: '/',
  USER: '/user',
  // 실내 지도 화면. stationId, floorId를 쿼리 파라미터로 받는다. (예: /user/map?stationId=1)
  INDOOR_MAP: '/user/map',
  COUNSELOR: '/counselor',
  ADMIN: '/admin',
} as const;
