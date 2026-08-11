import { describe, expect, it } from 'vitest';
import { angleDiffDeg, planarDistanceM, toPoseReading, yawDegOf } from './pose';

describe('yawDegOf', () => {
  it('회전이 없으면 0도다', () => {
    expect(yawDegOf({ x: 0, y: 0, z: 0, w: 1 })).toBeCloseTo(0, 6);
  });

  /**
   * 좌표 스펙 8.2가 정의한 전방 벡터 `(-sin ψ, -cos ψ)`가 성립해야 한다.
   * ψ = 0이면 전방이 (0, -1), 즉 -z다. 2차 실측에서 직진 시 Δz가 단조 감소한 것과 맞는다.
   */
  it('yaw 0도의 전방 벡터는 -z다', () => {
    const yaw = yawDegOf({ x: 0, y: 0, z: 0, w: 1 });
    const rad = (yaw * Math.PI) / 180;

    expect(-Math.sin(rad)).toBeCloseTo(0, 6);
    expect(-Math.cos(rad)).toBeCloseTo(-1, 6);
  });

  it('+y 축 90도 회전을 90도로 읽는다', () => {
    const half = Math.SQRT1_2;

    expect(yawDegOf({ x: 0, y: half, z: 0, w: half })).toBeCloseTo(90, 6);
  });

  it('+y 축 -90도 회전을 -90도로 읽는다', () => {
    const half = Math.SQRT1_2;

    expect(yawDegOf({ x: 0, y: -half, z: 0, w: half })).toBeCloseTo(-90, 6);
  });

  /**
   * 단말을 기울여도 방향각이 흔들리지 않아야 한다. (S15P11A206-382)
   *
   * 옛 식(`atan2(R₀₂, R₀₀)`)은 분자가 전방 축, 분모가 오른쪽 축이라 기울임각이 섞이면
   * `atan2(sin ψ·cos θ, cos ψ)`가 되어 값이 0쪽으로 끌려갔다. 기울임 60도에서 최대 18.4도,
   * 75도에서 30.5도였다. QA가 본 "폰을 기울이면 방향이 바뀐다"가 이것이다.
   *
   * **오차가 heading 0·90·180도에서 정확히 0이다.** 그래서 축에 정렬된 방향만 확인한 실기기
   * 검증(체크리스트 16번)에서는 드러나지 않았다. 10번이 "실제 각도 대비 오차는 미측정"으로
   * 남겨 둔 구간이 여기이므로, 격자로 덮어 다시 새지 않게 한다.
   */
  describe('기울여 들어도 같은 방향을 읽는다', () => {
    type Quaternion = { x: number; y: number; z: number; w: number };

    function multiply(a: Quaternion, b: Quaternion): Quaternion {
      return {
        w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
        x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      };
    }

    const rad = (deg: number) => (deg * Math.PI) / 180;
    /** 방향(+y 축). */
    const yaw = (deg: number): Quaternion => ({
      x: 0,
      y: Math.sin(rad(deg) / 2),
      z: 0,
      w: Math.cos(rad(deg) / 2),
    });
    /** 앞뒤로 눕히기(+x 축). */
    const pitch = (deg: number): Quaternion => ({
      x: Math.sin(rad(deg) / 2),
      y: 0,
      z: 0,
      w: Math.cos(rad(deg) / 2),
    });
    /** 좌우로 비스듬히 들기(+z 축). */
    const roll = (deg: number): Quaternion => ({
      x: 0,
      y: 0,
      z: Math.sin(rad(deg) / 2),
      w: Math.cos(rad(deg) / 2),
    });

    /** 두 각도의 최단 차이. 179도와 -179도는 2도 차이다. */
    const errorDeg = (actual: number, expected: number) =>
      Math.abs(((((actual - expected) % 360) + 540) % 360) - 180);

    const HEADINGS = [0, 20, 45, 70, 90, 135, 180, -45, -120];
    /** 위·아래 모두 본다. 오차는 `cos θ`에만 의존해 대칭이므로 부호를 함께 확인한다. */
    const TILTS = [0, 15, 30, 45, 60, 75, -30, -60];

    it.each(HEADINGS)('heading %i도는 기울임과 무관하다', (heading) => {
      for (const tilt of TILTS) {
        const actual = yawDegOf(multiply(yaw(heading), pitch(tilt)));

        expect(errorDeg(actual, heading)).toBeLessThan(1e-6);
      }
    });

    /** 시선축 회전은 회전행렬 3열을 건드리지 않으므로 값이 바뀌지 않아야 한다. */
    it.each([0, 10, 25, 45, 90, -60])('좌우로 %i도 비스듬히 들어도 같다', (rollDeg) => {
      for (const heading of HEADINGS) {
        const actual = yawDegOf(multiply(multiply(yaw(heading), pitch(30)), roll(rollDeg)));

        expect(errorDeg(actual, heading)).toBeLessThan(1e-6);
      }
    });

    /**
     * 거의 수직으로 눕힌 구간. 전방의 수평 성분이 사라져 up 축으로 갈아탄다.
     *
     * 위치 인식을 위해 바닥이나 천장을 훑는 동안이 이 구간이고, 그 순간의 값으로 앵커가
     * 만들어진다. 여기서 포기하면 앵커가 통째로 틀어진다.
     */
    it.each([80, 88, 92, 100, -85, -95])('%i도로 눕혀도 방향을 잃지 않는다', (tilt) => {
      for (const heading of HEADINGS) {
        const actual = yawDegOf(multiply(yaw(heading), pitch(tilt)));

        expect(errorDeg(actual, heading)).toBeLessThan(1e-6);
      }
    });

    /**
     * 수직에 닿기까지 방향각이 계단 없이 이어져야 한다. (S15P11A206-382)
     *
     * QA에서 "정방향으로 들다가 상하가 뒤집히면 방향값이 달라진다"는 보고가 있었다. 옛 식은
     * 기울임이 커지는 내내 값이 0쪽으로 끌려가다 90도에서 180도 뒤집혀, 뒤집힌 값으로 앵커가
     * 만들어지면 그 뒤의 모든 좌표가 반대로 회전됐다. 값이 아니라 **이어짐**을 검사한다.
     *
     * **수직을 넘어선 구간(약 102도 이상)은 검사하지 않는다.** 그 자세에서는 카메라가 실제로
     * 사용자의 뒤쪽을 향하므로 방향각이 반대가 되는 것이 맞다. 스펙 8.2가 정의한 값이 `단말
     * 전방`이기 때문이다. 뒤집힘까지 이으려면 "단말 up 축이 아래를 향하면 180도 돌린다"는 규칙을
     * 넣어야 하는데, 그 규칙은 폰을 옆으로 눕혔을 때(roll 90도) up 축의 수직 성분이 0을 지나며
     * 부호가 요동쳐 오히려 작은 손떨림에 180도씩 뒤집힌다. 실측으로 확인해 넣지 않았다.
     */
    it.each([1, -1])('수직에 닿기까지 방향각이 튀지 않는다 (기울임 부호 %i)', (sign) => {
      for (const heading of HEADINGS) {
        let previous = yawDegOf(multiply(yaw(heading), pitch(0)));

        for (let step = 2; step <= 100; step += 2) {
          const actual = yawDegOf(multiply(yaw(heading), pitch(sign * step)));

          expect(errorDeg(actual, previous)).toBeLessThan(1);
          previous = actual;
        }
      }
    });
  });
});

describe('angleDiffDeg', () => {
  it('같은 각도의 차이는 0이다', () => {
    expect(angleDiffDeg(30, 30)).toBe(0);
  });

  it('부호가 갈리는 경계를 최단 거리로 계산한다', () => {
    expect(angleDiffDeg(179, -179)).toBeCloseTo(2, 6);
    expect(angleDiffDeg(-179, 179)).toBeCloseTo(2, 6);
  });

  it('결과는 항상 0 이상 180 이하다', () => {
    expect(angleDiffDeg(0, 270)).toBeCloseTo(90, 6);
    expect(angleDiffDeg(0, 180)).toBeCloseTo(180, 6);
  });
});

describe('planarDistanceM', () => {
  it('(x, z) 평면 거리만 센다', () => {
    expect(planarDistanceM({ x: 0, z: 0 }, { x: 3, z: -4 })).toBeCloseTo(5, 6);
  });

  it('y는 인자에 없으므로 높이 변화가 섞이지 않는다', () => {
    expect(planarDistanceM({ x: 1, z: 2 }, { x: 1, z: 2 })).toBe(0);
  });
});

describe('toPoseReading', () => {
  /**
   * XRRigidTransform과 DOMPointReadOnly는 프레임 밖에서 쓰지 않고 숫자만 복사한다.
   * 원본 객체를 그대로 들고 나가면 다음 프레임에서 값이 바뀔 수 있다.
   */
  it('XR 객체를 참조하지 않고 숫자만 복사한다', () => {
    const position = { x: 1, y: 2, z: 3 };
    const orientation = { x: 0, y: 0, z: 0, w: 1 };
    const pose = { transform: { position, orientation } } as unknown as XRViewerPose;

    const result = toPoseReading(pose, 1234);

    expect(result).toEqual({
      position: { x: 1, y: 2, z: 3 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      yawDeg: result.yawDeg,
      timestamp: 1234,
    });
    expect(result.position).not.toBe(position);
    expect(result.orientation).not.toBe(orientation);
  });

  it('yawDeg를 함께 계산해 담는다', () => {
    const half = Math.SQRT1_2;
    const pose = {
      transform: {
        position: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: half, z: 0, w: half },
      },
    } as unknown as XRViewerPose;

    expect(toPoseReading(pose, 0).yawDeg).toBeCloseTo(90, 6);
  });
});
