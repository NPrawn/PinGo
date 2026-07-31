import { useTranslation } from 'react-i18next';
import { useStationFacilities, type Facility } from '@/entities/facility';
import {
  coordinateFrameOf,
  floorPlanImageUrl,
  meterToPixel,
  MOCK_FLOOR_MAPS,
  useStationFloorMaps,
  type FloorMap,
} from '@/entities/floor-map';
import type { IndoorPoint, RoutePathNode } from '@/entities/navigation';
import { resolveAssetUrl } from '@/shared/config';
import { MOCK_CURRENT_LOCATION, MOCK_DESTINATION, MOCK_PATH_NODES } from '../model/fixtures';
import { useMapGestures } from '../model/useMapGestures';
import { IndoorMapOverlay } from './IndoorMapOverlay';
import styles from './IndoorMapView.module.css';

interface IndoorMapViewProps {
  stationId: number;
  // 표시할 층. 지정하지 않으면 첫 번째 지도를 표시한다. (층 전환 UI는 태스크 280)
  floorId?: number;
  /** 현재 위치. 위치 인식(FR-U-004) 결과를 그대로 받는다. */
  currentLocation?: IndoorPoint | null;
  /**
   * 사용자가 바라보는 방향(도). **지도 미터 프레임 기준**이며 `useXrMapPosition`의
   * `headingDeg`를 그대로 받는다. 이미지 각도 변환은 이 컴포넌트가 한다.
   *
   * null이면 방향을 모르는 것이므로 마커에 방향을 표시하지 않는다.
   */
  currentHeadingDeg?: number | null;
  /** 목적지. 경로 응답의 마지막 노드와 같아도 무방하다. */
  destination?: IndoorPoint | null;
  /** 목적지 마커에 붙일 이름. 넘기지 않으면 점만 그린다. */
  destinationLabel?: string | null;
  /** 경로가 지나는 노드. 경로 응답의 pathNodes를 그대로 받는다. */
  pathNodes?: readonly RoutePathNode[];
  /**
   * 지도에 표시할 시설 유형. 넘기지 않으면 **아무 시설도 그리지 않는다.**
   *
   * 기본을 비워 두는 이유는 밀도다. 역삼역 B2는 실제 240m 폭이 안내 화면에서 287px에 들어가
   * 1m가 1.2px이고, 그 층의 시설 36개를 모두 그리면 마커 간 최소 간격이 3.9px이 되어 서로를
   * 덮는다. 유형을 하나 고르면 많아도 13개(계단)라 겹치지 않는다 — FR-U-006의 점진적 공개다.
   */
  facilityType?: string | null;
  /** 이름을 함께 보여줄 시설. */
  selectedFacilityId?: number | null;
  /** 시설 마커를 눌렀을 때. */
  onSelectFacility?: (facility: Facility) => void;
  /**
   * 백엔드 데이터가 없는 상태에서 화면을 확인하기 위한 목업 모드.
   * 켜면 층별 지도 조회를 건너뛰고, 넘겨받지 않은 오버레이 데이터를 목업으로 채운다.
   *
   * TODO: floor_map seed(FR-A-002)와 경로·위치 API가 연결되면
   * 이 prop과 목업 모듈(entities/floor-map/model/fixtures, ../model/fixtures)을 함께 제거한다.
   */
  useMockData?: boolean;
}

/**
 * 넘겨받지 않은 값만 목업으로 채운다.
 *
 * `undefined`는 "안 넘겼다", `null`은 "표시할 것이 없다"로 구분한다. `??`로 묶으면 둘이 같아져
 * 호출부가 목업을 끌 수 없다.
 */
function mockable<T>(value: T | null | undefined, mock: T, useMockData: boolean): T | null {
  if (value !== undefined) return value;
  return useMockData ? mock : null;
}

function selectFloorMap(maps: readonly FloorMap[], floorId?: number): FloorMap | undefined {
  if (floorId === undefined) return maps[0];
  return maps.find((map) => map.floorId === floorId);
}

/**
 * 특정 역·층의 실내 지도 이미지를 렌더링하고, 그 위에 현재 위치·목적지·경로를 겹쳐 그린다.
 *
 * 지도 이미지는 stage를 채우되 `object-fit: contain`으로 원본 비율을 유지한다.
 * 오버레이 SVG가 같은 박스에 같은 방식으로 여백을 만들기 때문에, 뷰포트 크기와 무관하게
 * 좌표가 도면과 일치한다. 시설·출구 마커(281)도 같은 stage 위에 얹힌다.
 */
export function IndoorMapView({
  stationId,
  floorId,
  currentLocation,
  currentHeadingDeg,
  destination,
  destinationLabel,
  pathNodes,
  facilityType,
  selectedFacilityId,
  onSelectFacility,
  useMockData = false,
}: IndoorMapViewProps) {
  const { t } = useTranslation();
  // 훅 반환값을 그대로 들고 다니면 ref 전달이 나머지 속성 접근까지 오염된 것으로 판정된다.
  const {
    ref: mapRef,
    view: mapView,
    reset: resetMapView,
    isTransformed: mapTransformed,
    handlers: mapHandlers,
  } = useMapGestures();
  // 목업 모드에서는 목업 지도를 쓰므로 조회하지 않는다.
  const query = useStationFloorMaps(stationId, { enabled: !useMockData });

  /**
   * 유형을 고르기 전에는 조회하지 않는다. 그릴 것이 없는데 77건을 받아 둘 이유가 없다.
   *
   * 목업 모드에서도 조회한다 — 시설은 실제 API에만 있고 목업이 없다. 역삼역은 목업 floorId와
   * 실제 floorId가 우연히 같아(B2=1·B3=2·B1=3) 목업 도면 위에도 제 위치에 얹힌다. 목업이
   * 제거되면(297) 이 우연에 의존하지 않는다.
   */
  const facilityQuery = useStationFacilities(stationId, {
    facilityType: facilityType ?? undefined,
    enabled: facilityType != null,
  });

  if (!useMockData) {
    if (query.isPending) {
      return <p className={styles.status}>{t('indoorMap.loading')}</p>;
    }
    if (query.isError) {
      return (
        <p className={styles.status} role="alert">
          {t('indoorMap.error')}
        </p>
      );
    }
  }

  const maps = useMockData ? MOCK_FLOOR_MAPS : (query.data ?? []);
  if (maps.length === 0) {
    return <p className={styles.status}>{t('indoorMap.empty')}</p>;
  }

  const floorMap = selectFloorMap(maps, floorId);
  if (!floorMap) {
    return <p className={styles.status}>{t('indoorMap.floorNotFound')}</p>;
  }

  const planImageUrl = floorPlanImageUrl(floorMap);

  return (
    <div
      className={styles.viewport}
      ref={mapRef}
      {...mapHandlers}
    >
      <div
        className={styles.stage}
        style={{
          transform: `translate(${mapView.x}px, ${mapView.y}px) scale(${mapView.scale})`,
        }}
      >
        {/* 백엔드에 등록된 도면이 없으면 FE가 들고 있는 평면도로 떨어진다(localPlans).
            둘 다 없으면 img를 만들지 않는다 — 빈 src는 깨진 이미지로 보이고, 좌표 오버레이는
            프레임만으로 그려지므로 도면 그림이 없어도 마커 위치는 맞다. */}
        {planImageUrl !== null && (
          <img
            className={styles.image}
            /* 브라우저 기본 이미지 끌기를 막는다. 그것이 시작되면 이후 pointermove가 끊겨
               지도 이동이 첫 이동에서 멈춘다. */
            draggable={false}
            src={resolveAssetUrl(planImageUrl)}
            alt={t('indoorMap.imageAlt', { floorCode: floorMap.floorCode })}
            width={floorMap.width}
            height={floorMap.height}
          />
        )}
        {/* 목업은 **넘겨받지 않은 것만** 채운다. `null`을 넘긴 것은 "표시할 것이 없다"는 뜻이라
            목업으로 대신하지 않는다 — 그러지 않으면 호출부가 목적지 없음을 표현할 수 없고,
            좌표를 모르는 목적지가 목업 자리에 그려져 이름과 다른 곳을 가리킨다. */}
        <MapOverlay
          floorMap={floorMap}
          currentLocation={mockable(currentLocation, MOCK_CURRENT_LOCATION, useMockData)}
          currentHeadingDeg={currentHeadingDeg}
          destination={mockable(destination, MOCK_DESTINATION, useMockData)}
          destinationLabel={destinationLabel}
          pathNodes={pathNodes ?? (useMockData ? MOCK_PATH_NODES : undefined)}
          facilities={facilityQuery.data}
          selectedFacilityId={selectedFacilityId}
          onSelectFacility={onSelectFacility}
          /* 지도가 커져도 마커는 화면상 크기를 유지한다. 확대는 도면을 크게 보려는 조작이고,
             마커까지 커지면 가리는 면적만 늘어난다. */
          viewScale={mapView.scale}
        />
      </div>
      {mapTransformed && (
        <button type="button" className={styles.resetView} onClick={resetMapView}>
          {t('indoorMap.resetView')}
        </button>
      )}
    </div>
  );
}

/**
 * 표시 중인 층의 좌표 프레임을 읽어 오버레이에 변환 함수를 넘긴다.
 * 프레임이 없는 층은 좌표를 이미지 위 어디에 놓아야 할지 알 수 없으므로 오버레이를 생략한다.
 */
function MapOverlay({
  floorMap,
  currentLocation,
  currentHeadingDeg,
  destination,
  destinationLabel,
  pathNodes,
  facilities,
  selectedFacilityId,
  onSelectFacility,
  viewScale,
}: {
  floorMap: FloorMap;
  currentLocation: IndoorPoint | null;
  currentHeadingDeg?: number | null;
  destination: IndoorPoint | null;
  destinationLabel?: string | null;
  pathNodes?: readonly RoutePathNode[];
  facilities?: readonly Facility[];
  selectedFacilityId?: number | null;
  onSelectFacility?: (facility: Facility) => void;
  viewScale: number;
}) {
  const frame = coordinateFrameOf(floorMap);
  if (!frame) return null;

  return (
    <IndoorMapOverlay
      floorId={floorMap.floorId}
      imageWidth={floorMap.width}
      imageHeight={floorMap.height}
      project={(mapX, mapY) => meterToPixel(mapX, mapY, frame)}
      currentLocation={currentLocation}
      /**
       * 미터 프레임 각도를 이미지 각도로 옮긴다.
       *
       * `meterToPixel`이 미터 벡터를 `frame.angleDeg`만큼 회전시키므로, 미터 프레임에서
       * θ인 방향은 이미지에서 `θ + angleDeg`가 된다. 위치와 방향에 같은 회전을 적용해야
       * 마커의 점과 부채꼴이 같은 좌표계를 가리킨다.
       */
      currentHeadingImageDeg={
        typeof currentHeadingDeg === 'number' ? currentHeadingDeg + frame.angleDeg : null
      }
      destination={destination}
      destinationLabel={destinationLabel}
      pathNodes={pathNodes}
      facilities={facilities}
      selectedFacilityId={selectedFacilityId}
      onSelectFacility={onSelectFacility}
      viewScale={viewScale}
    />
  );
}
