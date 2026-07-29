import type { CoordinateFrame, FloorMap } from './types';

/**
 * 역삼역(stationId=1) 목업 지도 데이터.
 *
 * TODO: 백엔드에 floor_map seed가 아직 없어(FR-A-002 지도 업로드 대기) FE에서 임시로 들고 있다.
 * 층별 지도 조회 API가 데이터를 내려주면 이 모듈과 IndoorMapView의 목업 분기를 함께 제거한다.
 *
 * 좌표계·프레임 값 원본: docs/역삼역_FE_좌표연동_스펙.md
 */

/**
 * 목업 floorId. 실제 floor_id는 auto-increment라 값이 다를 수 있으므로,
 * API 연동 시에는 이 상수 대신 층별 지도 응답의 floorCode로 매핑해야 한다.
 */
export const MOCK_FLOOR_ID = {
  B2: 1,
  B3: 2,
} as const;

/**
 * 평면도 자리를 채우는 스키매틱 도면.
 *
 * 실제 평면도 이미지(역삼역_B2.png 1624×969, 역삼역_B3.png 1659×948)가 아직 저장소에 없어
 * 같은 원본 픽셀 크기로 대체한다. 크기가 같아야 프레임 좌표가 실제 이미지에서도 그대로 맞는다.
 * 미터 원점과 +X축 방향을 프레임과 동일하게 회전시켜, 오버레이 좌표가 도면과 어긋나면 눈에 보인다.
 */
function schematicPlan(options: {
  width: number;
  height: number;
  originPx: readonly [number, number];
  angleDeg: number;
  hall: { x: number; y: number; width: number; height: number };
  label: string;
}): string {
  const { width, height, originPx, angleDeg, hall, label } = options;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#eceff4"/>`,
    `<g transform="translate(${originPx[0]} ${originPx[1]}) rotate(${angleDeg})">`,
    `<rect x="${hall.x}" y="${hall.y}" width="${hall.width}" height="${hall.height}" rx="12" fill="#fbfcfe" stroke="#c3ccd8" stroke-width="5"/>`,
    // 미터 원점(층간 엘리베이터 EVA) 표시.
    `<circle r="10" fill="none" stroke="#9aa6b4" stroke-width="4"/>`,
    // +X축 방향 표시.
    `<line x1="0" y1="0" x2="140" y2="0" stroke="#9aa6b4" stroke-width="4" stroke-dasharray="14 10"/>`,
    `</g>`,
    `<text x="28" y="56" font-family="sans-serif" font-size="34" fill="#8b95a3">${label}</text>`,
    `</svg>`,
  ].join('');
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * 층별 좌표 프레임. (docs/역삼역_FE_좌표연동_스펙.md §2)
 * mpp·z는 잠정값이며, COLMAP sim3 정합 후 이 상수만 갱신하면 렌더 로직은 그대로다.
 */
export const MOCK_COORDINATE_FRAMES: Readonly<Record<string, CoordinateFrame>> = {
  B2: { originPx: [622, 512], angleDeg: -21.28, mpp: 0.19 },
  B3: { originPx: [597, 497], angleDeg: -21.28, mpp: 0.19 },
};

/** 층 코드로 좌표 프레임을 찾는다. 등록되지 않은 층이면 undefined. */
export function findCoordinateFrame(floorCode: string): CoordinateFrame | undefined {
  return MOCK_COORDINATE_FRAMES[floorCode];
}

export const MOCK_FLOOR_MAPS: readonly FloorMap[] = [
  {
    mapId: 1,
    floorId: MOCK_FLOOR_ID.B2,
    floorCode: 'B2',
    mapType: 'image',
    mapUrl: schematicPlan({
      width: 1624,
      height: 969,
      originPx: [622, 512],
      angleDeg: -21.28,
      // B2 노드 분포(x -80~118m, y -15~43m)를 감싸는 대합실 영역.
      hall: { x: -470, y: -130, width: 1160, height: 400 },
      label: 'B2 대합실 (목업 도면)',
    }),
    width: 1624,
    height: 969,
    // TODO: 프레임의 mpp와 중복 개념이다. floor_map에 프레임이 들어오면 한쪽으로 통일한다.
    scaleMPerPx: 0.19,
    version: 'mock',
  },
  {
    mapId: 2,
    floorId: MOCK_FLOOR_ID.B3,
    floorCode: 'B3',
    mapType: 'image',
    mapUrl: schematicPlan({
      width: 1659,
      height: 948,
      originPx: [597, 497],
      angleDeg: -21.28,
      // B3 노드 분포(x -92~90m, y 0~27m)를 감싸는 승강장 영역.
      hall: { x: -560, y: -120, width: 1120, height: 340 },
      label: 'B3 승강장 (목업 도면)',
    }),
    width: 1659,
    height: 948,
    scaleMPerPx: 0.19,
    version: 'mock',
  },
];
