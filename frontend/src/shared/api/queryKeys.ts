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
  /**
   * 경로 옵션. 세 값이 모두 키에 들어가야 한다.
   *
   * 출발이나 목적지가 바뀌면 다른 경로다. 하나라도 빠뜨리면 위치를 옮겼는데 이전 경로가
   * 그대로 보인다.
   */
  indoorRouteOptions: (stationId: number, startNodeId: number, targetNodeId: number) =>
    ['pingo', 'routes', 'indoor', 'options', stationId, startNodeId, targetNodeId] as const,
} as const;
