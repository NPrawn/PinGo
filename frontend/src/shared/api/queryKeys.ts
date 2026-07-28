export const queryKeys = {
  all: ['pingo'] as const,
  stationFloorMaps: (stationId: number) => ['pingo', 'stations', stationId, 'maps'] as const,
} as const;
