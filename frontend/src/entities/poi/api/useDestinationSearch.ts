import { useQuery } from '@tanstack/react-query';
import { queryKeys, searchDestinations } from '@/shared/api';
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

export function useDestinationSearch(stationId: number, keyword: string, enabled: boolean) {
  const normalizedKeyword = keyword.trim();
  const language = 'ko';

  return useQuery({
    queryKey: queryKeys.destinationSearch(stationId, normalizedKeyword, language),
    queryFn: async (): Promise<Poi[]> => {
      const destinations = await searchDestinations(stationId, normalizedKeyword, language);

      return destinations.map((destination) => ({
        id: destination.destinationId,
        name: destination.nameKo ?? destination.nameEn ?? '이름 없는 목적지',
        icon: toIcon(destination.category),
        meta: destination.category ?? destination.destinationType ?? '',
        kind: toKind(destination.destinationType),
        destinationType: destination.destinationType,
      }));
    },
    enabled: enabled && stationId > 0 && normalizedKeyword.length > 0,
  });
}
