import { routeBearingOf } from './routeBearing';
import type { RoutePathNode } from '../model/types';

const B3 = 2;
const B2 = 1;

/** +x로 20m 간 뒤 +y로 20m 꺾이는 경로. 미터 프레임은 y가 아래로 증가한다. */
const PATH: RoutePathNode[] = [
  { nodeId: 1, floorId: B3, mapX: 0, mapY: 0 },
  { nodeId: 2, floorId: B3, mapX: 20, mapY: 0 },
  { nodeId: 3, floorId: B3, mapX: 20, mapY: 20 },
];

const AT_START = { floorId: B3, mapX: 0, mapY: 0 };

describe('routeBearingOf', () => {
  it('보는 방향과 같으면 정면이다', () => {
    const bearing = routeBearingOf({
      pathNodes: PATH,
      currentLocation: AT_START,
      // +x를 보고 있고 다음 지점도 +x에 있다.
      headingDeg: 0,
      travelledM: 0,
    });

    expect(bearing?.relativeDeg).toBeCloseTo(0);
    expect(bearing?.turn).toBe('straight');
  });

  it('보는 방향의 오른쪽에 있으면 오른쪽이다', () => {
    const bearing = routeBearingOf({
      pathNodes: PATH,
      currentLocation: AT_START,
      // -y(화면 위)를 보는데 다음 지점은 +x다. 시계 방향으로 90도.
      headingDeg: -90,
      travelledM: 0,
    });

    expect(bearing?.relativeDeg).toBeCloseTo(90);
    expect(bearing?.turn).toBe('right');
  });

  it('보는 방향의 왼쪽에 있으면 왼쪽이다', () => {
    const bearing = routeBearingOf({
      pathNodes: PATH,
      currentLocation: AT_START,
      headingDeg: 90,
      travelledM: 0,
    });

    expect(bearing?.relativeDeg).toBeCloseTo(-90);
    expect(bearing?.turn).toBe('left');
  });

  it('뒤에 있으면 되돌아가는 것으로 본다', () => {
    const bearing = routeBearingOf({
      pathNodes: PATH,
      currentLocation: AT_START,
      headingDeg: 180,
      travelledM: 0,
    });

    // 179도와 -181도는 같은 방향이다. 접어서 한쪽으로 모은다.
    expect(Math.abs(bearing!.relativeDeg)).toBeCloseTo(180);
    expect(bearing?.turn).toBe('around');
  });

  /**
   * 바로 앞 노드를 가리키면 그 노드에 다가갈수록 방향이 흔들리고, 밟는 순간 뒤를 가리킨다.
   * 조금 앞을 보게 두면 통로를 걷는 동안 화살표가 안정적으로 앞을 향한다.
   */
  it('거의 다다른 노드는 건너뛰고 그 다음을 가리킨다', () => {
    const bearing = routeBearingOf({
      pathNodes: PATH,
      // 첫 노드(20, 0)를 1m 앞두고 있다. 그 노드가 아니라 다음 꺾이는 지점을 가리켜야 한다.
      currentLocation: { floorId: B3, mapX: 19, mapY: 0 },
      headingDeg: 0,
      travelledM: 19,
    });

    // 다음 지점은 (20, 20). 오른쪽 아래를 향하므로 시계 방향으로 크게 돈다.
    expect(bearing?.turn).toBe('right');
  });

  /**
   * 방향을 모르면 그리지 않는다. 위로 고정하면 "정면"이라고 말하는 셈이라 엉뚱한 쪽으로 걷는다.
   */
  it('방향각을 모르면 아무 방향도 주지 않는다', () => {
    expect(
      routeBearingOf({
        pathNodes: PATH,
        currentLocation: AT_START,
        headingDeg: null,
        travelledM: 0,
      }),
    ).toBeNull();
  });

  it('위치를 모르면 아무 방향도 주지 않는다', () => {
    expect(
      routeBearingOf({ pathNodes: PATH, currentLocation: null, headingDeg: 0, travelledM: 0 }),
    ).toBeNull();
  });

  /**
   * 층 전환 직전에도 진입 지점을 계속 가리킨다.
   *
   * 예전에는 3m 앞 노드가 다른 층이면 방향이 없다고 보고 끊었다. 그래서 엘리베이터·계단 3m
   * 앞에서 화살표가 갑자기 사라졌다 — 실내에서 3m는 어느 쪽으로 가야 하는지 잊기에 충분하다.
   */
  it('층 전환 지점이 가까워도 그 지점을 계속 가리킨다', () => {
    const bearing = routeBearingOf({
      pathNodes: [
        { nodeId: 1, floorId: B3, mapX: 0, mapY: 0 },
        // 이 층에서 남은 마지막 지점. 곧 엘리베이터 진입 지점이다.
        { nodeId: 2, floorId: B3, mapX: 2, mapY: 0 },
        { nodeId: 3, floorId: B2, mapX: 2, mapY: 0 },
      ],
      currentLocation: AT_START,
      headingDeg: 0,
      travelledM: 0,
    });

    // 2m 앞이라 LOOKAHEAD(3m)보다 가깝지만, 그래도 그쪽을 가리켜야 한다.
    expect(bearing?.turn).toBe('straight');
    expect(bearing?.relativeDeg).toBeCloseTo(0);
  });

  /** 위층 통로를 가리키면 지금 층 벽을 향해 걷게 된다. */
  it('다른 층 노드는 가리키지 않는다', () => {
    const bearing = routeBearingOf({
      pathNodes: [
        { nodeId: 1, floorId: B3, mapX: 0, mapY: 0 },
        // 위층에만 남은 경로. 이 층에서 갈 곳이 없다.
        { nodeId: 2, floorId: B2, mapX: 0, mapY: 40 },
      ],
      currentLocation: AT_START,
      headingDeg: 0,
      travelledM: 0,
    });

    expect(bearing).toBeNull();
  });

  /** 발밑을 가리키면 한 걸음에 방향이 뒤집힌다. 그 순간의 안내는 카드가 맡는다. */
  it('전환 지점에 다 닿으면 방향을 주지 않는다', () => {
    const bearing = routeBearingOf({
      pathNodes: [
        { nodeId: 1, floorId: B3, mapX: 0, mapY: 0 },
        { nodeId: 2, floorId: B3, mapX: 0.3, mapY: 0 },
        { nodeId: 3, floorId: B2, mapX: 0.3, mapY: 0 },
      ],
      currentLocation: AT_START,
      headingDeg: 0,
      travelledM: 0,
    });

    expect(bearing).toBeNull();
  });

  it('경로가 없으면 아무 방향도 주지 않는다', () => {
    expect(
      routeBearingOf({ pathNodes: [], currentLocation: AT_START, headingDeg: 0, travelledM: 0 }),
    ).toBeNull();
  });
});
