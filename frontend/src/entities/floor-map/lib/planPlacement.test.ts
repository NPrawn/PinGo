import { placedBoundsOf, planPlacementOf } from './planPlacement';
import { localPlanList, PLAN_CANVAS, PLAN_REFERENCE } from '../model/localPlans';
import { meterToPixel } from './coordinates';
import type { FloorMap } from '../model/types';

const baseMap: FloorMap = {
  mapId: 1,
  floorId: 1,
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

/**
 * 도면을 기준 캔버스에 얹는 변환. (S15P11A206-314)
 *
 * 층마다 도면을 각자 상자에 맞추면 캔버스 크기가 달라서 이미지→화면 배율이 어긋난다.
 * 한 캔버스에 모아 놓으면 같은 미터 좌표가 어느 층에서든 같은 점으로 간다.
 */
describe('planPlacementOf', () => {
  it('기준 층은 제자리에 놓인다', () => {
    // 기준 층의 프레임은 기준 프레임과 같으므로 배율 1, 회전 0이다.
    const placement = planPlacementOf(baseMap);

    expect(placement?.transform).toContain('scale(1)');
    expect(placement?.transform).toContain('rotate(0)');
  });

  it('프레임이 없으면 놓을 자리를 정할 수 없다', () => {
    // 도면을 캔버스 어디에 둘지 알 수 없다. 호출부는 오버레이도 함께 생략한다.
    expect(planPlacementOf({ ...baseMap, floorCode: 'B7', scaleMPerPx: null })).toBeNull();
  });

  it('도면 원본 크기를 그대로 넘긴다', () => {
    // 기준 캔버스로 옮기는 일은 transform이 맡는다. 이미지 자체는 원본 비율을 유지한다.
    const placement = planPlacementOf({ ...baseMap, width: 1200, height: 800 });

    expect(placement).toMatchObject({ width: 1200, height: 800 });
  });
});

describe('기준 캔버스', () => {
  /**
   * 캔버스가 좁으면 넘치는 층이 잘린다. 층을 바꿀 때 잘린 가장자리가 나타났다 사라져
   * 지도가 튀어 보이므로, 세 층이 모두 안에 들어와야 한다.
   */
  it('등록된 도면을 모두 담는다', () => {
    for (const plan of localPlanList()) {
      const bounds = placedBoundsOf(plan.width, plan.height, plan.frame);

      expect(bounds.x0).toBeGreaterThanOrEqual(0);
      expect(bounds.y0).toBeGreaterThanOrEqual(0);
      expect(bounds.x1).toBeLessThanOrEqual(PLAN_CANVAS.width);
      expect(bounds.y1).toBeLessThanOrEqual(PLAN_CANVAS.height);
    }
  });

  it('쓸데없이 넓지는 않다', () => {
    // 캔버스가 넓어진 만큼 도면이 작게 보인다. 담을 수 있는 최소보다 20px 넘게 크면 낭비다.
    const bounds = localPlanList().map((plan) =>
      placedBoundsOf(plan.width, plan.height, plan.frame),
    );
    const needWidth = Math.max(...bounds.map((b) => b.x1));
    const needHeight = Math.max(...bounds.map((b) => b.y1));

    expect(PLAN_CANVAS.width - needWidth).toBeLessThan(20);
    expect(PLAN_CANVAS.height - needHeight).toBeLessThan(20);
  });

  it('원점이 캔버스 안에 있어 기준 프레임을 그대로 쓸 수 있다', () => {
    // 좌상단이 (0,0)이 아니면 미터 변환 결과를 그만큼 옮겨야 한다.
    const origin = meterToPixel(0, 0, PLAN_REFERENCE.frame);

    expect(origin).toEqual({ px: 622, py: 512 });
  });
});
