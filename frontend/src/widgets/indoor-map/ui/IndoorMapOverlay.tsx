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
  /**
   * 현재 위치 마커가 가리킬 방향(도). **이미지 픽셀 기준**이며 0이 오른쪽, 증가 방향이 아래다.
   *
   * 미터 프레임 각도가 아니라 이미지 각도를 받는다. `project`와 같은 이유로 — 프레임 변환을
   * 이 컴포넌트가 알지 못하게 두면 좌표 계약이 바뀌어도 여기는 그대로다.
   *
   * null이면 방향을 모르는 것이므로 점만 그린다. 0으로 대신 채우면 오른쪽을 바라보는 것으로
   * 보여, 방향을 모른다는 사실이 화면에서 사라진다.
   */
  currentHeadingImageDeg?: number | null;
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
  currentHeadingImageDeg,
  destination,
  pathNodes,
}: IndoorMapOverlayProps) {
  const { t } = useTranslation();

  const routeSegments = floorSegments(pathNodes ?? [], floorId, project);
  const currentPoint = pointOnFloor(currentLocation, floorId, project);
  const destinationPoint = pointOnFloor(destination, floorId, project);

  // 그릴 것이 하나도 없으면 오버레이 자체를 만들지 않는다.
  if (routeSegments.length === 0 && currentPoint === null && destinationPoint === null) {
    return null;
  }

  return (
    <svg
      className={styles.overlay}
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      // 배경 이미지 위 장식 레이어다. 의미 정보는 각 마커의 aria-label이 담당한다.
      focusable="false"
    >
      {routeSegments.length > 0 && (
        // 구간이 여러 개여도 사용자에게는 하나의 경로다. 라벨은 묶음에 한 번만 붙인다.
        <g role="img" aria-label={t('indoorMap.overlay.route')}>
          {routeSegments.map((points, index) => (
            <polyline
              key={index}
              className={styles.route}
              points={points.map((point) => `${point.px},${point.py}`).join(' ')}
            />
          ))}
        </g>
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
          {/* 방향을 아는 경우에만 부채꼴을 얹는다. 점보다 먼저 그려 점이 위에 남게 한다 —
              점의 중심이 곧 위치이므로 방향 표시가 그것을 덮으면 위치가 흐려진다. */}
          {Number.isFinite(currentHeadingImageDeg) && (
            <path
              className={styles.currentBeam}
              d={beamPath(currentPoint)}
              transform={`rotate(${currentHeadingImageDeg} ${currentPoint.px} ${currentPoint.py})`}
            />
          )}
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

/** 방향 부채꼴의 길이와 반각. 반각을 넓게 잡아 각도 오차가 덜 드러나게 한다. */
const BEAM_LENGTH = MARKER_RADIUS * 3.2;
const BEAM_HALF_ANGLE_DEG = 26;

/**
 * 마커 중심에서 오른쪽(0도)으로 뻗는 부채꼴을 그린다.
 *
 * 항상 0도로 그리고 회전은 `transform`이 맡는다. 각도를 경로 계산에 넣으면 179도와 -179도
 * 같은 경계에서 호의 방향(sweep flag)을 따로 판단해야 한다.
 */
function beamPath({ px, py }: PixelPoint): string {
  const rad = (BEAM_HALF_ANGLE_DEG * Math.PI) / 180;
  const dx = BEAM_LENGTH * Math.cos(rad);
  const dy = BEAM_LENGTH * Math.sin(rad);

  return [
    `M ${px} ${py}`,
    `L ${px + dx} ${py - dy}`,
    // 반각이 90도 미만이라 항상 짧은 호다. large-arc-flag는 0, sweep-flag는 시계 방향으로 1.
    `A ${BEAM_LENGTH} ${BEAM_LENGTH} 0 0 1 ${px + dx} ${py + dy}`,
    'Z',
  ].join(' ');
}

/**
 * 경로를 "표시 층에 연속으로 속한 구간"들로 나눈다.
 *
 * 층 조건으로만 걸러 하나의 선으로 이으면, 경로가 다른 층을 거쳐 이 층으로 돌아올 때
 * 실제로는 이어져 있지 않은 두 지점이 직선으로 연결돼 벽을 통과하는 것처럼 보인다.
 * (예: B3 승강장 → B2 대합실 → 반대편 B3 승강장) 구간을 나눠 그리면 층간 이동 지점에서
 * 선이 끊겨 실제 연결 관계를 그대로 전달한다.
 *
 * 다른 층 노드는 구간을 끊지만, 변환할 수 없는 좌표는 끊지 않고 건너뛴다.
 * 좌표를 모르는 것과 이 층에서 이어져 있지 않은 것은 다르다 — 앞뒤 노드는 여전히
 * 그 지점을 지나 연결돼 있으므로, 직선으로 잇는 편이 근사이되 없는 연결을 만들지는 않는다.
 */
function floorSegments(
  nodes: readonly RoutePathNode[],
  floorId: number,
  project: (mapX: number, mapY: number) => PixelPoint | null,
): PixelPoint[][] {
  const segments: PixelPoint[][] = [];
  let current: PixelPoint[] | null = null;

  for (const node of nodes) {
    if (node.floorId !== floorId) {
      current = null;
      continue;
    }
    const point = project(node.mapX, node.mapY);
    if (point === null) continue;

    if (current === null) {
      current = [];
      segments.push(current);
    }
    current.push(point);
  }

  // 점이 하나뿐인 구간은 이을 선이 없다.
  return segments.filter((segment) => segment.length >= 2);
}

/** 표시 층에 속한 지점만 픽셀 좌표로 바꾼다. 다른 층이거나 좌표가 잘못되면 null. */
function pointOnFloor(
  point: IndoorPoint | null | undefined,
  floorId: number,
  project: (mapX: number, mapY: number) => PixelPoint | null,
): PixelPoint | null {
  if (!point || point.floorId !== floorId) return null;
  return project(point.mapX, point.mapY);
}
