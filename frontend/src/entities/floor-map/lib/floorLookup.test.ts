import type { FloorMap } from '../model/types';
import { floorCodeAfterDelta, floorCodeOf, floorIdOf } from './floorLookup';

function map(floorId: number, floorCode: string): FloorMap {
  return {
    mapId: floorId,
    floorId,
    floorCode,
    mapType: 'image',
    mapUrl: null,
    width: 1624,
    height: 969,
    originPxX: 622,
    originPxY: 512,
    frameAngleDeg: -21.28,
    scaleMPerPx: 0.19,
    version: 'v1',
  };
}

/** 역삼역 배포 값. 층 코드 순서와 id 순서가 일치하지 않는다는 점이 중요하다. */
const MAPS = [map(3, 'B1'), map(1, 'B2'), map(2, 'B3')];

describe('floorIdOf', () => {
  it('층 코드로 숫자 floorId를 찾는다', () => {
    expect(floorIdOf(MAPS, 'B1')).toBe(3);
    expect(floorIdOf(MAPS, 'B2')).toBe(1);
    expect(floorIdOf(MAPS, 'B3')).toBe(2);
  });

  /** 역삼역에는 1F 지도가 없다. 없는 층을 0이나 첫 층으로 대신하면 엉뚱한 지도를 보여준다. */
  it('지도가 없는 층은 undefined다', () => {
    expect(floorIdOf(MAPS, '1F')).toBeUndefined();
    expect(floorIdOf([], 'B2')).toBeUndefined();
  });
});

describe('floorCodeOf', () => {
  it('숫자 floorId로 층 코드를 찾는다', () => {
    expect(floorCodeOf(MAPS, 3)).toBe('B1');
    expect(floorCodeOf(MAPS, 1)).toBe('B2');
  });

  it('없는 층은 undefined다', () => {
    expect(floorCodeOf(MAPS, 99)).toBeUndefined();
  });
});

describe('floorCodeAfterDelta', () => {
  const maps = [...MAPS, map(4, '1F')];

  it('현재 위치와 이동 층수를 기준으로 위층을 찾는다', () => {
    expect(floorCodeAfterDelta(maps, 2, 1)).toBe('B2');
    expect(floorCodeAfterDelta(maps, 1, 1)).toBe('B1');
    expect(floorCodeAfterDelta(maps, 3, 1)).toBe('1F');
  });

  it('현재 위치와 이동 층수를 기준으로 아래층을 찾는다', () => {
    expect(floorCodeAfterDelta(maps, 4, -1)).toBe('B1');
    expect(floorCodeAfterDelta(maps, 3, -1)).toBe('B2');
    expect(floorCodeAfterDelta(maps, 1, -1)).toBe('B3');
  });
});
