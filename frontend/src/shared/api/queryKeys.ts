export const queryKeys = {
  all: ['pingo'] as const,
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
} as const;
