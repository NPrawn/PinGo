// API 요청 경로. 백엔드 base URL은 `/api`를 포함한다. (API 명세서 2.1)
export const ENDPOINTS = {
  // 5.1 층별 지도 조회
  stationFloorMaps: (stationId: number) => `/api/stations/${stationId}/maps`,
  // 5.2 시설 목록 조회
  stationFacilities: (stationId: number) => `/api/stations/${stationId}/facilities`,
  // 8.1 경로 옵션 조회. 조회지만 요청 본문이 필요해 POST다.
  indoorRouteOptions: () => `/api/routes/indoor/options`,
} as const;
