import { describe, expect, it } from 'vitest';
import type { XrPoseReading } from '@/shared/lib/webxr';
import {
  createXrMapAnchor,
  forwardXrOf,
  normalizePlanar,
  xrToMapPoint,
  type XrMapAnchor,
} from './mapAlignment';

/**
 * 좌표 스펙 8.2~8.3 변환식 검증.
 *
 * **Fixture 기반이다.** `forwardMap`은 BE 구현이 없어 여기서 직접 주는 값이며, 실제 응답과의
 * 정합은 API 통합 후 8.5의 판정 기준(직선 복도 10m 직진)으로 확인한다.
 */

function reading(x: number, z: number, yawDeg = 0): XrPoseReading {
  return {
    position: { x, y: 0, z },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    yawDeg,
    timestamp: 0,
  };
}

const ANCHOR_MAP = { floorId: 2, mapX: 100, mapY: 200 };

describe('normalizePlanar', () => {
  it('길이를 1로 맞춘다', () => {
    const unit = normalizePlanar({ x: 3, y: 4 });

    expect(unit?.x).toBeCloseTo(0.6, 6);
    expect(unit?.y).toBeCloseTo(0.8, 6);
  });

  it('이미 단위벡터면 그대로다', () => {
    const unit = normalizePlanar({ x: 0, y: 1 });

    expect(unit).toEqual({ x: 0, y: 1 });
  });

  it('영벡터·비유한값·null은 null이다', () => {
    expect(normalizePlanar({ x: 0, y: 0 })).toBeNull();
    expect(normalizePlanar({ x: Number.NaN, y: 1 })).toBeNull();
    expect(normalizePlanar(null)).toBeNull();
    expect(normalizePlanar(undefined)).toBeNull();
  });
});

describe('forwardXrOf', () => {
  /** 2차 실측: 28.7m 직진에서 Δz가 단조 감소했다. yaw 0의 전방은 -z다. */
  it('yaw 0의 전방은 -z다', () => {
    const forward = forwardXrOf(0);

    expect(forward.x).toBeCloseTo(0, 6);
    expect(forward.y).toBeCloseTo(-1, 6);
  });

  it('yaw 90의 전방은 -x다', () => {
    const forward = forwardXrOf(90);

    expect(forward.x).toBeCloseTo(-1, 6);
    expect(forward.y).toBeCloseTo(0, 6);
  });
});

describe('createXrMapAnchor', () => {
  it('방향이 null이면 앵커를 만들지 않는다', () => {
    expect(createXrMapAnchor({ map: ANCHOR_MAP, reading: reading(0, 0), forwardMap: null })).toBe(
      null,
    );
  });

  it('방향이 영벡터여도 앵커를 만들지 않는다', () => {
    expect(
      createXrMapAnchor({ map: ANCHOR_MAP, reading: reading(0, 0), forwardMap: { x: 0, y: 0 } }),
    ).toBeNull();
  });

  it('정규화되지 않은 방향을 받아도 회전은 같다', () => {
    const unit = createXrMapAnchor({
      map: ANCHOR_MAP,
      reading: reading(0, 0),
      forwardMap: { x: 0.6, y: 0.8 },
    });
    const scaled = createXrMapAnchor({
      map: ANCHOR_MAP,
      reading: reading(0, 0),
      forwardMap: { x: 6, y: 8 },
    });

    expect(scaled?.rotation.cosA).toBeCloseTo(unit!.rotation.cosA, 6);
    expect(scaled?.rotation.sinA).toBeCloseTo(unit!.rotation.sinA, 6);
  });

  it('revision은 넘긴 값을 그대로 담는다', () => {
    const anchor = createXrMapAnchor(
      { map: ANCHOR_MAP, reading: reading(0, 0), forwardMap: { x: 1, y: 0 } },
      3,
    );

    expect(anchor?.revision).toBe(3);
  });
});

describe('xrToMapPoint', () => {
  /** 전방(XR -z)이 지도 +Y와 같은 방향인 앵커. 회전이 항등이 되는 배치다. */
  function identityAnchor(): XrMapAnchor {
    return createXrMapAnchor({
      map: ANCHOR_MAP,
      reading: reading(0, 0),
      forwardMap: { x: 0, y: -1 },
    })!;
  }

  it('앵커 지점 자신은 앵커의 지도 좌표다', () => {
    const point = xrToMapPoint({ x: 0, z: 0 }, identityAnchor());

    expect(point?.mapX).toBeCloseTo(100, 6);
    expect(point?.mapY).toBeCloseTo(200, 6);
  });

  /**
   * 8.3: `dZ`는 부호를 뒤집지 않는다. 전방으로 걸으면 `dZ`가 음수가 되고, 이 앵커에서는
   * 지도 `y`도 그만큼 감소한다.
   */
  it('전방 직진에서 dZ 부호를 뒤집지 않는다', () => {
    const point = xrToMapPoint({ x: 0, z: -10 }, identityAnchor());

    expect(point?.mapX).toBeCloseTo(100, 6);
    expect(point?.mapY).toBeCloseTo(190, 6);
  });

  /**
   * 3차 실측(체크리스트 16번): 26m 직진 후 90° 우회전해 다시 직진하니 `Δx`가
   * `-1.80 → +7.79`로 양수 방향이었다. 거울 보정이 없으므로 지도에서도 전방의 오른쪽으로
   * 나가야 한다.
   *
   * 지도 프레임은 `meterToPixel`의 변환 행렬식이 `+1`이라 평면도 이미지와 같은 방향성이다
   * (+x 오른쪽, +y 아래). 이 앵커에서 전방은 지도 `-Y`이고, 그쪽을 향해 섰을 때 오른쪽은
   * 지도 `+X`다. 따라서 `Δx` 양수는 지도 `x` 증가로 나와야 한다.
   *
   * **거울 보정을 넣었다면 여기서 `92.21`이 나온다.** 8.3이 적용하지 말라고 한 그 보정이며,
   * 이 단언이 그것을 막는다.
   */
  it('우회전 후 Δx 양수가 전방 기준 오른쪽으로 간다', () => {
    const point = xrToMapPoint({ x: 7.79, z: -29.52 }, identityAnchor());

    expect(point?.mapX).toBeCloseTo(107.79, 6);
    expect(point?.mapY).toBeCloseTo(200 - 29.52, 6);
  });

  /** 앵커 방향이 지도 +X를 향하면 XR 전방 이동이 지도 x 증가로 나와야 한다. */
  it('앵커 방향이 회전돼 있으면 그만큼 돌려서 옮긴다', () => {
    const anchor = createXrMapAnchor({
      map: ANCHOR_MAP,
      reading: reading(0, 0),
      forwardMap: { x: 1, y: 0 },
    })!;
    const point = xrToMapPoint({ x: 0, z: -10 }, anchor);

    expect(point?.mapX).toBeCloseTo(110, 6);
    expect(point?.mapY).toBeCloseTo(200, 6);
  });

  /**
   * 축에 정렬되지 않은 방향에서도 성립해야 한다. 목업 방향(0.6, 0.8)이 이 경우다.
   * 전방 10m는 그 방향으로 (6, 8)만큼 간다.
   */
  it('축에 정렬되지 않은 방향에서도 회전이 맞다', () => {
    const anchor = createXrMapAnchor({
      map: ANCHOR_MAP,
      reading: reading(0, 0),
      forwardMap: { x: 0.6, y: 0.8 },
    })!;
    const point = xrToMapPoint({ x: 0, z: -10 }, anchor);

    expect(point?.mapX).toBeCloseTo(106, 6);
    expect(point?.mapY).toBeCloseTo(208, 6);
  });

  /** 변환은 회전+평행이동이므로 거리가 보존돼야 한다. 반사가 섞여도 거리는 같지만 방향이 틀어진다. */
  it('앵커로부터의 거리를 보존한다', () => {
    const anchor = createXrMapAnchor({
      map: ANCHOR_MAP,
      reading: reading(0, 0),
      forwardMap: { x: 0.6, y: 0.8 },
    })!;
    const point = xrToMapPoint({ x: 3, z: -4 }, anchor)!;

    expect(Math.hypot(point.mapX - 100, point.mapY - 200)).toBeCloseTo(5, 6);
  });

  /**
   * 2차 실측 왕복 폐합: 28.7m 갔다가 돌아온 뒤 앵커로부터 0.76m였다. 변환은 이 오차를
   * 키우거나 줄이지 않고 그대로 옮겨야 한다.
   */
  it('왕복 폐합 오차를 그대로 옮긴다', () => {
    const anchor = createXrMapAnchor({
      map: ANCHOR_MAP,
      reading: reading(0, 0),
      forwardMap: { x: 0.6, y: 0.8 },
    })!;
    const closed = xrToMapPoint({ x: 0.76, z: 0 }, anchor)!;

    expect(Math.hypot(closed.mapX - 100, closed.mapY - 200)).toBeCloseTo(0.76, 6);
  });

  it('floorId는 pose가 아니라 앵커에서 온다', () => {
    const point = xrToMapPoint({ x: 5, z: -5 }, identityAnchor());

    expect(point?.floorId).toBe(2);
  });

  it('좌표가 유한하지 않으면 null이다', () => {
    expect(xrToMapPoint({ x: Number.NaN, z: 0 }, identityAnchor())).toBeNull();
  });
});
