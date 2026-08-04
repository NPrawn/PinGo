import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNearbyStations, queryKeys, searchStations } from '@/shared/api';
import { localizedNameOf, useApiLanguage, type ApiLanguage } from '@/shared/i18n';
import { localizeUserLabel } from '@/shared/lib/localizeUserLabel';
import type { Station } from '../model/types';

const ENGLISH_LINES: Readonly<Record<string, string>> = {
  '1호선': 'Line 1', '2호선': 'Line 2', '3호선': 'Line 3', '4호선': 'Line 4',
  '5호선': 'Line 5', '6호선': 'Line 6', '7호선': 'Line 7', '8호선': 'Line 8',
  '9호선': 'Line 9', 신분당선: 'Shinbundang Line', 수인분당선: 'Suin-Bundang Line',
  경의중앙선: 'Gyeongui-Jungang Line', 공항철도: 'Airport Railroad',
};

function lineInfoOf(lineInfo: string | undefined, language: ApiLanguage) {
  if (!lineInfo || language !== 'en') return lineInfo ?? '';
  return lineInfo.split('·').map((line) => ENGLISH_LINES[line.trim()] ?? line.trim()).join(' · ');
}

/** 서버가 주는 역 한 건. 세 조회가 같은 모양을 돌려주므로 필요한 만큼만 좁게 받는다. */
interface StationRow {
  stationId?: number;
  nameKo?: string;
  nameEn?: string;
  lineInfo?: string;
  address?: string;
  serviceReady?: boolean;
  distanceM?: number;
}

/**
 * 역 이름. 언어에 맞는 것을 고르고, 둘 다 없으면 자리를 채운다.
 *
 * 서버가 `nameKo`·`nameEn`을 둘 다 주므로 조회 키에 언어를 넣지 않는다(`localizedNameOf`).
 */
function stationName(language: ApiLanguage, nameKo?: string, nameEn?: string) {
  const localized = localizedNameOf(language, nameKo, nameEn);
  if (language === 'en' && localized) return nameEn?.trim() || localizeUserLabel(localized, 'en');
  return localized ?? (language === 'en' ? 'Unnamed station' : '이름 없는 역');
}

function formatDistance(distanceM: number | undefined, language: ApiLanguage) {
  if (distanceM == null) return language === 'en' ? 'Nearby station' : '주변 역';
  return distanceM < 1_000 ? `${distanceM}m` : `${(distanceM / 1_000).toFixed(1)}km`;
}

/**
 * 이름 선택을 **`select`에서** 한다. `queryFn`에서 하면 언어를 바꿔도 화면이 안 바뀐다.
 *
 * 조회 키에 언어를 넣지 않은 것은 서버가 두 언어 이름을 함께 주므로 다시 받을 필요가 없기
 * 때문이다. 그런데 이름 고르기를 `queryFn` 안에서 하면 **고른 결과가 캐시에 박힌다.** 언어를
 * 바꾸는 것은 조회 키를 바꾸지 않으므로 리액트 쿼리가 `queryFn`을 다시 부르지 않고, 화면에는
 * 이전 언어 이름이 그대로 남는다. 순수한 재렌더는 재조회 방아쇠가 아니다.
 *
 * `select`는 렌더 시점에 돌아가므로 언어에 반응한다. 서버 응답 자체는 캐시에 그대로 남아
 * 요청은 늘지 않는다 — 애초에 키에서 언어를 뺀 목적이 그것이다. (S15P11A206-339 리뷰)
 *
 * `useCallback`으로 묶는 이유는 함수 정체가 렌더마다 바뀌면 `select`가 매 렌더 다시 돌기
 * 때문이다. 언어가 바뀔 때만 돌면 된다.
 */
function useStationMapper(
  toStation: (row: StationRow, language: ApiLanguage, index: number) => Station,
) {
  const language = useApiLanguage();
  return useCallback(
    (rows: StationRow[]): Station[] => rows.map((row, index) => toStation(row, language, index)),
    [language, toStation],
  );
}

const toSearchResult = (row: StationRow, language: ApiLanguage): Station => ({
  stationId: row.stationId ?? null,
  name: stationName(language, row.nameKo, row.nameEn),
  line: lineInfoOf(row.lineInfo, language),
  // 외부 검색 결과는 주소를, 등록된 역은 그대로 검색 결과임을 보여준다.
  dist: row.address ?? (language === 'en' ? 'Search result' : '검색 결과'),
  serviceReady: row.serviceReady ?? true,
});

const toRegisteredStation = (row: StationRow, language: ApiLanguage): Station => ({
  stationId: row.stationId ?? null,
  name: stationName(language, row.nameKo, row.nameEn),
  line: lineInfoOf(row.lineInfo, language),
  dist: language === 'en' ? 'Indoor guidance available' : '실내 안내 가능',
  serviceReady: true,
});

const toNearbyStation = (row: StationRow, language: ApiLanguage, index: number): Station => ({
  stationId: row.stationId ?? null,
  name: stationName(language, row.nameKo, row.nameEn),
  line: lineInfoOf(row.lineInfo, language),
  dist: formatDistance(row.distanceM, language),
  here: index === 0,
});

export function useStationSearch(keyword: string, enabled: boolean) {
  const normalizedKeyword = keyword.trim();
  const select = useStationMapper(toSearchResult);

  return useQuery({
    queryKey: queryKeys.stationSearch(normalizedKeyword),
    queryFn: () => searchStations(normalizedKeyword),
    select,
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
  const select = useStationMapper(toRegisteredStation);

  return useQuery({
    queryKey: queryKeys.registeredStations(),
    queryFn: () => searchStations(undefined),
    select,
    enabled,
  });
}

export function useNearbyStations(latitude: number | undefined, longitude: number | undefined) {
  const enabled = latitude != null && longitude != null;
  const select = useStationMapper(toNearbyStation);

  return useQuery({
    queryKey: queryKeys.nearbyStations(latitude ?? 0, longitude ?? 0),
    queryFn: () => getNearbyStations(latitude!, longitude!),
    select,
    enabled,
  });
}
