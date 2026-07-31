import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { facilityIconOf, type Facility } from '@/entities/facility';
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
  /**
   * 목적지 마커에 붙일 이름. 프로토타입에서 점 위에 얹혀 있던 `3번 출구` 칩이다.
   *
   * 마커와 같은 좌표계에서 그려야 층을 바꾸거나 목적지가 달라져도 둘이 붙어 있다.
   * null이면 점만 그린다.
   */
  destinationLabel?: string | null;
  pathNodes?: readonly RoutePathNode[];
  /**
   * 지도에 표시할 시설. 표시 층에 속한 것만 그린다.
   *
   * **호출부가 이미 걸러서 넘긴다.** 역 하나의 시설이 층당 30여 개인데 안내 화면의 지도는
   * 1m가 1.2px이라(역삼역 B2는 240m 폭이 287px에 들어간다) 전부 그리면 마커가 서로를 덮는다.
   * 어떤 유형을 보여줄지는 화면이 정한다(FR-U-006 점진적 공개).
   */
  facilities?: readonly Facility[];
  /** 이름을 함께 표시할 시설. 기본은 아이콘만 그린다 — 라벨을 다 붙이면 도면이 가려진다. */
  selectedFacilityId?: number | null;
  /** 시설 마커를 눌렀을 때. 넘기지 않으면 마커가 탭을 받지 않는다. */
  onSelectFacility?: (facility: Facility) => void;
  /**
   * 지도에 적용된 확대 배율. 기본 1.
   *
   * **마커 치수를 이 값으로 나눈다.** 마커는 지도와 함께 확대되면 안 된다 — 확대는 도면을 크게
   * 보려는 조작이고, 마커가 같이 커지면 가리는 면적만 늘어난다. 지도 UI의 통례이기도 하다.
   * 좌표는 그대로 두고 크기만 상쇄하므로 마커가 가리키는 지점은 바뀌지 않는다.
   */
  viewScale?: number;
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
  destinationLabel,
  pathNodes,
  facilities,
  selectedFacilityId,
  onSelectFacility,
  viewScale = 1,
}: IndoorMapOverlayProps) {
  const { t } = useTranslation();
  /**
   * 부채꼴 페이드 그라디언트의 id.
   *
   * 고정 문자열로 두면 한 문서에 오버레이가 둘 이상 있을 때 뒤쪽 오버레이가 앞쪽 정의를
   * 참조한다 — 그라디언트 중심이 남의 마커 위치라 페이드가 엉뚱한 곳에서 시작한다.
   *
   * `useId`가 붙이는 구분 기호는 id에 쓸 수 없는 문자일 수 있어 걸러낸다.
   */
  const beamGradientId = `beam${useId().replace(/[^\w-]/g, '')}`;

  /**
   * 화면상 크기를 일정하게 두기 위한 배수.
   *
   * 지도를 2배로 확대하면 마커 치수를 절반으로 줄여, 보이는 크기가 그대로 유지된다.
   */
  const sizeUnit = 1 / (viewScale > 0 ? viewScale : 1);
  const markerRadius = MARKER_RADIUS * sizeUnit;
  const destinationRadius = DESTINATION_RADIUS * sizeUnit;
  const facilityRadius = FACILITY_RADIUS * sizeUnit;
  const labelFontSize = LABEL_FONT_SIZE * sizeUnit;
  const labelGap = LABEL_GAP * sizeUnit;
  const beamLength = BEAM_LENGTH * sizeUnit;
  const borderWidth = BORDER_WIDTH * sizeUnit;
  const pinBorderWidth = PIN_BORDER_WIDTH * sizeUnit;
  const labelHaloWidth = LABEL_HALO_WIDTH * sizeUnit;
  const routeWidth = ROUTE_WIDTH * sizeUnit;
  const routeDash = `${ROUTE_DASH[0] * sizeUnit} ${ROUTE_DASH[1] * sizeUnit}`;

  const routeSegments = floorSegments(pathNodes ?? [], floorId, project);
  const currentPoint = pointOnFloor(currentLocation, floorId, project);
  const destinationPoint = pointOnFloor(destination, floorId, project);
  const facilityPins = facilitiesOnFloor(facilities ?? [], floorId, project);

  // 그릴 것이 하나도 없으면 오버레이 자체를 만들지 않는다.
  if (
    routeSegments.length === 0 &&
    currentPoint === null &&
    destinationPoint === null &&
    facilityPins.length === 0
  ) {
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
              strokeWidth={routeWidth}
              strokeDasharray={routeDash}
              points={points.map((point) => `${point.px},${point.py}`).join(' ')}
            />
          ))}
        </g>
      )}

      {/* 시설은 경로·현재위치보다 아래에 둔다. 안내에 필요한 표시가 시설에 가리면 안 된다. */}
      {facilityPins.map(({ facility, point }) => {
        const selected = facility.facilityId === selectedFacilityId;

        return (
          <g
            key={facility.facilityId}
            className={onSelectFacility ? styles.facilityTappable : undefined}
            role={onSelectFacility ? 'button' : 'img'}
            aria-label={facility.nameKo}
            aria-pressed={onSelectFacility ? selected : undefined}
            onClick={onSelectFacility ? () => onSelectFacility(facility) : undefined}
          >
            <circle
              className={[styles.facilityPin, selected && styles.facilityPinOn]
                .filter(Boolean)
                .join(' ')}
              cx={point.px}
              cy={point.py}
              r={facilityRadius}
              strokeWidth={pinBorderWidth}
            />
            {/* 스프라이트 심볼을 그대로 참조한다. 아이콘 모양은 entities/facility가 정한다. */}
            <use
              className={[styles.facilityIcon, selected && styles.facilityIconOn]
                .filter(Boolean)
                .join(' ')}
              href={`#i-${facilityIconOf(facility.facilityType)}`}
              x={point.px - facilityRadius / 2}
              y={point.py - facilityRadius / 2}
              width={facilityRadius}
              height={facilityRadius}
            />
            {/* 이름은 고른 것에만 붙인다. 층당 30여 개를 모두 붙이면 도면이 글자로 덮인다. */}
            {selected && (
              <text
                className={styles.facilityLabel}
                x={point.px}
                y={point.py + facilityRadius + labelFontSize}
                fontSize={labelFontSize}
                strokeWidth={labelHaloWidth}
                textAnchor="middle"
              >
                {facility.nameKo}
              </text>
            )}
          </g>
        );
      })}

      {destinationPoint && (
        <g role="img" aria-label={t('indoorMap.overlay.destination')}>
          <circle
            className={styles.destinationPin}
            cx={destinationPoint.px}
            cy={destinationPoint.py}
            r={destinationRadius}
            strokeWidth={borderWidth}
          />
          {destinationLabel != null && destinationLabel !== '' && (
            // 원본과 같이 점 위쪽에 얹는다. 점과 겹치지 않을 만큼만 띄운다.
            <text
              className={styles.destinationLabel}
              x={destinationPoint.px}
              y={destinationPoint.py - destinationRadius - labelGap}
              fontSize={labelFontSize}
              strokeWidth={labelHaloWidth}
              textAnchor="middle"
            >
              {destinationLabel}
            </text>
          )}
        </g>
      )}

      {currentPoint && (
        <g role="img" aria-label={t('indoorMap.overlay.currentLocation')}>
          {/**
           * 부채꼴의 페이드. 마커 중심을 기준으로 옅어져야 하므로 좌표를 직접 준다 —
           * 기본 단위(objectBoundingBox)는 부채꼴 경로의 바운딩 박스 중심을 쓰는데,
           * 그 중심은 마커 위치가 아니라 부채꼴 한복판이다.
           *
           * 회전은 마커 중심을 축으로 하므로, 같은 점을 중심으로 둔 그라디언트는 회전에
           * 영향받지 않는다.
           */}
          <defs>
            <radialGradient
              id={beamGradientId}
              gradientUnits="userSpaceOnUse"
              cx={currentPoint.px}
              cy={currentPoint.py}
              r={beamLength}
            >
              <stop className={styles.beamStopInner} offset="0%" />
              <stop className={styles.beamStopOuter} offset="100%" />
            </radialGradient>
          </defs>
          <circle
            className={styles.currentHalo}
            cx={currentPoint.px}
            cy={currentPoint.py}
            r={markerRadius * HALO_SCALE}
          />
          {/* 방향을 아는 경우에만 부채꼴을 얹는다. 점보다 먼저 그려 점이 위에 남게 한다 —
              점의 중심이 곧 위치이므로 방향 표시가 그것을 덮으면 위치가 흐려진다. */}
          {Number.isFinite(currentHeadingImageDeg) && (
            <path
              className={styles.currentBeam}
              fill={`url(#${beamGradientId})`}
              d={beamPath(currentPoint, beamLength)}
              transform={`rotate(${currentHeadingImageDeg} ${currentPoint.px} ${currentPoint.py})`}
            />
          )}
          <circle
            className={styles.currentDot}
            cx={currentPoint.px}
            cy={currentPoint.py}
            r={markerRadius}
            strokeWidth={borderWidth}
          />
        </g>
      )}
    </svg>
  );
}

/**
 * 마커 치수. 단위는 **원본 이미지 픽셀**이라 viewBox와 함께 축소된다.
 *
 * 비율은 프로토타입 `.heading`(점 16px · ping 22px · beam 반지름 27px)과
 * `.dotdest`(14px)에서 가져왔다. 절대값은 경로 안내 화면의 지도 박스에서 원본과 같은 크기로
 * 보이도록 맞춘 것이다(그 박스의 표시 배율이 약 0.2다).
 *
 * TODO(283): 표시 배율에 관계없이 화면상 크기를 일정하게 두려면 렌더된 박스를 실제로 재야
 * 한다. 팬·줌이 들어올 때 그 값이 필요하므로 그때 화면 좌표 기준으로 바꾼다. 지금은 지도를
 * 크게 띄우는 화면(/user/map)에서 마커도 함께 커진다.
 */
const MARKER_RADIUS = 40;
const HALO_SCALE = 1.375;
const DESTINATION_RADIUS = 35;

/** 목적지 이름. 점 위에 얹되 겹치지 않을 만큼 띄운다. */
const LABEL_FONT_SIZE = 44;
const LABEL_GAP = 14;

/**
 * 선 두께. 좌표와 같은 원본 이미지 픽셀 단위다.
 *
 * `vector-effect: non-scaling-stroke`를 쓰지 않는다. 그것은 SVG 안의 변환만 무시하고 바깥
 * CSS 확대는 그대로 받아서, 확대할 때 반지름은 줄고 두께만 커진다. 값은 프로토타입의 화면상
 * 두께(테두리 3px·시설 2px·글자 외곽선 5px·경로 5px)를 지금 표시 배율에서 환산한 것이다.
 */
const BORDER_WIDTH = 15;
const PIN_BORDER_WIDTH = 10;
const LABEL_HALO_WIDTH = 25;
const ROUTE_WIDTH = 25;
const ROUTE_DASH: readonly [number, number] = [5, 55];

/**
 * 시설 마커 반지름. 프로토타입 `.facpin`의 아이콘 원이 26px이므로 같은 크기가 되도록 잡았다.
 * 안쪽 아이콘 글리프는 원 지름의 절반이며, 이 역시 프로토타입과 같다.
 */
const FACILITY_RADIUS = 65;

/** 방향 부채꼴. 원본의 conic-gradient가 60도를 덮었으므로 반각은 30도다. */
const BEAM_LENGTH = MARKER_RADIUS * 3.375;
const BEAM_HALF_ANGLE_DEG = 30;


/**
 * 마커 중심에서 오른쪽(0도)으로 뻗는 부채꼴을 그린다.
 *
 * 항상 0도로 그리고 회전은 `transform`이 맡는다. 각도를 경로 계산에 넣으면 179도와 -179도
 * 같은 경계에서 호의 방향(sweep flag)을 따로 판단해야 한다.
 */
function beamPath({ px, py }: PixelPoint, length: number): string {
  const rad = (BEAM_HALF_ANGLE_DEG * Math.PI) / 180;
  const dx = length * Math.cos(rad);
  const dy = length * Math.sin(rad);

  return [
    `M ${px} ${py}`,
    `L ${px + dx} ${py - dy}`,
    // 반각이 90도 미만이라 항상 짧은 호다. large-arc-flag는 0, sweep-flag는 시계 방향으로 1.
    `A ${length} ${length} 0 0 1 ${px + dx} ${py + dy}`,
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

/** 표시 층에 속한 시설만 픽셀 좌표와 함께 남긴다. 좌표를 변환할 수 없는 시설은 건너뛴다. */
function facilitiesOnFloor(
  facilities: readonly Facility[],
  floorId: number,
  project: (mapX: number, mapY: number) => PixelPoint | null,
): { facility: Facility; point: PixelPoint }[] {
  const pins: { facility: Facility; point: PixelPoint }[] = [];

  for (const facility of facilities) {
    if (facility.floorId !== floorId) continue;
    const point = project(facility.mapX, facility.mapY);
    if (point === null) continue;
    pins.push({ facility, point });
  }

  return pins;
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
