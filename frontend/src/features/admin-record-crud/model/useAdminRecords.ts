import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAdminFacility,
  createAdminNearbyPlace,
  createAdminPlaceExitRecommendation,
  createAdminRouteEdge,
  createAdminRouteNode,
  createAdminStation,
  deactivateAdminCounselor,
  deleteAdminFacility,
  deleteAdminNearbyPlace,
  deleteAdminPlaceExitRecommendation,
  deleteAdminRouteEdge,
  deleteAdminRouteNode,
  deleteAdminStation,
  getAdminCounselors,
  getAdminCounselor,
  getAdminFacility,
  getAdminFacilities,
  getAdminNearbyPlaces,
  getAdminNearbyPlace,
  getAdminPlaceExitRecommendations,
  getAdminRouteEdges,
  getAdminRouteEdge,
  getAdminRouteNodes,
  getAdminRouteNode,
  getAdminStation,
  getAdminStations,
  updateAdminCounselor,
  updateAdminFacility,
  updateAdminNearbyPlace,
  updateAdminRouteEdge,
  updateAdminRouteNode,
  updateAdminStation,
} from '@/shared/api';
import { ADMIN_SCHEMA, type AdminRecord, type AdminTableTab } from './schema';

type Draft = {
  id: number | null;
  values: Record<string, string>;
};

const TOAST_MS = 2200;
const EDGE_ID_OFFSET = 1_000_000_000;
const RECOMMENDATION_ID_OFFSET = 2_000_000_000;

function numberValue(value: string, required = true): number | undefined {
  if (!value.trim()) {
    if (required) throw new Error('필수 숫자 값이 비어 있습니다.');
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error('숫자 형식이 올바르지 않습니다.');
  return parsed;
}

function boolValue(value: string) {
  return value === 'true';
}

function valuesOf(row: AdminRecord) {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => [key, String(value)]),
  );
}

/** 관리자 표를 실제 API 조회·생성·수정·삭제 동작에 연결한다. */
export function useAdminRecords(tab: AdminTableTab) {
  const schema = ADMIN_SCHEMA[tab];
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [renderedTab, setRenderedTab] = useState(tab);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  if (renderedTab !== tab) {
    setRenderedTab(tab);
    setQuery('');
    setDraft(null);
    setDeletingId(null);
  }

  const flash = useCallback((message: string) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), TOAST_MS);
  }, []);

  const load = useCallback(async (): Promise<AdminRecord[]> => {
    if (tab === 'station') {
      const stations = await getAdminStations();
      return stations
        .filter((station) => station.stationId != null)
        .map((station) => ({
          id: station.stationId!,
          name: station.nameKo ?? '',
          nameEn: station.nameEn ?? '',
          line: station.lineInfo ?? '',
          floors: '-',
          latitude: station.latitude ?? '',
          longitude: station.longitude ?? '',
          status: '운영 중',
        }));
    }
    if (tab === 'facility') {
      const stations = await getAdminStations();
      const groups = await Promise.all(
        stations
          .filter((station) => station.stationId != null)
          .map((station) => getAdminFacilities({ stationId: station.stationId! })),
      );
      return groups
        .flat()
        .filter((facility) => facility.facilityId != null)
        .map((facility) => ({
          id: facility.facilityId!,
          stationId: facility.stationId ?? '',
          floor: facility.floorId ?? '',
          name: facility.nameKo ?? '',
          nameEn: facility.nameEn ?? '',
          type: facility.facilityType ?? '',
          mapX: facility.mapX ?? '',
          mapY: facility.mapY ?? '',
          linkedNodeId: facility.linkedNodeId ?? '',
          accessible: String(facility.isAccessible ?? false),
          status: facility.isAccessible ? '접근 가능' : '일반',
        }));
    }
    if (tab === 'route') {
      const [nodes, edges] = await Promise.all([getAdminRouteNodes(), getAdminRouteEdges()]);
      const nodeRows = nodes
        .filter((node) => node.nodeId != null)
        .map((node) => ({
          id: node.nodeId!,
          rawId: node.nodeId!,
          kind: 'node',
          name: node.name ?? `노드 ${node.nodeId}`,
          stationId: node.stationId ?? '',
          floorId: node.floorId ?? '',
          nodeType: node.nodeType ?? 'normal',
          graphType: node.nodeType ?? 'normal',
          mapX: node.mapX ?? '',
          mapY: node.mapY ?? '',
          landmark: String(node.isLandmark ?? false),
          fromNodeId: '',
          toNodeId: '',
          distance: '',
          seconds: '',
          moveType: 'walk',
          accessible: 'true',
          bidirectional: 'true',
          status: node.isLandmark ? '랜드마크' : '일반',
        }));
      const edgeRows = edges
        .filter((edge) => edge.edgeId != null)
        .map((edge) => ({
          id: EDGE_ID_OFFSET + edge.edgeId!,
          rawId: edge.edgeId!,
          kind: 'edge',
          name: `${edge.fromNodeId ?? '-'} → ${edge.toNodeId ?? '-'}`,
          stationId: edge.stationId ?? '',
          fromNodeId: edge.fromNodeId ?? '',
          toNodeId: edge.toNodeId ?? '',
          distance: edge.distanceM ?? '',
          seconds: edge.estimatedTimeSec ?? '',
          moveType: edge.moveType ?? '',
          graphType: edge.moveType ?? '',
          accessible: String(edge.isAccessible ?? false),
          bidirectional: String(edge.isBidirectional ?? false),
          status: edge.isAccessible ? '접근 가능' : '일반',
        }));
      return [...nodeRows, ...edgeRows];
    }
    if (tab === 'place') {
      const [places, recommendations] = await Promise.all([
        getAdminNearbyPlaces(),
        getAdminPlaceExitRecommendations(),
      ]);
      const placeRows = places
        .filter((place) => place.placeId != null)
        .map((place) => ({
          id: place.placeId!,
          rawId: place.placeId!,
          kind: 'place',
          stationId: place.stationId ?? '',
          name: place.nameKo ?? '',
          nameEn: place.nameEn ?? '',
          cat: place.category ?? '',
          address: place.address ?? '',
          latitude: place.latitude ?? '',
          longitude: place.longitude ?? '',
          externalMapUrl: place.externalMapUrl ?? '',
          status: place.active === false ? '비활성' : '운영 중',
        }));
      const recommendationRows = recommendations
        .filter((item) => item.recommendationId != null)
        .map((item) => ({
          id: RECOMMENDATION_ID_OFFSET + item.recommendationId!,
          rawId: item.recommendationId!,
          kind: 'recommendation',
          name: `장소 ${item.placeId ?? '-'} → 출구 ${item.exitFacilityId ?? '-'}`,
          cat: '추천 출구',
          stationId: '',
          nameEn: '',
          address: '',
          latitude: '',
          longitude: '',
          externalMapUrl: '',
          placeId: item.placeId ?? '',
          exitFacilityId: item.exitFacilityId ?? '',
          priority: item.priority ?? 1,
          walkingTimeMin: item.walkingTimeMin ?? '',
          reasonKo: item.reasonKo ?? '',
          isPrimary: String(item.isPrimary ?? false),
          status: item.isPrimary ? '대표 추천' : '추천',
        }));
      return [...placeRows, ...recommendationRows];
    }
    const counselors = await getAdminCounselors();
    return counselors
      .filter((account) => account.accountId != null)
      .map((account) => ({
        id: account.accountId!,
        name: account.name ?? '',
        account: account.loginId ?? '',
        stationId: account.stationId ?? '',
        active: String(account.isActive ?? false),
        status: account.isActive ? '활성' : '승인 대기',
      }));
  }, [tab]);

  const recordsQuery = useQuery({
    queryKey: ['admin-records', tab],
    queryFn: load,
  });
  const rows = useMemo(() => recordsQuery.data ?? [], [recordsQuery.data]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const visibleRows = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value).includes(trimmed)),
    );
  }, [query, rows]);

  const startCreate = () => {
    if (tab === 'counselor') {
      flash('상담원 계정 생성은 회원가입 후 승인 방식입니다.');
      return;
    }
    setDraft({ id: null, values: { ...schema.blank } });
    setInvalid(false);
  };

  const startEdit = async (id: number) => {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) return;
    const rawId = Number(row.rawId ?? id);
    try {
      if (tab === 'station') await getAdminStation(rawId);
      else if (tab === 'facility') await getAdminFacility(rawId);
      else if (tab === 'route' && row.kind === 'node') await getAdminRouteNode(rawId);
      else if (tab === 'route') await getAdminRouteEdge(rawId);
      else if (tab === 'place' && row.kind !== 'recommendation') await getAdminNearbyPlace(rawId);
      else if (tab === 'counselor') await getAdminCounselor(rawId);
    } catch {
      flash('상세 정보를 불러오지 못했습니다.');
      return;
    }
    setDraft({ id, values: valuesOf(row) });
    setInvalid(false);
  };

  const changeField = (key: string, value: string) => {
    setDraft((current) =>
      current ? { ...current, values: { ...current.values, [key]: value } } : current,
    );
    setInvalid(false);
  };

  const save = async () => {
    if (!draft) return;
    const needsName = !(tab === 'place' && draft.values.kind === 'recommendation');
    if (needsName && !draft.values.name?.trim()) {
      setInvalid(true);
      return;
    }
    const value = draft.values;
    try {
      if (tab === 'station') {
        const request = {
          nameKo: value.name,
          nameEn: value.nameEn || value.name,
          lineInfo: value.line || undefined,
          latitude: numberValue(value.latitude, false),
          longitude: numberValue(value.longitude, false),
        };
        if (draft.id == null) await createAdminStation(request);
        else await updateAdminStation(draft.id, request);
      } else if (tab === 'facility') {
        const common = {
          facilityType: value.type,
          nameKo: value.name,
          nameEn: value.nameEn || undefined,
          mapX: numberValue(value.mapX)!,
          mapY: numberValue(value.mapY)!,
          linkedNodeId: numberValue(value.linkedNodeId, false),
          isAccessible: boolValue(value.accessible),
        };
        if (draft.id == null) {
          await createAdminFacility({
            stationId: numberValue(value.stationId)!,
            floorId: numberValue(value.floor)!,
            ...common,
          });
        } else {
          await updateAdminFacility(draft.id, common);
        }
      } else if (tab === 'route') {
        const rawId = numberValue(value.rawId ?? '', false);
        if (value.kind === 'node') {
          const common = {
            nodeType: value.nodeType,
            name: value.name || undefined,
            mapX: numberValue(value.mapX)!,
            mapY: numberValue(value.mapY)!,
            isLandmark: boolValue(value.landmark),
          };
          if (draft.id == null) {
            await createAdminRouteNode({
              stationId: numberValue(value.stationId)!,
              floorId: numberValue(value.floorId)!,
              ...common,
            });
          } else {
            await updateAdminRouteNode(rawId ?? draft.id, common);
          }
        } else {
          const common = {
            distanceM: numberValue(value.distance)!,
            estimatedTimeSec: numberValue(value.seconds, false),
            moveType: value.moveType,
            isAccessible: boolValue(value.accessible),
            isBidirectional: boolValue(value.bidirectional),
          };
          if (draft.id == null) {
            await createAdminRouteEdge({
              stationId: numberValue(value.stationId)!,
              fromNodeId: numberValue(value.fromNodeId)!,
              toNodeId: numberValue(value.toNodeId)!,
              ...common,
            });
          } else {
            await updateAdminRouteEdge(rawId ?? draft.id - EDGE_ID_OFFSET, common);
          }
        }
      } else if (tab === 'place') {
        if (value.kind === 'recommendation') {
          const request = {
            placeId: numberValue(value.placeId)!,
            exitFacilityId: numberValue(value.exitFacilityId)!,
            priority: numberValue(value.priority)!,
            reasonKo: value.reasonKo || undefined,
            walkingTimeMin: numberValue(value.walkingTimeMin, false),
            isPrimary: boolValue(value.isPrimary),
          };
          if (draft.id != null) {
            await deleteAdminPlaceExitRecommendation(
              numberValue(value.rawId ?? '', false) ?? draft.id - RECOMMENDATION_ID_OFFSET,
            );
          }
          await createAdminPlaceExitRecommendation(request);
        } else {
          const common = {
            nameKo: value.name,
            nameEn: value.nameEn || undefined,
            category: value.cat,
            address: value.address || undefined,
            latitude: numberValue(value.latitude, false),
            longitude: numberValue(value.longitude, false),
            externalMapUrl: value.externalMapUrl || undefined,
          };
          if (draft.id == null) {
            await createAdminNearbyPlace({
              stationId: numberValue(value.stationId)!,
              ...common,
            });
          } else {
            await updateAdminNearbyPlace(draft.id, common);
          }
        }
      } else if (draft.id != null) {
        await updateAdminCounselor(draft.id, {
          stationId: numberValue(value.stationId, false),
          isActive: boolValue(value.active),
        });
      }
      setDraft(null);
      flash(draft.id == null ? '항목을 등록했습니다.' : '변경 사항을 저장했습니다.');
      await queryClient.invalidateQueries({ queryKey: ['admin-records', tab] });
    } catch {
      setInvalid(true);
      flash('입력값을 확인해 주세요.');
    }
  };

  const confirmDelete = async () => {
    if (deletingId == null) return;
    try {
      if (tab === 'station') await deleteAdminStation(deletingId);
      else if (tab === 'facility') await deleteAdminFacility(deletingId);
      else if (tab === 'route') {
        const row = rows.find((candidate) => candidate.id === deletingId);
        const rawId = Number(row?.rawId ?? deletingId);
        if (row?.kind === 'node') await deleteAdminRouteNode(rawId);
        else await deleteAdminRouteEdge(rawId);
      } else if (tab === 'place') {
        const row = rows.find((candidate) => candidate.id === deletingId);
        const rawId = Number(row?.rawId ?? deletingId);
        if (row?.kind === 'recommendation') await deleteAdminPlaceExitRecommendation(rawId);
        else await deleteAdminNearbyPlace(rawId);
      } else await deactivateAdminCounselor(deletingId);
      setDeletingId(null);
      flash(tab === 'counselor' ? '계정을 비활성화했습니다.' : '항목을 삭제했습니다.');
      await queryClient.invalidateQueries({ queryKey: ['admin-records', tab] });
    } catch {
      flash('참조 중인 항목은 삭제할 수 없습니다.');
    }
  };

  const deletingName =
    deletingId == null ? '' : String(rows.find((row) => row.id === deletingId)?.name ?? '');

  return {
    schema,
    rows: visibleRows,
    query,
    setQuery,
    draft,
    invalid,
    startCreate,
    startEdit,
    changeField,
    cancelEdit: () => {
      setDraft(null);
      setInvalid(false);
    },
    save,
    deletingId,
    deletingName,
    askDelete: setDeletingId,
    cancelDelete: () => setDeletingId(null),
    confirmDelete,
    toast,
    flash,
  };
}
