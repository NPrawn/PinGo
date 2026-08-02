import { apiClient, ENDPOINTS, type ApiResponse } from '@/shared/api';
import type { Facility } from '../model/types';

export interface StationFacilitiesQuery {
  /** 특정 층만 조회한다. 층별 지도 응답의 숫자 floorId다. */
  floorId?: number;
  /** 특정 유형만 조회한다. */
  facilityType?: string;
}

// 역 내부 시설 목록을 조회한다. (GET /api/stations/{stationId}/facilities)
export async function getStationFacilities(
  stationId: number,
  query: StationFacilitiesQuery = {},
): Promise<Facility[]> {
  const { data } = await apiClient.get<ApiResponse<Facility[]>>(
    ENDPOINTS.stations.facilities(stationId),
    // 값이 없는 항목은 보내지 않는다. axios가 undefined 파라미터를 생략한다.
    { params: { floorId: query.floorId, facilityType: query.facilityType } },
  );
  return data.data ?? [];
}
