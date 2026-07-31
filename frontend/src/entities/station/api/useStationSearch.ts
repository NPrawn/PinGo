import { useQuery } from '@tanstack/react-query';
import { getNearbyStations, queryKeys, searchStations } from '@/shared/api';
import type { Station } from '../model/types';

function formatDistance(distanceM?: number) {
  if (distanceM == null) return '주변 역';
  return distanceM < 1_000 ? `${distanceM}m` : `${(distanceM / 1_000).toFixed(1)}km`;
}

export function useStationSearch(keyword: string, enabled: boolean) {
  const normalizedKeyword = keyword.trim();
  const language = 'ko';

  return useQuery({
    queryKey: queryKeys.stationSearch(normalizedKeyword, language),
    queryFn: async (): Promise<Station[]> => {
      const stations = await searchStations(normalizedKeyword, language);
      return stations.map((station) => ({
        id: station.stationId,
        name: station.nameKo ?? station.nameEn ?? '이름 없는 역',
        line: station.lineInfo ?? '',
        // 외부 검색 결과는 주소를, 등록된 역은 그대로 검색 결과임을 보여준다.
        dist: station.address ?? '검색 결과',
        serviceReady: station.serviceReady ?? true,
      }));
    },
    enabled: enabled && normalizedKeyword.length > 0,
  });
}

/**
 * 실내 안내가 준비된(=등록된) 역 전체 목록.
 *
 * keyword 없이 역 검색을 호출하면 등록된 역만 돌아온다. GPS를 못 쓸 때 주변 역 목록의
 * 대체 목록으로 쓴다.
 */
export function useRegisteredStations(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.registeredStations('ko'),
    queryFn: async (): Promise<Station[]> => {
      const stations = await searchStations(undefined, 'ko');
      return stations.map((station) => ({
        id: station.stationId,
        name: station.nameKo ?? station.nameEn ?? '이름 없는 역',
        line: station.lineInfo ?? '',
        dist: '실내 안내 가능',
        serviceReady: true,
      }));
    },
    enabled,
  });
}

export function useNearbyStations(latitude: number | undefined, longitude: number | undefined) {
  const enabled = latitude != null && longitude != null;

  return useQuery({
    queryKey: queryKeys.nearbyStations(latitude ?? 0, longitude ?? 0),
    queryFn: async (): Promise<Station[]> => {
      const stations = await getNearbyStations(latitude!, longitude!);
      return stations.map((station, index) => ({
        id: station.stationId,
        name: station.nameKo ?? station.nameEn ?? '이름 없는 역',
        line: station.lineInfo ?? '',
        dist: formatDistance(station.distanceM),
        here: index === 0,
      }));
    },
    enabled,
  });
}
