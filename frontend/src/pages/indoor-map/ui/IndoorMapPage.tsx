import { useSearchParams } from 'react-router-dom';
import { IndoorMapView } from '@/widgets/indoor-map';
import styles from './IndoorMapPage.module.css';

function parsePositiveInt(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * 실내 지도 화면. stationId, floorId를 쿼리 파라미터로 받는다.
 * 예: /user/map?stationId=1&floorId=2
 * stationId가 없으면 백엔드 확인 편의를 위해 1을 기본값으로 사용한다.
 * (역 선택 UI는 별도 스토리이므로 여기서는 파라미터로만 받는다.)
 */
export function IndoorMapPage() {
  const [searchParams] = useSearchParams();
  const stationId = parsePositiveInt(searchParams.get('stationId')) ?? 1;
  const floorId = parsePositiveInt(searchParams.get('floorId'));

  return (
    <main className={styles.page}>
      <IndoorMapView stationId={stationId} floorId={floorId} />
    </main>
  );
}
