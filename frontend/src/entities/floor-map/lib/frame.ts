import { isRenderableCoordinate } from './coordinates';
import type { CoordinateFrame, FloorMap } from '../model/types';

/**
 * 층별 지도 응답에서 좌표 프레임을 꺼낸다. (API 명세서 5.1 · V9 마이그레이션)
 *
 * `scaleMPerPx`·`originPxX`·`originPxY`·`frameAngleDeg`가 **모두 있어야** 변환이 성립한다.
 * 하나라도 없으면 null이며, 호출부는 지도 이미지만 그리고 오버레이를 생략한다. 프레임이 확정되지
 * 않은 역의 지도도 등록할 수 있게 백엔드가 nullable로 두었기 때문이다.
 *
 * `scaleMPerPx`가 0이면 나눗셈이 성립하지 않으므로 프레임으로 인정하지 않는다.
 *
 * 백엔드가 `BigDecimal`로 내려주므로 JSON 파싱 결과가 문자열이나 null일 수 있다.
 * `isRenderableCoordinate`로 유한한 수인지 확인한 값만 통과시킨다.
 */
export function coordinateFrameOf(map: FloorMap): CoordinateFrame | null {
  const { originPxX, originPxY, frameAngleDeg, scaleMPerPx } = map;

  if (!isRenderableCoordinate(originPxX) || !isRenderableCoordinate(originPxY)) return null;
  if (!isRenderableCoordinate(frameAngleDeg)) return null;
  if (!isRenderableCoordinate(scaleMPerPx) || scaleMPerPx <= 0) return null;

  return {
    originPx: [originPxX, originPxY],
    angleDeg: frameAngleDeg,
    mpp: scaleMPerPx,
  };
}
