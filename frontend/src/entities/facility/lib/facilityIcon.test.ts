import { DEFAULT_FACILITY_ICON, facilityIconOf, isExit } from './facilityIcon';

describe('facilityIconOf', () => {
  it('알려진 유형에 맞는 아이콘을 준다', () => {
    expect(facilityIconOf('exit')).toBe('door');
    expect(facilityIconOf('elevator')).toBe('elevator');
    expect(facilityIconOf('restroom')).toBe('restroom');
  });

  /**
   * 백엔드가 유형을 추가할 때(311에서 약국·편의점·환전기·인형뽑기가 추가됐다) 지도에서 시설이
   * 사라지면 안 된다. 프론트가 모르는 유형도 지점으로는 보여야 한다.
   */
  it('모르는 유형은 기본 아이콘으로 떨어진다', () => {
    expect(facilityIconOf('some_new_type_from_backend')).toBe(DEFAULT_FACILITY_ICON);
    expect(facilityIconOf('')).toBe(DEFAULT_FACILITY_ICON);
  });

  /** 역삼역 응답에 실제로 오는 14종은 모두 전용 아이콘이 있어야 한다. */
  it('역삼역이 내려주는 유형에는 기본 아이콘이 쓰이지 않는다', () => {
    const served = [
      'exit',
      'gate',
      'stair',
      'escalator',
      'elevator',
      'restroom',
      'ticket_machine',
      'card_charger',
      'currency_exchange_machine',
      'locker',
      'pharmacy',
      'convenience_store',
      'claw_machine_arcade',
      'info',
    ];

    for (const type of served) {
      expect(facilityIconOf(type), type).not.toBe(DEFAULT_FACILITY_ICON);
    }
  });
});

describe('isExit', () => {
  it('출구만 참이다', () => {
    expect(isExit('exit')).toBe(true);
    expect(isExit('gate')).toBe(false);
  });
});
