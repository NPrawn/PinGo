import { localizeUserLabel } from './localizeUserLabel';

describe('localizeUserLabel', () => {
  it('영어 화면의 위치와 목적지 더미 이름을 번역한다', () => {
    expect(localizeUserLabel('B3 계단 하단', 'en')).toBe('B3 Bottom of stairs');
    expect(localizeUserLabel('GS25 역삼역점', 'en')).toBe('GS25 Yeoksam Station');
    expect(localizeUserLabel('언주역', 'en')).toBe('Eonju Station');
    expect(localizeUserLabel('선릉역', 'en')).toBe('Seolleung Station');
  });

  it('한국어 화면의 이름은 변경하지 않는다', () => {
    expect(localizeUserLabel('B3 계단 하단', 'ko')).toBe('B3 계단 하단');
  });
});
