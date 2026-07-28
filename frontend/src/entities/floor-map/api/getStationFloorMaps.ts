import { apiClient, ENDPOINTS, type ApiResponse } from '@/shared/api';
import type { FloorMap } from '../model/types';

// 역의 층별 지도 목록을 조회한다. (GET /api/stations/{stationId}/maps)
export async function getStationFloorMaps(stationId: number): Promise<FloorMap[]> {
  const { data } = await apiClient.get<ApiResponse<FloorMap[]>>(
    ENDPOINTS.stationFloorMaps(stationId),
  );
  return data.data;
}
