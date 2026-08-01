import type { PlanarVector } from '../lib/mapAlignment';

/**
 * 앵커 시점 전방 방향(`forwardMap`)의 주입 지점. (S15P11A206-296)
 *
 * **이 파일이 방향 값이 앱에 들어오는 유일한 통로다.** 좌표 스펙 8.5에서 계약이 확정됐지만
 * 필드명·정규화 주체·`null` 허용 여부는 통합 때 정하기로 남았고 BE 구현도 아직 없다.
 * 어댑터를 한 곳에 모아 두면 실제 필드가 붙을 때 여기만 고치면 된다.
 */

/**
 * 위치 인식 응답의 후보 하나에서 방향을 꺼낸다.
 *
 * 지금은 **어떤 필드가 올지 모른다.** `API_명세서.md`의 위치 인식 응답에는 아직
 * `nodeId`·`floorId`·`label`·`mapX`·`mapY`·`confidenceScore`·`confidenceLabel`만 있다.
 * 그래서 알려진 후보 필드명을 순서대로 보고, 없으면 null을 돌려준다.
 *
 * TODO: 필드명이 확정되면 후보 목록을 지우고 확정된 이름 하나만 읽는다. 응답 타입도 함께
 * 정의한다. (좌표 스펙 8.5 "통합 때 확정할 것")
 */
export function readForwardMap(candidate: unknown): PlanarVector | null {
  if (typeof candidate !== 'object' || candidate === null) return null;

  const record = candidate as Record<string, unknown>;

  for (const key of FORWARD_FIELD_CANDIDATES) {
    const value = toPlanarVector(record[key]);

    if (value) return value;
  }

  return null;
}

/**
 * 방향 필드로 올 만한 이름들. 확정되면 하나만 남는다.
 *
 * AI 파이프라인 설계서 8.1~8.2가 `forward_colmap`이라는 이름을 쓰므로 snake_case 변형도
 * 함께 본다. 8.5의 확정 내용은 "캐노니컬 수평면 2D 단위벡터"이고 이름은 열려 있다.
 */
const FORWARD_FIELD_CANDIDATES = ['forwardMap', 'forward', 'forward_map', 'headingVector'] as const;

/** `{x, y}` 또는 `[x, y]` 형태를 평면 벡터로 읽는다. 그 외에는 null. */
function toPlanarVector(value: unknown): PlanarVector | null {
  if (Array.isArray(value)) {
    const [x, y] = value;

    return typeof x === 'number' && typeof y === 'number' ? { x, y } : null;
  }

  if (typeof value !== 'object' || value === null) return null;

  const { x, y } = value as Record<string, unknown>;

  return typeof x === 'number' && typeof y === 'number' ? { x, y } : null;
}

/**
 * BE 구현 전까지 쓸 목업 방향.
 *
 * **일부러 항등(회전 0)이 아니다.** 항등으로 두면 XR 좌표가 지도 좌표로 그대로 흘러가서,
 * 회전을 적용하지 않는 배선 오류가 테스트에서도 화면에서도 드러나지 않는다. 축에 정렬되지도
 * 않은 값이라 x·y를 바꿔 넣는 실수도 결과가 달라진다.
 *
 * 3-4-5 삼각형의 단위벡터라 손으로 검산하기 쉽다.
 *
 * TODO: 위치 인식 응답에 방향 필드가 붙으면 이 상수와 사용처를 제거한다.
 */
export const MOCK_ANCHOR_FORWARD_MAP: PlanarVector = { x: 0.6, y: 0.8 };

/**
 * 후보에서 방향을 읽되, 없으면 목업으로 채운다.
 *
 * `useMock`을 끄면 방향이 없는 후보에서 앵커가 만들어지지 않는다. 이것이 통합 후의 정상
 * 동작이다. 켜면 BE 없이도 변환 경로 전체를 화면에서 확인할 수 있다.
 */
export function resolveAnchorForwardMap(
  candidate: unknown,
  { useMock = false }: { useMock?: boolean } = {},
): PlanarVector | null {
  return readForwardMap(candidate) ?? (useMock ? MOCK_ANCHOR_FORWARD_MAP : null);
}
