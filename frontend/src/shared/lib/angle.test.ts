import { inPlaneAngleDeg, shortestAngleDeltaDeg, unwrapDeg } from './angle';

/** 실제 안내 화면이 쓰는 기울기. */
const TILT = 58;

/**
 * 보정한 각도로 평면 안을 돌렸을 때 화면에 보이는 각도.
 *
 * `inPlaneAngleDeg`가 뒤집는 대상이 이 식이므로, 두 값을 왕복시켜 원래대로 돌아오는지 본다 —
 * 기대값을 손으로 적어 두면 그 숫자가 맞는지를 다시 검산해야 한다.
 */
function screenAngleOf(inPlaneDeg: number, tiltDeg: number): number {
  const rad = (inPlaneDeg * Math.PI) / 180;
  const cosTilt = Math.cos((tiltDeg * Math.PI) / 180);

  return (Math.atan2(Math.sin(rad), Math.cos(rad) * cosTilt) * 180) / Math.PI;
}

describe('shortestAngleDeltaDeg', () => {
  it('같은 각도의 차이는 0이다', () => {
    expect(shortestAngleDeltaDeg(30, 30)).toBe(0);
  });

  it('부호가 갈리는 경계를 최단 거리로 본다', () => {
    expect(shortestAngleDeltaDeg(179, -179)).toBeCloseTo(2, 6);
    expect(shortestAngleDeltaDeg(-179, 179)).toBeCloseTo(-2, 6);
  });
});

describe('unwrapDeg', () => {
  /**
   * 이 함수의 존재 이유. 경로 반대쪽을 보고 좌우로 조금씩 돌렸을 때 화살표가 한 바퀴 돌던
   * 문제다. 값이 358도 움직이는 대신 2도만 움직여야 한다.
   */
  it('경계를 넘어도 조금씩만 움직인다', () => {
    expect(unwrapDeg(179, -179)).toBeCloseTo(181, 6);
    expect(unwrapDeg(-179, 179)).toBeCloseTo(-181, 6);
  });

  it('한 바퀴를 넘겨도 이어 붙는다', () => {
    let deg = 170;

    // 뒤를 보며 좌우로 20도씩 여섯 번 흔든다. 접힌 값이라면 매번 358도씩 튄다.
    for (const target of [-170, 170, -170, 170, -170, 170]) {
      const next = unwrapDeg(deg, target);

      expect(Math.abs(next - deg)).toBeLessThanOrEqual(20.000001);
      deg = next;
    }
  });

  it('직전 값과 같으면 움직이지 않는다', () => {
    expect(unwrapDeg(540, 180)).toBeCloseTo(540, 6);
  });
});

describe('inPlaneAngleDeg', () => {
  it('눕히지 않았으면 각도를 그대로 둔다', () => {
    for (const deg of [0, 30, -45, 90, 150, -170]) {
      expect(inPlaneAngleDeg(deg, 0)).toBeCloseTo(deg, 6);
    }
  });

  /** 이 함수의 존재 이유. 보정한 각도로 돌리면 화면에서는 원하던 각도로 보여야 한다. */
  it('보정한 각도는 화면에서 원하던 각도로 보인다', () => {
    for (const deg of [0, 5, 25, 45, 70, 90, 120, 179, -20, -60, -90, -135]) {
      expect(screenAngleOf(inPlaneAngleDeg(deg, TILT), TILT)).toBeCloseTo(deg, 6);
    }
  });

  /**
   * 보정하지 않으면 얼마나 어긋나는지 남겨 둔다. 실기기에서 관측된 불일치의 크기다 —
   * 58도로 눕힌 평면에서 30도는 47도로 보인다.
   */
  it('보정하지 않으면 화면에서 더 벌어져 보인다', () => {
    expect(screenAngleOf(30, TILT)).toBeCloseTo(47.45, 2);
    expect(screenAngleOf(45, TILT)).toBeCloseTo(62.08, 2);
  });

  it('정면과 정반대는 눕혀도 그대로다', () => {
    expect(inPlaneAngleDeg(0, TILT)).toBeCloseTo(0, 6);
    expect(Math.abs(inPlaneAngleDeg(180, TILT))).toBeCloseTo(180, 6);
  });

  /** 좌우는 앞뒤 성분이 없어 눌릴 것이 없다. */
  it('정확히 옆을 가리키는 각도는 바뀌지 않는다', () => {
    expect(inPlaneAngleDeg(90, TILT)).toBeCloseTo(90, 6);
    expect(inPlaneAngleDeg(-90, TILT)).toBeCloseTo(-90, 6);
  });

  /**
   * 사분면이 보존돼야 한다. `atan(cos T · tan θ)`로 구현하면 90도를 넘는 방향에서 부호가
   * 뒤집혀, 되돌아가야 할 때 화살표가 앞을 가리킨다.
   */
  it('되돌아가는 방향에서 부호가 뒤집히지 않는다', () => {
    expect(inPlaneAngleDeg(150, TILT)).toBeGreaterThan(90);
    expect(inPlaneAngleDeg(-150, TILT)).toBeLessThan(-90);
  });

  /**
   * 주기 함수라 **바퀴 수를 잃는다.** 그래서 부르는 순서가 정해져 있다 — 접힌 방향각을 먼저
   * 보정하고(`inPlaneAngleDeg`) 그 결과를 이어 붙인다(`unwrapDeg`). 순서를 뒤집어 이어 붙인
   * 값을 보정하면 여기서 바퀴 수가 사라져 화살표가 다시 한 바퀴 돈다.
   */
  it('한 바퀴 넘긴 값은 같은 방향으로 접힌다', () => {
    const base = inPlaneAngleDeg(30, TILT);

    expect(inPlaneAngleDeg(30 + 360, TILT)).toBeCloseTo(base, 6);
    expect(inPlaneAngleDeg(30 - 360, TILT)).toBeCloseTo(base, 6);
  });
});
