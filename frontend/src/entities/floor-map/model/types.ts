/**
 * 층별 실내 지도 한 장의 메타데이터. (API 명세서 5.1)
 *
 * 이미지 정보와 **좌표 프레임**을 함께 담는다. 노드·경로·현재위치는 캐노니컬 미터로 내려오므로
 * 지도 위에 그리려면 이 프레임으로 픽셀 변환을 해야 한다(`coordinateFrameOf`).
 */
export interface FloorMap {
  mapId: number;
  floorId: number;
  floorCode: string;
  // 명세서에는 현재 'image'만 정의되어 있다. 벡터 등 추가 타입은 계약 확정 후 확장한다.
  mapType: string;
  /**
   * 백엔드 정적 파일의 상대 경로. `resolveAssetUrl`로 절대 URL로 변환해 사용한다.
   *
   * **null일 수 있다.** 좌표 프레임만 등록되고 이미지는 아직 없는 상태이며(V9 seed가 그렇다),
   * 이때 클라이언트가 자체 이미지를 쓰고 프레임만 가져다 쓴다. 단 자체 이미지가 기준
   * 크기(width×height)를 확대·축소한 것이어야 프레임이 그대로 성립한다.
   */
  mapUrl: string | null;
  // 좌표 프레임의 기준이 되는 원본 픽셀 크기. 층마다 다르다.
  width: number;
  height: number;
  /**
   * 1픽셀당 미터. 아래 세 값과 함께 **모두 있어야** 좌표 변환이 가능하다.
   * 하나라도 null이면 지도 이미지는 표시할 수 있으나 좌표 오버레이는 할 수 없다.
   */
  scaleMPerPx: number | null;
  /** 캐노니컬 원점(0,0)에 대응하는 이미지 픽셀. */
  originPxX: number | null;
  originPxY: number | null;
  /** 캐노니컬 +X축과 이미지 x축의 각도(도). 진북 기준이 아니다. */
  frameAngleDeg: number | null;
  version: string;
}

/**
 * 층 평면도의 미터 좌표계와 원본 이미지 픽셀 좌표 사이의 변환 규칙.
 * (docs/역삼역_FE_좌표연동_스펙.md §2 좌표 프레임)
 *
 * route_node의 mapX/mapY는 층간 엘리베이터를 원점으로 하는 미터 값이므로,
 * 이미지 위에 그리려면 회전(angleDeg)과 축척(mpp)을 함께 적용해야 한다.
 *
 * TODO: 현재 층별 지도 조회 응답에 이 필드가 없어 FE 상수로 들고 있다.
 * floor_map에 프레임 컬럼이 추가되면 FloorMap으로 합친다.
 */
export interface CoordinateFrame {
  // 미터 원점 (0, 0)이 놓이는 원본 이미지 픽셀 좌표.
  originPx: readonly [x: number, y: number];
  // 이미지 기준 +X축(승강장·6번출구 방향) 각도. 진북 기준이 아니다.
  angleDeg: number;
  // meter per pixel.
  mpp: number;
}
