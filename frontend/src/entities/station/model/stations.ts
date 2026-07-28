import type { Station } from './types';

/**
 * Stations offered on the "current station" screen.
 *
 * TODO: Replace with the station lookup API once the endpoint and GPS contract
 * are agreed. These are the prototype's fixtures.
 */
export const STATIONS: readonly Station[] = [
  { name: '역삼역', line: '2호선', dist: '현재 GPS 위치', here: true },
  { name: '선릉역', line: '2호선·수인분당', dist: '420m' },
  { name: '강남역', line: '2호선·신분당', dist: '1.1km' },
];

export const DEFAULT_STATION = '역삼역';

export function searchStations(query: string): readonly Station[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return STATIONS.filter((station) => station.name.includes(trimmed));
}
