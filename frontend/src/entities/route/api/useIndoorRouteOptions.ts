import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api';
import { getIndoorRouteOptions } from './getIndoorRouteOptions';
import type { RouteOptionsQuery } from '../model/types';

/**
 * 경로 옵션 조회 훅.
 *
 * 세 값이 모두 양수일 때만 요청한다. 출발 노드는 위치 인식(FR-U-004)에서, 도착 노드는 목적지
 * 검색(FR-U-007)에서 오는데 둘 다 아직 없다. 값이 없을 때 0이나 null로 부르면 서버가 400을
 * 돌려주고 화면에는 오류가 뜬다 — 아직 고를 것이 없는 상태와 조회에 실패한 상태는 다르다.
 *
 * `useStationFloorMaps`가 유효하지 않은 stationId에서 요청을 걸지 않는 것과 같은 방식이다.
 */
export function useIndoorRouteOptions(query: Partial<RouteOptionsQuery>) {
  const { stationId, startNodeId, targetNodeId, currentMapX, currentMapY } = query;
  /**
   * 사용자 좌표는 조건에 넣지 않는다. **선택 필드다.**
   *
   * 좌표 정합이 없는 층(역삼역 B1)은 위치 인식이 좌표를 주지 못한다. 조건에 넣으면 그 층에서
   * 경로 옵션 자체를 못 받는데, 좌표 없이도 서버는 `startNodeId`로 예전처럼 답한다.
   */
  const ready =
    isPositiveInteger(stationId) &&
    isPositiveInteger(startNodeId) &&
    isPositiveInteger(targetNodeId);

  return useQuery({
    queryKey: queryKeys.indoorRouteOptions(
      stationId ?? 0,
      startNodeId ?? 0,
      targetNodeId ?? 0,
      currentMapX,
      currentMapY,
    ),
    queryFn: () =>
      getIndoorRouteOptions({
        stationId: stationId as number,
        startNodeId: startNodeId as number,
        targetNodeId: targetNodeId as number,
        currentMapX,
        currentMapY,
      }),
    enabled: ready,
  });
}

function isPositiveInteger(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
