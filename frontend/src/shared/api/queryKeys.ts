export const queryKeys = {
  all: ['pingo'] as const,
  stationSearch: (keyword: string, language: string) =>
    ['pingo', 'stations', 'search', keyword, language] as const,
  nearbyStations: (latitude: number, longitude: number) =>
    ['pingo', 'stations', 'nearby', latitude, longitude] as const,
  destinationSearch: (stationId: number, keyword: string, language: string) =>
    ['pingo', 'destinations', stationId, keyword, language] as const,
  stationFloorMaps: (stationId: number) => ['pingo', 'stations', stationId, 'maps'] as const,
} as const;
