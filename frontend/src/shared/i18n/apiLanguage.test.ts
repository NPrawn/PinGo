import { apiLanguageOf } from './apiLanguage';
import { localizedNameOf } from './localizedName';

describe('apiLanguageOf', () => {
  it('지역이 붙은 태그를 언어 코드로 줄인다', () => {
    expect(apiLanguageOf('ko-KR')).toBe('ko');
    expect(apiLanguageOf('en-US')).toBe('en');
    expect(apiLanguageOf('EN')).toBe('en');
  });

  /**
   * i18n `fallbackLng`와 같은 값으로 떨어진다.
   *
   * 여기서 `en`으로 떨어뜨리면 화면은 한국어인데 서버 문구만 영어인 상태가 된다.
   */
  it('모르는 값과 빈 값은 ko로 떨어진다', () => {
    expect(apiLanguageOf('de')).toBe('ko');
    expect(apiLanguageOf('')).toBe('ko');
    expect(apiLanguageOf(undefined)).toBe('ko');
  });
});

describe('localizedNameOf', () => {
  it('언어에 맞는 이름을 고른다', () => {
    expect(localizedNameOf('ko', '역삼역', 'Yeoksam Station')).toBe('역삼역');
    expect(localizedNameOf('en', '역삼역', 'Yeoksam Station')).toBe('Yeoksam Station');
  });

  /** `nameEn`은 nullable이다. 이름이 아예 없는 것보다 읽을 수 있는 이름이 낫다. */
  it('고른 쪽이 비어 있으면 다른 쪽으로 떨어진다', () => {
    expect(localizedNameOf('en', '수유실', null)).toBe('수유실');
    expect(localizedNameOf('en', '수유실', '   ')).toBe('수유실');
    expect(localizedNameOf('ko', undefined, 'Elevator')).toBe('Elevator');
  });

  it('둘 다 없으면 null이다', () => {
    expect(localizedNameOf('ko', null, null)).toBeNull();
    expect(localizedNameOf('en', undefined, undefined)).toBeNull();
  });
});
