import type { CoordinateFrame } from '../model/types';
import { isRenderableCoordinate, meterToPixel, pixelToPercent } from './coordinates';

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

describe('pixelToPercent', () => {
  it('이미지 크기 대비 백분율로 바꾼다', () => {
    expect(pixelToPercent({ px: 812, py: 484.5 }, 1624, 969)).toEqual({ left: 50, top: 50 });
  });

  it('이미지 크기가 유효하지 않으면 null을 반환한다', () => {
    expect(pixelToPercent({ px: 10, py: 10 }, 0, 969)).toBeNull();
    expect(pixelToPercent({ px: 10, py: 10 }, 1624, -1)).toBeNull();
    expect(pixelToPercent({ px: 10, py: 10 }, Number.NaN, 969)).toBeNull();
  });
});
