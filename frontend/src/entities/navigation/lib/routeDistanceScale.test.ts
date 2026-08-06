import { describe, expect, it } from 'vitest';
import { routeDistanceScaleOf, xrDistanceScaleOf } from './routeDistanceScale';

describe('routeDistanceScaleOf', () => {
  it('compares same-floor map distance with managed physical distance', () => {
    const scale = routeDistanceScaleOf(
      {
        pathNodes: [
          { nodeId: 1, floorId: 2, mapX: 0, mapY: 0 },
          { nodeId: 2, floorId: 2, mapX: 6, mapY: 8 },
          { nodeId: 3, floorId: 2, mapX: 12, mapY: 16 },
        ],
        steps: [
          { fromNodeId: 1, toNodeId: 2, distanceM: 8 },
          { fromNodeId: 2, toNodeId: 3, distanceM: 8 },
        ],
      },
      2,
    );

    expect(scale).toBeCloseTo(1.25, 6);
  });

  it('excludes other floors and vertical transitions', () => {
    const scale = routeDistanceScaleOf(
      {
        pathNodes: [
          { nodeId: 1, floorId: 2, mapX: 0, mapY: 0 },
          { nodeId: 2, floorId: 2, mapX: 10, mapY: 0 },
          { nodeId: 3, floorId: 3, mapX: 10, mapY: 0 },
        ],
        steps: [
          { fromNodeId: 1, toNodeId: 2, distanceM: 5 },
          { fromNodeId: 2, toNodeId: 3, distanceM: 50 },
        ],
      },
      2,
    );

    expect(scale).toBe(2);
  });

  it('falls back to one for missing or implausible calibration data', () => {
    expect(routeDistanceScaleOf(undefined, 2)).toBe(1);
    expect(routeDistanceScaleOf({ pathNodes: [], steps: [] }, 2)).toBe(1);
    expect(
      routeDistanceScaleOf(
        {
          pathNodes: [
            { nodeId: 1, floorId: 2, mapX: 0, mapY: 0 },
            { nodeId: 2, floorId: 2, mapX: 100, mapY: 0 },
          ],
          steps: [{ fromNodeId: 1, toNodeId: 2, distanceM: 1 }],
        },
        2,
      ),
    ).toBe(1);
  });

  it('applies the XR movement correction to the route scale', () => {
    const scale = xrDistanceScaleOf(
      {
        pathNodes: [
          { nodeId: 1, floorId: 2, mapX: 0, mapY: 0 },
          { nodeId: 2, floorId: 2, mapX: 6, mapY: 8 },
        ],
        steps: [{ fromNodeId: 1, toNodeId: 2, distanceM: 8 }],
      },
      2,
    );

    expect(scale).toBeCloseTo(2, 6);
  });
});
