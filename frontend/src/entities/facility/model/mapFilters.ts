import type { IconName } from '@/shared/ui';

/**
 * 지도 위에 켤 수 있는 시설 유형.
 *
 * **한 번에 한 유형만 켠다.** 역삼역 B2는 실제 240m 폭이 지도에서 287px에 들어가 1m가
 * 1.2px이고, 그 층 시설 36개를 모두 그리면 마커 간 최소 간격이 3.9px이 되어 서로를 덮는다.
 * 유형 하나면 많아도 13개(계단)라 겹치지 않는다 — FR-U-006의 점진적 공개다.
 *
 * 안내 화면과 상담 화면이 같은 목록을 써야 한다. 상담자가 켠 시설이 사용자 화면에 없는
 * 유형이면, 짚어 준 자리를 사용자가 찾을 수 없다.
 *
 * **역삼역 응답에 오는 유형은 14종이고 이 목록은 그중 일부다.** 전체 표시(`showAllFacilities`)는
 * 그 층의 모든 유형을 그리므로, 여기 없는 유형은 지도에 뜨는데 칩이 없어 따로 켜고 끌 수 없다.
 * 유형을 늘릴 때 판단 기준은 **길을 찾는 사람이 그것을 목표로 삼는가**다 — 개찰구와 물품보관함은
 * 그렇고(S15P11A206-206), 환승통로·역무실처럼 지나가거나 물어보는 곳은 아직 두지 않았다.
 */
export const FACILITY_MAP_FILTERS: readonly {
  name: string;
  icon: IconName;
  facilityType: string;
}[] = [
  { name: '화장실', icon: 'restroom', facilityType: 'restroom' },
  { name: '승차권 충전', icon: 'card', facilityType: 'card_charger' },
  { name: '물품보관함', icon: 'lock', facilityType: 'locker' },
  { name: '엘리베이터', icon: 'elevator', facilityType: 'elevator' },
  { name: '에스컬레이터', icon: 'escalator', facilityType: 'escalator' },
  { name: '계단', icon: 'stairs', facilityType: 'stair' },
  { name: '내린 위치', icon: 'train', facilityType: 'platform' },
  { name: '개찰구', icon: 'gate', facilityType: 'gate' },
  { name: '출구', icon: 'door', facilityType: 'exit' },
];
