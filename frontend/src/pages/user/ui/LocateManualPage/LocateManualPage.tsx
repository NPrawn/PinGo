import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { useUserSessionStore } from '@/entities/user-session';
import { ConsultCta } from '@/features/consult-request';
import { getStationFacilities, getStationMaps, updateUserSession } from '@/shared/api';
import { resolveAssetUrl, USER_ROUTES } from '@/shared/config';
import type { FloorId } from '@/shared/types';
import { BackLink, Button, Icon, MapPreview, PillButton, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './LocateManualPage.module.css';

const SUPPORTED_FLOORS = new Set<FloorId>(['1F', 'B1', 'B2', 'B3']);

function asFloorId(value?: string): FloorId | null {
  return value && SUPPORTED_FLOORS.has(value as FloorId) ? (value as FloorId) : null;
}

function markerPosition(
  value: number | undefined,
  pixels: number | undefined,
  scale: number | undefined,
) {
  if (value == null || pixels == null || scale == null || pixels <= 0 || scale <= 0) return '50%';
  return `${Math.min(96, Math.max(4, (value / (pixels * scale)) * 100))}%`;
}

/** 실제 층 지도와 시설 데이터를 이용해 현재 위치의 경로 노드를 선택한다. */
export function LocateManualPage() {
  const navigate = useNavigate();
  const stationId = useStationStore((state) => state.stationId);
  const floor = useStationStore((state) => state.floor);
  const setFloor = useStationStore((state) => state.setFloor);
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const setCurrentLocation = useNavigationStore((state) => state.setCurrentLocation);
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);

  const mapsQuery = useQuery({
    queryKey: ['station-maps', stationId],
    queryFn: () => getStationMaps(stationId!),
    // 등록되지 않은 역은 층별 지도가 없다.
    enabled: stationId != null,
  });
  const selectedMap = useMemo(
    () => mapsQuery.data?.find((map) => map.floorCode === floor) ?? mapsQuery.data?.[0],
    [floor, mapsQuery.data],
  );
  const facilitiesQuery = useQuery({
    queryKey: ['station-facilities', stationId, selectedMap?.floorId],
    queryFn: () => getStationFacilities(stationId!, { floorId: selectedMap!.floorId }),
    enabled: stationId != null && selectedMap?.floorId != null,
  });
  const facilities = (facilitiesQuery.data ?? []).filter(
    (facility) => facility.facilityId != null && facility.linkedNodeId != null,
  );
  const selectedFacility = facilities.find(
    (facility) => facility.facilityId === selectedFacilityId,
  );

  async function confirmLocation() {
    if (
      !selectedFacility ||
      selectedFacility.linkedNodeId == null ||
      selectedFacility.floorId == null
    ) {
      return;
    }
    setCurrentLocation({
      nodeId: selectedFacility.linkedNodeId,
      floorId: selectedFacility.floorId,
      label: selectedFacility.nameKo ?? selectedFacility.nameEn,
      mapX: selectedFacility.mapX,
      mapY: selectedFacility.mapY,
    });
    if (userSessionId) {
      await updateUserSession(userSessionId, { currentNodeId: selectedFacility.linkedNodeId });
    }
    navigate(USER_ROUTES.LOCATE_SUCCESS);
  }

  return (
    <PhoneFrame>
      <div className={styles.headerBar}>
        <BackLink to={USER_ROUTES.LOCATE_FAILED}>뒤로</BackLink>
        <ConsultCta variant="icon" />
      </div>
      <Title>
        지도에서 현재
        <br />
        위치를 선택해 주세요
      </Title>
      <Sub>가까이에 보이는 시설을 선택하면 해당 경로 노드로 위치를 확정합니다.</Sub>

      <div className={styles.floors}>
        {(mapsQuery.data ?? []).map((map) => {
          const floorId = asFloorId(map.floorCode);
          if (!floorId) return null;
          return (
            <PillButton
              key={map.floorId}
              on={floor === floorId}
              onClick={() => {
                setFloor(floorId);
                setSelectedFacilityId(null);
              }}
            >
              {map.floorCode}
            </PillButton>
          );
        })}
      </div>

      <MapPreview className={styles.map}>
        {selectedMap?.mapUrl ? (
          <img
            className={styles.mapImage}
            src={resolveAssetUrl(selectedMap.mapUrl)}
            alt={`${selectedMap.floorCode ?? ''} 실내 지도`}
          />
        ) : (
          <div className={styles.mapStatus}>
            {mapsQuery.isError ? '지도를 불러오지 못했습니다.' : '지도를 불러오는 중입니다.'}
          </div>
        )}

        <div className={styles.floorBadge}>{selectedMap?.floorCode ?? floor}</div>
        {facilities.map((facility) => {
          const selected = facility.facilityId === selectedFacilityId;
          return (
            <button
              key={facility.facilityId}
              type="button"
              className={[styles.marker, selected && styles.markerSelected]
                .filter(Boolean)
                .join(' ')}
              style={{
                left: markerPosition(facility.mapX, selectedMap?.width, selectedMap?.scaleMPerPx),
                top: markerPosition(facility.mapY, selectedMap?.height, selectedMap?.scaleMPerPx),
              }}
              onClick={() => setSelectedFacilityId(facility.facilityId ?? null)}
              aria-pressed={selected}
            >
              <span className={styles.markerIcon}>
                <Icon name={facility.facilityType === 'elevator' ? 'elevator' : 'pin'} size={16} />
              </span>
              <span className={styles.markerLabel}>
                {facility.nameKo ?? facility.nameEn ?? '시설'}
              </span>
            </button>
          );
        })}
      </MapPreview>

      <p className={styles.hint}>
        {facilitiesQuery.isError
          ? '시설 정보를 불러오지 못했습니다.'
          : selectedFacility
            ? `${selectedFacility.nameKo ?? selectedFacility.nameEn}을(를) 선택했습니다.`
            : '지도에 표시된 시설을 하나 선택해 주세요.'}
      </p>
      <div className={styles.actions}>
        <Button className={styles.confirm} disabled={!selectedFacility} onClick={confirmLocation}>
          이 위치로 확정
        </Button>
      </div>
    </PhoneFrame>
  );
}
