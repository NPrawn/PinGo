import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { queryKeys, searchDestinations } from '@/shared/api';
import type { IconName } from '@/shared/ui';
import type { Poi, PoiKind } from '../model/types';

function toKind(destinationType?: string): PoiKind {
  return destinationType?.toLowerCase() === 'facility' ? 'facility' : 'place';
}

function toIcon(category?: string): IconName {
  const normalized = category?.toLowerCase() ?? '';
  if (normalized.includes('카페') || normalized.includes('coffee')) return 'coffee';
  if (normalized.includes('편의점')) return 'store';
  if (normalized.includes('elevator')) return 'elevator';
  if (normalized.includes('restroom') || normalized.includes('toilet')) return 'restroom';
  if (normalized.includes('exit')) return 'door';
  if (normalized.includes('store') || normalized.includes('shop')) return 'store';
  return 'pin';
}

function toPoi(
  destination: Awaited<ReturnType<typeof searchDestinations>>[number],
  language: 'ko' | 'en',
): Poi {
  return {
    id: destination.destinationId,
    name:
      (language === 'en' ? destination.nameEn : destination.nameKo) ??
      destination.nameKo ??
      destination.nameEn ??
      (language === 'en' ? 'Unnamed destination' : '이름 없는 목적지'),
    icon: toIcon(destination.category),
    meta: destination.category ?? destination.destinationType ?? '',
    kind: toKind(destination.destinationType),
    destinationType: destination.destinationType,
    latitude: destination.latitude,
    longitude: destination.longitude,
    address: destination.address,
  };
}

/**
 * 목적지 검색.
 *
 * 등록되지 않은 역은 `stationId`가 null이라 조회를 걸지 않는다. 역 선택에서 그런 역을 막아
 * 두었지만 스토어 타입이 null을 허용하는 동안 이쪽도 스스로 막는다.
 */
export function useDestinationSearch(stationId: number | null, keyword: string, enabled: boolean) {
  const { i18n } = useTranslation();
  const normalizedKeyword = keyword.trim();
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'ko';

  return useQuery({
    queryKey: queryKeys.destinationSearch(stationId ?? 0, normalizedKeyword, language),
    queryFn: async (): Promise<Poi[]> => {
      const destinations = await searchDestinations(stationId!, normalizedKeyword, language);

      return destinations.map((destination) => toPoi(destination, language));
    },
    enabled: enabled && stationId != null && stationId > 0 && normalizedKeyword.length > 0,
  });
}

/** Resolve one fixed quick destination only after the user selects it. */
export async function resolveDestination(stationId: number, name: string, language: 'ko' | 'en') {
  const destinations = await searchDestinations(stationId, name, language);
  const pois = destinations.map((destination) => toPoi(destination, language));
  return pois.find((poi) => poi.name === name) ?? pois[0];
}
