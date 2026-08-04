import { describe, expect, it } from 'vitest';
import {
  distanceForDestination,
  durationForDestination,
  straightLineDistanceM,
} from './useExitRoute';

describe('straightLineDistanceM', () => {
  it('returns zero for the same GPS coordinate', () => {
    expect(straightLineDistanceM(37.5007, 127.0365, 37.5007, 127.0365)).toBe(0);
  });

  it('calculates the straight-line distance between an exit and a destination in meters', () => {
    const distance = straightLineDistanceM(37.5007, 127.0355, 37.5007, 127.0365);

    expect(distance).toBeGreaterThan(88);
    expect(distance).toBeLessThan(89);
  });
});

describe('distanceForDestination', () => {
  it('uses the exit-to-building distance for an external destination', () => {
    expect(distanceForDestination('place', 180, 88.4)).toBe(88.4);
    expect(distanceForDestination('external_place', 180, 88.4)).toBe(88.4);
  });

  it('keeps the indoor route distance for an indoor destination', () => {
    expect(distanceForDestination('facility', 180, 88.4)).toBe(180);
  });

  it('does not mix the indoor-to-exit distance into an external destination metric', () => {
    expect(distanceForDestination('place', 180, null)).toBeNull();
  });
});

describe('durationForDestination', () => {
  it('shows Kakao walking time only for external destinations', () => {
    expect(durationForDestination('external_place', 2295)).toBe(2295);
    expect(durationForDestination('facility', 2295)).toBeNull();
  });
});
