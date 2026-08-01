import { isRenderableCoordinate } from './coordinates';
import { localPlanFrame } from '../model/localPlans';
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

/**
 * **실제로 화면에 그려지는 도면**에 맞는 좌표 프레임을 고른다.
 *
 * 규칙은 하나다 — 프레임은 도면을 따라간다.
 *
 * - `mapUrl`이 있으면 백엔드가 올린 도면이 그려지므로 백엔드 프레임을 쓴다.
 * - 없으면 FE 자체 도면으로 떨어지므로(`floorPlanImageUrl`) 그 도면의 프레임을 쓴다.
 *
 * 프레임은 특정 이미지에 대해서만 의미가 있는 값이기 때문이다. 지금 백엔드에는 세 층이 모두
 * `scaleMPerPx: 0.19`로 등록돼 있는데 실제 도면 세 장은 서로 다른 배율로 캡쳐됐다. 그 값을
 * FE 도면에 그대로 적용하면 층마다 같은 미터 좌표가 다른 자리에 찍힌다(S15P11A206-314).
 * 측정 근거는 `localPlans.ts`에 있다.
 *
 * 자체 도면이 없는 층은 그릴 이미지도 없으므로 백엔드 프레임으로 떨어진다. 그림 없이 좌표만
 * 얹는 경우이며, 프레임마저 없으면 null이 되어 호출부가 오버레이를 생략한다.
 */
export function displayFrameOf(map: FloorMap): CoordinateFrame | null {
  if (map.mapUrl === null) {
    const local = localPlanFrame(map.floorCode);
    if (local) return local;
  }

  return coordinateFrameOf(map);
}
