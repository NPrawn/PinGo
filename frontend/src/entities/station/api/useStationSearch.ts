import { useQuery } from '@tanstack/react-query';
import { getNearbyStations, queryKeys, searchStations } from '@/shared/api';
import { localizedNameOf, useApiLanguage, type ApiLanguage } from '@/shared/i18n';
import type { Station } from '../model/types';

/**
 * 역 이름. 언어에 맞는 것을 고르고, 둘 다 없으면 자리를 채운다.
 *
 * 서버가 `nameKo`·`nameEn`을 둘 다 주므로 조회 키에 언어를 넣지 않는다(`localizedNameOf`).
 */
function stationName(language: ApiLanguage, nameKo?: string, nameEn?: string) {
  return localizedNameOf(language, nameKo, nameEn) ?? '이름 없는 역';
}

function formatDistance(distanceM?: number) {
  if (distanceM == null) return '주변 역';
  return distanceM < 1_000 ? `${distanceM}m` : `${(distanceM / 1_000).toFixed(1)}km`;
}

export function useStationSearch(keyword: string, enabled: boolean) {
  const normalizedKeyword = keyword.trim();
  /**
   * 검색 언어. 예전에는 `'ko'`로 박혀 있어서, 영어를 고른 사용자도 한국어로 검색됐다.
   * 서버가 이 값을 실제로 받아 쓴다(`searchStations`). (S15P11A206-339)
   */
  const language = useApiLanguage();

  return useQuery({
    queryKey: queryKeys.stationSearch(normalizedKeyword, language),
    queryFn: async (): Promise<Station[]> => {
      const stations = await searchStations(normalizedKeyword, language);
      return stations.map((station) => ({
        stationId: station.stationId ?? null,
        name: stationName(language, station.nameKo, station.nameEn),
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
  const language = useApiLanguage();

  return useQuery({
    queryKey: queryKeys.registeredStations(language),
    queryFn: async (): Promise<Station[]> => {
      const stations = await searchStations(undefined, language);
      return stations.map((station) => ({
        stationId: station.stationId ?? null,
        name: stationName(language, station.nameKo, station.nameEn),
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
  /* 주변 역 조회는 좌표만 보내고 언어를 받지 않는다. 이름 선택에만 쓰므로 키에 넣지 않는다. */
  const language = useApiLanguage();

  return useQuery({
    queryKey: queryKeys.nearbyStations(latitude ?? 0, longitude ?? 0),
    queryFn: async (): Promise<Station[]> => {
      const stations = await getNearbyStations(latitude!, longitude!);
      return stations.map((station, index) => ({
        stationId: station.stationId ?? null,
        name: stationName(language, station.nameKo, station.nameEn),
        line: station.lineInfo ?? '',
        dist: formatDistance(station.distanceM),
        here: index === 0,
      }));
    },
    enabled,
  });
}
