import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api';
import { useApiLanguage } from '@/shared/i18n';
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
   * 언어는 호출부에서 받지 않고 여기서 읽는다.
   *
   * 호출부에 맡기면 한 곳만 빠뜨려도 그 화면이 조용히 영어로 돌아간다(`useApiLanguage`).
   * 인자로 온 값이 있으면 그것을 존중한다 — 테스트가 언어를 고정할 수 있어야 한다.
   *
   * 훅은 조건 없이 부른다. `query.language ?? useApiLanguage()` 로 쓰면 값이 있는 렌더에서
   * 훅을 건너뛰어 호출 순서가 어긋난다.
   */
  const currentLanguage = useApiLanguage();
  const language = query.language ?? currentLanguage;
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
      language,
      currentMapX,
      currentMapY,
    ),
    queryFn: () =>
      getIndoorRouteOptions({
        stationId: stationId as number,
        startNodeId: startNodeId as number,
        targetNodeId: targetNodeId as number,
        language,
        currentMapX,
        currentMapY,
      }),
    enabled: ready,
  });
}

function isPositiveInteger(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
