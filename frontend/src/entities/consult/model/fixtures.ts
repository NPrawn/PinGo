import type { ConsultHistoryEntry, ConsultRequest } from './types';

/**
 * Consultation fixtures.
 *
 * TODO: Replace with the consult queue and history APIs once those contracts,
 * and the WebRTC signalling payloads, are agreed.
 */

export const CONSULT_REQUESTS: readonly ConsultRequest[] = [
  {
    type: '현재 위치를 못 찾겠어요',
    time: '12:03',
    wait: '2분',
    loc: 'B1 12번 기둥 부근',
    detail: '주변이 복잡해 VPS 인식 실패',
  },
  {
    type: '출구를 못 찾겠어요',
    time: '12:01',
    wait: '4분',
    loc: 'B2 환승통로',
    detail: '3번 출구 방향을 못 찾음',
  },
  {
    type: '경로 안내가 이상해요',
    time: '11:58',
    wait: '7분',
    loc: 'B1 대합실',
    detail: '엘리베이터 점검으로 경로 오류',
  },
  { type: '기타 문의', time: '11:55', wait: '9분', loc: '1F 출구 앞', detail: '교통카드 문의' },
];

export const CONSULT_HISTORY: readonly ConsultHistoryEntry[] = [
  {
    agent: '김상담',
    date: '2026년 07월 18일',
    summary: '12번 기둥 랜드마크로 위치를 재지정하고 엘리베이터 경로로 3번 출구까지 안내 완료',
    from: 'B1 대합실 12번 기둥 부근',
    exit: '3번 출구',
    option: '계단 없는 경로 (엘리베이터 중심)',
    lang: '한국어',
    log: [
      { who: '사용자', text: '지금 여기가 어딘지 모르겠어요.' },
      { who: '상담원', text: '주변에 12번 기둥 보이시나요?' },
      { who: '사용자', text: '네, 왼쪽에 보여요.' },
      { who: '상담원', text: '그 기둥 기준 왼쪽 엘리베이터로 이동하시면 3번 출구예요.' },
      { who: '사용자', text: '감사합니다, 찾았어요!' },
    ],
  },
  {
    agent: '박상담',
    date: '2026년 07월 18일',
    summary: '환승통로에서 방향을 잃은 사용자에게 화살표 안내로 3번 출구까지 유도',
    from: 'B2 환승통로',
    exit: '3번 출구',
    option: '빠른 경로',
    lang: 'English',
    log: [
      { who: 'User', text: 'I think I took the wrong hallway.' },
      { who: '상담원', text: '화살표를 보내드릴게요. 화살표 방향으로 직진하세요.' },
      { who: 'User', text: 'Okay, I see the arrow now.' },
      { who: '상담원', text: '에스컬레이터 타고 올라가면 3번 출구입니다.' },
    ],
  },
  {
    agent: '김상담',
    date: '2026년 07월 17일',
    summary: '엘리베이터 점검으로 경로 재계산 후 에스컬레이터 경로 재안내',
    from: 'B1 2번 개찰구',
    exit: '3번 출구',
    option: '엘리베이터 중심 → 에스컬레이터로 변경',
    lang: '한국어',
    log: [
      { who: '사용자', text: '엘리베이터가 점검 중이라 못 타요.' },
      { who: '상담원', text: '확인했습니다. 경로를 다시 계산할게요.' },
      { who: '상담원', text: '앞쪽 에스컬레이터를 이용하는 경로로 안내드릴게요.' },
      { who: '사용자', text: '네 그쪽으로 갈게요.' },
    ],
  },
];

/** Speaker colour in the transcript — users in mint, counselors in lilac. */
export function speakerColor(who: string): string {
  return /사용자|user/i.test(who) ? '#0f5a3e' : '#a99bff';
}

/** Problem types the user can raise, in prototype order. */
export const CONSULT_ISSUES = [
  { label: '현재 위치를 못 찾겠어요', icon: 'pin', tone: 'mint' },
  { label: '출구를 못 찾겠어요', icon: 'door', tone: 'coral' },
  { label: '경로 안내가 이상해요', icon: 'compass', tone: 'sky' },
  { label: '기타 문의', icon: 'chat', tone: 'lilac' },
] as const;

/** Satisfaction labels for the 1–5 star rating. */
export const SATISFACTION_LABELS = [
  '',
  '별로예요',
  '아쉬워요',
  '보통이에요',
  '좋았어요',
  '매우 만족해요',
] as const;
