export const queryKeys = {
  all: ['pingo'] as const,
  /**
   * 역 검색. **언어를 키에 넣지 않는다.**
   *
   * 서버가 `nameKo`·`nameEn` 을 모두 보고 검색하고(`StationRepository.searchActiveByKeyword`)
   * 두 이름을 함께 내려주므로, 언어가 바뀌어도 서버가 줄 내용이 같다. 키에 넣으면 언어를 바꿀
   * 때마다 같은 결과를 다시 받는다. 표시할 이름은 받은 뒤에 고른다(`localizedNameOf`).
   * (S15P11A206-339)
   */
  stationSearch: (keyword: string) => ['pingo', 'stations', 'search', keyword] as const,
  /** 검색어 없이 조회하는 등록된 역 목록. 검색 결과와 캐시를 섞지 않도록 키를 따로 둔다. */
  registeredStations: () => ['pingo', 'stations', 'registered'] as const,
  nearbyStations: (latitude: number, longitude: number) =>
    ['pingo', 'stations', 'nearby', latitude, longitude] as const,
  /** 목적지 검색. 역 검색과 같은 이유로 언어를 키에 넣지 않는다(`stationSearch`). */
  destinationSearch: (stationId: number, keyword: string) =>
    ['pingo', 'destinations', stationId, keyword] as const,
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
   *
   * **언어도 들어간다.** 이용 불가 사유 문구(`unavailableMessage`)를 서버가 요청 언어로 쓴다.
   * 이름처럼 두 언어를 함께 받는 값이 아니라 **서버가 조립하는 문장**이라, 언어가 바뀌면 응답
   * 자체가 달라진다. 키에 없으면 언어를 바꿨는데 이전 언어의 문구가 그대로 보인다.
   * (S15P11A206-339)
   */
  indoorRouteOptions: (
    stationId: number,
    startNodeId: number,
    targetNodeId: number,
    language: string,
    currentMapX?: number | null,
    currentMapY?: number | null,
  ) =>
    [
      'pingo',
      'routes',
      'indoor',
      'options',
      stationId,
      startNodeId,
      targetNodeId,
      language,
      currentMapX ?? null,
      currentMapY ?? null,
    ] as const,
  consultationSummary: (consultationId: string) =>
    ['pingo', 'consultations', consultationId, 'summary'] as const,
  /**
   * 담당 역의 상담 목록. 조건이 없으면 모든 상담 목록 캐시를 무효화하는 공통 prefix다.
   * 조회할 때는 상태·페이지·정렬을 모두 넣어 서로 다른 응답이 같은 캐시를 덮지 않게 한다.
   */
  counselorConsultations: (params?: {
    status?: string;
    page?: number;
    size?: number;
    sort?: string;
  }) => {
    const base = ['pingo', 'counselors', 'me', 'consultations'] as const;
    if (!params) return base;
    return [
      ...base,
      params.status ?? null,
      params.page ?? 0,
      params.size ?? null,
      params.sort ?? null,
    ] as const;
  },
  /** 로그인한 상담자 본인 정보. */
  counselorMe: () => ['pingo', 'counselors', 'me'] as const,
} as const;
