import { displayFrameOf } from './frame';
import { PLAN_REFERENCE } from '../model/localPlans';
import type { CoordinateFrame, FloorMap } from '../model/types';

/** 기준 캔버스 위에 층 도면 한 장을 놓는 방법. */
export interface PlanPlacement {
  /** 도면의 원본 픽셀 크기. `<image>`의 width·height로 그대로 쓴다. */
  width: number;
  height: number;
  /** 도면 픽셀 좌표를 기준 캔버스 좌표로 옮기는 SVG transform. */
  transform: string;
}

/**
 * 층 도면을 **기준 캔버스**(`PLAN_REFERENCE`) 위 제자리에 놓는 변환을 만든다.
 *
 * 층마다 도면을 각자 `object-fit: contain`으로 맞추면, 캔버스 크기가 달라서 이미지→화면
 * 배율과 여백이 층마다 달라진다. 층을 바꿀 때 역사 전체가 커졌다 작아졌다 하는 원인이다.
 * 모든 층을 한 캔버스에 얹으면 그 단계가 사라진다.
 *
 * 변환은 두 프레임의 차이다. 도면 픽셀 `p`를 기준 픽셀로 옮긴다.
 *
 * ```
 * p_ref = origin_ref + (mpp/mpp_ref) · R(angle_ref − angle) · (p − origin)
 * ```
 *
 * 이러면 같은 미터 좌표가 어느 층에서도 기준 캔버스의 같은 점으로 간다. 오버레이는 층과
 * 무관하게 기준 프레임 하나로만 좌표를 변환하면 된다.
 *
 * 프레임을 알 수 없는 층은 도면을 어디에 놓아야 할지 정할 수 없으므로 null이다. 호출부는
 * 도면을 기준 캔버스에 얹지 말고 예전처럼 상자에 맞춰 보여주되, 오버레이는 생략해야 한다.
 */
export function planPlacementOf(map: FloorMap): PlanPlacement | null {
  const frame = displayFrameOf(map);
  if (!frame) return null;

  const { scale, rotation } = placementOf(frame);
  const [ox, oy] = frame.originPx;
  const [refX, refY] = PLAN_REFERENCE.frame.originPx;

  // SVG transform은 오른쪽부터 적용된다 — 원점을 빼고, 배율·회전을 준 뒤, 기준 원점으로 옮긴다.
  const transform = [
    `translate(${refX} ${refY})`,
    `rotate(${rotation})`,
    `scale(${scale})`,
    `translate(${-ox} ${-oy})`,
  ].join(' ');

  return { width: map.width, height: map.height, transform };
}

function placementOf(frame: CoordinateFrame): { scale: number; rotation: number } {
  const reference = PLAN_REFERENCE.frame;
  return {
    scale: frame.mpp / reference.mpp,
    rotation: reference.angleDeg - frame.angleDeg,
  };
}

/** 기준 캔버스 위에서 도면이 차지하는 사각형. */
export interface PlacedBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * 도면을 기준 캔버스에 놓았을 때의 범위.
 *
 * 캔버스가 세 층을 모두 담는지 검사하는 데 쓴다. 캔버스보다 넓으면 그만큼 잘려 나가고,
 * 층을 바꿀 때 잘린 가장자리가 나타났다 사라져 지도가 튀어 보인다.
 */
export function placedBoundsOf(
  width: number,
  height: number,
  frame: CoordinateFrame,
): PlacedBounds {
  const { scale, rotation } = placementOf(frame);
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const [ox, oy] = frame.originPx;
  const [refX, refY] = PLAN_REFERENCE.frame.originPx;

  const corners = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ].map(([x, y]) => {
    const dx = x - ox;
    const dy = y - oy;
    return [refX + scale * (cos * dx - sin * dy), refY + scale * (sin * dx + cos * dy)];
  });

  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);

  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
