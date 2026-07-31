// 층별 실내 지도 한 장의 메타데이터. (API 명세서 5.1)
export interface FloorMap {
  mapId: number;
  floorId: number;
  floorCode: string;
  // 명세서에는 현재 'image'만 정의되어 있다. 벡터 등 추가 타입은 계약 확정 후 확장한다.
  mapType: string;
  /**
   * 백엔드 정적 파일의 상대 경로. resolveAssetUrl로 절대 URL로 변환해 사용한다.
   *
   * **null이 온다.** 도면 이미지 업로드(FR-A-002)가 아직 안 된 층은 이 값이 없다. 그 경우
   * 이미지 없이 오버레이만 그린다 — 마커 좌표는 프레임만으로 정해지므로 도면 그림이 없어도
   * 위치는 맞다.
   */
  mapUrl: string | null;
  // 지도 이미지 원본 픽셀 크기. 좌표 오버레이 계산의 기준 좌표계다.
  width: number;
  height: number;
  /**
   * 좌표 프레임. 미터 좌표를 원본 이미지 픽셀로 옮기는 데 필요한 세 값이다.
   * (docs/역삼역_FE_좌표연동_스펙.md §2, API 명세서 5.1)
   *
   * 미터 원점 (0, 0)이 놓이는 픽셀 좌표와 이미지 기준 +X축 각도, 1픽셀당 미터다.
   * `coordinateFrameOf`로 `CoordinateFrame`으로 바꿔 쓴다.
   */
  originPxX: number;
  originPxY: number;
  frameAngleDeg: number;
  // 1픽셀당 미터. 거리·축척 계산과 프레임 변환에 함께 쓰인다.
  scaleMPerPx: number;
  version: string;
}

/**
 * 층 평면도의 미터 좌표계와 원본 이미지 픽셀 좌표 사이의 변환 규칙.
 * (docs/역삼역_FE_좌표연동_스펙.md §2 좌표 프레임)
 *
 * route_node의 mapX/mapY는 층간 엘리베이터를 원점으로 하는 미터 값이므로,
 * 이미지 위에 그리려면 회전(angleDeg)과 축척(mpp)을 함께 적용해야 한다.
 *
 * 값의 출처는 층별 지도 조회 응답이다. `coordinateFrameOf`가 `FloorMap`에서 만든다.
 * 렌더 쪽이 쓰기 편한 모양으로 좁힌 것이며, 별도의 계약이 아니다.
 */
export interface CoordinateFrame {
  // 미터 원점 (0, 0)이 놓이는 원본 이미지 픽셀 좌표.
  originPx: readonly [x: number, y: number];
  // 이미지 기준 +X축(승강장·6번출구 방향) 각도. 진북 기준이 아니다.
  angleDeg: number;
  // meter per pixel.
  mpp: number;
}
