import { MOCK_COORDINATE_FRAMES, MOCK_FLOOR_ID, MOCK_FLOOR_MAPS } from './fixtures';

/**
 * 목업 데이터의 내부 정합성 검사.
 *
 * 좌표 프레임과 지도 메타데이터가 각각 따로 정의돼 있어 값이 어긋나도 타입 검사에 걸리지 않는다.
 * 어긋나면 오버레이 좌표나 확대 배율이 조용히 틀어지므로 여기서 잡는다.
 */
describe('MOCK_FLOOR_MAPS', () => {
  it('모든 층에 좌표 프레임이 있다', () => {
    for (const map of MOCK_FLOOR_MAPS) {
      expect(MOCK_COORDINATE_FRAMES[map.floorCode]).toBeDefined();
    }
  });

  it('목업 지도가 폴백 프레임과 같은 값을 담는다', () => {
    // 목업은 자기 데이터에 프레임을 담아 FE 폴백에 의존하지 않는다. 두 값이 갈라지면
    // 목업 모드와 폴백 경로가 다르게 동작해 버그를 재현할 수 없게 된다.
    for (const map of MOCK_FLOOR_MAPS) {
      const frame = MOCK_COORDINATE_FRAMES[map.floorCode];

      expect(map.scaleMPerPx).toBe(frame.mpp);
      expect(map.originPxX).toBe(frame.originPx[0]);
      expect(map.originPxY).toBe(frame.originPx[1]);
      expect(map.frameAngleDeg).toBe(frame.angleDeg);
    }
  });

  it('목업 지도도 mapUrl이 null이라 자체 이미지 경로를 탄다', () => {
    // 실제 응답(V9 seed)이 null이므로 목업도 같은 경로를 타야 폴백이 검증된다.
    for (const map of MOCK_FLOOR_MAPS) {
      expect(map.mapUrl).toBeNull();
    }
  });

  it('floorId가 MOCK_FLOOR_ID와 일치한다', () => {
    for (const map of MOCK_FLOOR_MAPS) {
      expect(map.floorId).toBe(MOCK_FLOOR_ID[map.floorCode as keyof typeof MOCK_FLOOR_ID]);
    }
  });

  it('floorId와 mapId가 중복되지 않는다', () => {
    const floorIds = MOCK_FLOOR_MAPS.map((map) => map.floorId);
    const mapIds = MOCK_FLOOR_MAPS.map((map) => map.mapId);

    expect(new Set(floorIds).size).toBe(floorIds.length);
    expect(new Set(mapIds).size).toBe(mapIds.length);
  });

  it('원본 크기가 양수다', () => {
    // 프레임의 originPx가 이 크기를 기준으로 정의돼 있다.
    for (const map of MOCK_FLOOR_MAPS) {
      expect(map.width).toBeGreaterThan(0);
      expect(map.height).toBeGreaterThan(0);
    }
  });

  it('첫 번째 지도가 B2다', () => {
    // 층을 지정하지 않으면 이것이 표시된다. 목업 위치·경로가 B2·B3에 있어 순서에 의미가 있다.
    expect(MOCK_FLOOR_MAPS[0].floorCode).toBe('B2');
  });
});
