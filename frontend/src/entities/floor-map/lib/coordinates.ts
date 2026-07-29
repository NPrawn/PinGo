import type { CoordinateFrame } from '../model/types';

// 원본 이미지 픽셀 좌표.
export interface PixelPoint {
  px: number;
  py: number;
}

/**
 * 좌표가 렌더 가능한 유한 실수인지 판별한다.
 *
 * mapX/mapY는 백엔드 BigDecimal에서 내려오므로 JSON 파싱 결과가
 * null·undefined·NaN이 될 수 있다. 그런 좌표는 그리지 않고 건너뛴다.
 */
export function isRenderableCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * 미터 좌표를 원본 이미지 픽셀 좌표로 변환한다.
 * (docs/역삼역_FE_좌표연동_스펙.md §3 변환 헬퍼)
 *
 * 좌표가 유한하지 않거나 프레임의 mpp가 0이면 null을 반환한다.
 * 호출부는 null을 "그리지 않음"으로 처리한다.
 */
export function meterToPixel(x: number, y: number, frame: CoordinateFrame): PixelPoint | null {
  if (!isRenderableCoordinate(x) || !isRenderableCoordinate(y)) return null;
  if (!isRenderableCoordinate(frame.mpp) || frame.mpp === 0) return null;

  const radians = (frame.angleDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const [originX, originY] = frame.originPx;

  return {
    px: originX + (cos * x - sin * y) / frame.mpp,
    py: originY + (sin * x + cos * y) / frame.mpp,
  };
}
