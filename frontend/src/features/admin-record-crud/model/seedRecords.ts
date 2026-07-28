import type { AdminRecord, AdminTableTab } from './schema';

/**
 * Seed rows for the admin console.
 *
 * TODO: Replace with the admin CRUD endpoints via TanStack Query. Until the
 * API contract exists these live in component state, so edits are lost on
 * reload — exactly as in the prototype.
 */
export const SEED_RECORDS: Record<AdminTableTab, readonly AdminRecord[]> = {
  station: [
    { id: 31, name: '역삼역', line: '2호선', floors: '1F·B1·B2', status: '운영중' },
    { id: 32, name: '선릉역', line: '2호선·수인분당', floors: '1F·B1·B2·B3', status: '운영중' },
    { id: 33, name: '강남역', line: '2호선·신분당', floors: '1F·B1·B2', status: '준비중' },
  ],
  route: [
    {
      id: 41,
      name: 'B1 대합실 → 3번 출구',
      option: '빠른 경로',
      dist: '210m · 4분',
      status: '운영중',
    },
    {
      id: 42,
      name: 'B1 대합실 → 3번 출구',
      option: '엘리베이터 중심',
      dist: '240m · 6분',
      status: '점검중',
    },
    {
      id: 43,
      name: 'B2 승강장 → 2번 출구',
      option: '계단 없는 경로',
      dist: '320m · 7분',
      status: '운영중',
    },
  ],
  facility: [
    { id: 1, name: '3번 출구', type: '출구', floor: '1F', status: '운영중' },
    { id: 2, name: '엘리베이터 A', type: '엘리베이터', floor: 'B2↔1F', status: '점검중' },
    { id: 3, name: '2번 개찰구', type: '개찰구', floor: 'B1', status: '운영중' },
    { id: 4, name: '화장실', type: '편의시설', floor: 'B1', status: '운영중' },
  ],
  place: [
    { id: 11, name: '스타벅스 역삼점', cat: '카페', exit: '3번 출구', walk: '도보 2분' },
    { id: 12, name: '강남파이낸스센터', cat: '오피스', exit: '7번 출구', walk: '도보 5분' },
    { id: 13, name: '올리브영 역삼', cat: '쇼핑', exit: '4번 출구', walk: '도보 3분' },
  ],
  counselor: [
    { id: 21, name: '김상담', account: 'kim@pingo.kr', station: '역삼역', status: '상담 가능' },
    { id: 22, name: '박상담', account: 'park@pingo.kr', station: '역삼역', status: '상담 중' },
    { id: 23, name: '이상담', account: 'lee@pingo.kr', station: '강남역', status: '비활성' },
    { id: 24, name: '최상담', account: 'choi@pingo.kr', station: '역삼역', status: '승인 대기' },
  ],
};

/** New ids continue from the prototype's `aSeq` counter. */
export const SEED_ID_START = 200;
