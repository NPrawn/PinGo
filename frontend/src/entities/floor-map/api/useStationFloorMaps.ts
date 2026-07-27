import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api';
import { getStationFloorMaps } from './getStationFloorMaps';

// 역의 층별 지도 목록을 조회하는 쿼리 훅.
// 유효한 stationId일 때만 요청한다.
export function useStationFloorMaps(stationId: number) {
  return useQuery({
    queryKey: queryKeys.stationFloorMaps(stationId),
    queryFn: () => getStationFloorMaps(stationId),
    enabled: Number.isInteger(stationId) && stationId > 0,
  });
}
