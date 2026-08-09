import type { CoordinateFrame } from '../model/types';
import { isRenderableCoordinate, meterToPixel, pixelToMeter } from './coordinates';

// docs/역삼역_FE_좌표연동_스펙.md §2의 B2 프레임.
const b2Frame: CoordinateFrame = {
  originPx: [622, 512],
  angleDeg: -21.28,
  mpp: 0.19,
};

describe('isRenderableCoordinate', () => {
  it('유한 실수만 통과시킨다', () => {
    expect(isRenderableCoordinate(0)).toBe(true);
    expect(isRenderableCoordinate(-80.4)).toBe(true);
  });

  it('NaN·무한대·숫자가 아닌 값을 거른다', () => {
    expect(isRenderableCoordinate(Number.NaN)).toBe(false);
    expect(isRenderableCoordinate(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isRenderableCoordinate(null)).toBe(false);
    expect(isRenderableCoordinate(undefined)).toBe(false);
    expect(isRenderableCoordinate('320.5')).toBe(false);
  });
});

describe('meterToPixel', () => {
  // 스펙 문서가 제시한 검증값. 프레임 상수를 갱신해도 이 관계는 유지돼야 한다.
  it('원점 좌표는 프레임의 originPx로 변환된다', () => {
    expect(meterToPixel(0, 0, b2Frame)).toEqual({ px: 622, py: 512 });
  });

  it('EVB 좌표를 스펙의 검증값으로 변환한다', () => {
    const result = meterToPixel(-0.4, 27.2, b2Frame);
    expect(result).not.toBeNull();
    expect(result!.px).toBeCloseTo(672, 0);
    expect(result!.py).toBeCloseTo(646, 0);
  });

  it('회전을 적용한다 — +X축은 이미지 수평이 아니다', () => {
    // angleDeg가 0이 아니므로 x축으로만 이동해도 py가 함께 변한다.
    const result = meterToPixel(10, 0, b2Frame);
    expect(result).not.toBeNull();
    expect(result!.py).not.toBeCloseTo(b2Frame.originPx[1], 3);
  });

  it('잘못된 좌표는 null을 반환한다', () => {
    expect(meterToPixel(Number.NaN, 0, b2Frame)).toBeNull();
    expect(meterToPixel(0, Number.NaN, b2Frame)).toBeNull();
  });

  it('mpp가 0이면 0으로 나누지 않고 null을 반환한다', () => {
    expect(meterToPixel(1, 1, { ...b2Frame, mpp: 0 })).toBeNull();
  });
});

/**
 * 화면에서 짚은 자리를 좌표로 남기는 데 쓴다. (S15P11A206-89)
 *
 * 상담자가 지도 위에 그린 선이 그렇다. 화면 기준 값으로 남기면 두 사람의 확대·이동·회전·표시
 * 층이 달라 같은 자리를 가리키지 못한다.
 */
describe('pixelToMeter', () => {
  it('프레임 원점은 미터 원점으로 되돌아간다', () => {
    const result = pixelToMeter(622, 512, b2Frame);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(0, 6);
    expect(result!.y).toBeCloseTo(0, 6);
  });

  /**
   * 왕복이 제자리로 와야 한다. 회전각과 배율 어느 하나만 부호가 어긋나도 오류 없이 조용히
   * 틀린 좌표가 나오는데, 그 어긋남은 그린 선이 엉뚱한 자리에 뜨는 것으로만 드러난다.
   */
  it('meterToPixel 과 왕복하면 제자리로 돌아온다', () => {
    for (const [x, y] of [
      [0, 0],
      [-0.4, 27.2],
      [12.5, -8.75],
      [-30, -30],
    ]) {
      const pixel = meterToPixel(x, y, b2Frame);
      expect(pixel).not.toBeNull();

      const meter = pixelToMeter(pixel!.px, pixel!.py, b2Frame);
      expect(meter).not.toBeNull();
      expect(meter!.x).toBeCloseTo(x, 6);
      expect(meter!.y).toBeCloseTo(y, 6);
    }
  });

  it('잘못된 좌표와 mpp 0 은 null 을 반환한다', () => {
    expect(pixelToMeter(Number.NaN, 0, b2Frame)).toBeNull();
    expect(pixelToMeter(0, Number.NaN, b2Frame)).toBeNull();
    expect(pixelToMeter(1, 1, { ...b2Frame, mpp: 0 })).toBeNull();
  });
});
