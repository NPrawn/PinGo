import { describe, expect, it } from 'vitest';
import { normalizePlanar } from '../lib/mapAlignment';
import { MOCK_ANCHOR_FORWARD_MAP, readForwardMap, resolveAnchorForwardMap } from './anchorForward';

/**
 * 방향 주입 지점 검증. (S15P11A206-296)
 *
 * **실제 API와 연결되지 않았다.** `API_명세서.md`의 `candidates[]`에 방향 필드가 아직 없다.
 * 여기서 보는 것은 어댑터가 필드 부재를 정상 분기로 다루는지와 목업이 항등이 아닌지다.
 */

describe('readForwardMap', () => {
  it('객체 형태의 방향을 읽는다', () => {
    expect(readForwardMap({ mapX: 1, mapY: 2, forwardMap: { x: 0.6, y: 0.8 } })).toEqual({
      x: 0.6,
      y: 0.8,
    });
  });

  it('배열 형태의 방향도 읽는다', () => {
    expect(readForwardMap({ forward: [0.6, 0.8] })).toEqual({ x: 0.6, y: 0.8 });
  });

  it('snake_case 필드도 읽는다', () => {
    expect(readForwardMap({ forward_map: { x: 1, y: 0 } })).toEqual({ x: 1, y: 0 });
  });

  /**
   * 현재 API 명세서의 응답 그대로다. 방향 필드가 없으므로 null이어야 하고, 이것이
   * 통합 전까지의 정상 동작이다.
   */
  it('지금 명세서의 후보에는 방향이 없어 null이다', () => {
    const candidate = {
      nodeId: 15,
      floorId: 2,
      label: 'B2 개찰구 앞',
      mapX: 320.5,
      mapY: 180.2,
      confidenceScore: 0.87,
      confidenceLabel: 'high',
    };

    expect(readForwardMap(candidate)).toBeNull();
  });

  it('후보가 객체가 아니면 null이다', () => {
    expect(readForwardMap(null)).toBeNull();
    expect(readForwardMap(undefined)).toBeNull();
    expect(readForwardMap('forward')).toBeNull();
  });

  it('숫자가 아닌 성분은 읽지 않는다', () => {
    expect(readForwardMap({ forwardMap: { x: '0.6', y: 0.8 } })).toBeNull();
    expect(readForwardMap({ forwardMap: [0.6] })).toBeNull();
  });
});

describe('MOCK_ANCHOR_FORWARD_MAP', () => {
  it('단위벡터다', () => {
    expect(Math.hypot(MOCK_ANCHOR_FORWARD_MAP.x, MOCK_ANCHOR_FORWARD_MAP.y)).toBeCloseTo(1, 6);
  });

  /**
   * **목업이 항등이면 안 된다.**
   *
   * XR 전방은 `(0, -1)`(yaw 0 기준)이다. 목업을 그 값으로 두면 회전이 항등이 되어 XR 좌표가
   * 지도 좌표로 그대로 흘러가고, 회전을 적용하지 않는 배선 오류가 테스트에서도 화면에서도
   * 드러나지 않는다.
   */
  it('항등 회전을 만들지 않는다', () => {
    const forwardXrAtYawZero = { x: 0, y: -1 };
    const cosA =
      forwardXrAtYawZero.x * MOCK_ANCHOR_FORWARD_MAP.x +
      forwardXrAtYawZero.y * MOCK_ANCHOR_FORWARD_MAP.y;
    const sinA =
      forwardXrAtYawZero.x * MOCK_ANCHOR_FORWARD_MAP.y -
      forwardXrAtYawZero.y * MOCK_ANCHOR_FORWARD_MAP.x;

    expect(cosA).not.toBeCloseTo(1, 3);
    expect(sinA).not.toBeCloseTo(0, 3);
  });

  /** 축에 정렬돼 있으면 x·y를 바꿔 넣는 실수가 드러나지 않는다. */
  it('축에 정렬돼 있지 않다', () => {
    expect(MOCK_ANCHOR_FORWARD_MAP.x).not.toBe(0);
    expect(MOCK_ANCHOR_FORWARD_MAP.y).not.toBe(0);
    expect(Math.abs(MOCK_ANCHOR_FORWARD_MAP.x)).not.toBeCloseTo(
      Math.abs(MOCK_ANCHOR_FORWARD_MAP.y),
      3,
    );
  });

  it('이미 정규화돼 있어 normalizePlanar를 통과해도 같다', () => {
    expect(normalizePlanar(MOCK_ANCHOR_FORWARD_MAP)).toEqual(MOCK_ANCHOR_FORWARD_MAP);
  });
});

describe('resolveAnchorForwardMap', () => {
  it('목업을 끄면 방향 없는 후보에서 null이다', () => {
    expect(resolveAnchorForwardMap({ mapX: 1, mapY: 2 })).toBeNull();
  });

  it('목업을 켜면 방향 없는 후보를 목업으로 채운다', () => {
    expect(resolveAnchorForwardMap({ mapX: 1, mapY: 2 }, { useMock: true })).toEqual(
      MOCK_ANCHOR_FORWARD_MAP,
    );
  });

  /** 실제 값이 있으면 목업이 덮지 않는다. 통합 후 목업만 제거하면 되도록 한다. */
  it('실제 방향이 있으면 목업보다 우선한다', () => {
    expect(resolveAnchorForwardMap({ forwardMap: { x: 1, y: 0 } }, { useMock: true })).toEqual({
      x: 1,
      y: 0,
    });
  });
});
