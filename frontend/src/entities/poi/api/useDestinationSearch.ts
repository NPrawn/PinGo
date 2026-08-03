import { useQuery } from '@tanstack/react-query';
import { queryKeys, searchDestinations } from '@/shared/api';
import { localizedNameOf, useApiLanguage } from '@/shared/i18n';
import type { IconName } from '@/shared/ui';
import type { Poi, PoiKind } from '../model/types';

function toKind(destinationType?: string): PoiKind {
  return destinationType?.toLowerCase() === 'place' ? 'place' : 'facility';
}

function toIcon(category?: string): IconName {
  const normalized = category?.toLowerCase() ?? '';
  if (normalized.includes('elevator')) return 'elevator';
  if (normalized.includes('restroom') || normalized.includes('toilet')) return 'restroom';
  if (normalized.includes('exit')) return 'door';
  if (normalized.includes('store') || normalized.includes('shop')) return 'store';
  return 'pin';
}

/**
 * 목적지 검색.
 *
 * 등록되지 않은 역은 `stationId`가 null이라 조회를 걸지 않는다. 역 선택에서 그런 역을 막아
 * 두었지만 스토어 타입이 null을 허용하는 동안 이쪽도 스스로 막는다.
 */
export function useDestinationSearch(stationId: number | null, keyword: string, enabled: boolean) {
  const normalizedKeyword = keyword.trim();
  /**
   * 표시할 이름을 고르는 데만 쓴다. 요청에도 조회 키에도 싣지 않는다 — 사유는
   * `queryKeys.stationSearch`에 적어 두었다. (S15P11A206-339)
   */
  const language = useApiLanguage();

  return useQuery({
    queryKey: queryKeys.destinationSearch(stationId ?? 0, normalizedKeyword),
    queryFn: async (): Promise<Poi[]> => {
      const destinations = await searchDestinations(stationId!, normalizedKeyword);

      return destinations.map((destination) => ({
        id: destination.destinationId,
        /* 서버가 두 언어 이름을 함께 주므로 조회 키가 아니라 여기서 고른다(`localizedNameOf`). */
        name:
          localizedNameOf(language, destination.nameKo, destination.nameEn) ?? '이름 없는 목적지',
        icon: toIcon(destination.category),
        meta: destination.category ?? destination.destinationType ?? '',
        kind: toKind(destination.destinationType),
        destinationType: destination.destinationType,
        latitude: destination.latitude,
        longitude: destination.longitude,
        address: destination.address,
      }));
    },
    enabled: enabled && stationId != null && stationId > 0 && normalizedKeyword.length > 0,
  });
}
