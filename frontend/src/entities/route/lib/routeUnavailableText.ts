import type { RouteUnavailableReason } from '@/shared/types';

/**
 * 도달 불가 사유를 사용자 문구로 옮긴다.
 *
 * 응답은 열거형 이름(`NO_ACCESSIBLE_ROUTE`)만 준다. 백엔드 `RouteUnavailableReason`이 같은 뜻의
 * 한국어 문구를 들고 있지만 응답에 싣지 않으므로 화면 쪽에서 짝을 맞춘다. 문구도 그쪽 것을
 * 그대로 따랐다 — 두 곳이 다른 말을 하면 로그와 화면이 어긋난다.
 *
 * 모르는 값이 오면 null이다. 백엔드가 사유를 늘렸을 때 화면에 열거형 이름이 그대로 노출되는
 * 것보다 사유 줄을 비우는 편이 낫다.
 */
export function routeUnavailableText(reason: RouteUnavailableReason | null): string | null {
  switch (reason) {
    case 'NO_ROUTE':
      return '출발지에서 도착지까지 연결된 경로가 없습니다.';
    case 'NO_ACCESSIBLE_ROUTE':
      return '계단·에스컬레이터를 제외한 경로로는 도착지까지 이동할 수 없습니다.';
    default:
      return null;
  }
}
