import type { ApiLanguage } from './apiLanguage';

/**
 * 언어에 맞는 이름을 고른다.
 *
 * 백엔드는 역·시설·목적지 이름을 `nameKo`와 `nameEn`으로 **둘 다** 내려준다. 그래서 언어를
 * 조회 키에 넣을 필요가 없다 — 언어를 바꿔도 서버가 줄 내용은 같으므로 캐시를 그대로 두고
 * 읽는 쪽만 바꾸면 된다. 서버가 하나만 골라 보내게 하면 같은 키에 언어별로 다른 내용이 들어가야
 * 하므로 키를 쪼개야 하고, 언어를 바꿀 때마다 전부 다시 받는다. (S15P11A206-339)
 *
 * **한국어가 아니면 영어를 먼저 본다.** 영어 이름이 없는 항목이 있어(`nameEn`은 nullable)
 * 그때는 한국어로 떨어진다. 이름이 아예 없는 것보다 읽을 수 있는 이름이 낫다.
 *
 * 둘 다 없으면 `null`이다. 부르는 쪽이 그 화면에 맞는 문구를 정한다.
 */
export function localizedNameOf(
  language: ApiLanguage,
  nameKo: string | null | undefined,
  nameEn: string | null | undefined,
): string | null {
  const preferred = language === 'ko' ? nameKo : nameEn;
  return preferred?.trim() || nameKo?.trim() || nameEn?.trim() || null;
}
