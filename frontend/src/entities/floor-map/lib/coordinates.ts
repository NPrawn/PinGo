import type { CoordinateFrame } from '../model/types';

// 원본 이미지 픽셀 좌표.
export interface PixelPoint {
  px: number;
  py: number;
}

/** 캐노니컬 미터 좌표. 층 안에서의 자리를 나타내며 층 자체는 담지 않는다. */
export interface MeterPoint {
  x: number;
  y: number;
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
  if (!isRenderableCoordinate(frame.mpp) || frame.mpp <= 0) return null;

  const radians = (frame.angleDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const [originX, originY] = frame.originPx;

  return {
    px: originX + (cos * x - sin * y) / frame.mpp,
    py: originY + (sin * x + cos * y) / frame.mpp,
  };
}

/**
 * 원본 이미지 픽셀 좌표를 미터 좌표로 되돌린다. `meterToPixel` 의 역변환이다.
 *
 * 화면에서 짚은 자리를 좌표로 남겨야 하는 곳에 쓴다 — 상담자가 지도 위에 그린 선이 그렇다.
 * 화면 기준 값으로 남기면 두 사람의 확대·이동·회전·표시 층이 달라 같은 자리를 가리키지 못한다.
 *
 * 회전은 각도를 반대로 돌려 되짚는다(직교 행렬이라 전치가 곧 역행렬이다). 배율은 곱하고
 * 원점은 빼는 순서가 정변환과 뒤집힌다.
 */
export function pixelToMeter(px: number, py: number, frame: CoordinateFrame): MeterPoint | null {
  if (!isRenderableCoordinate(px) || !isRenderableCoordinate(py)) return null;
  if (!isRenderableCoordinate(frame.mpp) || frame.mpp <= 0) return null;

  const radians = (frame.angleDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const [originX, originY] = frame.originPx;

  const dx = (px - originX) * frame.mpp;
  const dy = (py - originY) * frame.mpp;

  return {
    x: cos * dx + sin * dy,
    y: -sin * dx + cos * dy,
  };
}
