import type { AdminTab } from '@/shared/config';

export type AdminRecord = { id: number } & Record<string, string | number>;

export type AdminColumn = {
  k: string;
  label: string;
  flex: number;
  weight?: number;
  badge?: boolean;
};

export type AdminField =
  | { k: string; label: string; type: 'text'; ph?: string }
  | { k: string; label: string; type: 'select'; opts: readonly string[] };

export type AdminTableSchema = {
  title: string;
  desc: string;
  newLabel: string;
  cols: readonly AdminColumn[];
  fields: readonly AdminField[];
  blank: Record<string, string>;
};

export type AdminTableTab = Exclude<AdminTab, 'map'>;

export function isTableTab(tab: AdminTab): tab is AdminTableTab {
  return tab !== 'map';
}

export const ADMIN_SCHEMA: Record<AdminTableTab, AdminTableSchema> = {
  station: {
    title: '역 관리',
    desc: '서비스 대상 역의 기본 정보를 관리합니다.',
    newLabel: '역 추가',
    cols: [
      { k: 'name', label: '역명', flex: 1.4, weight: 700 },
      { k: 'line', label: '노선', flex: 1.2 },
      { k: 'floors', label: '층', flex: 0.8 },
      { k: 'status', label: '상태', flex: 0.8, badge: true },
    ],
    fields: [
      { k: 'name', label: '한글 역명', type: 'text' },
      { k: 'nameEn', label: '영문 역명', type: 'text' },
      { k: 'line', label: '노선 정보', type: 'text' },
      { k: 'latitude', label: '위도', type: 'text' },
      { k: 'longitude', label: '경도', type: 'text' },
    ],
    blank: { name: '', nameEn: '', line: '', latitude: '', longitude: '' },
  },
  route: {
    title: '경로 그래프 관리',
    desc: '경로 노드와 두 노드 사이의 간선을 관리합니다.',
    newLabel: '노드/간선 추가',
    cols: [
      { k: 'kind', label: '종류', flex: 0.6, badge: true },
      { k: 'name', label: '이름/구간', flex: 1.4, weight: 700 },
      { k: 'graphType', label: '유형', flex: 1 },
      { k: 'status', label: '접근성', flex: 0.8, badge: true },
    ],
    fields: [
      { k: 'kind', label: '종류', type: 'select', opts: ['node', 'edge'] },
      { k: 'stationId', label: '역 ID', type: 'text' },
      { k: 'floorId', label: '층 ID(노드)', type: 'text' },
      {
        k: 'nodeType',
        label: '노드 유형',
        type: 'select',
        opts: ['normal', 'junction', 'facility', 'floor_transition', 'exit'],
      },
      { k: 'name', label: '노드 이름', type: 'text' },
      { k: 'mapX', label: '지도 X(노드)', type: 'text' },
      { k: 'mapY', label: '지도 Y(노드)', type: 'text' },
      { k: 'landmark', label: '랜드마크', type: 'select', opts: ['true', 'false'] },
      { k: 'fromNodeId', label: '출발 노드 ID', type: 'text' },
      { k: 'toNodeId', label: '도착 노드 ID', type: 'text' },
      { k: 'distance', label: '거리(m)', type: 'text' },
      { k: 'seconds', label: '예상 시간(초)', type: 'text' },
      {
        k: 'moveType',
        label: '이동 수단',
        type: 'select',
        opts: ['walk', 'elevator', 'stair', 'escalator', 'gate'],
      },
      { k: 'accessible', label: '접근 가능', type: 'select', opts: ['true', 'false'] },
      { k: 'bidirectional', label: '양방향', type: 'select', opts: ['true', 'false'] },
    ],
    blank: {
      kind: 'node',
      name: '새 노드',
      stationId: '',
      floorId: '',
      nodeType: 'normal',
      mapX: '0',
      mapY: '0',
      landmark: 'false',
      fromNodeId: '',
      toNodeId: '',
      distance: '',
      seconds: '',
      moveType: 'walk',
      accessible: 'true',
      bidirectional: 'true',
    },
  },
  facility: {
    title: '시설 · 출구 관리',
    desc: '시설 위치와 연결 경로 노드를 관리합니다.',
    newLabel: '시설 추가',
    cols: [
      { k: 'name', label: '시설명', flex: 1.4, weight: 700 },
      { k: 'type', label: '유형', flex: 1 },
      { k: 'floor', label: '층 ID', flex: 0.7 },
      { k: 'status', label: '접근성', flex: 0.8, badge: true },
    ],
    fields: [
      { k: 'stationId', label: '역 ID', type: 'text' },
      { k: 'floor', label: '층 ID', type: 'text' },
      { k: 'name', label: '한글명', type: 'text' },
      { k: 'nameEn', label: '영문명', type: 'text' },
      {
        k: 'type',
        label: '시설 유형',
        type: 'select',
        opts: ['exit', 'gate', 'elevator', 'escalator', 'restroom', 'information'],
      },
      { k: 'mapX', label: '지도 X', type: 'text' },
      { k: 'mapY', label: '지도 Y', type: 'text' },
      { k: 'linkedNodeId', label: '연결 노드 ID', type: 'text' },
      { k: 'accessible', label: '접근 가능', type: 'select', opts: ['true', 'false'] },
    ],
    blank: {
      stationId: '',
      floor: '',
      name: '',
      nameEn: '',
      type: 'information',
      mapX: '0',
      mapY: '0',
      linkedNodeId: '',
      accessible: 'true',
    },
  },
  place: {
    title: '주변 장소·추천 출구 관리',
    desc: '역 주변 목적지와 장소별 추천 출구를 관리합니다.',
    newLabel: '장소/추천 추가',
    cols: [
      { k: 'kind', label: '종류', flex: 0.6, badge: true },
      { k: 'name', label: '장소명', flex: 1.4, weight: 700 },
      { k: 'cat', label: '카테고리', flex: 1 },
      { k: 'stationId', label: '역 ID', flex: 0.7 },
      { k: 'status', label: '상태', flex: 0.7, badge: true },
    ],
    fields: [
      { k: 'kind', label: '종류', type: 'select', opts: ['place', 'recommendation'] },
      { k: 'stationId', label: '역 ID', type: 'text' },
      { k: 'name', label: '한글명', type: 'text' },
      { k: 'nameEn', label: '영문명', type: 'text' },
      { k: 'cat', label: '카테고리', type: 'text' },
      { k: 'address', label: '주소', type: 'text' },
      { k: 'latitude', label: '위도', type: 'text' },
      { k: 'longitude', label: '경도', type: 'text' },
      { k: 'externalMapUrl', label: '외부 지도 URL', type: 'text' },
      { k: 'placeId', label: '장소 ID(추천)', type: 'text' },
      { k: 'exitFacilityId', label: '출구 시설 ID(추천)', type: 'text' },
      { k: 'priority', label: '추천 우선순위', type: 'text' },
      { k: 'walkingTimeMin', label: '도보 시간(분)', type: 'text' },
      { k: 'reasonKo', label: '추천 이유', type: 'text' },
      { k: 'isPrimary', label: '대표 출구', type: 'select', opts: ['true', 'false'] },
    ],
    blank: {
      kind: 'place',
      stationId: '',
      name: '',
      nameEn: '',
      cat: '',
      address: '',
      latitude: '',
      longitude: '',
      externalMapUrl: '',
      placeId: '',
      exitFacilityId: '',
      priority: '1',
      walkingTimeMin: '',
      reasonKo: '',
      isPrimary: 'false',
    },
  },
  counselor: {
    title: '상담원 계정 관리',
    desc: '가입한 상담원의 담당 역과 활성 상태를 관리합니다.',
    newLabel: '가입은 회원가입에서 진행',
    cols: [
      { k: 'name', label: '이름', flex: 1, weight: 700 },
      { k: 'account', label: '계정', flex: 1.4 },
      { k: 'stationId', label: '역 ID', flex: 0.7 },
      { k: 'status', label: '상태', flex: 0.8, badge: true },
    ],
    fields: [
      { k: 'name', label: '이름(읽기 전용)', type: 'text' },
      { k: 'account', label: '계정(읽기 전용)', type: 'text' },
      { k: 'stationId', label: '담당 역 ID', type: 'text' },
      { k: 'active', label: '활성 상태', type: 'select', opts: ['true', 'false'] },
    ],
    blank: { name: '', account: '', stationId: '', active: 'false' },
  },
};

export function badgeTone(value: string): { bg: string; fg: string } {
  if (/운영|활성|가능|true/i.test(value)) return { bg: '#d9f0df', fg: '#0f5a3e' };
  if (/대기|준비|false/i.test(value)) return { bg: '#fbf0db', fg: '#8a6412' };
  return { bg: '#f1f3f7', fg: '#6b7a72' };
}
