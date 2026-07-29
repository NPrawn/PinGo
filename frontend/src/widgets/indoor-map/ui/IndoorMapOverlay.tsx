import { useTranslation } from 'react-i18next';
import { type PixelPoint } from '@/entities/floor-map';
import type { IndoorPoint, RoutePathNode } from '@/entities/navigation';
import styles from './IndoorMapOverlay.module.css';

interface IndoorMapOverlayProps {
  /** 지금 화면에 그려진 층. 이 층에 속한 좌표만 표시한다. */
  floorId: number;
  /** 배경 지도의 원본 픽셀 크기. viewBox 기준이 된다. */
  imageWidth: number;
  imageHeight: number;
  /**
   * 지도 좌표를 원본 이미지 픽셀로 변환한다. 변환할 수 없으면 null을 반환한다.
   *
   * 좌표 계약(미터 프레임 vs 이미지 픽셀)이 아직 팀에서 확정되지 않았으므로
   * 변환식을 컴포넌트 안에 두지 않고 주입받는다. 계약이 바뀌어도 이 컴포넌트는 그대로다.
   */
  project: (mapX: number, mapY: number) => PixelPoint | null;
  currentLocation?: IndoorPoint | null;
  destination?: IndoorPoint | null;
  pathNodes?: readonly RoutePathNode[];
}

/**
 * 현재 위치·목적지·경로를 지도 이미지 위에 겹쳐 그리는 표현 컴포넌트.
 *
 * 배경 이미지와 같은 박스를 차지하는 SVG 하나로 그린다. viewBox가 원본 이미지 크기와 같고
 * preserveAspectRatio 기본값이 배경 이미지의 `object-fit: contain`과 동일하게 동작하므로,
 * 렌더 크기가 달라져도 좌표가 이미지와 어긋나지 않는다. 표시 배율을 따로 계산하지 않는다.
 *
 * 자체 상태가 없다. props가 바뀌면 매 렌더에서 좌표를 다시 계산해 오버레이가 갱신된다.
 */
export function IndoorMapOverlay({
  floorId,
  imageWidth,
  imageHeight,
  project,
  currentLocation,
  destination,
  pathNodes,
}: IndoorMapOverlayProps) {
  const { t } = useTranslation();

  // 표시 층에 속하고 변환 가능한 좌표만 남긴다. 잘못된 좌표는 경로에서 조용히 빠진다.
  const routePoints = (pathNodes ?? [])
    .filter((node) => node.floorId === floorId)
    .map((node) => project(node.mapX, node.mapY))
    .filter((point): point is PixelPoint => point !== null);

  const currentPoint = pointOnFloor(currentLocation, floorId, project);
  const destinationPoint = pointOnFloor(destination, floorId, project);

  // 그릴 것이 하나도 없으면 오버레이 자체를 만들지 않는다.
  if (routePoints.length < 2 && currentPoint === null && destinationPoint === null) {
    return null;
  }

  return (
    <svg
      className={styles.overlay}
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      // 배경 이미지 위 장식 레이어다. 의미 정보는 각 마커의 aria-label이 담당한다.
      focusable="false"
    >
      {/* 노드가 2개 미만이면 이을 선이 없다. 빈 경로·단일 노드 경로는 선을 그리지 않는다. */}
      {routePoints.length >= 2 && (
        <polyline
          className={styles.route}
          role="img"
          aria-label={t('indoorMap.overlay.route')}
          points={routePoints.map((point) => `${point.px},${point.py}`).join(' ')}
        />
      )}

      {destinationPoint && (
        <g role="img" aria-label={t('indoorMap.overlay.destination')}>
          <circle
            className={styles.destinationPin}
            cx={destinationPoint.px}
            cy={destinationPoint.py}
            r={MARKER_RADIUS}
          />
          <circle
            className={styles.destinationCore}
            cx={destinationPoint.px}
            cy={destinationPoint.py}
            r={MARKER_RADIUS / 2.5}
          />
        </g>
      )}

      {currentPoint && (
        <g role="img" aria-label={t('indoorMap.overlay.currentLocation')}>
          <circle
            className={styles.currentHalo}
            cx={currentPoint.px}
            cy={currentPoint.py}
            r={MARKER_RADIUS * 1.8}
          />
          <circle
            className={styles.currentDot}
            cx={currentPoint.px}
            cy={currentPoint.py}
            r={MARKER_RADIUS}
          />
        </g>
      )}
    </svg>
  );
}

// 원본 이미지 픽셀 단위 마커 반지름. viewBox와 함께 축소되므로 지도 축척에 비례한다.
const MARKER_RADIUS = 26;

/** 표시 층에 속한 지점만 픽셀 좌표로 바꾼다. 다른 층이거나 좌표가 잘못되면 null. */
function pointOnFloor(
  point: IndoorPoint | null | undefined,
  floorId: number,
  project: (mapX: number, mapY: number) => PixelPoint | null,
): PixelPoint | null {
  if (!point || point.floorId !== floorId) return null;
  return project(point.mapX, point.mapY);
}
