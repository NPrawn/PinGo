import { coordinateFrameOf, displayFrameOf } from './frame';
import { localPlanFrame } from '../model/localPlans';
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

/**
 * 프레임은 **그려지는 도면**을 따라간다. (S15P11A206-314)
 *
 * 백엔드에는 세 층이 모두 scaleMPerPx 0.19로 등록돼 있는데 FE가 들고 있는 도면 세 장은 서로
 * 다른 배율로 캡쳐됐다. 등록값을 그대로 FE 도면에 적용하면 층마다 같은 미터 좌표가 다른 자리에
 * 찍혀, 층을 바꿀 때 역사가 어긋나 보인다.
 */
describe('displayFrameOf', () => {
  it('백엔드 도면이 있으면 백엔드 프레임을 쓴다', () => {
    // 관리자가 올린 도면이므로 그 도면에 맞춰 측정된 백엔드 값이 맞다.
    const uploaded = { ...B2_RESPONSE, mapUrl: '/uploads/maps/yeoksam-b2.png' };

    expect(displayFrameOf(uploaded)).toEqual({
      originPx: [622, 512],
      angleDeg: -21.28,
      mpp: 0.19,
    });
  });

  it('백엔드 도면이 없으면 FE 도면의 프레임을 쓴다', () => {
    // mapUrl이 null이면 화면에 뜨는 건 public/maps의 자체 도면이다.
    expect(displayFrameOf(B2_RESPONSE)).toEqual(localPlanFrame('B2'));
  });

  it('FE 도면이 없는 층은 백엔드 프레임으로 떨어진다', () => {
    // 도면 그림 없이 좌표만 얹는 경우. 그려질 이미지가 없으니 대체할 프레임도 없다.
    const otherStation = { ...B2_RESPONSE, floorCode: 'B7' };

    expect(displayFrameOf(otherStation)?.mpp).toBe(0.19);
  });

  it('둘 다 없으면 null이다', () => {
    const noFrame = { ...B2_RESPONSE, floorCode: 'B7', scaleMPerPx: null };

    expect(displayFrameOf(noFrame)).toBeNull();
  });

  /**
   * 도면끼리 직접 정합해 측정한 상대 배율이다. 세 쌍을 독립적으로 맞춘 결과가 사슬로 맞는다
   * (1.025 × 0.990 ≒ 1.010). 이 비가 깨지면 층 전환 시 지도가 다시 튄다.
   */
  it('층 사이 상대 배율이 측정값과 맞는다', () => {
    const b1 = localPlanFrame('B1');
    const b2 = localPlanFrame('B2');
    const b3 = localPlanFrame('B3');

    expect(b1!.mpp / b2!.mpp).toBeCloseTo(1.025, 3);
    expect(b2!.mpp / b3!.mpp).toBeCloseTo(0.99, 3);
    // B3만 0.5도 틀어져 있다. B1과 B2는 같은 각도다.
    expect(b3!.angleDeg - b2!.angleDeg).toBeCloseTo(0.5, 5);
    expect(b1!.angleDeg).toBe(b2!.angleDeg);
  });
});
