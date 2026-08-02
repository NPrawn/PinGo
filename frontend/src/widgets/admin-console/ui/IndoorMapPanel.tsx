import { useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAdminFloor,
  deleteAdminFloor,
  getAdminFloorMaps,
  getAdminFloors,
  getAdminStations,
  updateAdminFloor,
  uploadAdminFloorMap,
} from '@/shared/api';
import { floorPlanImageUrl } from '@/entities/floor-map';
import { resolveAssetUrl } from '@/shared/config';
import { Button } from '@/shared/ui';
import styles from './IndoorMapPanel.module.css';

type IndoorMapPanelProps = {
  onFlash: (message: string) => void;
};

/** 실제 역·층·도면 API를 사용하는 관리자 도면 패널. */
export function IndoorMapPanel({ onFlash }: IndoorMapPanelProps) {
  const queryClient = useQueryClient();
  const [stationId, setStationId] = useState<number | null>(null);
  const stationsQuery = useQuery({
    queryKey: ['admin-stations'],
    queryFn: getAdminStations,
  });
  const firstStationId = stationsQuery.data?.find(
    (station) => station.stationId != null,
  )?.stationId;
  const effectiveStationId = stationId ?? firstStationId ?? null;
  const floorsQuery = useQuery({
    queryKey: ['admin-floors', effectiveStationId],
    queryFn: () => getAdminFloors(effectiveStationId!),
    enabled: effectiveStationId != null,
  });
  const mapQueries = useQueries({
    queries: (floorsQuery.data ?? []).map((floor) => ({
      queryKey: ['admin-floor-maps', floor.floorId],
      queryFn: () => getAdminFloorMaps(floor.floorId!),
      enabled: floor.floorId != null,
    })),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['admin-floors', effectiveStationId] });
    await queryClient.invalidateQueries({ queryKey: ['admin-floor-maps'] });
  }

  async function addFloor() {
    if (effectiveStationId == null) return;
    const floorCode = window.prompt('추가할 층 코드(예: B2)를 입력하세요.');
    if (!floorCode?.trim()) return;
    try {
      await createAdminFloor(effectiveStationId, {
        floorCode: floorCode.trim(),
        floorName: floorCode.trim(),
        floorOrder: (floorsQuery.data?.length ?? 0) + 1,
      });
      await refresh();
      onFlash('층을 추가했습니다.');
    } catch {
      onFlash('층을 추가하지 못했습니다.');
    }
  }

  async function editFloor(
    floorId: number,
    currentCode: string,
    currentName: string,
    floorOrder: number,
  ) {
    const floorName = window.prompt('층 표시 이름을 입력하세요.', currentName);
    if (floorName == null) return;
    try {
      await updateAdminFloor(floorId, {
        floorCode: currentCode,
        floorName,
        floorOrder,
      });
      await refresh();
      onFlash('층 정보를 수정했습니다.');
    } catch {
      onFlash('층 정보를 수정하지 못했습니다.');
    }
  }

  async function removeFloor(floorId: number) {
    if (!window.confirm('이 층을 삭제할까요?')) return;
    try {
      await deleteAdminFloor(floorId);
      await refresh();
      onFlash('층을 삭제했습니다.');
    } catch {
      onFlash('지도·시설·경로가 참조 중인 층은 삭제할 수 없습니다.');
    }
  }

  async function uploadMap(floorId: number, file: File) {
    try {
      await uploadAdminFloorMap(floorId, { mapType: 'image' }, file);
      await refresh();
      onFlash('도면을 업로드했습니다.');
    } catch {
      onFlash('도면 업로드에 실패했습니다.');
    }
  }

  /**
   * 표 대신 카드 그리드가 비었을 때 대신 말해 줄 한 줄.
   *
   * 순서가 중요하다. 역 조회가 끝나기 전이거나 역이 하나도 없으면 층 조회는 `enabled: false`라
   * 영원히 pending이므로, 층 상태를 보기 전에 역 상태부터 확정한다.
   */
  const notice = (() => {
    if (stationsQuery.isError) {
      return { text: '역 목록을 불러오지 못했습니다.', retry: () => void stationsQuery.refetch() };
    }
    if (stationsQuery.isPending) return { text: '역 목록을 불러오는 중이에요.', retry: null };
    if (effectiveStationId == null) return { text: '등록된 역이 없어요.', retry: null };
    if (floorsQuery.isError) {
      return { text: '층 목록을 불러오지 못했습니다.', retry: () => void floorsQuery.refetch() };
    }
    if (floorsQuery.isPending) return { text: '층 목록을 불러오는 중이에요.', retry: null };
    if ((floorsQuery.data ?? []).length === 0) {
      return { text: '등록된 층이 없어요. 층을 먼저 추가해 주세요.', retry: null };
    }
    return null;
  })();

  return (
    <>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>실내 지도 관리</h2>
          <p className={styles.desc}>역별 층과 활성 도면 버전을 관리합니다.</p>
        </div>
        <div>
          <select
            value={effectiveStationId ?? ''}
            onChange={(event) => setStationId(Number(event.target.value))}
            aria-label="관리할 역"
          >
            {(stationsQuery.data ?? []).map((station) => (
              <option key={station.stationId} value={station.stationId}>
                {station.nameKo ?? station.nameEn}
              </option>
            ))}
          </select>
          <Button size="sm" className={styles.upload} onClick={() => void addFloor()}>
            + 층 추가
          </Button>
        </div>
      </div>

      {/* 실패·로딩·빈 목록은 서로 다른 상태다. 셋 다 빈 화면이면 원인을 알 수 없다.
          `enabled: false`인 층 조회는 계속 pending이므로 역이 없는 경우를 먼저 걸러낸다. */}
      {notice && (
        <div className={styles.state} role={notice.retry ? 'alert' : undefined}>
          <p className={notice.retry ? styles.stateError : styles.stateText}>{notice.text}</p>
          {notice.retry && (
            <button type="button" className={styles.retry} onClick={notice.retry}>
              다시 시도
            </button>
          )}
        </div>
      )}

      <div className={styles.grid}>
        {(floorsQuery.data ?? []).map((floor, index) => {
          if (floor.floorId == null) return null;
          const maps = mapQueries[index]?.data ?? [];
          const currentMap = maps[0];
          // 백엔드에 올라온 도면이 있으면 그것을, 없으면 FE 번들의 평면도를 쓴다.
          // 역삼역 B1~B3는 좌표 프레임만 등록돼 있어 `mapUrl`이 null이며(V9 seed),
          // 사용자 화면은 이미 같은 폴백을 탄다. 관리자만 빈 카드를 보고 있었다.
          const planUrl = currentMap
            ? floorPlanImageUrl({
                mapUrl: currentMap.mapUrl ?? null,
                floorCode: currentMap.floorCode ?? floor.floorCode ?? '',
              })
            : null;
          return (
            <div key={floor.floorId} className={styles.card}>
              <div className={styles.preview}>
                {planUrl ? (
                  <img
                    src={resolveAssetUrl(planUrl)}
                    alt={`${floor.floorCode ?? ''} 도면`}
                    className={styles.previewSvg}
                  />
                ) : (
                  <div className={styles.previewSvg}>등록된 도면이 없습니다.</div>
                )}
                <span className={styles.floorTag}>{floor.floorCode}</span>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardTitle}>{floor.floorName ?? floor.floorCode}</div>
                <div className={styles.cardMeta}>
                  {currentMap
                    ? `도면 ${maps.length}개 · ${currentMap.version ?? '버전 없음'}`
                    : '등록된 도면 없음'}
                  {currentMap && !currentMap.mapUrl && ' · 기본 도면 표시 중'}
                </div>
                <div className={styles.cardActions}>
                  <label className={`${styles.cardAction} ${styles.cardActionPrimary}`}>
                    도면 업로드
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadMap(floor.floorId!, file);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className={`${styles.cardAction} ${styles.cardActionSecondary}`}
                    onClick={() =>
                      void editFloor(
                        floor.floorId!,
                        floor.floorCode ?? '',
                        floor.floorName ?? '',
                        floor.floorOrder ?? index + 1,
                      )
                    }
                  >
                    이름 수정
                  </button>
                  <button
                    type="button"
                    className={`${styles.cardAction} ${styles.cardActionSecondary}`}
                    onClick={() => void removeFloor(floor.floorId!)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
