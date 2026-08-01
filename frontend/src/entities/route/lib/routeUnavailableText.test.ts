import { routeUnavailableText } from './routeUnavailableText';
import type { RouteUnavailableReason } from '@/shared/types';

describe('routeUnavailableText', () => {
  it('사유를 사용자 문구로 옮긴다', () => {
    expect(routeUnavailableText('NO_ROUTE')).toBe('출발지에서 도착지까지 연결된 경로가 없습니다.');
    expect(routeUnavailableText('NO_ACCESSIBLE_ROUTE')).toBe(
      '계단·에스컬레이터를 제외한 경로로는 도착지까지 이동할 수 없습니다.',
    );
  });

  it('사유가 없으면 null이다', () => {
    // available=true인 옵션은 사유가 없다. 사유 줄을 그리지 않는다.
    expect(routeUnavailableText(null)).toBeNull();
  });

  it('모르는 사유는 화면에 내보내지 않는다', () => {
    // 백엔드가 사유를 늘렸을 때 열거형 이름이 그대로 노출되는 것보다 비우는 편이 낫다.
    expect(routeUnavailableText('NO_ELEVATOR' as RouteUnavailableReason)).toBeNull();
  });
});
