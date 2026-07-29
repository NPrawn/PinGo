import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api';
import { getStationFloorMaps } from './getStationFloorMaps';

interface UseStationFloorMapsOptions {
  /**
   * 조회를 실행할지 여부. 기본값 true.
   * 호출부가 다른 경로로 지도를 얻을 때(예: 목업) 요청을 끄는 데 쓴다.
   */
  enabled?: boolean;
}

// 역의 층별 지도 목록을 조회하는 쿼리 훅.
// 유효한 stationId일 때만 요청하고, 호출부가 enabled로 조회를 끌 수 있다.
export function useStationFloorMaps(stationId: number, options?: UseStationFloorMapsOptions) {
  const hasValidStationId = Number.isInteger(stationId) && stationId > 0;

  return useQuery({
    queryKey: queryKeys.stationFloorMaps(stationId),
    queryFn: () => getStationFloorMaps(stationId),
    enabled: (options?.enabled ?? true) && hasValidStationId,
  });
}
