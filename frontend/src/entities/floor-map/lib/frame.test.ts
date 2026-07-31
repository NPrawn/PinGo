import { coordinateFrameOf } from './frame';
import type { FloorMap } from '../model/types';

/** V9 seed의 역삼역 B2 행과 같은 응답. */
const B2_RESPONSE: FloorMap = {
  mapId: 2,
  floorId: 2,
  floorCode: 'B2',
  mapType: 'image',
  mapUrl: null,
  width: 1624,
  height: 969,
  scaleMPerPx: 0.19,
  originPxX: 622,
  originPxY: 512,
  frameAngleDeg: -21.28,
  version: 'v1',
};

describe('coordinateFrameOf', () => {
  it('네 값이 모두 있으면 프레임을 만든다', () => {
    expect(coordinateFrameOf(B2_RESPONSE)).toEqual({
      originPx: [622, 512],
      angleDeg: -21.28,
      mpp: 0.19,
    });
  });

  it('하나라도 없으면 null이다', () => {
    // 프레임이 확정되지 않은 역의 지도도 등록할 수 있게 백엔드가 nullable로 두었다.
    const fields = ['scaleMPerPx', 'originPxX', 'originPxY', 'frameAngleDeg'] as const;

    for (const field of fields) {
      expect(coordinateFrameOf({ ...B2_RESPONSE, [field]: null })).toBeNull();
    }
  });

  it('축척이 0이면 프레임으로 인정하지 않는다', () => {
    // 변환식이 scaleMPerPx로 나누므로 0이면 성립하지 않는다.
    expect(coordinateFrameOf({ ...B2_RESPONSE, scaleMPerPx: 0 })).toBeNull();
  });

  it('유한하지 않은 값은 거른다', () => {
    // BigDecimal이 JSON을 거치면서 숫자가 아닌 값이 될 수 있다.
    expect(coordinateFrameOf({ ...B2_RESPONSE, originPxX: Number.NaN })).toBeNull();
    expect(
      coordinateFrameOf({ ...B2_RESPONSE, frameAngleDeg: Number.POSITIVE_INFINITY }),
    ).toBeNull();
  });

  it('각도 0도 유효한 값이다', () => {
    // falsy 검사로 걸러버리면 기울지 않은 도면의 프레임이 사라진다.
    expect(coordinateFrameOf({ ...B2_RESPONSE, frameAngleDeg: 0 })?.angleDeg).toBe(0);
  });

  it('원점이 (0, 0)이어도 유효하다', () => {
    const frame = coordinateFrameOf({ ...B2_RESPONSE, originPxX: 0, originPxY: 0 });
    expect(frame?.originPx).toEqual([0, 0]);
  });
});
