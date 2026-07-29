import { env } from './env';

/**
 * 백엔드가 내려주는 정적 파일 상대 경로(`/uploads/maps/...`)를
 * 원본 서버의 절대 URL로 변환한다. (API 명세서 2.5 지도 파일 관리)
 * 이미 절대 URL이거나 data URI(인라인 자산)면 그대로 반환한다.
 */
export function resolveAssetUrl(path: string): string {
  if (/^(?:https?:\/\/|data:)/i.test(path)) return path;
  const base = env.VITE_API_BASE_URL.replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}
