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
   * 경유지 노드. **경로에 실어 보낸 순서 그대로** 넘긴다.
   *
   * 경로선을 다리로 나누고 각 경유지에 번호를 붙이는 데 쓴다. 겹치는 복도에서 어느 쪽이 먼저인지
   * 알려주는 것이 이 번호이고, 헤더의 `경유 1`과 짝이 맞는다.
   */
  waypointNodeIds?: readonly number[];
  /**
   * 지금 걷고 있는 다리. 0이 출발 → 첫 경유지다.
   *
   * 이 값으로 다리마다 명도를 정한다 — 지나온 다리는 흐리게, 지금 다리는 진하게, 남은 다리는
   * 연하게. 넘기지 않거나 null이면 전부 기본 색이다.
   *
   * 위젯이 스스로 계산하지 않는 이유는 진행도가 화면의 것이기 때문이다. 진행 거리는 XR 위치와
   * 래칫으로 정해지고 화면이 스토어에 들고 있다(`routeProgressOf`).
   */
  activeLeg?: number | null;
  /**
   * 현재 위치와 경로 사이의 빈 자리를 이을지. 기본은 잇지 않는다.
   *
   * 경로선은 노드에서 시작하고 내 점은 실제 좌표에 있어서 둘이 떨어져 보인다. 서버가 목적지
   * 기준으로 진입 노드를 다시 고르면(S15P11A206-337) 그 간격이 수십 m가 될 수도 있다 — 그때는
   * 이 선이 그 층 안내의 전부다.
   *
   * **거리로 자르지 않는다.** 멀다는 것은 곧 그만큼 걸어가야 한다는 뜻이고, 그리지 않으면 사용자는
   * 자기 층에 경로가 없다고 읽는다. 이 선이 그래프에 없는 구간이라 도면상 벽을 지날 수는 있지만,
   * 아무것도 없는 것보다는 방향을 아는 편이 낫다.
   *
   * 기본을 끔으로 두는 것은 안내 화면이 아닌 지도(둘러보기·상담 공유)에서는 이을 이유가 없기
   * 때문이다. 그 화면들의 경로는 "이 역의 경로"이고 내 위치에서 출발하는 것이 아니다.
   */
  connectCurrentToRoute?: boolean;
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
  /**
   * 지금 목적지인 경로 노드. 그 노드에 연결된 시설 아이콘을 도착지로 표시한다.
   * (S15P11A206-206)
   *
   * 목적지 마커(`destination`)만으로는 **어느 시설이 목적지인지** 알 수 없다. 마커는 경로
   * 노드 좌표에 찍히고 아이콘은 시설 좌표에 그려지는데 이 둘이 정확히 겹치지 않는다. 그래서
   * 상담자가 엘리베이터를 새 목적지로 짚어도, 지도에서는 아이콘 여러 개 사이에 점 하나가
   * 늘어난 것으로만 보였다 — 짚은 그 아이콘이 목적지가 되었다는 표시가 없었다.
   *
   * 좌표로 맞추지 않고 **노드로** 맞춘다. 좌표 비교는 소수점 자리와 도면 갱신에 흔들린다.
   */
  destinationNodeId?: number | null;
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
  /**
   * 지도에 걸린 회전(도). 기본 0.
   *
   * **글자와 아이콘을 이 각도만큼 되돌린다.** 진행 방향을 위로 세우려고 지도를 돌리면
   * 그 안의 이름표도 함께 누워 읽을 수 없게 된다. 위치를 나타내는 점·선은 돌아야 맞고,
   * 읽는 요소만 세워 둔다.
   */
  mapRotationDeg?: number;
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
  waypointNodeIds,
  activeLeg = null,
  connectCurrentToRoute = false,
  facilities,
  selectedFacilityId,
  destinationNodeId,
  onSelectFacility,
  viewScale = 1,
  mapRotationDeg = 0,
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
  const routeCasingWidth = ROUTE_CASING_WIDTH * sizeUnit;
  const waypointRadius = WAYPOINT_RADIUS * sizeUnit;
  const waypointFontSize = WAYPOINT_FONT_SIZE * sizeUnit;
  const directionSpacing = DIRECTION_SPACING * sizeUnit;
  const directionArm = DIRECTION_ARM * sizeUnit;
  const directionWidth = DIRECTION_WIDTH * sizeUnit;
  /** 오른쪽(0도)을 향하는 화살촉. 방향은 `transform`의 회전이 맡는다. */
  const chevron = [
    `M ${-directionArm} ${-directionArm * DIRECTION_SPREAD}`,
    'L 0 0',
    `L ${-directionArm} ${directionArm * DIRECTION_SPREAD}`,
  ].join(' ');

  /** 지도가 돌아간 만큼 되돌린다. 읽는 요소는 항상 화면에 바로 서 있어야 한다. */
  const upright = (point: PixelPoint): string | undefined =>
    mapRotationDeg === 0 ? undefined : `rotate(${-mapRotationDeg} ${point.px} ${point.py})`;

  const waypoints = waypointNodeIds ?? [];
  /**
   * 점이 하나뿐인 구간도 남겨 둔다.
   *
   * 선으로는 그릴 수 없지만 **이어 줄 자리로는 쓴다.** 서버가 진입 노드를 목적지 기준으로 다시
   * 고르면서 계단·엘리베이터 노드를 집으면(S15P11A206-337) 그 층에 경로 노드가 하나만 남는다.
   * 버려 버리면 사용자가 서 있는 층에 아무것도 그려지지 않는다.
   */
  const allSegments = floorSegments(pathNodes ?? [], floorId, project, waypoints);
  const routeSegments = allSegments.filter((segment) => segment.points.length >= 2);
  const paintOrder = activeLegLast(routeSegments, activeLeg);
  /** 이 층에 보이는 경유지와 그 번호. 헤더의 `경유 N`과 같은 번호다. */
  const waypointPins = waypoints.flatMap((nodeId, index) => {
    const node = (pathNodes ?? []).find((item) => item.nodeId === nodeId);
    if (!node || node.floorId !== floorId) return [];
    const point = project(node.mapX, node.mapY);

    return point ? [{ point, order: index + 1 }] : [];
  });
  const currentPoint = pointOnFloor(currentLocation, floorId, project);
  /** 내 점에서 경로까지 이어 줄 선. 이을 것이 없거나 점 안에 묻히는 길이면 null이다. */
  const connector = connectCurrentToRoute
    ? routeConnector(currentPoint, allSegments, markerRadius)
    : null;
  /**
   * 연결선 가운데에 놓을 방향 표시. 내 쪽에서 경로 쪽을 가리킨다. (S15P11A206-89)
   *
   * 간격을 선 길이로 주면 표시가 정확히 가운데 하나만 놓인다 — `directionMarks` 가 첫 표시를
   * 간격의 절반 자리에 두고 그다음은 선 밖으로 나가기 때문이다.
   */
  const connectorMarks = connector
    ? directionMarks(
        [connector.from, connector.to],
        Math.hypot(connector.to.px - connector.from.px, connector.to.py - connector.from.py),
      )
    : [];
  const destinationPoint = pointOnFloor(destination, floorId, project);
  /**
   * 고른 시설을 **맨 나중에** 그린다. (S15P11A206-206)
   *
   * SVG 에는 `z-index` 가 없어 나중에 그린 것이 위로 온다. 역삼역 B2 는 1m 가 1.2px 이라 그 층
   * 시설 36개를 모두 그리면 마커 간 최소 간격이 3.9px 인데, 고른 것이 목록에서 앞에 있으면 뒤에
   * 그려지는 이웃 마커에 아이콘과 이름표가 덮인다 — 눌렀는데 무엇을 눌렀는지 보이지 않았다.
   *
   * 정렬만 바꾼다. 경로·현재 위치보다 위로 올리지는 않는다 — 안내에 필요한 표시가 시설에 가리면
   * 안 된다는 규칙(아래 렌더 순서)은 그대로다.
   */
  const isDestinationFacility = (facility: Facility): boolean =>
    destinationNodeId != null && facility.linkedNodeId === destinationNodeId;
  /**
   * 그리는 순서. 큰 값이 위로 온다. 고른 것 > 목적지 > 나머지.
   *
   * 목적지 표시도 이웃 마커에 덮이면 없는 것과 같다. 고른 것을 목적지보다 위에 두는 이유는
   * 이름표가 붙는 쪽이라 가려지면 무엇을 눌렀는지 알 수 없기 때문이다.
   */
  const paintRank = (facility: Facility): number => {
    if (facility.facilityId === selectedFacilityId) return 2;
    return isDestinationFacility(facility) ? 1 : 0;
  };
  const facilityPins = facilitiesOnFloor(facilities ?? [], floorId, project).sort(
    (a, b) => paintRank(a.facility) - paintRank(b.facility),
  );
  // 그릴 것이 하나도 없으면 오버레이 자체를 만들지 않는다.
  if (
    routeSegments.length === 0 &&
    waypointPins.length === 0 &&
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
      {/* 이은 선만 있어도 그린다. 그 층에 경로 노드가 하나뿐이면 선으로 그릴 구간이 없는데,
          이 조건이 구간만 보면 사용자가 서 있는 층에 아무 안내도 남지 않는다. */}
      {(routeSegments.length > 0 || connector !== null) && (
        // 구간이 여러 개여도 사용자에게는 하나의 경로다. 라벨은 묶음에 한 번만 붙인다.
        <g role="img" aria-label={t('indoorMap.overlay.route')}>
          {/* 바깥 테두리를 모든 구간에 먼저 깔고 본선을 그 위에 얹는다. 구간마다 번갈아 그리면
              구간이 만나는 자리에서 뒷 구간의 테두리가 앞 구간의 본선을 덮는다. */}
          {paintOrder.map((segment, index) => (
            <polyline
              key={index}
              className={styles.routeCasing}
              strokeWidth={routeCasingWidth}
              points={segment.points.map((point) => `${point.px},${point.py}`).join(' ')}
              // 배경에서 떼어 놓기 위한 장식이다. 경로 자체는 아래 본선이 나타낸다.
              aria-hidden
            />
          ))}
          {connector && (
            <line
              className={styles.routeCasing}
              strokeWidth={routeCasingWidth}
              x1={connector.from.px}
              y1={connector.from.py}
              x2={connector.to.px}
              y2={connector.to.py}
              aria-hidden
            />
          )}
          {paintOrder.map((segment, index) => (
            <polyline
              key={index}
              className={[styles.route, legToneClass(segment.leg, activeLeg)]
                .filter(Boolean)
                .join(' ')}
              strokeWidth={routeWidth}
              points={segment.points.map((point) => `${point.px},${point.py}`).join(' ')}
            />
          ))}
          {/*
            내 점에서 경로까지. **본선과 같은 두께·같은 색으로 그린다.**

            경로선은 그래프 노드에서 시작하고 내 점은 실제 좌표에 있어 둘이 몇 미터 떨어져
            보인다. 그 사이가 비어 있으면 경로가 내가 아닌 다른 곳에서 시작하는 것으로 읽힌다.

            점선이나 다른 색으로 구분하지 않는다. 여기서 알려야 하는 것은 "이 선이 나에게서
            시작한다"이고, 다르게 그리면 그 구간만 따로 판단해야 하는 무언가로 보인다.
            이 선을 그릴지 말지는 호출부가 이미 판단했다.
          */}
          {connector && (
            <line
              className={[styles.route, legToneClass(connector.leg, activeLeg)]
                .filter(Boolean)
                .join(' ')}
              strokeWidth={routeWidth}
              x1={connector.from.px}
              y1={connector.from.py}
              x2={connector.to.px}
              y2={connector.to.py}
            />
          )}
          {/* 진행 방향. 지도가 돌아가도 함께 돌아야 한다 — 가리키는 것이 방향 자체다.
              선과 같은 순서로 그려 현재 다리의 화살표가 맨 위에 남는다. */}
          {paintOrder.flatMap((segment, segmentIndex) =>
            directionMarks(segment.points, directionSpacing).map((mark, markIndex) => (
              <path
                key={`${segmentIndex}-${markIndex}`}
                className={styles.routeDirection}
                strokeWidth={directionWidth}
                d={chevron}
                transform={`translate(${mark.px} ${mark.py}) rotate(${mark.angleDeg})`}
              />
            )),
          )}
          {/*
            연결선에도 화살표를 둔다. (S15P11A206-89)

            **이 선만 방향이 없었다.** 본선에는 일정 간격으로 화살표가 놓이는데 연결선은 하나도
            받지 못했다. 그런데 이 선이야말로 방향을 읽어야 하는 자리다 — 경로에서 벗어났거나
            목적지를 지나친 동안에는 화면에 이 선밖에 없고, 그때 사용자가 알아야 하는 것은
            "어느 쪽으로 가면 경로로 돌아가는가"다. 방향이 없으면 걸어온 자취처럼 보인다.

            간격을 선 길이로 두면 표시가 **가운데 하나만** 놓인다(첫 표시가 간격의 절반 자리에
            오고 다음은 선 밖이다). 짧은 연결선에 촘촘한 간격을 쓰면 화살표가 없거나 뭉친다.
          */}
          {connectorMarks.map((mark, markIndex) => (
            <path
              key={`connector-${markIndex}`}
              className={styles.routeDirection}
              strokeWidth={directionWidth}
              d={chevron}
              transform={`translate(${mark.px} ${mark.py}) rotate(${mark.angleDeg})`}
            />
          ))}
        </g>
      )}

      {/*
        경유지 번호.

        겹치는 복도에서 어느 쪽을 먼저 지나는지 알려주는 것이 이 번호다. 색만으로는 같은 자리를
        두 번 지날 때 위에 그려진 다리 하나만 보이지만, 번호는 지점에 붙어 있어 가려지지 않는다.

        번호는 지도가 돌아도 세워 둔다 — 읽는 요소다.
      */}
      {waypointPins.map(({ point, order }) => (
        <g
          key={order}
          role="img"
          aria-label={t('indoorMap.overlay.waypoint', { order })}
          transform={upright(point)}
        >
          <circle
            className={styles.waypointPin}
            cx={point.px}
            cy={point.py}
            r={waypointRadius}
            strokeWidth={borderWidth}
          />
          <text
            className={styles.waypointOrder}
            x={point.px}
            y={point.py}
            fontSize={waypointFontSize}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {order}
          </text>
        </g>
      ))}

      {/* 시설은 경로·현재위치보다 아래에 둔다. 안내에 필요한 표시가 시설에 가리면 안 된다. */}
      {facilityPins.map(({ facility, point }) => {
        const selected = facility.facilityId === selectedFacilityId;
        const isDestination = isDestinationFacility(facility);

        return (
          <g
            key={facility.facilityId}
            className={onSelectFacility ? styles.facilityTappable : undefined}
            role={onSelectFacility ? 'button' : 'img'}
            /* 목적지라는 사실을 이름에도 싣는다. 색만으로 알리면 화면을 읽어 주는 사용자에게는
               아무 표시도 없는 것과 같다. */
            aria-label={
              isDestination
                ? `${facility.nameKo} · ${t('indoorMap.overlay.destination')}`
                : facility.nameKo
            }
            aria-pressed={onSelectFacility ? selected : undefined}
            onClick={onSelectFacility ? () => onSelectFacility(facility) : undefined}
          >
            {/* 목적지 시설에는 테두리를 한 겹 더 두른다. 마커 자체를 목적지 색으로 바꾸면
                유형 아이콘이 무엇인지 읽기 어려워진다. */}
            {isDestination && (
              <circle
                className={styles.facilityDestinationRing}
                cx={point.px}
                cy={point.py}
                r={facilityRadius + pinBorderWidth * 1.5}
                strokeWidth={pinBorderWidth * 1.5}
              />
            )}
            <circle
              className={[
                styles.facilityPin,
                selected && styles.facilityPinOn,
                isDestination && !selected && styles.facilityPinDestination,
              ]
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
              transform={upright(point)}
            />
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
              transform={upright(destinationPoint)}
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

/**
 * 경유지 번호 핀. 목적지 점보다 조금 크다 — 안에 숫자가 들어가야 읽힌다.
 *
 * 숫자는 지름의 60% 정도가 원 안에서 꽉 차 보이지 않으면서 읽히는 크기다.
 */
const WAYPOINT_RADIUS = 52;
const WAYPOINT_FONT_SIZE = WAYPOINT_RADIUS * 1.2;

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

/**
 * 경로선 바깥 테두리.
 *
 * 도면에는 벽·해칭 선이 빽빽해서, 선 하나만 그으면 그중 하나로 묻힌다. 연한 색으로 한 겹
 * 넓게 깔고 그 위에 본선을 얹으면 배경에서 떨어져 나온다. 지도 앱들이 경로에 쓰는 방식이다.
 */
const ROUTE_CASING_WIDTH = ROUTE_WIDTH + 18;

/**
 * 진행 방향 표시.
 *
 * 선만으로는 어느 쪽으로 가야 하는지 알 수 없다. 출발점과 도착점을 알아도 층을 넘나드는
 * 구간에서는 선이 끊겨, 이 층에서 어느 방향으로 걸어야 하는지가 사라진다.
 *
 * 노드마다 두지 않고 **일정 거리마다** 둔다. 그래프의 노드 간격은 복도 구조에 따라 3m에서
 * 30m까지 벌어지는데, 노드에 붙이면 촘촘한 구간에서 화살표가 서로 겹치고 긴 직선에서는
 * 하나도 없다.
 *
 * 크기는 선 두께에 맞춰 잡았다. 팔 길이가 두께의 1.2배쯤이면 선 위에 얹혀도 뭉치지 않는다.
 */
const DIRECTION_SPACING = 260;
const DIRECTION_ARM = 30;
const DIRECTION_WIDTH = 12;

/** 화살촉 벌어짐. 0.72는 약 55도로, 좁으면 뾰족해 보이고 넓으면 방향이 둔해진다. */
const DIRECTION_SPREAD = 0.72;

interface DirectionMark {
  px: number;
  py: number;
  angleDeg: number;
}

/**
 * 경로 위에 일정 간격으로 놓을 방향 표시의 위치와 각도.
 *
 * 첫 표시를 간격의 절반만큼 띄우고 끝에서도 그만큼 남긴다. 끝에 붙이면 현재 위치·목적지 마커에
 * 가려 방향은 읽히지 않고 어수선함만 남는다.
 */
function directionMarks(points: readonly PixelPoint[], spacing: number): DirectionMark[] {
  if (points.length < 2 || spacing <= 0) return [];

  const segments = points
    .slice(1)
    .map((end, index) => {
      const start = points[index];
      const dx = end.px - start.px;
      const dy = end.py - start.py;

      return { start, dx, dy, length: Math.hypot(dx, dy) };
    })
    .filter((segment) => segment.length > 0);

  const marks: DirectionMark[] = [];
  let travelled = 0;
  let next = spacing / 2;

  for (const segment of segments) {
    const angleDeg = (Math.atan2(segment.dy, segment.dx) * 180) / Math.PI;

    while (next <= travelled + segment.length) {
      const ratio = (next - travelled) / segment.length;
      marks.push({
        px: segment.start.px + segment.dx * ratio,
        py: segment.start.py + segment.dy * ratio,
        angleDeg,
      });
      next += spacing;
    }

    travelled += segment.length;
  }

  return marks;
}

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

/** 한 번에 그리는 경로 조각. `leg`은 몇 번째 다리인지다(0이 출발 → 첫 경유지). */
interface RouteSegment {
  points: PixelPoint[];
  leg: number;
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
 *
 * **경유지에서도 끊는다.** 색이 다리마다 달라지므로 경계가 필요하다. 경유지 노드는 앞 다리의
 * 끝이면서 뒤 다리의 시작이라 두 구간이 같은 점을 공유한다 — 한쪽에만 넣으면 그 자리에 틈이
 * 생긴다.
 *
 * 경유지 판정은 순서대로 한다. 왕복 경로에서 같은 노드를 두 번 지날 수 있는데, 두 번째 통과를
 * 또 경계로 삼으면 다리가 실제보다 많아진다.
 */
function floorSegments(
  nodes: readonly RoutePathNode[],
  floorId: number,
  project: (mapX: number, mapY: number) => PixelPoint | null,
  waypointNodeIds: readonly number[] = [],
): RouteSegment[] {
  const segments: RouteSegment[] = [];
  let current: RouteSegment | null = null;
  let leg = 0;
  let pending = 0;

  for (const node of nodes) {
    const endsLeg = pending < waypointNodeIds.length && node.nodeId === waypointNodeIds[pending];
    const point = node.floorId === floorId ? project(node.mapX, node.mapY) : null;

    if (point === null) {
      // 이 층에 없는 노드는 구간을 끊는다. 좌표만 모르는 노드는 앞뒤를 그대로 잇는다.
      if (node.floorId !== floorId) current = null;
    } else {
      if (current === null) {
        current = { points: [], leg };
        segments.push(current);
      }
      current.points.push(point);
    }

    if (endsLeg) {
      leg += 1;
      pending += 1;
      // 경유지가 이 층에 보이면 그 점에서 다음 다리를 시작해 선을 이어 준다.
      current = point === null ? null : { points: [point], leg };
      if (current) segments.push(current);
    }
  }

  /*
    점이 하나뿐인 구간도 그대로 돌려준다.

    선으로는 그릴 수 없지만 이어 줄 자리로는 쓴다. 여기서 걸러 버리면 그 층에 경로 노드가 하나뿐인
    경우(서버가 계단·엘리베이터 노드를 진입 노드로 고른 경우)에 그 층 안내가 통째로 사라진다.
    선을 그릴 구간만 필요한 쪽이 걸러 쓴다.
  */
  return segments;
}

/**
 * 다리를 **진행도 기준으로** 칠한다.
 *
 * - 지나온 다리 → 흐리게
 * - 지금 걷는 다리 → 가장 진하게
 * - 남은 다리 → 연하게
 *
 * 예전에는 첫 다리를 늘 가장 진하게 칠했다. 그래서 첫 경유지를 지나 두 번째 구간을 걷고 있어도
 * 이미 지나온 첫 구간이 가장 눈에 띄고 정작 갈 길이 연했다 — "지금 걷는 다리가 가장 진하다"는
 * 의도와 반대로 동작했다.
 *
 * 색을 여러 가지로 나누지 않고 **한 색의 명도 단계**로 둔다. 지도에는 이미 민트(시설)와
 * 파스텔 레드(경로)가 있어서 주황·파랑을 더하면 무엇이 무엇인지 다시 알 수 없게 된다.
 * 명도 차이는 색을 구분하기 어려운 사용자에게도 남는다.
 *
 * 진행 중인 다리를 모르면 전부 기본 색이다. 경로에서 벗어난 동안이 그렇다 — 어느 다리를 걷는지
 * 말할 근거가 없는데 한 곳을 진하게 칠하면 그 길을 따라 걷게 된다.
 */
function legToneClass(leg: number, activeLeg: number | null): string | undefined {
  if (activeLeg === null) return undefined;
  if (leg < activeLeg) return styles.routePassed;
  if (leg === activeLeg) return styles.routeNear;

  return styles.routeFar;
}

/**
 * 그리는 순서. **지금 걷는 다리를 마지막에** 그린다.
 *
 * 같은 복도를 두 번 지나면 나중에 그린 것이 위에 남는다. 순서를 그대로 두면 흐린 지나온 다리나
 * 연한 남은 다리가 진한 현재 다리를 덮어, 정작 지금 필요한 화살표가 사라진다.
 *
 * 지나온 다리를 가장 아래, 남은 다리를 그 위, 현재 다리를 맨 위에 둔다. 진행 중인 다리를 모르면
 * 순서를 바꿀 이유가 없다.
 *
 * 같은 층 구간 순서는 유지한다 — 한 다리 안에서는 그린 순서가 보이는 결과를 바꾸지 않는다.
 */
function activeLegLast(
  segments: readonly RouteSegment[],
  activeLeg: number | null,
): RouteSegment[] {
  if (activeLeg === null) return [...segments];

  const rank = (leg: number) => (leg === activeLeg ? 2 : leg > activeLeg ? 1 : 0);
  return [...segments].sort((left, right) => rank(left.leg) - rank(right.leg));
}

/** 내 점에서 경로까지 이어 줄 선. `leg`은 닿는 구간의 다리로, 같은 명도로 그리기 위한 값이다. */
interface RouteConnector {
  from: PixelPoint;
  to: PixelPoint;
  leg: number;
}

/**
 * 현재 위치에서 경로까지의 최단 연결.
 *
 * 경로의 **첫 점이 아니라 가장 가까운 점**에 잇는다. 첫 점에 이으면 조금이라도 걸어간 뒤에는
 * 뒤로 향하는 선이 그려져, 이미 지나온 곳으로 돌아가라는 것처럼 보인다. 가장 가까운 점에 이으면
 * 출발할 때는 진입 노드로, 걷는 중에는 발밑의 경로로 이어져 늘 앞을 향한다.
 *
 * **픽셀 좌표에서 계산해도 된다.** `project`가 회전·등비 확대·평행이동뿐이라 거리의 순서가
 * 보존되므로, 미터에서 가장 가까운 점이 픽셀에서도 가장 가깝다. 이 위젯이 미터 프레임을 알지
 * 못하게 두는 편이 좌표 계약이 바뀔 때 안전하다(`project` 주입과 같은 이유다).
 *
 * `minLength`보다 짧으면 그리지 않는다. 그만한 길이는 현재 위치 점 안에 묻혀 보이지 않는데,
 * 요소만 하나 늘어난다.
 */
function routeConnector(
  current: PixelPoint | null,
  segments: readonly RouteSegment[],
  minLength: number,
): RouteConnector | null {
  if (current === null) return null;

  let best: { point: PixelPoint; leg: number; distance: number } | null = null;

  for (const segment of segments) {
    for (let index = 0; index < segment.points.length; index += 1) {
      /* 첫 점은 이을 선분이 없으니 그 점 자체가 후보다. 점이 하나뿐인 구간이 여기 해당한다 —
         그 층에 경로 노드가 하나만 남은 경우이고, 그때 이 선이 그 층의 안내 전부가 된다. */
      const point =
        index === 0
          ? segment.points[0]
          : nearestOnSegment(current, segment.points[index - 1], segment.points[index]);
      const distance = Math.hypot(point.px - current.px, point.py - current.py);
      if (best === null || distance < best.distance) {
        best = { point, leg: segment.leg, distance };
      }
    }
  }

  if (best === null || best.distance < minLength) return null;

  return { from: current, to: best.point, leg: best.leg };
}

/** 선분 위에서 주어진 점에 가장 가까운 지점. 선분 밖으로는 나가지 않는다(끝점으로 잘린다). */
function nearestOnSegment(point: PixelPoint, start: PixelPoint, end: PixelPoint): PixelPoint {
  const dx = end.px - start.px;
  const dy = end.py - start.py;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return start;

  const along = ((point.px - start.px) * dx + (point.py - start.py) * dy) / lengthSq;
  const clamped = Math.min(1, Math.max(0, along));

  return { px: start.px + dx * clamped, py: start.py + dy * clamped };
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
