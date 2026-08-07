import type { IconName } from '@/shared/ui';

/**
 * 시설 유형 → 아이콘.
 *
 * 값은 역삼역(stationId=1) 응답에 실제로 오는 14종과 `erd_최종.md` 5.2의 유형 목록을 합친
 * 것이다. **모르는 유형은 기본 아이콘으로 떨어진다** — 백엔드가 유형을 추가할 때 지도에서
 * 시설이 사라지는 것보다 낫다.
 */
const FACILITY_ICONS: Readonly<Record<string, IconName>> = {
  exit: 'door',
  gate: 'gate',
  platform: 'train',
  // 층을 오르내리는 통로라는 뜻으로 세로 교환 화살표를 쓴다.
  transfer_passage: 'swap',
  stair: 'stairs',
  escalator: 'escalator',
  elevator: 'elevator',
  restroom: 'restroom',
  station_office: 'building',
  ticket_machine: 'card',
  card_charger: 'card',
  currency_exchange_machine: 'exchange',
  locker: 'lock',
  pharmacy: 'bottle',
  convenience_store: 'store',
  claw_machine_arcade: 'arcade',
  info: 'info',
};

/** 모르는 유형에 쓰는 아이콘. 지도 위 지점이라는 뜻만 전달한다. */
export const DEFAULT_FACILITY_ICON: IconName = 'pin';

export function facilityIconOf(facilityType: string): IconName {
  return FACILITY_ICONS[facilityType] ?? DEFAULT_FACILITY_ICON;
}

/** 출구인지. 출구는 목적지·도착 판정에서 다르게 다뤄지므로 자주 걸러낸다. */
export function isExit(facilityType: string): boolean {
  return facilityType === 'exit';
}
