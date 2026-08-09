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

  it('기존 세션에 영어 빠른 목적지만 남아도 한국어로 복원한다', () => {
    expect(localizeUserLabel('Chaji Yeoksam', 'ko')).toBe('차지 역삼점');
    expect(localizeUserLabel('Olive Young Yeoksam Jungang', 'ko')).toBe(
      '올리브영 역삼중앙점',
    );
  });

  it('경로 API의 일반·수직 이동 라벨을 영어로 보정한다', () => {
    expect(localizeUserLabel('출입구', 'en')).toBe('Exit');
    expect(localizeUserLabel('B0.5→B1 에스컬레이터 도착점 A', 'en')).toBe(
      'B0.5 to B1 Escalator End A',
    );
    expect(localizeUserLabel('B1-B2 계단 A', 'en')).toBe('B1-B2 Stairs A');
  });
});
