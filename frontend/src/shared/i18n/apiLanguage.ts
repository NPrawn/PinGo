import { useTranslation } from 'react-i18next';

/**
 * 서버에 실어 보내는 언어 코드. 백엔드 `Language` enum(KO·EN·JA·ZH)을 소문자로 적은 것이다.
 *
 * JA·ZH는 값으로는 보낼 수 있지만 백엔드에 그 두 언어 문구가 없어 영어로 떨어진다
 * (`Language.DEFAULT`). 지금 UI가 고를 수 있는 것은 KO·EN 둘뿐이다.
 */
export type ApiLanguage = 'ko' | 'en' | 'ja' | 'zh';

const SUPPORTED: readonly string[] = ['ko', 'en', 'ja', 'zh'];

/**
 * i18next 언어 태그를 서버가 받는 코드로 줄인다.
 *
 * `ko-KR`처럼 지역이 붙어 오거나 브라우저가 모르는 태그를 줄 수 있다. 앞 두 글자만 보고,
 * 모르는 값은 `ko`로 둔다 — i18n `fallbackLng`와 같은 값이라 화면 문구와 서버 문구가
 * 갈리지 않는다.
 */
export function apiLanguageOf(language: string | undefined): ApiLanguage {
  const base = (language ?? '').slice(0, 2).toLowerCase();
  return (SUPPORTED.includes(base) ? base : 'ko') as ApiLanguage;
}

/**
 * 서버 요청에 실을 언어. **조회 훅이 스스로 읽는다.**
 *
 * 호출부에서 넘기게 두면 한 곳만 빠뜨려도 그 화면이 조용히 서버 기본 언어로 돌아간다. 실제로
 * 그렇게 됐다 — 경로 요청에 `language`가 없어서 한국어를 골라도 세부 안내가 영어로 나왔다.
 * 백엔드가 `language == null`이면 `Language.DEFAULT`(=EN)로 떨어지기 때문이고, 빠뜨린 쪽은
 * 아무 오류도 보지 못한다. (S15P11A206-339)
 *
 * `useTranslation`을 거치므로 언어를 바꾸면 이 값을 쓰는 컴포넌트가 다시 렌더된다. 조회 키에
 * 이 값이 들어가 있으면 그때 새로 받는다.
 */
export function useApiLanguage(): ApiLanguage {
  const { i18n } = useTranslation();
  return apiLanguageOf(i18n.language);
}
