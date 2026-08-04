export const queryKeys = {
  all: ['pingo'] as const,
  stationSearch: (keyword: string, language: string) =>
    ['pingo', 'stations', 'search', keyword, language] as const,
  /** 검색어 없이 조회하는 등록된 역 목록. 검색 결과와 캐시를 섞지 않도록 키를 따로 둔다. */
  registeredStations: (language: string) => ['pingo', 'stations', 'registered', language] as const,
  nearbyStations: (latitude: number, longitude: number, language: string) =>
    ['pingo', 'stations', 'nearby', latitude, longitude, language] as const,
  destinationSearch: (stationId: number, keyword: string, language: string) =>
    ['pingo', 'destinations', stationId, keyword, language] as const,
  stationFloorMaps: (stationId: number) => ['pingo', 'stations', stationId, 'maps'] as const,
  /**
   * 시설 목록. 필터가 키에 들어가야 층·유형별 응답이 서로를 덮지 않는다.
   * 필터 없이 부른 경우와 구분되도록 값이 없으면 null로 채운다.
   */
  stationFacilities: (stationId: number, filter?: { floorId?: number; facilityType?: string }) =>
    [
      'pingo',
      'stations',
      stationId,
      'facilities',
      filter?.floorId ?? null,
      filter?.facilityType ?? null,
    ] as const,
  /**
   * 경로 옵션. 출발·목적지·사용자 좌표가 모두 키에 들어가야 한다.
   *
   * 출발이나 목적지가 바뀌면 다른 경로다. 하나라도 빠뜨리면 위치를 옮겼는데 이전 경로가
   * 그대로 보인다.
   *
   * 좌표도 결과를 바꾼다 — 서버가 그 값으로 진입 노드를 다시 고르므로 총 거리가 달라진다.
   * 키에 없으면 재인식으로 좌표만 바뀐 경우에 옛 응답이 그대로 재사용된다. 값이 없는 경우와
   * 구분되도록 null로 채운다. 잦은 재요청을 막으려면 넣기 전에 반올림한다(`routeOriginOf`).
   */
  indoorRouteOptions: (
    stationId: number,
    startNodeId: number,
    targetNodeId: number,
    currentMapX?: number | null,
    currentMapY?: number | null,
    language?: string,
  ) =>
    [
      'pingo',
      'routes',
      'indoor',
      'options',
      stationId,
      startNodeId,
      targetNodeId,
      currentMapX ?? null,
      currentMapY ?? null,
      language ?? null,
    ] as const,
  consultationSummary: (consultationId: string) =>
    ['pingo', 'consultations', consultationId, 'summary'] as const,
  /** 담당 역의 상담 목록(대기~종료 전 상태 모두 포함). Requests/History 화면이 공유한다. */
  counselorConsultations: () => ['pingo', 'counselors', 'me', 'consultations'] as const,
  /** 로그인한 상담자 본인 정보. */
  counselorMe: () => ['pingo', 'counselors', 'me'] as const,
} as const;
