import { apiClient, ENDPOINTS, type ApiResponse } from '@/shared/api';
import type { RouteOption, RouteOptionsQuery } from '../model/types';

/**
 * 출발 노드에서 도착 노드까지의 경로 옵션을 조회한다.
 * (POST /api/routes/indoor/options)
 *
 * 조회인데 POST인 이유는 요청 본문이 필요해서다. 명세와 백엔드 컨트롤러가 모두 POST다.
 */
export async function getIndoorRouteOptions(query: RouteOptionsQuery): Promise<RouteOption[]> {
  const { data } = await apiClient.post<ApiResponse<RouteOption[]>>(
    ENDPOINTS.routes.indoorOptions,
    query,
  );
  return data.data ?? [];
}
