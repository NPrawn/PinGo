import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAdminFacility,
  createAdminRouteEdge,
  createAdminRouteNode,
  createAdminStation,
  deactivateAdminCounselor,
  deleteAdminFacility,
  deleteAdminRouteEdge,
  deleteAdminRouteNode,
  deleteAdminStation,
  getAdminCounselors,
  getAdminCounselor,
  getAdminFacility,
  getAdminFacilities,
  getAdminRouteEdges,
  getAdminRouteEdge,
  getAdminRouteNodes,
  getAdminRouteNode,
  getAdminStation,
  getAdminStations,
  updateAdminCounselor,
  updateAdminFacility,
  updateAdminRouteEdge,
  updateAdminRouteNode,
  updateAdminStation,
  ApiError,
} from '@/shared/api';
import {
  ADMIN_SCHEMA,
  COUNSELOR_STATUS_LABELS,
  type AdminRecord,
  type AdminTableTab,
} from './schema';

type Draft = {
  id: number | null;
  values: Record<string, string>;
};

const TOAST_MS = 2200;
const EDGE_ID_OFFSET = 1_000_000_000;

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

/**
 * 실패 원인을 화면에 쓸 문장으로 바꾼다.
 *
 * 서버가 어떤 필드가 왜 거절됐는지 알려주는데, 이를 버리고 "확인해 주세요"만 띄우면
 * 관리자가 무엇을 고쳐야 할지 알 수 없다. 서버 메시지를 우선 쓰고 없을 때만 기본 문구로 떨어진다.
 */
function reasonOf(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback;
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

  /**
   * 역 단위로만 조회할 수 있는 목록을 모든 역에 대해 모은다.
   *
   * 경로·주변 장소·시설 조회는 `stationId`가 있어야 한다. OpenAPI 문서에는 선택 항목으로
   * 적혀 있지만 서버가 null을 400으로 거절한다(RouteService.requireStationId,
   * AdminPlaceService.requireStationId). 콘솔은 역을 가리지 않고 전부 보여주므로
   * 역 목록을 먼저 받아 역마다 호출한다.
   */
  const forEachStation = useCallback(
    async <T>(fetchOne: (stationId: number) => Promise<T[]>): Promise<T[]> => {
      const stations = await getAdminStations();
      const groups = await Promise.all(
        stations
          .filter((station) => station.stationId != null)
          .map((station) => fetchOne(station.stationId!)),
      );
      return groups.flat();
    },
    [],
  );

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
      const facilities = await forEachStation((stationId) => getAdminFacilities({ stationId }));
      return facilities
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
      const [nodes, edges] = await Promise.all([
        forEachStation((stationId) => getAdminRouteNodes({ stationId })),
        forEachStation((stationId) => getAdminRouteEdges(stationId)),
      ]);
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
        // 상태가 없는 계정을 '상담 가능'으로 보여주면 안 된다.
        consultStatus: COUNSELOR_STATUS_LABELS[account.status ?? ''] ?? '-',
      }));
  }, [tab, forEachStation]);

  const recordsQuery = useQuery({
    queryKey: ['admin-records', tab],
    queryFn: load,
    // 상담 상태는 상담 수락·종료로 서버에서 바뀌므로 주기적으로 다시 읽는다.
    refetchInterval: tab === 'counselor' ? 5000 : false,
  });
  const rows = useMemo(() => recordsQuery.data ?? [], [recordsQuery.data]);
  // 조회 실패를 빈 배열로 흘려보내면 "항목이 없다"와 구분되지 않는다. 서버 메시지를 그대로
  // 올려 화면이 실패·빈 목록·로딩 중을 각각 다르게 말할 수 있게 한다.
  const loadError = recordsQuery.isError
    ? recordsQuery.error instanceof ApiError
      ? recordsQuery.error.message
      : '목록을 불러오지 못했습니다.'
    : null;

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const visibleRows = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value).includes(trimmed)),
    );
  }, [query, rows]);

  const startCreate = () => {
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
      else if (tab === 'counselor') await getAdminCounselor(rawId);
    } catch (error) {
      flash(reasonOf(error, '상세 정보를 불러오지 못했습니다.'));
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
    if (!draft.values.name?.trim()) {
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
      } else if (draft.id != null) {
        await updateAdminCounselor(draft.id, {
          stationId: numberValue(value.stationId, false),
          isActive: boolValue(value.active),
        });
      }
      setDraft(null);
      flash(draft.id == null ? '항목을 등록했습니다.' : '변경 사항을 저장했습니다.');
      await queryClient.invalidateQueries({ queryKey: ['admin-records', tab] });
    } catch (error) {
      setInvalid(true);
      flash(reasonOf(error, '입력값을 확인해 주세요.'));
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
      } else await deactivateAdminCounselor(deletingId);
      setDeletingId(null);
      flash(tab === 'counselor' ? '계정을 비활성화했습니다.' : '항목을 삭제했습니다.');
      await queryClient.invalidateQueries({ queryKey: ['admin-records', tab] });
    } catch (error) {
      flash(reasonOf(error, '참조 중인 항목은 삭제할 수 없습니다.'));
    }
  };

  /** 승인 대기 상담원 계정을 활성화한다. */
  const approve = async (id: number) => {
    try {
      await updateAdminCounselor(id, { isActive: true });
      flash('계정을 승인했습니다.');
      await queryClient.invalidateQueries({ queryKey: ['admin-records', tab] });
    } catch (error) {
      flash(reasonOf(error, '계정을 승인하지 못했습니다.'));
    }
  };

  const deletingName =
    deletingId == null ? '' : String(rows.find((row) => row.id === deletingId)?.name ?? '');

  return {
    schema,
    rows: visibleRows,
    isLoading: recordsQuery.isPending,
    loadError,
    retryLoad: () => void recordsQuery.refetch(),
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
    approve,
    isApprovable: tab === 'counselor' ? (row: AdminRecord) => row.active === 'false' : undefined,
    // Counselor accounts are deactivated, not removed, so the action says so and
    // only shows on accounts that are still active.
    deleteLabel: tab === 'counselor' ? '비활성화' : '삭제',
    deleteDescription:
      tab === 'counselor' ? '계정을 비활성화해요. 다시 수락하면 활성화됩니다.' : undefined,
    isDeletable: tab === 'counselor' ? (row: AdminRecord) => row.active === 'true' : undefined,
    toast,
    flash,
  };
}
