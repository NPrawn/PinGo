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

/**
 * SVG transform 문자열을 실제로 적용한다. 값을 다시 계산해 비교하면 구현과 같은 식을 두 번
 * 쓰는 것이라 아무것도 검증하지 못한다. 화면에 나가는 문자열 그대로를 푼다.
 */
function applyTransform(transform: string, point: { px: number; py: number }) {
  const steps = [...transform.matchAll(/(translate|rotate|scale)\(([^)]*)\)/g)];
  let { px, py } = point;

  // transform 목록은 왼쪽이 바깥이다. 점에는 오른쪽부터 적용한다.
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const [, op, rawArgs] = steps[index];
    const args = rawArgs.trim().split(/[\s,]+/).map(Number);

    if (op === 'translate') {
      px += args[0];
      py += args[1] ?? 0;
    } else if (op === 'scale') {
      px *= args[0];
      py *= args[1] ?? args[0];
    } else {
      const radians = (args[0] * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const rotatedX = cos * px - sin * py;
      py = sin * px + cos * py;
      px = rotatedX;
    }
  }

  return { px, py };
}

/**
 * 마커가 도면에서 밀리지 않는지. (S15P11A206-79 점검)
 *
 * 오버레이는 **기준 프레임 하나로** 시설·경로·현재 위치를 찍고, 도면은 **자기 프레임으로**
 * 기준 캔버스에 얹힌다. 서로 다른 경로다. 둘이 정확히 같은 점으로 가지 않으면 시설 마커가
 * 도면 위에서 밀린다 — 층 전환 정합을 잡으려고 넣은 변환이 마킹을 망가뜨리는 경우다.
 *
 * 층별 프레임을 고쳐도 이 관계는 유지되어야 한다. 프레임 값이 맞는지는 별개의 문제이며
 * (B1은 13장 미검증 항목), 여기서 보는 것은 **변환이 마커를 옮기지 않는다**는 것이다.
 */
describe('도면과 마커', () => {
  const samples: readonly (readonly [number, number])[] = [
    [0, 0],
    [150, 0],
    [-50.079, 6.468],
    [130.012, 24.742],
    [113.6, 43.7],
  ];

  it('시설 좌표는 그 층 도면에서 원래 있던 자리에 그대로 남는다', () => {
    for (const plan of localPlanList()) {
      const placement = planPlacementOf({
        ...baseMap,
        floorCode: plan.floorCode,
        width: plan.width,
        height: plan.height,
        scaleMPerPx: plan.frame.mpp,
        originPxX: plan.frame.originPx[0],
        originPxY: plan.frame.originPx[1],
        frameAngleDeg: plan.frame.angleDeg,
      });

      for (const [mapX, mapY] of samples) {
        // 도면 안에서의 자리 → 기준 캔버스로 옮긴 자리
        const onPlan = meterToPixel(mapX, mapY, plan.frame);
        // 오버레이가 마커를 찍는 자리
        const drawn = meterToPixel(mapX, mapY, PLAN_REFERENCE.frame);
        expect(onPlan).not.toBeNull();
        expect(drawn).not.toBeNull();

        const moved = applyTransform(placement!.transform, onPlan!);

        expect(moved.px).toBeCloseTo(drawn!.px, 6);
        expect(moved.py).toBeCloseTo(drawn!.py, 6);
      }
    }
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
