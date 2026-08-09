import { localizeUserLabel } from './localizeUserLabel';

const INTERNAL_NODE_CODE = /^B\d+_[RF]\d+$/i;

/** 현재 언어의 사용자용 위치명을 고르고 내부 경로 노드 코드는 노출하지 않는다. */
export function localizedLocationLabelOf(
  labelKo: string | null | undefined,
  labelEn: string | null | undefined,
  language: string,
  fallback: string,
): string {
  const label = language === 'en' ? (labelEn ?? labelKo) : labelKo;
  if (!label || INTERNAL_NODE_CODE.test(label)) return fallback;
  return language === 'en' && !labelEn ? localizeUserLabel(label, language) : label;
}
