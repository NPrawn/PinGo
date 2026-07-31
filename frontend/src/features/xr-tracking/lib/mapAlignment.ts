import type { IndoorPoint } from '@/entities/navigation';
import type { XrPoseReading } from '@/shared/lib/webxr';

/**
 * XR 상대 pose를 지도 캐노니컬 미터 좌표로 옮기는 순수 모듈. (S15P11A206-296)
 *
 * `docs/역삼역_FE_좌표연동_스펙.md` 8.2~8.3의 앵커 정의와 변환식을 그대로 구현한다.
 * React·XR 객체·타이머가 없고 입력만으로 결과가 정해진다.
 *
 * **여기서 픽셀로 바꾸지 않는다.** 데이터는 캐노니컬 미터로 흐르고 픽셀 변환은 표시 단계의
 * `meterToPixel`이 맡는다(좌표 스펙 7장). 그래서 provisional 상태인 `mpp`가 이 모듈의
 * 정확도에 영향을 주지 않는다.
 */

/** 수평면 2D 벡터. 지도 프레임에서는 (x, y), XR 프레임에서는 (x, z)를 담는다. */
export interface PlanarVector {
  x: number;
  y: number;
}

/**
 * 지도 프레임과 XR 프레임을 묶는 앵커.
 *
 * **사전 위치 확정으로 만들지 않는다.** 초기 위치 인식(U-05)과 수동 선택(U-07)은 XR 세션보다
 * 앞이라 짝지을 pose가 없다. 앵커는 경로 안내 화면에서 세션이 추적을 잡은 뒤 세션 안 VPS로
 * 만든다(`docs/기술_의사결정_정리.md` 11.2).
 */
export interface XrMapAnchor {
  /** 앵커 시점의 확정 지도 좌표. 캐노니컬 미터다. */
  map: IndoorPoint;
  /** 같은 시점 XR 평면 위치. XR 평면은 (x, z)다. */
  xr: { x: number; z: number };
  /** 같은 시점 단말 전방의 XR 평면 단위벡터. `(-sin ψ, -cos ψ)`. */
  forwardXr: PlanarVector;
  /** 같은 시점 단말 전방의 캐노니컬 미터 평면 단위벡터. 위치 인식 응답에서 온다(8.5). */
  forwardMap: PlanarVector;
  /**
   * 두 전방 벡터로 산출한 회전. 앵커가 갱신될 때까지 고정이다.
   *
   * 각도가 아니라 내적·외적으로 들고 있다. 각도로 두면 0도 기준과 증가 방향을 따로 합의해야
   * 하고, 좌표 스펙 8.3의 이전 판이 정확히 그 문제로 폐기됐다.
   */
  rotation: { cosA: number; sinA: number };
  /**
   * 앵커가 몇 번째인지. 최초 생성이 0이고 재인식으로 갱신될 때마다 증가한다.
   *
   * 갱신은 누적 오차를 초기화한다(11.2). 표시 쪽에서 "새 기준으로 다시 시작했다"를 알아야
   * 이전 앵커 기준으로 평활하던 값을 이어 쓰지 않는다.
   */
  revision: number;
}

/** 앵커 상태. 없으면 추적하지 않고 확정 위치만 표시한다(11.2). */
export type XrAnchorStatus = 'none' | 'established' | 'refreshed';

/** 앵커 한 쌍을 만들기 위한 입력. */
export interface XrAnchorInput {
  /** 세션 안 VPS가 확정한 지도 좌표. 캐노니컬 미터다. */
  map: IndoorPoint;
  /** 같은 순간의 pose. 확정 주기를 거치지 않은 원시 값이어야 한다. */
  reading: XrPoseReading;
  /**
   * 같은 순간 단말 전방의 캐노니컬 평면 방향.
   *
   * **nullable이다.** 필드명·정규화 주체·`null` 허용 여부가 통합 때 확정되므로(8.5),
   * 산출 실패나 필드 부재를 정상 분기로 다룬다. null이면 회전을 정할 수 없어 앵커를
   * 만들지 않는다.
   */
  forwardMap: PlanarVector | null;
}

/**
 * 벡터를 단위벡터로 만든다. 길이가 0이거나 유한하지 않으면 null.
 *
 * 정규화 주체가 미정이므로(8.5) FE에서 한 번 더 정규화한다. 이미 단위벡터면 결과가 같고,
 * 배율만 다른 값이 와도 무해하다 — 방향 벡터는 배율로 환산되지 않는다.
 */
export function normalizePlanar(vector: PlanarVector | null | undefined): PlanarVector | null {
  if (!vector) return null;

  const { x, y } = vector;

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const length = Math.hypot(x, y);

  if (length === 0) return null;

  return { x: x / length, y: y / length };
}

/**
 * pose의 yaw에서 XR 평면 전방 단위벡터를 구한다.
 *
 * 좌표 스펙 8.2의 `(-sin ψ, -cos ψ)`다. ψ = 0의 전방이 `-z`인 것은 WebXR 뷰어의 전방이
 * `-Z`이기 때문이며 2차 실기기 검증에서 확인됐다(28.7m 직진 시 Δz 단조 감소).
 *
 * 반환값의 `y`는 XR 평면의 `z` 성분이다. 두 프레임 모두 수평면 2D로 다루기 위해 이름을 맞춘다.
 */
export function forwardXrOf(yawDeg: number): PlanarVector {
  const rad = (yawDeg * Math.PI) / 180;

  return { x: -Math.sin(rad), y: -Math.cos(rad) };
}

/**
 * 앵커를 만든다. 방향을 알 수 없으면 null.
 *
 * `revision`은 호출하는 쪽이 관리한다. 최초 생성은 0, 재인식 갱신은 직전 값 + 1이다.
 */
export function createXrMapAnchor(input: XrAnchorInput, revision = 0): XrMapAnchor | null {
  const forwardMap = normalizePlanar(input.forwardMap);

  /**
   * 방향이 없으면 앵커를 만들지 않는다.
   *
   * 회전을 항등으로 가정하고 넘어가면 XR 세션 시작 방향이 곧 지도 +X라고 선언하는 것과
   * 같다. 그건 우연히만 맞고, 틀려도 오류가 나지 않은 채 마커가 엉뚱한 쪽으로 움직인다(8.5).
   * 앵커 없음으로 두면 확정 위치만 표시되어 사용자가 잘못된 정보를 보지 않는다.
   */
  if (!forwardMap) return null;

  const forwardXr = normalizePlanar(forwardXrOf(input.reading.yawDeg));

  if (!forwardXr) return null;

  const { x, z } = input.reading.position;

  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;

  return {
    map: input.map,
    xr: { x, z },
    forwardXr,
    forwardMap,
    // 내적과 2D 외적. 좌표 스펙 8.3과 같은 식이다.
    rotation: {
      cosA: forwardXr.x * forwardMap.x + forwardXr.y * forwardMap.y,
      sinA: forwardXr.x * forwardMap.y - forwardXr.y * forwardMap.x,
    },
    revision,
  };
}

/**
 * 지금 pose의 yaw를 지도 프레임 기준 방향각(도)으로 옮긴다. (S15P11A206-141)
 *
 * 위치와 같은 회전을 쓴다. 앵커의 `rotation`은 XR 평면 벡터를 지도 평면 벡터로 옮기는
 * 변환이므로, 전방 벡터에 그대로 적용하면 지도 프레임에서 사용자가 바라보는 방향이 된다.
 *
 * 각도 기준은 지도 프레임의 `+X`축이고 증가 방향은 `+Y`쪽이다(`atan2(y, x)`). 이미지 위에
 * 그릴 때는 좌표 프레임의 `angleDeg`를 더해야 픽셀 기준 각도가 된다 — `meterToPixel`이
 * 같은 각도로 회전시키기 때문이다.
 *
 * 앵커 시점에 부르면 `atan2(forwardMap.y, forwardMap.x)`와 같은 값이 나온다. 회전이
 * 두 전방 벡터로 만들어졌으므로 `rotate(forwardXr) = forwardMap`이 정확히 성립한다.
 */
export function mapHeadingDegOf(yawDeg: number, anchor: XrMapAnchor): number | null {
  if (!Number.isFinite(yawDeg)) return null;

  const forwardXr = forwardXrOf(yawDeg);
  const { cosA, sinA } = anchor.rotation;
  const x = cosA * forwardXr.x - sinA * forwardXr.y;
  const y = sinA * forwardXr.x + cosA * forwardXr.y;

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return (Math.atan2(y, x) * 180) / Math.PI;
}

/**
 * XR pose를 지도 캐노니컬 미터 좌표로 옮긴다. (좌표 스펙 8.3)
 *
 * **`dZ`의 부호를 뒤집지 않고 거울 보정도 넣지 않는다.** 3차 실기기 검증에서 90° 우회전 후
 * 직진에 `Δx`가 `-1.80 → +7.79`로 양수 방향이었고, 이는 두 프레임의 방향성이 같다는 추론과
 * 일치한다(`WebXR_검증_결과.md` 3.0 3차).
 *
 * **`floorId`를 pose에서 유도하지 않는다.** `local` 공간의 원점 높이는 세션을 시작한 순간
 * 단말이 들려 있던 높이라 알 수 없다(8.4). 앵커의 층을 그대로 전달하고, 층 전환 판정은
 * 경로 단계와 재인식이 맡는다.
 */
export function xrToMapPoint(
  position: { x: number; z: number },
  anchor: XrMapAnchor,
): IndoorPoint | null {
  const dX = position.x - anchor.xr.x;
  const dZ = position.z - anchor.xr.z; // 부호 반전 없음

  if (!Number.isFinite(dX) || !Number.isFinite(dZ)) return null;

  const { cosA, sinA } = anchor.rotation;

  return {
    floorId: anchor.map.floorId,
    mapX: anchor.map.mapX + (cosA * dX - sinA * dZ),
    mapY: anchor.map.mapY + (sinA * dX + cosA * dZ),
  };
}
