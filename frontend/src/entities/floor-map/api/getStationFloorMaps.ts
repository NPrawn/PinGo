import { apiClient, ENDPOINTS, unwrap } from '@/shared/api';
import type { FloorMap } from '../model/types';

// 역의 층별 지도 목록을 조회한다. (GET /api/stations/{stationId}/maps)
export async function getStationFloorMaps(stationId: number): Promise<FloorMap[]> {
  return unwrap<FloorMap[]>(apiClient.get(ENDPOINTS.stationFloorMaps(stationId)));
}
