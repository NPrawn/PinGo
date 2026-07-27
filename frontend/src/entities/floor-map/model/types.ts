// 층별 실내 지도 한 장의 메타데이터. (API 명세서 5.1)
export interface FloorMap {
  mapId: number;
  floorId: number;
  floorCode: string;
  // 명세서에는 현재 'image'만 정의되어 있다. 벡터 등 추가 타입은 계약 확정 후 확장한다.
  mapType: string;
  // 백엔드 정적 파일의 상대 경로. resolveAssetUrl로 절대 URL로 변환해 사용한다.
  mapUrl: string;
  // 지도 이미지 원본 픽셀 크기. 좌표 오버레이 계산의 기준 좌표계다.
  width: number;
  height: number;
  // 1픽셀당 미터. 거리·축척 계산에 사용한다.
  scaleMPerPx: number;
  version: string;
}
