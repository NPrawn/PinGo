import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getNearbyStations, queryKeys, searchStations } from '@/shared/api';
import { localizeUserLabel } from '@/shared/lib/localizeUserLabel';
import type { Station } from '../model/types';

const ENGLISH_LINES: Readonly<Record<string, string>> = {
  '1호선': 'Line 1',
  '2호선': 'Line 2',
  '3호선': 'Line 3',
  '4호선': 'Line 4',
  '5호선': 'Line 5',
  '6호선': 'Line 6',
  '7호선': 'Line 7',
  '8호선': 'Line 8',
  '9호선': 'Line 9',
  신분당선: 'Shinbundang Line',
  수인분당선: 'Suin-Bundang Line',
  경의중앙선: 'Gyeongui-Jungang Line',
  공항철도: 'Airport Railroad',
};

function formatLineInfo(lineInfo: string | null | undefined, language: 'ko' | 'en') {
  if (!lineInfo || language === 'ko') return lineInfo ?? '';
  return lineInfo
    .split('·')
    .map((line) => ENGLISH_LINES[line.trim()] ?? line.trim())
    .join(' · ');
}

function stationName(
  station: { nameKo?: string | null; nameEn?: string | null },
  language: 'ko' | 'en',
) {
  const fallback = station.nameKo ?? station.nameEn;
  if (!fallback) return language === 'en' ? 'Unnamed station' : '이름 없는 역';
  if (language === 'en') {
    return station.nameEn?.trim() || localizeUserLabel(fallback, 'en');
  }
  return station.nameKo ?? station.nameEn ?? fallback;
}

function formatDistance(distanceM: number | undefined, language: 'ko' | 'en') {
  if (distanceM == null) return language === 'en' ? 'Nearby station' : '주변 역';
  return distanceM < 1_000 ? `${distanceM}m` : `${(distanceM / 1_000).toFixed(1)}km`;
}

export function useStationSearch(keyword: string, enabled: boolean) {
  const { i18n } = useTranslation();
  const normalizedKeyword = keyword.trim();
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'ko';

  return useQuery({
    queryKey: queryKeys.stationSearch(normalizedKeyword, language),
    queryFn: async (): Promise<Station[]> => {
      const stations = await searchStations(normalizedKeyword, language);
      return stations.map((station) => ({
        stationId: station.stationId ?? null,
        name: stationName(station, language),
        line: formatLineInfo(station.lineInfo, language),
        // 외부 검색 결과는 주소를, 등록된 역은 그대로 검색 결과임을 보여준다.
        dist: station.address ?? (language === 'en' ? 'Search result' : '검색 결과'),
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
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'ko';
  return useQuery({
    queryKey: queryKeys.registeredStations(language),
    queryFn: async (): Promise<Station[]> => {
      const stations = await searchStations(undefined, language);
      return stations.map((station) => ({
        stationId: station.stationId ?? null,
        name: stationName(station, language),
        line: formatLineInfo(station.lineInfo, language),
        dist: language === 'en' ? 'Indoor guidance available' : '실내 안내 가능',
        serviceReady: true,
      }));
    },
    enabled,
  });
}

export function useNearbyStations(latitude: number | undefined, longitude: number | undefined) {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'ko';
  const enabled = latitude != null && longitude != null;

  return useQuery({
    queryKey: queryKeys.nearbyStations(latitude ?? 0, longitude ?? 0, language),
    queryFn: async (): Promise<Station[]> => {
      const stations = await getNearbyStations(latitude!, longitude!);
      return stations.map((station, index) => ({
        stationId: station.stationId ?? null,
        name: stationName(station, language),
        line: formatLineInfo(station.lineInfo, language),
        dist: formatDistance(station.distanceM, language),
        here: index === 0,
      }));
    },
    enabled,
  });
}
