import { useQuery } from '@tanstack/react-query';
import { queryKeys, searchDestinations } from '@/shared/api';
import { localizedNameOf, useApiLanguage } from '@/shared/i18n';
import type { ApiLanguage } from '@/shared/i18n';
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
  language: ApiLanguage,
): Poi {
  return {
    id: destination.destinationId,
    /* 서버가 두 언어 이름을 함께 주므로 조회 키가 아니라 여기서 고른다(`localizedNameOf`). */
    name: localizedNameOf(language, destination.nameKo, destination.nameEn) ?? '이름 없는 목적지',
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

      return destinations.map((destination) => toPoi(destination, language));
    },
    enabled: enabled && stationId != null && stationId > 0 && normalizedKeyword.length > 0,
  });
}

/**
 * 빠른 목적지 하나를 사용자가 고른 뒤에야 실제 목적지로 바꾼다.
 *
 * **찾을 때는 한국어로 맞추고, 돌려줄 때는 사용자 언어로 고른다.** `name`으로 들어오는 것은
 * `QUICK_DESTINATIONS`의 한국어 라벨이고 그것으로 검색까지 했으므로, 맞춰 볼 대상도 한국어
 * 이름이어야 한다. 사용자 언어로 맞추면 영어 UI에서 `'Olive Young' === '올리브영 역삼중앙점'`이
 * 되어 아무것도 못 찾고 조용히 첫 결과로 떨어진다. 화면에 보일 이름은 그와 별개로 사용자
 * 언어를 따른다. (S15P11A206-339)
 *
 * 훅이 아니라 이벤트 처리 중에 부르는 함수라 `useApiLanguage`를 쓸 수 없다. 그래서 언어를
 * **필수 인자**로 받는다 — 새 호출부가 생기면 컴파일이 먼저 막는다.
 */
export async function resolveDestination(stationId: number, name: string, language: ApiLanguage) {
  const destinations = await searchDestinations(stationId, name);
  const matched =
    destinations.find(
      (destination) => localizedNameOf('ko', destination.nameKo, destination.nameEn) === name,
    ) ?? destinations[0];

  return matched == null ? undefined : toPoi(matched, language);
}
