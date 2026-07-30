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
        dist: '검색 결과',
      }));
    },
    enabled: enabled && normalizedKeyword.length > 0,
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
