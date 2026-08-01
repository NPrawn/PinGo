// API 요청 경로. 백엔드 base URL은 `/api`를 포함한다. (API 명세서 2.1)
export const ENDPOINTS = {
  auth: {
    login: '/api/auth/login',
    signup: '/api/auth/signup',
    checkLoginId: '/api/auth/check-login-id',
  },
  counselors: {
    me: '/api/counselors/me',
    consultations: '/api/counselors/consultations',
    consultation: (consultationId: string) => `/api/counselors/consultations/${consultationId}`,
  },
  userSessions: {
    root: '/api/user-sessions',
    detail: (userSessionId: string) => `/api/user-sessions/${userSessionId}`,
  },
  stations: {
    nearby: '/api/stations/nearby',
    search: '/api/stations/search',
    detail: (stationId: number) => `/api/stations/${stationId}`,
    // 5.2 시설 목록 조회
    facilities: (stationId: number) => `/api/stations/${stationId}/facilities`,
  },
  stationFloorMaps: (stationId: number) => `/api/stations/${stationId}/maps`,
  facilities: {
    detail: (facilityId: number) => `/api/facilities/${facilityId}`,
  },
  destinations: {
    search: '/api/destinations/search',
    nearestExit: '/api/destinations/nearest-exit',
  },
  places: {
    recommendedExits: (placeId: number) => `/api/places/${placeId}/recommended-exits`,
  },
  vps: {
    localize: '/api/vps/localize',
  },
  routes: {
    // 8.1 경로 옵션 조회. 조회지만 요청 본문이 필요해 POST다.
    indoorOptions: '/api/routes/indoor/options',
    indoor: '/api/routes/indoor',
  },
  externalMaps: {
    directions: '/api/external-maps/directions',
  },
  consultations: {
    root: '/api/consultations',
    detail: (consultationId: string) => `/api/consultations/${consultationId}`,
    accept: (consultationId: string) => `/api/consultations/${consultationId}/accept`,
    reject: (consultationId: string) => `/api/consultations/${consultationId}/reject`,
    end: (consultationId: string) => `/api/consultations/${consultationId}/end`,
    waitingEvents: (consultationId: string) =>
      `/api/consultations/${consultationId}/waiting-events`,
    fallbackEvents: (consultationId: string) =>
      `/api/consultations/${consultationId}/fallback-events`,
  },
  admin: {
    stations: '/api/admin/stations',
    station: (stationId: number) => `/api/admin/stations/${stationId}`,
    stationFloors: (stationId: number) => `/api/admin/stations/${stationId}/floors`,
    floor: (floorId: number) => `/api/admin/floors/${floorId}`,
    floorMaps: (floorId: number) => `/api/admin/floors/${floorId}/maps`,
    facilities: '/api/admin/facilities',
    facility: (facilityId: number) => `/api/admin/facilities/${facilityId}`,
    routeNodes: '/api/admin/route-nodes',
    routeNode: (nodeId: number) => `/api/admin/route-nodes/${nodeId}`,
    routeEdges: '/api/admin/route-edges',
    routeEdge: (edgeId: number) => `/api/admin/route-edges/${edgeId}`,
    nearbyPlaces: '/api/admin/nearby-places',
    nearbyPlace: (placeId: number) => `/api/admin/nearby-places/${placeId}`,
    recommendations: '/api/admin/place-exit-recommendations',
    recommendation: (recommendationId: number) =>
      `/api/admin/place-exit-recommendations/${recommendationId}`,
    counselors: '/api/admin/counselors',
    counselor: (accountId: number) => `/api/admin/counselors/${accountId}`,
  },
} as const;
