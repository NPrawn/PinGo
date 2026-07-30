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
