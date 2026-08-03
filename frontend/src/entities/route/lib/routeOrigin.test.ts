import { routeOriginOf } from './routeOrigin';

describe('routeOriginOf', () => {
  /**
   * 조회 키에 그대로 넣으면 좌표가 조금만 흔들려도 경로를 다시 받는다. 10cm 차이로 진입 노드가
   * 바뀌는 경우는 없다.
   */
  it('좌표를 0.1m 단위로 반올림한다', () => {
    expect(routeOriginOf(-34.8974, 23.3281)).toEqual({
      currentMapX: -34.9,
      currentMapY: 23.3,
    });
  });

  /** 역삼역 캐노니컬 좌표는 원점 서쪽이 음수다. 부호에 따라 자리가 달라지면 안 된다. */
  it('음수도 같은 자리에서 반올림한다', () => {
    expect(routeOriginOf(-34.86, -34.84)).toEqual({ currentMapX: -34.9, currentMapY: -34.8 });
  });

  /**
   * **짝으로 있어야 한다.** 백엔드가 한쪽만 온 좌표를 무시하므로, 반쪽을 보내는 것은 안 보내는
   * 것과 같으면서 화면만 보냈다고 믿게 된다.
   */
  it('한쪽만 있으면 아무것도 싣지 않는다', () => {
    expect(routeOriginOf(12.5, null)).toBeNull();
    expect(routeOriginOf(null, 12.5)).toBeNull();
  });

  /** 좌표 정합이 없는 층(역삼역 B1)은 위치 인식이 좌표를 주지 못한다. */
  it('좌표를 모르면 아무것도 싣지 않는다', () => {
    expect(routeOriginOf(null, null)).toBeNull();
    expect(routeOriginOf(undefined, undefined)).toBeNull();
  });

  /** 0은 유효한 좌표다. 역삼역 캐노니컬 원점이 `B2-B3 엘리베이터 B`라 실제로 쓰인다. */
  it('0은 값으로 다룬다', () => {
    expect(routeOriginOf(0, 0)).toEqual({ currentMapX: 0, currentMapY: 0 });
  });

  /** NaN을 그대로 실어 보내면 JSON에서 null이 되어 서버가 400으로 답한다. */
  it('숫자가 아니면 싣지 않는다', () => {
    expect(routeOriginOf(Number.NaN, 1)).toBeNull();
    expect(routeOriginOf(Number.POSITIVE_INFINITY, 1)).toBeNull();
  });
});
