import type { Station } from './types';

/**
 * 역삼역의 백엔드 역 id.
 *
 * 지금 데이터가 등록된 역은 이곳뿐이다. 화면 여러 곳이 `1`을 그대로 적어 쓰고 있었는데
 * (안내 화면의 지도·시설 조회 등), 그 자리를 이 상수와 `stationStore.stationId`로 옮긴다.
 *
 * TODO: 역 조회 API(FR-U-003)가 붙으면 응답의 id를 쓰고 이 상수를 지운다.
 */
export const DEFAULT_STATION_ID = 1;

/**
 * Stations offered on the "current station" screen.
 *
 * TODO: Replace with the station lookup API once the endpoint and GPS contract
 * are agreed. These are the prototype's fixtures.
 */
export const STATIONS: readonly Station[] = [
  {
    name: '역삼역',
    stationId: DEFAULT_STATION_ID,
    line: '2호선',
    dist: '현재 GPS 위치',
    here: true,
  },
  { name: '선릉역', stationId: null, line: '2호선·수인분당', dist: '420m' },
  { name: '강남역', stationId: null, line: '2호선·신분당', dist: '1.1km' },
];

export const DEFAULT_STATION = '역삼역';

export function searchStations(query: string): readonly Station[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return STATIONS.filter((station) => station.name.includes(trimmed));
}
