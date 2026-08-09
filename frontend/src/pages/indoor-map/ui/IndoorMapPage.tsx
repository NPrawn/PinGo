import { useSearchParams } from 'react-router-dom';
import type { IndoorPoint } from '@/entities/navigation';
import { IndoorMapView } from '@/widgets/indoor-map';
import styles from './IndoorMapPage.module.css';

function parsePositiveInt(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/** 지도 좌표는 음수·소수를 모두 가질 수 있어 부호 있는 실수로 읽는다. */
function parseFiniteFloat(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * 쿼리 파라미터로 받은 현재 위치. 오버레이가 하드코딩된 값이 아니라
 * 외부에서 넘어온 좌표를 그대로 표시하는지 확인하는 용도다.
 *
 * x·y가 모두 있어야 위치로 인정한다. floor를 생략하면 표시 중인 층으로 본다.
 *
 * TODO: 위치 인식(FR-U-004) API가 연결되면 이 파라미터를 제거하고
 * 그 응답을 currentLocation으로 넘긴다.
 */
function parseCurrentLocation(
  searchParams: URLSearchParams,
  displayedFloorId: number | undefined,
): IndoorPoint | undefined {
  const mapX = parseFiniteFloat(searchParams.get('x'));
  const mapY = parseFiniteFloat(searchParams.get('y'));
  if (mapX === undefined || mapY === undefined) return undefined;

  // 층을 안 넘기면 지금 보고 있는 층에 찍는다. 층 지정도 없으면 첫 번째 지도(목업 B2)다.
  const floorId = parsePositiveInt(searchParams.get('floor')) ?? displayedFloorId ?? 1;
  return { floorId, mapX, mapY };
}

/**
 * 실내 지도 화면. stationId, floorId를 쿼리 파라미터로 받는다.
 * 예: /user/map?stationId=1&floorId=2
 * stationId가 없으면 백엔드 확인 편의를 위해 1을 기본값으로 사용한다.
 * (역 선택 UI는 별도 스토리이므로 여기서는 파라미터로만 받는다.)
 *
 * 확인용 파라미터 (TODO: 백엔드 지도·위치 API가 연결되면 제거한다)
 * - `mock=1` 목업 지도·위치·경로로 오버레이를 표시한다
 *   예: /user/map?mock=1 (B2) · /user/map?mock=1&floorId=2 (B3)
 * - `x`, `y`, `floor` 현재 위치를 직접 지정한다. 목업 위치보다 우선한다
 *   예: /user/map?mock=1&x=-58.4&y=42.5
 * - `follow=1` 길안내 화면과 같은 시점 추종을 켠다
 * - `heading` 진행 방향(도, 미터 프레임 기준). 추종 중이면 그 방향이 화면 위로 온다
 *   예: /user/map?mock=1&x=0&y=0&follow=1&heading=30
 *
 *   방향은 XR에서만 나오므로 기기 없이 회전을 확인할 방법이 이것뿐이다.
 */
export function IndoorMapPage() {
  const [searchParams] = useSearchParams();
  const stationId = parsePositiveInt(searchParams.get('stationId')) ?? 1;
  const floorId = parsePositiveInt(searchParams.get('floorId'));
  const useMockData = searchParams.get('mock') === '1';
  const currentLocation = parseCurrentLocation(searchParams, floorId);
  const followCamera = searchParams.get('follow') === '1';
  const currentHeadingDeg = parseFiniteFloat(searchParams.get('heading')) ?? null;

  return (
    <main className={styles.page}>
      <IndoorMapView
        stationId={stationId}
        floorId={floorId}
        currentLocation={currentLocation}
        currentHeadingDeg={currentHeadingDeg}
        followCamera={followCamera}
        useMockData={useMockData}
      />
    </main>
  );
}
