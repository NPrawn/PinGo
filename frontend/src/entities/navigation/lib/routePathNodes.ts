import type { RouteResponse } from '@/shared/api';
import type { RoutePathNode } from '../model/types';

/**
 * 경로 응답의 노드 목록을 지도가 그릴 수 있는 형태로 추린다.
 *
 * OpenAPI 스키마는 `nodeId`·`floorId`·`mapX`·`mapY`를 모두 선택 필드로 내려준다. 빠진 값을
 * 0으로 채우면 도면 원점에 점이 찍혀, 실제로는 지나지 않는 곳을 지나는 경로선이 그려진다.
 * 좌표를 온전히 갖춘 노드만 남긴다.
 *
 * 응답이 없거나(조회 전·실패) 노드가 하나도 없으면 빈 배열이다. 부르는 쪽은 이때 경로선을
 * 그리지 않는다 — 목업으로 대신하지 않는다.
 */
export function routePathNodesOf(route: RouteResponse | null | undefined): RoutePathNode[] {
  return (route?.pathNodes ?? []).flatMap((node) =>
    node.nodeId != null && node.floorId != null && node.mapX != null && node.mapY != null
      ? [{ nodeId: node.nodeId, floorId: node.floorId, mapX: node.mapX, mapY: node.mapY }]
      : [],
  );
}
