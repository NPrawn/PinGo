import type { FloorId } from '@/shared/types';
import type { FacilityPin, Poi } from './types';

/**
 * Facilities and nearby places used by destination search and the indoor map.
 *
 * TODO: Replace with the facility / place APIs once those contracts are agreed.
 */

export const FACILITIES: readonly Poi[] = [
  { name: '화장실', icon: 'restroom', meta: 'B1 대합실 · 3번 출구 방면', kind: 'facility' },
  { name: '엘리베이터', icon: 'elevator', meta: 'B2 ↔ 1F 전 층 운행', kind: 'facility' },
  { name: '물품보관함', icon: 'lock', meta: 'B1 · 2번 개찰구 옆', kind: 'facility' },
  { name: '수유실', icon: 'bottle', meta: 'B1 고객안내센터 내', kind: 'facility' },
  { name: '편의점 GS25', icon: 'store', meta: 'B1 대합실', kind: 'facility' },
  { name: 'ATM', icon: 'card', meta: 'B1 · 1번 개찰구 옆', kind: 'facility' },
];

export const PLACES: readonly Poi[] = [
  {
    name: '스타벅스 역삼점',
    icon: 'coffee',
    meta: '3번 출구 · 도보 2분',
    star: true,
    kind: 'place',
  },
  { name: 'GS25 역삼역점', icon: 'store', meta: '1번 출구 · 도보 1분', kind: 'place' },
  { name: '강남파이낸스센터', icon: 'building', meta: '7번 출구 · 도보 5분', kind: 'place' },
  { name: '올리브영 역삼', icon: 'cosmetics', meta: '4번 출구 · 도보 3분', kind: 'place' },
  { name: '역삼 세무서', icon: 'gov', meta: '6번 출구 · 도보 6분', kind: 'place' },
];

/** Destination search looks across places first, then facilities. */
export const ALL_DESTINATIONS: readonly Poi[] = [...PLACES, ...FACILITIES];

export function searchDestinations(query: string): readonly Poi[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return ALL_DESTINATIONS.filter((poi) => poi.name.includes(trimmed));
}

/** Facility pins per floor, drawn on the counselor's shared map. */
export const FLOOR_FACILITY_PINS: Record<FloorId, readonly FacilityPin[]> = {
  '1F': [
    { key: 'exit3', icon: 'door', label: '3번 출구', x: '62%', y: '26%' },
    { key: 'exit1', icon: 'door', label: '1번 출구', x: '22%', y: '62%' },
    { key: 'bus', icon: 'bus', label: '버스정류장', x: '78%', y: '70%' },
  ],
  B1: [
    { key: 'gate2', icon: 'door', label: '2번 개찰구', x: '36%', y: '40%' },
    { key: 'cvs', icon: 'store', label: '편의점', x: '72%', y: '28%' },
    { key: 'info', icon: 'info', label: '고객안내센터', x: '24%', y: '66%' },
    { key: 'wc', icon: 'restroom', label: '화장실', x: '76%', y: '66%' },
  ],
  B2: [
    { key: 'elev', icon: 'elevator', label: '엘리베이터', x: '70%', y: '28%' },
    { key: 'platform', icon: 'train', label: '승강장', x: '50%', y: '72%' },
    { key: 'stair', icon: 'stairs', label: '계단', x: '26%', y: '34%' },
  ],
  B3: [],
};

/** Accent colour per facility icon, used for the map pins. */
export const FACILITY_TINTS: Partial<Record<string, string>> = {
  door: '#c24a3d',
  store: '#7358d4',
  info: '#4a9cd6',
  restroom: '#4a9cd6',
  elevator: '#0ea36f',
  train: '#a76a1f',
  stairs: '#0ea36f',
  bus: '#a76a1f',
};

export const DEFAULT_FACILITY_TINT = '#0f5a3e';
