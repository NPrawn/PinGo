import { localPlanUrl } from './localPlans';
import type { CoordinateFrame, FloorMap } from './types';

/**
 * 역삼역(stationId=1) 목업 지도 데이터. `?mock=1`에서만 쓴다.
 *
 * TODO: 백엔드가 없거나 DB가 준비되지 않은 상태에서 화면을 확인하기 위한 것이다. 층별 지도
 * 조회·경로·위치 API가 모두 연결되면 이 모듈과 IndoorMapView의 목업 분기를 함께 제거한다.
 *
 * 좌표계·프레임 값 원본: docs/역삼역_FE_좌표연동_스펙.md
 * 실제 값은 V9__add_floor_map_coordinate_frame.sql seed와 같다.
 */

/**
 * 목업 floorId.
 *
 * **실제 floor_id와 대응하지 않는다.** 실제 값은 auto-increment이고 V8이 B1→B2→B3 순으로
 * 넣으므로 fresh DB에서는 B1이 가장 작다. 목업은 여기 순서를 따르며, 두 값을 비교하거나
 * 목업 id를 실제 API 응답에 쓰면 안 된다. API 연동 시에는 응답의 `floorCode`로 매핑한다.
 *
 * TODO: 목업 제거 시 이 상수도 함께 지운다. 그때까지는 `?mock=1&floorId=` 파라미터의 의미가
 * 실제 모드와 다르다는 점에 주의한다.
 */
export const MOCK_FLOOR_ID = {
  B2: 1,
  B3: 2,
  B1: 3,
} as const;

/**
 * 층별 좌표 프레임 **폴백**. (docs/역삼역_FE_좌표연동_스펙.md §2)
 *
 * 우선순위는 API 응답이다(`coordinateFrameOf`). 이 상수는 목업 모드와, 프레임 컬럼이 비어 있는
 * 지도를 위한 폴백으로만 쓴다. 값은 DB `floor_map`과 같으므로 둘이 갈라지면 안 된다.
 *
 * `mpp`는 실측 보정값 0.12799다 (S15P11A206-351). V9가 넣은 0.19는 승강장 205m 단일 측정에서
 * 역산한 값이었고 실제보다 1.484배 컸다. V23이 DB를 같은 값으로 바꿨다.
 *
 * B1의 originPx는 **미검증 추정값**이다. B1에는 원점 기준 엘리베이터가 없어 추정으로 얹었고
 * 예비 정합에서 최대 4.4m 차이가 나왔다. B1 좌표끼리는 일관되므로 B1 안에서의 지도 표시와
 * 경로선 렌더링은 정상 동작하고, 층 전환 위치 정합에만 영향이 있다(S15P11A206-314에서 확정).
 *
 * TODO: 프레임이 확정되면 DB만 UPDATE하면 되도록, 실제 모드에서는 이 상수를 타지 않아야 한다.
 * 모든 층의 프레임이 API로 내려오는 것이 확인되면 이 상수를 지운다.
 */
export const MOCK_COORDINATE_FRAMES: Readonly<Record<string, CoordinateFrame>> = {
  B1: { originPx: [594, 501], angleDeg: -21.28, mpp: 0.12799 },
  B2: { originPx: [622, 512], angleDeg: -21.28, mpp: 0.12799 },
  B3: { originPx: [597, 497], angleDeg: -21.28, mpp: 0.12799 },
};

/** 층 코드로 폴백 좌표 프레임을 찾는다. 등록되지 않은 층이면 undefined. */
export function findCoordinateFrame(floorCode: string): CoordinateFrame | undefined {
  return MOCK_COORDINATE_FRAMES[floorCode];
}

/** 목업 지도 한 장을 만든다. 프레임 값은 폴백 상수에서 가져와 둘이 어긋나지 않게 한다. */
function mockFloorMap(options: {
  mapId: number;
  floorId: number;
  floorCode: 'B1' | 'B2' | 'B3';
  width: number;
  height: number;
}): FloorMap {
  const { mapId, floorId, floorCode, width, height } = options;
  const frame = MOCK_COORDINATE_FRAMES[floorCode];

  return {
    mapId,
    floorId,
    floorCode,
    mapType: 'image',
    // 실제 응답도 mapUrl이 null이라 같은 폴백 경로를 탄다(localPlans).
    mapUrl: null,
    width,
    height,
    scaleMPerPx: frame.mpp,
    originPxX: frame.originPx[0],
    originPxY: frame.originPx[1],
    frameAngleDeg: frame.angleDeg,
    version: 'mock',
  };
}

/**
 * 목업 층별 지도.
 *
 * width·height는 스펙 §1의 원본 픽셀 크기이며 실제 PNG와 V9 seed 값 모두와 일치한다.
 * 프레임의 originPx가 이 크기를 기준으로 정의돼 있으므로 어긋나면 오버레이가 도면과 맞지 않는다.
 *
 * **순서에 의미가 있다.** 층을 지정하지 않으면 첫 번째 지도가 표시된다(IndoorMapView).
 * 층 오름차순(B1→B3)이 자연스럽지만 목업 위치·경로가 B2·B3에만 있어, 기본 화면에서 바로
 * 오버레이가 보이도록 B2를 앞에 둔다. 층 전환 UI(280)가 붙으면 이 순서는 의미를 잃는다.
 */
export const MOCK_FLOOR_MAPS: readonly FloorMap[] = [
  mockFloorMap({ mapId: 1, floorId: MOCK_FLOOR_ID.B2, floorCode: 'B2', width: 1624, height: 969 }),
  mockFloorMap({ mapId: 2, floorId: MOCK_FLOOR_ID.B3, floorCode: 'B3', width: 1659, height: 948 }),
  mockFloorMap({ mapId: 3, floorId: MOCK_FLOOR_ID.B1, floorCode: 'B1', width: 1626, height: 967 }),
];

/** 목업 지도가 쓰는 자체 평면도 URL. 브라우저 밖에서는 null이다. */
export function mockPlanUrl(floorCode: string): string | null {
  return localPlanUrl(floorCode);
}
