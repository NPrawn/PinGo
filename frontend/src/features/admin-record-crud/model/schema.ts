import type { AdminTab } from '@/shared/config';

export type AdminRecord = { id: number } & Record<string, string | number>;

export type AdminColumn = {
  k: string;
  label: string;
  flex: number;
  weight?: number;
  /** Render the value as a status badge. */
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
  /** Values a freshly created row starts with. */
  blank: Record<string, string>;
};

/** Tabs that render a CRUD table. `map` is handled by its own screen. */
export type AdminTableTab = Exclude<AdminTab, 'map'>;

export function isTableTab(tab: AdminTab): tab is AdminTableTab {
  return tab !== 'map';
}

/**
 * Column and form definitions per admin tab.
 *
 * Ported from the prototype's `aSchema()`.
 *
 * TODO: Once the admin APIs are agreed, derive these from the API schema
 * instead of hard-coding Korean labels and option lists here.
 */
export const ADMIN_SCHEMA: Record<AdminTableTab, AdminTableSchema> = {
  station: {
    title: '역 관리',
    desc: '서비스 대상 역과 노선·운영 층 정보를 관리해요.',
    newLabel: '역 추가',
    cols: [
      { k: 'name', label: '역명', flex: 1.4, weight: 700 },
      { k: 'line', label: '노선', flex: 1.4 },
      { k: 'floors', label: '운영 층', flex: 1 },
      { k: 'status', label: '상태', flex: 1, badge: true },
    ],
    fields: [
      { k: 'name', label: '역명', type: 'text', ph: '예) 역삼역' },
      { k: 'line', label: '노선', type: 'text', ph: '예) 2호선' },
      { k: 'floors', label: '운영 층', type: 'text', ph: '예) 1F·B1·B2' },
      { k: 'status', label: '서비스 상태', type: 'select', opts: ['운영중', '준비중', '중단'] },
    ],
    blank: { name: '', line: '2호선', floors: '1F·B1·B2', status: '준비중' },
  },
  route: {
    title: '경로 관리',
    desc: '출발–도착 구간의 추천 경로와 이동 옵션을 관리해요.',
    newLabel: '경로 추가',
    cols: [
      { k: 'name', label: '구간', flex: 1.8, weight: 700 },
      { k: 'option', label: '이동 옵션', flex: 1.2 },
      { k: 'dist', label: '거리·시간', flex: 1 },
      { k: 'status', label: '상태', flex: 1, badge: true },
    ],
    fields: [
      { k: 'name', label: '구간', type: 'text', ph: '예) B1 대합실 → 3번 출구' },
      {
        k: 'option',
        label: '이동 옵션',
        type: 'select',
        opts: ['빠른 경로', '엘리베이터 중심', '계단 없는 경로', '에스컬레이터 중심'],
      },
      { k: 'dist', label: '거리·시간', type: 'text', ph: '예) 210m · 4분' },
      { k: 'status', label: '상태', type: 'select', opts: ['운영중', '점검중', '폐쇄'] },
    ],
    blank: { name: '', option: '빠른 경로', dist: '', status: '운영중' },
  },
  facility: {
    title: '시설 · 출구 관리',
    desc: '출구·개찰구·엘리베이터 등 시설 위치와 운영 상태를 관리해요.',
    newLabel: '시설 추가',
    cols: [
      { k: 'name', label: '시설명', flex: 1.6, weight: 700 },
      { k: 'type', label: '유형', flex: 1 },
      { k: 'floor', label: '층', flex: 0.8 },
      { k: 'status', label: '상태', flex: 1, badge: true },
    ],
    fields: [
      { k: 'name', label: '시설명', type: 'text', ph: '예) 3번 출구' },
      {
        k: 'type',
        label: '유형',
        type: 'select',
        opts: ['출구', '개찰구', '엘리베이터', '에스컬레이터', '편의시설'],
      },
      { k: 'floor', label: '층', type: 'select', opts: ['1F', 'B1', 'B2', 'B2↔1F'] },
      { k: 'status', label: '운영 상태', type: 'select', opts: ['운영중', '점검중', '폐쇄'] },
    ],
    blank: { name: '', type: '출구', floor: '1F', status: '운영중' },
  },
  place: {
    title: '주변 장소 관리',
    desc: '역 주변 장소와 연결 추천 출구를 관리해요.',
    newLabel: '장소 추가',
    cols: [
      { k: 'name', label: '장소명', flex: 1.6, weight: 700 },
      { k: 'cat', label: '카테고리', flex: 1 },
      { k: 'exit', label: '추천 출구', flex: 1 },
      { k: 'walk', label: '도보', flex: 0.8 },
    ],
    fields: [
      { k: 'name', label: '장소명', type: 'text', ph: '예) 스타벅스 역삼점' },
      {
        k: 'cat',
        label: '카테고리',
        type: 'select',
        opts: ['카페', '음식점', '쇼핑', '오피스', '관공서', '병원'],
      },
      {
        k: 'exit',
        label: '추천 출구',
        type: 'select',
        opts: [
          '1번 출구',
          '2번 출구',
          '3번 출구',
          '4번 출구',
          '5번 출구',
          '6번 출구',
          '7번 출구',
          '8번 출구',
        ],
      },
      { k: 'walk', label: '도보 시간', type: 'text', ph: '예) 도보 3분' },
    ],
    blank: { name: '', cat: '카페', exit: '1번 출구', walk: '도보 1분' },
  },
  counselor: {
    title: '상담자 계정 관리',
    desc: '상담자 계정과 담당 역·상담 가능 상태를 관리해요.',
    newLabel: '계정 추가',
    cols: [
      { k: 'name', label: '이름', flex: 1, weight: 700 },
      { k: 'account', label: '계정', flex: 1.6 },
      { k: 'station', label: '담당 역', flex: 1 },
      { k: 'status', label: '상태', flex: 1, badge: true },
    ],
    fields: [
      { k: 'name', label: '이름', type: 'text', ph: '예) 김상담' },
      { k: 'account', label: '계정 (이메일)', type: 'text', ph: 'name@pingo.kr' },
      {
        k: 'station',
        label: '담당 역',
        type: 'select',
        opts: ['역삼역', '선릉역', '강남역', '삼성역'],
      },
      {
        k: 'status',
        label: '상태',
        type: 'select',
        opts: ['상담 가능', '상담 중', '승인 대기', '비활성'],
      },
    ],
    blank: { name: '', account: '', station: '역삼역', status: '상담 가능' },
  },
};

/** Badge colours for status values. Ported from the prototype's `badgeTone`. */
export function badgeTone(value: string): { bg: string; fg: string } {
  if (/운영중|상담 가능/.test(value)) return { bg: '#d9f0df', fg: '#0f5a3e' };
  if (/점검중|상담 중|준비중|승인 대기/.test(value)) return { bg: '#fbf0db', fg: '#8a6412' };
  return { bg: '#f1f3f7', fg: '#6b7a72' };
}
