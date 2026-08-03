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
  webrtc: {
    iceServers: '/api/webrtc/ice-servers',
  },
  routes: {
    // 8.1 경로 옵션 조회. 조회지만 요청 본문이 필요해 POST다.
    indoorOptions: '/api/routes/indoor/options',
    indoor: '/api/routes/indoor',
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
    // DataChannel 이 열리지 않았을 때 상담 이벤트가 지나는 우회로.
    dataChannelEvents: (consultationId: string) =>
      `/api/consultations/${consultationId}/data-channel-events`,
    // 실시간 자막 한 줄을 상대 언어로 옮긴다.
    translate: (consultationId: string) => `/api/consultations/${consultationId}/translate`,
    transcript: (consultationId: string) => `/api/consultations/${consultationId}/transcript`,
    summary: (consultationId: string) => `/api/consultations/${consultationId}/summary`,
    rating: (consultationId: string) => `/api/consultations/${consultationId}/rating`,
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
    counselors: '/api/admin/counselors',
    counselor: (accountId: number) => `/api/admin/counselors/${accountId}`,
  },
} as const;
