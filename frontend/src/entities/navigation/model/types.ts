/**
 * 실내 지도 위에 그릴 수 있는 최소 좌표 정보.
 *
 * 위치·경로 API 응답이 서로 필드 구성이 다르므로(수동 위치 선택 응답에는 stationId가 있고
 * VPS 위치 후보 응답에는 confidenceScore가 있다) 오버레이가 실제로 필요한 세 필드만 요구한다.
 * 그러면 currentIndoorLocation·위치 후보·경로 노드가 모두 그대로 들어맞는다.
 * (API 명세서 §7 위치, §8 경로)
 *
 * mapX·mapY는 백엔드 BigDecimal에서 내려오므로 런타임 값이 타입과 어긋날 수 있다.
 * 그리기 전에 isRenderableCoordinate로 검사한다.
 */
export interface IndoorPoint {
  floorId: number;
  mapX: number;
  mapY: number;
}

/** Canonical-map horizontal direction returned by VPS. */
export interface MapDirection {
  x: number;
  y: number;
}

/**
 * 경로가 지나는 노드. (POST /api/routes/indoor 응답의 pathNodes)
 * 백엔드 RoutePathNode 레코드와 필드가 1:1로 대응한다.
 */
export interface RoutePathNode extends IndoorPoint {
  nodeId: number;
}
