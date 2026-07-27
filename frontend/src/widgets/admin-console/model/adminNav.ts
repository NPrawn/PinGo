import type { AdminTab } from '@/shared/config';
import type { IconName } from '@/shared/ui';

export type AdminNavItem = {
  tab: AdminTab;
  icon: IconName;
  label: string;
  /** Icon accent colour, cycled from the prototype's `navTint` palette. */
  tint: string;
};

const TINTS = ['#3cd8a0', '#7cc7f0', '#ff9e8c', '#c4b5fd', '#f0b36a', '#5ee0b0'];

const ITEMS: readonly Omit<AdminNavItem, 'tint'>[] = [
  { tab: 'station', icon: 'train', label: '역 관리' },
  { tab: 'map', icon: 'map', label: '실내지도 관리' },
  { tab: 'facility', icon: 'door', label: '시설·출구 관리' },
  { tab: 'route', icon: 'compass', label: '경로 관리' },
  { tab: 'place', icon: 'pin', label: '주변 장소 관리' },
  { tab: 'counselor', icon: 'headset', label: '상담자 계정' },
];

export const ADMIN_NAV: readonly AdminNavItem[] = ITEMS.map((item, index) => ({
  ...item,
  tint: TINTS[index % TINTS.length],
}));
