import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api';
import { getStationFacilities, type StationFacilitiesQuery } from './getStationFacilities';

interface UseStationFacilitiesOptions extends StationFacilitiesQuery {
  /** 조회를 실행할지. 기본값 true. 목업으로 화면을 볼 때 끈다. */
  enabled?: boolean;
}

/**
 * 역 내부 시설 목록을 조회하는 쿼리 훅.
 *
 * **층 필터를 서버에 넘기지 않고 전체를 받아 화면에서 거르는 편이 낫다.** 층을 전환할 때마다
 * 새 요청이 나가면 이미 받은 데이터를 다시 받는다. 역 하나의 시설은 수십 건이라 한 번에 받아도
 * 부담이 없다. 그래서 `floorId`는 기본으로 넘기지 않고, 호출부가 필요할 때만 지정한다.
 */
export function useStationFacilities(stationId: number, options?: UseStationFacilitiesOptions) {
  const hasValidStationId = Number.isInteger(stationId) && stationId > 0;
  const query: StationFacilitiesQuery = {
    floorId: options?.floorId,
    facilityType: options?.facilityType,
  };

  return useQuery({
    queryKey: queryKeys.stationFacilities(stationId, query),
    queryFn: () => getStationFacilities(stationId, query),
    enabled: (options?.enabled ?? true) && hasValidStationId,
  });
}
