export const queryKeys = {
  all: ['pingo'] as const,
  stationSearch: (keyword: string, language: string) =>
    ['pingo', 'stations', 'search', keyword, language] as const,
  /** 검색어 없이 조회하는 등록된 역 목록. 검색 결과와 캐시를 섞지 않도록 키를 따로 둔다. */
  registeredStations: (language: string) =>
    ['pingo', 'stations', 'registered', language] as const,
  nearbyStations: (latitude: number, longitude: number) =>
    ['pingo', 'stations', 'nearby', latitude, longitude] as const,
  destinationSearch: (stationId: number, keyword: string, language: string) =>
    ['pingo', 'destinations', stationId, keyword, language] as const,
  stationFloorMaps: (stationId: number) => ['pingo', 'stations', stationId, 'maps'] as const,
} as const;
