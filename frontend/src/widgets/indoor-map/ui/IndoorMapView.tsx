import { useTranslation } from 'react-i18next';
import { useStationFacilities, type Facility } from '@/entities/facility';
import {
  floorPlanImageUrl,
  meterToPixel,
  MOCK_FLOOR_MAPS,
  PLAN_CANVAS,
  PLAN_REFERENCE,
  planPlacementOf,
  useStationFloorMaps,
  type FloorMap,
  type PlanPlacement,
} from '@/entities/floor-map';
import type { IndoorPoint, RoutePathNode } from '@/entities/navigation';
import { resolveAssetUrl } from '@/shared/config';
import { Icon } from '@/shared/ui';
import { MOCK_CURRENT_LOCATION, MOCK_DESTINATION, MOCK_PATH_NODES } from '../model/fixtures';
import { useMapGestures } from '../model/useMapGestures';
import { useSmoothedRotationDeg } from '../model/useSmoothedRotation';
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
  /** 경유지 노드. 경로에 실어 보낸 순서 그대로 넘긴다 — 다리별 색과 번호 핀에 쓰인다. */
  waypointNodeIds?: readonly number[];
  /** 지금 걷고 있는 다리(0이 출발 → 첫 경유지). 다리별 명도를 정한다. */
  activeLeg?: number | null;
  /**
   * 현재 위치와 경로 사이의 빈 자리를 이을지. 기본은 잇지 않는다.
   *
   * 경로선은 그래프 노드에서 시작하고 내 점은 실제 좌표에 있어 둘이 떨어져 보인다. 서버가 진입
   * 노드를 다시 고르면 그 간격이 수십 m가 될 수 있고, 그 층에 남는 경로 노드가 하나뿐이면 이 선이
   * 그 층 안내의 전부가 된다.
   *
   * 안내 화면에서만 켠다. 둘러보기·상담 공유 지도의 경로는 내 위치에서 출발하는 것이 아니다.
   */
  connectCurrentToRoute?: boolean;
  /**
   * 지도에 표시할 시설 유형. 넘기지 않으면 **아무 시설도 그리지 않는다.**
   *
   * 기본을 비워 두는 이유는 밀도다. 역삼역 B2는 실제 240m 폭이 안내 화면에서 287px에 들어가
   * 1m가 1.2px이고, 그 층의 시설 36개를 모두 그리면 마커 간 최소 간격이 3.9px이 되어 서로를
   * 덮는다. 유형을 하나 고르면 많아도 13개(계단)라 겹치지 않는다 — FR-U-006의 점진적 공개다.
   */
  facilityType?: string | null;
  /**
   * `facilityType`이 없을 때 **표시 층의 시설을 모두** 그린다. 기본은 아무것도 그리지 않는다.
   *
   * 안내 화면이 이걸 켠다. 무엇이 어디에 있는지 먼저 보여 준 다음 유형으로 좁히는 흐름이라,
   * 아무것도 없는 지도에서 시작하지 않는다. 대신 위 밀도 계산이 그대로 적용되므로 마커가
   * 서로 겹친다 — 훑어보는 용도이고, 고르려면 유형을 켜야 한다.
   */
  showAllFacilities?: boolean;
  /** 이름을 함께 보여줄 시설. */
  selectedFacilityId?: number | null;
  /** 시설 마커를 눌렀을 때. */
  onSelectFacility?: (facility: Facility) => void;
  /**
   * 시점이 현재 위치를 따라가게 한다. 길안내 화면용이다.
   *
   * 켜면 전체 조망 대신 내 주변 60m를 화면 아래쪽 기준으로 보여준다. 지도를 밀거나 확대하면
   * 추종이 풀려 전체까지 자유롭게 볼 수 있고, `내 위치` 버튼으로 되돌아온다.
   *
   * 지도를 훑어보는 화면(`/user/map`)에서는 꺼 둔다 — 거기서는 조망이 목적이다.
   */
  followCamera?: boolean;
  /**
   * 진행 방향이 화면 위를 향하도록 **지도를 돌릴지**. 기본은 돌린다.
   *
   * `followCamera`가 켜져 있을 때만 뜻이 있다. 추종은 그대로 두고 회전만 끄는 자리다.
   *
   * 끄는 쪽은 상담자 화면이다. 상담자는 사용자를 따라가며 봐야 하지만 자기 화면까지 같이 돌면
   * 도면을 읽을 수 없다 — 역 구조를 아는 사람이 방향을 잡는 기준은 도면의 고정된 방위다.
   * 회전을 끄면 지도는 북쪽 고정이고 **마커의 방향 부채꼴만 돈다**(`currentHeadingImageDeg`는
   * 지도 회전과 무관하게 계산된다). 사용자가 어디를 보고 있는지는 그대로 전달된다.
   */
  rotateWithHeading?: boolean;
  /**
   * `내 위치` 버튼을 눌렀을 때. 시점 복귀는 위젯이 하고, **층 되돌리기는 여기서** 한다.
   *
   * 표시 층은 화면이 들고 있다(안내 화면의 층 버튼). 위젯이 시점만 되돌리면 다른 층을 보던
   * 사용자는 그 층 지도가 자기 좌표로 옮겨진 것만 보게 되고, 정작 마커는 다른 층이라 그려지지
   * 않는다. 내 위치로 가는 버튼을 눌렀는데 내 위치가 화면에 없는 상태가 된다.
   */
  onRecenter?: () => void;
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
 * 시점 추종이 화면 가로에 담을 캔버스 픽셀. 60m에 해당한다(기준 프레임 mpp 0.19).
 *
 * 전체 조망은 화면 폭에 320m가 들어가 1m가 1화면px이 채 안 된다. 20m를 걸어도 19px밖에
 * 움직이지 않아 이동하고 있다는 것이 보이지 않는다. 60m로 좁히면 같은 20m가 100px 넘게
 * 움직인다 — 내비게이션이 걷기 안내에서 쓰는 범위다.
 */
const FOLLOW_SPAN_PX = 60 / 0.19;

/** 내 위치를 화면 세로 68% 지점에 둔다. 위쪽 3분의 2를 진행 방향에 내주는 배치다. */
const FOLLOW_ANCHOR_Y = 0.68;

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
  waypointNodeIds,
  activeLeg,
  connectCurrentToRoute = false,
  facilityType,
  showAllFacilities = false,
  selectedFacilityId,
  onSelectFacility,
  followCamera = false,
  rotateWithHeading = true,
  onRecenter,
  useMockData = false,
}: IndoorMapViewProps) {
  const { t } = useTranslation();

  /**
   * 시점 추종의 목표. 현재 위치를 표시 캔버스 좌표로 옮긴 값이다.
   *
   * 층 판정은 하지 않는다. 세 층이 같은 기준 캔버스에 얹혀 있어(`planPlacementOf`) 좌표만으로
   * 목표가 정해지고, 층이 다른지는 `onOtherFloor`가 따로 판단해 복귀 버튼으로 알린다.
   */
  const followTarget =
    followCamera && currentLocation
      ? meterToPixel(currentLocation.mapX, currentLocation.mapY, PLAN_REFERENCE.frame)
      : null;

  /**
   * 진행 방향이 화면 위를 향하도록 지도를 돌릴 각도.
   *
   * 방향각은 미터 프레임 기준이라 먼저 캔버스 기준으로 옮긴다(`+ angleDeg`). 캔버스에서
   * 0도는 오른쪽이고 위는 -90도이므로, 방향각 φ를 위로 세우려면 `-90 - φ`만큼 돌린다.
   *
   * 방향을 모르면 돌리지 않는다 — 0으로 채우면 북쪽 고정과 구분되지 않는다.
   *
   * `rotateWithHeading`을 끈 화면은 방향을 알아도 돌리지 않는다. 추종(`followTarget`)은 위에서
   * 따로 정하므로, 사용자를 화면 가운데 붙들어 둔 채 도면 방위만 고정된다.
   */
  const targetRotationDeg =
    followCamera && rotateWithHeading && typeof currentHeadingDeg === 'number'
      ? -90 - (currentHeadingDeg + PLAN_REFERENCE.frame.angleDeg)
      : null;

  /**
   * 방향은 5° 데드밴드로 걸러진 계단으로 들어오고, 부호가 ±180°에서 뒤집힌다. 그대로 지도에
   * 걸면 5.4배로 당겨진 화면이 계단마다 튀고, 경계에서는 한 바퀴 돈다. 각도를 이어 붙이고
   * 완만하게 편 값을 쓴다.
   */
  const mapRotationDeg = useSmoothedRotationDeg(targetRotationDeg);

  // 훅 반환값을 그대로 들고 다니면 ref 전달이 나머지 속성 접근까지 오염된 것으로 판정된다.
  const {
    ref: mapRef,
    view: mapView,
    reset: resetMapView,
    isFollowing: mapFollowing,
    isTransformed: mapTransformed,
    handlers: mapHandlers,
  } = useMapGestures({
    target: followTarget,
    canvas: PLAN_CANVAS,
    spanPx: FOLLOW_SPAN_PX,
    anchorY: FOLLOW_ANCHOR_Y,
    rotationDeg: mapRotationDeg,
  });
  // 목업 모드에서는 목업 지도를 쓰므로 조회하지 않는다.
  const query = useStationFloorMaps(stationId, { enabled: !useMockData });

  /**
   * 그릴 것이 없으면 조회하지 않는다. 유형도 고르지 않고 전부 보여 주지도 않는 화면에서
   * 77건을 받아 둘 이유가 없다.
   *
   * 층으로 좁히지 않는다. 역 하나의 시설은 수십 건이라 한 번에 받아도 부담이 없고, 층마다
   * 좁히면 층을 오갈 때마다 다시 받는다(`useStationFacilities`). 다른 층 것은 오버레이가
   * 걸러 낸다.
   *
   * 목업 모드에서도 조회한다 — 시설은 실제 API에만 있고 목업이 없다. 역삼역은 목업 floorId와
   * 실제 floorId가 우연히 같아(B2=1·B3=2·B1=3) 목업 도면 위에도 제 위치에 얹힌다. 목업이
   * 제거되면(297) 이 우연에 의존하지 않는다.
   */
  const wantsFacilities = facilityType != null || showAllFacilities;
  const facilityQuery = useStationFacilities(stationId, {
    facilityType: facilityType ?? undefined,
    enabled: wantsFacilities,
  });
  /**
   * 조회를 꺼도 캐시에 남은 목록은 그대로 돌아온다.
   *
   * 같은 키를 다른 화면이 이미 받아 두었으면 `enabled: false`가 데이터를 비워 주지 않는다.
   * 그리지 않기로 한 상태에서 마커가 남지 않도록 여기서 한 번 더 끊는다.
   */
  const facilities = wantsFacilities ? facilityQuery.data : undefined;

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
  const placement = planPlacementOf(floorMap);
  const imageAlt = t('indoorMap.imageAlt', { floorCode: floorMap.floorCode });

  /**
   * 내가 있는 층이 아닌 곳을 보고 있는지.
   *
   * 이때는 오버레이가 내 위치 마커를 그리지 않는다(다른 층 좌표라 걸러진다). 시점만 되돌려 봐야
   * 아무것도 나타나지 않으므로, 복귀 버튼을 띄워 층까지 함께 되돌릴 수 있게 한다.
   */
  const onOtherFloor = currentLocation != null && currentLocation.floorId !== floorMap.floorId;

  /**
   * 모든 층의 도면을 한 번에 올려 두고 표시 층만 드러낸다.
   *
   * 층을 바꿀 때 그림이 순간적으로 갈아치워지면 튀어 보인다. 실제로 바뀌는 것은 층 구조라
   * 없앨 수 없는 차이지만(지도 패널 기준 9~10%, 그중 95% 이상이 도면), 짧게 겹쳐 넘기면
   * 스냅이 아니라 디졸브로 읽힌다.
   *
   * 도면을 전처리해 장당 50KB가 되었으므로 세 층을 다 올려도 154KB다. 미리 올려 두는 김에
   * 디코딩 지연도 없앤다.
   */
  const planLayers = maps
    .map((map) => ({ map, url: floorPlanImageUrl(map), placement: planPlacementOf(map) }))
    .filter(
      (layer): layer is { map: FloorMap; url: string; placement: PlanPlacement } =>
        layer.url !== null && layer.placement !== null,
    );

  return (
    <div className={styles.viewport} ref={mapRef} {...mapHandlers}>
      <div
        className={styles.stage}
        style={{
          /* 회전을 확대보다 바깥에 둔다. 안쪽에 두면 회전이 확대된 좌표계에서 일어나
             내 위치를 축으로 돌지 않는다. */
          transform: `translate(${mapView.x}px, ${mapView.y}px) rotate(${mapView.rotation}deg) scale(${mapView.scale})`,
        }}
      >
        {/* 백엔드에 등록된 도면이 없으면 FE가 들고 있는 평면도로 떨어진다(localPlans).
            둘 다 없으면 아무것도 만들지 않는다 — 빈 src는 깨진 이미지로 보이고, 좌표 오버레이는
            프레임만으로 그려지므로 도면 그림이 없어도 마커 위치는 맞다. */}
        {planImageUrl !== null &&
          (placement ? (
            /* 도면을 **기준 캔버스**에 얹는다. 층마다 캔버스 크기가 달라(1626×967 · 1624×969 ·
               1659×948) 각자 contain으로 맞추면 이미지→화면 배율이 층마다 2.2% 어긋나고, 층을
               바꿀 때 역사 전체가 커졌다 작아졌다 한다. 오버레이와 같은 viewBox를 쓰므로 둘의
               맞춤 방식도 자동으로 일치한다. */
            <svg
              className={styles.image}
              viewBox={`0 0 ${PLAN_CANVAS.width} ${PLAN_CANVAS.height}`}
              role="img"
              aria-label={imageAlt}
            >
              {planLayers.map((layer) => (
                <image
                  key={layer.map.floorId}
                  className={styles.planLayer}
                  href={resolveAssetUrl(layer.url)}
                  x={0}
                  y={0}
                  width={layer.placement.width}
                  height={layer.placement.height}
                  transform={layer.placement.transform}
                  opacity={layer.map.floorId === floorMap.floorId ? 1 : 0}
                />
              ))}
            </svg>
          ) : (
            /* 프레임을 모르는 층. 도면을 기준 캔버스 어디에 놓을지 정할 수 없으므로 상자에만
               맞춰 보여준다. 이 경우 오버레이도 그리지 않는다. */
            <img
              className={styles.image}
              /* 브라우저 기본 이미지 끌기를 막는다. 그것이 시작되면 이후 pointermove가 끊겨
                 지도 이동이 첫 이동에서 멈춘다. */
              draggable={false}
              src={resolveAssetUrl(planImageUrl)}
              alt={imageAlt}
              width={floorMap.width}
              height={floorMap.height}
            />
          ))}
        {/* 목업은 **넘겨받지 않은 것만** 채운다. `null`을 넘긴 것은 "표시할 것이 없다"는 뜻이라
            목업으로 대신하지 않는다 — 그러지 않으면 호출부가 목적지 없음을 표현할 수 없고,
            좌표를 모르는 목적지가 목업 자리에 그려져 이름과 다른 곳을 가리킨다. */}
        <MapOverlay
          floorId={floorMap.floorId}
          placement={placement}
          currentLocation={mockable(currentLocation, MOCK_CURRENT_LOCATION, useMockData)}
          currentHeadingDeg={currentHeadingDeg}
          destination={mockable(destination, MOCK_DESTINATION, useMockData)}
          destinationLabel={destinationLabel}
          pathNodes={pathNodes ?? (useMockData ? MOCK_PATH_NODES : undefined)}
          waypointNodeIds={waypointNodeIds}
          activeLeg={activeLeg}
          connectCurrentToRoute={connectCurrentToRoute}
          facilities={facilities}
          selectedFacilityId={selectedFacilityId}
          onSelectFacility={onSelectFacility}
          /* 지도가 커져도 마커는 화면상 크기를 유지한다. 확대는 도면을 크게 보려는 조작이고,
             마커까지 커지면 가리는 면적만 늘어난다. */
          viewScale={mapView.scale}
          /* 이름표와 아이콘을 되돌려 세우는 데 쓴다. 점·선은 지도와 함께 돌아야 맞다. */
          mapRotationDeg={mapView.rotation}
        />
      </div>
      {/* 추종 중이고 내 층을 보고 있으면 버튼이 필요 없다. 손으로 둘러보거나 다른 층으로 넘어간
          뒤에만 돌아갈 곳을 제시한다.

          **층만 넘긴 경우에도 보여야 한다.** 지도를 밀지 않았으면 추종은 그대로 켜져 있어서,
          예전에는 다른 층에서 버튼이 아예 나타나지 않았다. 내 층으로 돌아올 방법이 층 버튼을
          직접 다시 누르는 것뿐이었고, 어느 층에 있었는지는 화면에 적혀 있지 않다.

          글자 대신 아이콘으로 둔다 — 지도를 가리는 면적이 줄고, 내비게이션의 통례다.
          이름은 화면에 보이지 않으므로 aria-label로만 남긴다. */}
      {(followTarget ? !mapFollowing || onOtherFloor : mapTransformed) && (
        <button
          type="button"
          className={styles.resetView}
          onClick={() => {
            resetMapView();
            onRecenter?.();
          }}
          aria-label={t(followTarget ? 'indoorMap.recenter' : 'indoorMap.resetView')}
        >
          <Icon name={followTarget ? 'target' : 'refresh'} size={18} />
        </button>
      )}
    </div>
  );
}

/**
 * 오버레이를 **기준 캔버스** 좌표계로 그린다.
 *
 * 층별 프레임을 쓰지 않는다. 도면이 이미 `planPlacementOf`로 기준 캔버스에 옮겨져 있으므로,
 * 좌표 변환도 기준 프레임 하나만 쓰면 어느 층에서든 같은 미터 좌표가 화면의 같은 점으로 간다.
 * 층마다 다른 프레임으로 그리면 도면과 마커가 서로 다른 공간에 놓여 어긋난다.
 *
 * 도면을 기준 캔버스에 놓을 수 없는 층(프레임 결손)은 `placement`가 null이다. 그 층은 좌표를
 * 어디에 찍어야 할지 알 수 없으므로 오버레이를 생략한다.
 */
function MapOverlay({
  floorId,
  placement,
  currentLocation,
  currentHeadingDeg,
  destination,
  destinationLabel,
  pathNodes,
  waypointNodeIds,
  activeLeg,
  connectCurrentToRoute,
  facilities,
  selectedFacilityId,
  onSelectFacility,
  viewScale,
  mapRotationDeg,
}: {
  floorId: number;
  placement: PlanPlacement | null;
  currentLocation: IndoorPoint | null;
  currentHeadingDeg?: number | null;
  destination: IndoorPoint | null;
  destinationLabel?: string | null;
  pathNodes?: readonly RoutePathNode[];
  waypointNodeIds?: readonly number[];
  /** 지금 걷고 있는 다리(0이 출발 → 첫 경유지). 다리별 명도를 정한다. */
  activeLeg?: number | null;
  /** 현재 위치와 경로 사이를 이을지. 경로에서 벗어난 동안에는 켜지 않는다. */
  connectCurrentToRoute?: boolean;
  facilities?: readonly Facility[];
  selectedFacilityId?: number | null;
  onSelectFacility?: (facility: Facility) => void;
  viewScale: number;
  mapRotationDeg: number;
}) {
  if (!placement) return null;

  const frame = PLAN_REFERENCE.frame;

  return (
    <IndoorMapOverlay
      floorId={floorId}
      imageWidth={PLAN_CANVAS.width}
      imageHeight={PLAN_CANVAS.height}
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
      waypointNodeIds={waypointNodeIds}
      activeLeg={activeLeg}
      connectCurrentToRoute={connectCurrentToRoute}
      facilities={facilities}
      selectedFacilityId={selectedFacilityId}
      onSelectFacility={onSelectFacility}
      viewScale={viewScale}
      mapRotationDeg={mapRotationDeg}
    />
  );
}
