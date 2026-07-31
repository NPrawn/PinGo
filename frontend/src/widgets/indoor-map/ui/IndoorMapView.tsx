import { useTranslation } from 'react-i18next';
import {
  coordinateFrameOf,
  meterToPixel,
  MOCK_FLOOR_MAPS,
  useStationFloorMaps,
  type FloorMap,
} from '@/entities/floor-map';
import type { IndoorPoint, RoutePathNode } from '@/entities/navigation';
import { resolveAssetUrl } from '@/shared/config';
import { MOCK_CURRENT_LOCATION, MOCK_DESTINATION, MOCK_PATH_NODES } from '../model/fixtures';
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
   * 백엔드 데이터가 없는 상태에서 화면을 확인하기 위한 목업 모드.
   * 켜면 층별 지도 조회를 건너뛰고, 넘겨받지 않은 오버레이 데이터를 목업으로 채운다.
   *
   * TODO: floor_map seed(FR-A-002)와 경로·위치 API가 연결되면
   * 이 prop과 목업 모듈(entities/floor-map/model/fixtures, ../model/fixtures)을 함께 제거한다.
   */
  useMockData?: boolean;
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
  useMockData = false,
}: IndoorMapViewProps) {
  const { t } = useTranslation();
  // 목업 모드에서는 목업 지도를 쓰므로 조회하지 않는다.
  const query = useStationFloorMaps(stationId, { enabled: !useMockData });

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

  return (
    <div className={styles.viewport}>
      <div className={styles.stage}>
        {/* 도면 이미지가 아직 업로드되지 않은 층은 mapUrl이 null이다(FR-A-002 대기).
            그 경우 img를 만들지 않는다 — 빈 src는 깨진 이미지로 보이고, 좌표 오버레이는
            프레임만으로 그려지므로 도면 그림이 없어도 마커 위치는 맞다. */}
        {floorMap.mapUrl !== null && (
          <img
            className={styles.image}
            src={resolveAssetUrl(floorMap.mapUrl)}
            alt={t('indoorMap.imageAlt', { floorCode: floorMap.floorCode })}
            width={floorMap.width}
            height={floorMap.height}
          />
        )}
        <MapOverlay
          floorMap={floorMap}
          currentLocation={currentLocation ?? (useMockData ? MOCK_CURRENT_LOCATION : null)}
          currentHeadingDeg={currentHeadingDeg}
          destination={destination ?? (useMockData ? MOCK_DESTINATION : null)}
          destinationLabel={destinationLabel}
          pathNodes={pathNodes ?? (useMockData ? MOCK_PATH_NODES : undefined)}
        />
        {/* 시설·출구 마커(281)가 이 stage 위에 추가된다. */}
      </div>
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
}: {
  floorMap: FloorMap;
  currentLocation: IndoorPoint | null;
  currentHeadingDeg?: number | null;
  destination: IndoorPoint | null;
  destinationLabel?: string | null;
  pathNodes?: readonly RoutePathNode[];
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
    />
  );
}
