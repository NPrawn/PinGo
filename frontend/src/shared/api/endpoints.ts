// API 요청 경로. 백엔드 base URL은 `/api`를 포함한다. (API 명세서 2.1)
export const ENDPOINTS = {
  // 5.1 층별 지도 조회
  stationFloorMaps: (stationId: number) => `/api/stations/${stationId}/maps`,
} as const;
