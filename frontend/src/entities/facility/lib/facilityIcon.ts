import type { IconName } from '@/shared/ui';

/**
 * 시설 유형 → 아이콘.
 *
 * 값은 역삼역(stationId=1) 응답에 실제로 오는 14종과 `ERD_초안.md` 5.2의 유형 목록을 합친
 * 것이다. **모르는 유형은 기본 아이콘으로 떨어진다** — 백엔드가 유형을 추가할 때 지도에서
 * 시설이 사라지는 것보다 낫다.
 *
 * TODO: 아이콘 스프라이트에 개찰구·에스컬레이터·환전기·인형뽑기 전용 심볼이 없어 뜻이 가까운
 * 것을 돌려 쓴다. 스프라이트가 늘어나면 여기만 고치면 된다.
 */
const FACILITY_ICONS: Readonly<Record<string, IconName>> = {
  exit: 'door',
  // 개찰구. 통과 지점이라는 뜻으로 체크를 쓴다. 문 아이콘은 출구가 쓴다.
  gate: 'check',
  platform: 'train',
  transfer_passage: 'swap',
  stair: 'stairs',
  // 계단과 같은 심볼을 쓴다. 이름으로 구분된다.
  escalator: 'stairs',
  elevator: 'elevator',
  restroom: 'restroom',
  station_office: 'building',
  ticket_machine: 'card',
  card_charger: 'card',
  currency_exchange_machine: 'globe',
  locker: 'lock',
  pharmacy: 'bottle',
  convenience_store: 'store',
  claw_machine_arcade: 'sparkle',
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
