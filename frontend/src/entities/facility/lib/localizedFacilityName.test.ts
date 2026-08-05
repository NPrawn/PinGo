import type { Facility } from '../model/types';
import {
  facilityAtNodeMatchingLabel,
  facilityMatchesLabel,
  localizedFacilityNameAtNode,
  localizedFacilityNameOf,
} from './localizedFacilityName';

const pharmacy: Facility = {
  facilityId: 25,
  stationId: 1,
  floorId: 3,
  facilityType: 'pharmacy',
  nameKo: '약국 A',
  nameEn: 'Pharmacy A',
  mapX: 10,
  mapY: 20,
  linkedNodeId: 101,
  isAccessible: true,
};

describe('localizedFacilityNameOf', () => {
  it('uses the English facility name on the English UI', () => {
    expect(localizedFacilityNameOf(pharmacy, 'en')).toBe('Pharmacy A');
  });

  it('uses the Korean facility name on the Korean UI', () => {
    expect(localizedFacilityNameOf(pharmacy, 'ko')).toBe('약국 A');
  });
});

describe('localizedFacilityNameAtNode', () => {
  it('matches an API node to its facility through linkedNodeId', () => {
    expect(localizedFacilityNameAtNode([pharmacy], 101, 'en', '약국 A')).toBe('Pharmacy A');
  });

  it('keeps the node label when no facility is linked', () => {
    expect(localizedFacilityNameAtNode([pharmacy], 999, 'ko', 'B1 복도')).toBe('B1 복도');
  });
});

describe('facilityMatchesLabel', () => {
  it('matches bilingual names and equivalent exit labels', () => {
    expect(facilityMatchesLabel(pharmacy, 'Pharmacy A')).toBe(true);
    expect(facilityMatchesLabel({ nameKo: '4번 출구', nameEn: 'Exit 4' }, '4번 출입구')).toBe(true);
  });

  it('does not trust a stale node whose facility has a different label', () => {
    expect(facilityAtNodeMatchingLabel([pharmacy], 101, 'B2-B3 계단 8')).toBeUndefined();
  });

  it('checks every facility when multiple facilities share a route node', () => {
    const elevator = {
      ...pharmacy,
      facilityId: 26,
      nameKo: '엘리베이터 B',
      nameEn: 'Elevator B',
    };

    expect(facilityAtNodeMatchingLabel([pharmacy, elevator], 101, 'Elevator B')).toBe(elevator);
  });
});
