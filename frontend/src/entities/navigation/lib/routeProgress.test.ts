import { routeProgressOf } from './routeProgress';
import type { RoutePathNode } from '../model/types';

const B3 = 2;
const B2 = 1;

/**
 * B3 통로를 100m 걸어 엘리베이터로 B2에 올라간 뒤, **같은 x 구간을 되돌아** 걷는 경로.
 *
 * 두 층이 x를 공유하는 것이 역삼역의 실제 모양이다(B2 대합실이 B3 승강장 바로 위에 있다).
 * 층을 보지 않고 투영하면 어느 층 구간에 붙을지 좌표만으로는 정해지지 않는다.
 */
const PATH: RoutePathNode[] = [
  { nodeId: 1, floorId: B3, mapX: 0, mapY: 0 },
  { nodeId: 2, floorId: B3, mapX: 100, mapY: 0 },
  // 층 전환. 수평 거리가 0이다.
  { nodeId: 3, floorId: B2, mapX: 100, mapY: 0 },
  { nodeId: 4, floorId: B2, mapX: 0, mapY: 0 },
];

const STEPS = [{ distanceM: 100 }, { distanceM: 6 }, { distanceM: 100 }];

describe('routeProgressOf', () => {
  it('경로에 투영해 진행 거리를 구한다', () => {
    const progress = routeProgressOf({
      pathNodes: PATH,
      steps: STEPS,
      // 통로에서 살짝 벗어나 걷는다. 투영하면 30m 지점이다.
      currentLocation: { floorId: B3, mapX: 30, mapY: 2 },
    });

    expect(progress.travelledM).toBeCloseTo(30);
    expect(progress.offRoute).toBe(false);
    expect(progress.currentStepIndex).toBe(0);
    /*
      70이 아니다. 구간 거리 합(206m)을 경로 길이(200m)에 맞춰 줄이므로 첫 구간이 97.1m에서
      끝난다. 차이는 엘리베이터의 수직 6m가 수평 경로에 없기 때문이고, 이 근사를 두는 이유는
      `stepBoundaries`에 적어 두었다.
    */
    expect(progress.stepRemainingM).toBeCloseTo(67.1, 1);
  });

  /**
   * 가장 빠지기 쉬운 함정.
   *
   * 역삼역 B2와 B3는 x·y가 거의 겹친다. 층을 보지 않고 투영하면 B3에 서 있는데 바로 위 B2 구간에
   * 붙어, 아직 올라가지도 않은 층의 구간이 진행 중으로 표시된다.
   */
  it('같은 x·y라도 다른 층 구간에는 붙지 않는다', () => {
    const onB3 = routeProgressOf({
      pathNodes: PATH,
      steps: STEPS,
      currentLocation: { floorId: B3, mapX: 70, mapY: 0 },
    });
    // B3 구간에 붙는다. 70m 지점이다.
    expect(onB3.travelledM).toBeCloseTo(70);
    expect(onB3.currentStepIndex).toBe(0);

    const onB2 = routeProgressOf({
      pathNodes: PATH,
      steps: STEPS,
      currentLocation: { floorId: B2, mapX: 70, mapY: 0 },
    });
    /*
      좌표는 같은데 층이 다르다. B2 구간은 100m에서 시작해 되돌아오므로 x=70은 130m 지점이다.
      층을 보지 않으면 이 위치가 70m로 읽혀, 아직 올라가지도 않은 구간이 진행 중으로 표시된다.
    */
    expect(onB2.travelledM).toBeCloseTo(130);
    expect(onB2.currentStepIndex).toBe(2);
  });

  /** 층을 옮기면 그 층 구간에 붙어 진행도가 자연히 넘어간다. 엘리베이터는 수평 거리가 0이다. */
  it('층을 옮기면 진행도가 다음 층 구간으로 넘어간다', () => {
    const progress = routeProgressOf({
      pathNodes: PATH,
      steps: STEPS,
      currentLocation: { floorId: B2, mapX: 100, mapY: 0 },
      travelledM: 100,
    });

    expect(progress.passedNodeIds).toContain(3);
    expect(progress.offRoute).toBe(false);
  });

  /**
   * XR 위치는 흔들린다. 진행도가 뒤로 갔다 앞으로 오면 안내가 두 구간 사이를 깜빡이고, 사용자는
   * 자기가 잘못 걷고 있다고 읽는다.
   */
  it('뒤로 물러난 위치로는 진행도를 되돌리지 않는다', () => {
    const progress = routeProgressOf({
      pathNodes: PATH,
      steps: STEPS,
      currentLocation: { floorId: B3, mapX: 40, mapY: 0 },
      travelledM: 60,
    });

    expect(progress.travelledM).toBeCloseTo(60);
  });

  /** 다른 복도를 걷는데 경로를 따라간 것으로 세면, 지나지도 않은 구간이 완료로 표시된다. */
  it('경로에서 멀면 진행도를 올리지 않는다', () => {
    const progress = routeProgressOf({
      pathNodes: PATH,
      steps: STEPS,
      // 통로에서 40m 떨어진 다른 복도.
      currentLocation: { floorId: B3, mapX: 50, mapY: 40 },
      travelledM: 10,
    });

    expect(progress.offRoute).toBe(true);
    expect(progress.travelledM).toBeCloseTo(10);
  });

  it('지나온 노드를 순서대로 모은다', () => {
    const progress = routeProgressOf({
      pathNodes: PATH,
      steps: STEPS,
      currentLocation: { floorId: B3, mapX: 100, mapY: 0 },
    });

    // 출발 노드는 언제나 포함된다. 100m 지점의 노드까지 지났다.
    expect(progress.passedNodeIds).toEqual([1, 2, 3]);
  });

  it('위치를 모르면 진행도를 올리지 않고 첫 구간에 머문다', () => {
    const progress = routeProgressOf({ pathNodes: PATH, steps: STEPS, currentLocation: null });

    expect(progress.offRoute).toBe(true);
    expect(progress.travelledM).toBe(0);
    expect(progress.currentStepIndex).toBe(0);
  });

  /** 구간 거리 합(206m)과 경로 기하 길이(200m)가 다르다 — 엘리베이터 6m는 수직이다. */
  it('경로 끝에서는 남은 거리가 0이다', () => {
    const progress = routeProgressOf({
      pathNodes: PATH,
      steps: STEPS,
      currentLocation: { floorId: B2, mapX: 0, mapY: 0 },
    });

    expect(progress.currentStepIndex).toBe(2);
    expect(progress.stepRemainingM).toBeCloseTo(0);
  });

  /** 길이가 0인 층 전환 구간도 자리를 갖는다. 아니면 그 안내가 한 번도 보이지 않는다. */
  it('엘리베이터 앞에 서면 층 전환 구간을 안내한다', () => {
    const progress = routeProgressOf({
      pathNodes: PATH,
      steps: STEPS,
      currentLocation: { floorId: B3, mapX: 100, mapY: 0 },
    });

    expect(progress.currentStepIndex).toBe(1);
  });

  /**
   * **그 층에 경로 노드가 하나뿐인 경우.** (S15P11A206-337 반영 뒤 실제로 생겼다)
   *
   * 서버가 진입 노드를 목적지 기준으로 다시 고르면서 계단·엘리베이터 노드를 집으면, 그 층의 경로가
   * 그 노드 하나로 끝난다. 그러면 그 층에 투영할 구간이 없어 사용자가 늘 경로 이탈로 판정됐다 —
   * 서 있는 층인데 안내 카드도 상세 경로 강조도 지도의 접근선도 전부 꺼졌다.
   */
  describe('층에 경로 노드가 하나뿐일 때', () => {
    /** B3는 계단 진입 노드 하나로 끝나고, 그 다음은 B2다. */
    const singleOnB3: RoutePathNode[] = [
      { nodeId: 234, floorId: B3, mapX: 20, mapY: 0 },
      { nodeId: 235, floorId: B2, mapX: 20, mapY: 0 },
      { nodeId: 236, floorId: B2, mapX: 120, mapY: 0 },
    ];

    it('그 노드까지의 거리로 위치를 판정한다', () => {
      const progress = routeProgressOf({
        pathNodes: singleOnB3,
        // 계단에서 10m 떨어져 있다. 이탈이 아니다.
        currentLocation: { floorId: B3, mapX: 10, mapY: 0 },
      });

      expect(progress.offRoute).toBe(false);
      // 그 노드가 경로 시작점이라 아직 0m다.
      expect(progress.travelledM).toBeCloseTo(0);
      expect(progress.passedNodeIds).toContain(234);
    });

    /** 이탈 판정 자체는 살아 있어야 한다. 노드가 하나뿐이라고 어디에 서 있어도 되는 것은 아니다. */
    it('그 노드에서 멀면 이탈로 본다', () => {
      const progress = routeProgressOf({
        pathNodes: singleOnB3,
        currentLocation: { floorId: B3, mapX: 200, mapY: 0 },
      });

      expect(progress.offRoute).toBe(true);
    });

    /** 구간이 있는 층에서는 결과가 달라지지 않는다. 노드 후보가 투영을 앞지르면 진행도가 튄다. */
    it('구간이 있는 층에서는 투영 결과를 그대로 쓴다', () => {
      const progress = routeProgressOf({
        pathNodes: PATH,
        steps: STEPS,
        // 노드 1(0m)과 노드 2(100m) 사이. 가까운 노드는 노드 2지만 투영이 이긴다.
        currentLocation: { floorId: B3, mapX: 60, mapY: 3 },
      });

      expect(progress.travelledM).toBeCloseTo(60);
    });
  });

  it('경로가 없으면 판정할 것이 없다', () => {
    const progress = routeProgressOf({
      pathNodes: [],
      currentLocation: { floorId: B2, mapX: 0, mapY: 0 },
    });

    expect(progress.travelledM).toBe(0);
    expect(progress.currentStepIndex).toBeNull();
    expect(progress.passedNodeIds).toEqual([]);
    expect(progress.snappedLocation).toBeNull();
  });

  /**
   * 지도에 찍을 자리. 측위 오차만큼 경로 옆에 떨어진 점을 경로선 위로 얹는다.
   *
   * **기준은 이탈 판정 하나뿐이다.** 얹는 기준을 따로 두면 그 사이 거리에서 점이 선 밖에 남고,
   * 점에서 선까지 잇는 선이 다시 그려져 갈림길처럼 보인다.
   */
  describe('경로 위에 얹은 자리', () => {
    it('경로 옆에 서면 경로 위 자리를 준다', () => {
      const progress = routeProgressOf({
        pathNodes: PATH,
        steps: STEPS,
        currentLocation: { floorId: B3, mapX: 30, mapY: 2 },
      });

      // 수선의 발. y만 0으로 당겨지고 x는 그대로다.
      expect(progress.snappedLocation).toEqual({ floorId: B3, mapX: 30, mapY: 0 });
    });

    /** 구간을 지나쳐도 선 밖으로는 나가지 않는다. 끝점에 붙는다. */
    it('구간 밖으로 나가면 끝점으로 잘린다', () => {
      const progress = routeProgressOf({
        pathNodes: PATH,
        steps: STEPS,
        // 노드 2(x=100)를 5m 지나쳤다.
        currentLocation: { floorId: B3, mapX: 105, mapY: 1 },
      });

      expect(progress.snappedLocation).toEqual({ floorId: B3, mapX: 100, mapY: 0 });
    });

    /**
     * **멀어도 얹는다.** 이탈로 판정되기 전까지는 경로 위에 있다고 보는 것이고, 그러면 점도
     * 경로 위에 있어야 한다. 여기서 얹지 않으면 점과 선을 잇는 선이 다시 필요해진다.
     */
    it('이탈 전이면 멀리 떨어져 있어도 얹는다', () => {
      const progress = routeProgressOf({
        pathNodes: PATH,
        steps: STEPS,
        // 경로에서 10m. 이탈 기준(15m) 안쪽이다.
        currentLocation: { floorId: B3, mapX: 30, mapY: 10 },
      });

      expect(progress.offRoute).toBe(false);
      expect(progress.snappedLocation).toEqual({ floorId: B3, mapX: 30, mapY: 0 });
    });

    /** 이탈하면 얹지 않는다. 그때는 날것의 자리와 경로를 잇는 선이 필요한 안내다. */
    it('경로에서 벗어나면 얹지 않는다', () => {
      const progress = routeProgressOf({
        pathNodes: PATH,
        steps: STEPS,
        // 경로에서 20m. 이탈 기준(15m)을 넘었다.
        currentLocation: { floorId: B3, mapX: 30, mapY: 20 },
      });

      expect(progress.offRoute).toBe(true);
      expect(progress.snappedLocation).toBeNull();
    });

    it('위치를 모르면 얹을 것이 없다', () => {
      const progress = routeProgressOf({ pathNodes: PATH, steps: STEPS, currentLocation: null });

      expect(progress.snappedLocation).toBeNull();
    });

    /**
     * 점은 진행도의 래칫을 따르지 않는다.
     *
     * 래칫은 안내 카드가 두 구간 사이에서 깜빡이는 것을 막으려는 것이다. 점의 자리까지 붙들면
     * 뒤로 걸을 때 점이 굳어, 사용자는 자기 위치가 갱신되지 않는다고 읽는다.
     */
    it('진행도가 래칫으로 앞서 있어도 점은 지금 자리를 가리킨다', () => {
      const progress = routeProgressOf({
        pathNodes: PATH,
        steps: STEPS,
        currentLocation: { floorId: B3, mapX: 30, mapY: 2 },
        travelledM: 60,
      });

      expect(progress.travelledM).toBeCloseTo(60);
      expect(progress.snappedLocation).toEqual({ floorId: B3, mapX: 30, mapY: 0 });
    });

    /** 그 층에 구간이 없어 노드가 후보로 뽑힌 경우에도 자리를 준다. */
    it('그 층에 노드 하나뿐이면 그 노드 자리를 준다', () => {
      const progress = routeProgressOf({
        pathNodes: [
          { nodeId: 1, floorId: B3, mapX: 0, mapY: 0 },
          { nodeId: 2, floorId: B2, mapX: 20, mapY: 0 },
          { nodeId: 3, floorId: B2, mapX: 40, mapY: 0 },
        ],
        currentLocation: { floorId: B3, mapX: 3, mapY: 2 },
      });

      expect(progress.snappedLocation).toEqual({ floorId: B3, mapX: 0, mapY: 0 });
    });
  });
});
