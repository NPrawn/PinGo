import { useTranslation } from 'react-i18next';
import { useStationFloorMaps, type FloorMap } from '@/entities/floor-map';
import { resolveAssetUrl } from '@/shared/config';
import styles from './IndoorMapView.module.css';

interface IndoorMapViewProps {
  stationId: number;
  // 표시할 층. 지정하지 않으면 첫 번째 지도를 표시한다. (층 전환 UI는 태스크 280)
  floorId?: number;
}

function selectFloorMap(maps: FloorMap[], floorId?: number): FloorMap | undefined {
  if (floorId === undefined) return maps[0];
  return maps.find((map) => map.floorId === floorId);
}

/**
 * 특정 역·층의 실내 지도 이미지를 렌더링한다.
 * 이미지는 원본 width/height를 고유 비율로 삼아, 뷰포트 크기와 무관하게
 * 비율을 유지한 채 화면 안에 맞춰진다.
 * 시설·출구 마커(281)와 현재 위치·경로 오버레이(282)는 stage 위에 얹힌다.
 */
export function IndoorMapView({ stationId, floorId }: IndoorMapViewProps) {
  const { t } = useTranslation();
  const { data: maps, isPending, isError } = useStationFloorMaps(stationId);

  if (isPending) {
    return <p className={styles.status}>{t('indoorMap.loading')}</p>;
  }
  if (isError) {
    return (
      <p className={styles.status} role="alert">
        {t('indoorMap.error')}
      </p>
    );
  }
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
        <img
          className={styles.image}
          src={resolveAssetUrl(floorMap.mapUrl)}
          alt={t('indoorMap.imageAlt', { floorCode: floorMap.floorCode })}
          width={floorMap.width}
          height={floorMap.height}
        />
        {/* 마커(281) / 경로·현재 위치(282) 오버레이가 이 stage 위에 추가된다. */}
      </div>
    </div>
  );
}
