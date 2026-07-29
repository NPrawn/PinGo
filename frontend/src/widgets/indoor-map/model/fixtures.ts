import { MOCK_FLOOR_ID } from '@/entities/floor-map';
import type { IndoorPoint, RoutePathNode } from '@/entities/navigation';

/**
 * 오버레이 확인용 목업 위치·경로.
 *
 * TODO: 위치 인식(FR-U-004)과 경로 조회(POST /api/routes/indoor)가 연결되면 제거한다.
 * 좌표는 실제 seed(V4__seed_yeoksam_b2_b3_route_graph.sql)의 노드 값을 그대로 옮겼으므로,
 * API 연동 시 좌표가 달라지지 않는다.
 */

/**
 * B3 승강장 → 계단 → 층간 엘리베이터 → B2 대합실 → 3번출구 엘리베이터.
 * 층을 넘나들어서 표시 층 필터링이 실제로 동작하는지 확인할 수 있다.
 */
export const MOCK_PATH_NODES: readonly RoutePathNode[] = [
  { nodeId: 204, floorId: MOCK_FLOOR_ID.B3, mapX: -91.8, mapY: 23.6 }, // B3_N2 승강장 서쪽 끝
  { nodeId: 205, floorId: MOCK_FLOOR_ID.B3, mapX: -25.3, mapY: 25.6 }, // B3_N3 계단 하단
  { nodeId: 202, floorId: MOCK_FLOOR_ID.B3, mapX: -0.4, mapY: 27.2 }, // EVB (B3)
  { nodeId: 102, floorId: MOCK_FLOOR_ID.B2, mapX: -0.4, mapY: 27.2 }, // EVB (B2)
  { nodeId: 112, floorId: MOCK_FLOOR_ID.B2, mapX: -12.4, mapY: 15.6 }, // B2_N3 대합실 복도
  { nodeId: 111, floorId: MOCK_FLOOR_ID.B2, mapX: -56.7, mapY: 17.9 }, // B2_N2 3번출구 분기
  { nodeId: 104, floorId: MOCK_FLOOR_ID.B2, mapX: -58.4, mapY: 42.5 }, // EV3 3번출구 엘리베이터
];

/** B3 승강장 위. 노드에 딱 붙지 않은 값으로 두어 마커가 노드와 독립임을 보인다. */
export const MOCK_CURRENT_LOCATION: IndoorPoint = {
  floorId: MOCK_FLOOR_ID.B3,
  mapX: -60.0,
  mapY: 24.5,
};

/** 목적지는 경로의 마지막 노드(3번출구 엘리베이터)와 같은 지점이다. */
export const MOCK_DESTINATION: IndoorPoint = {
  floorId: MOCK_FLOOR_ID.B2,
  mapX: -58.4,
  mapY: 42.5,
};
