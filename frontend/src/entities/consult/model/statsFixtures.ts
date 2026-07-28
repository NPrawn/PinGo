/**
 * Counselor dashboard figures.
 *
 * TODO: Replace with the analytics endpoint once it exists — these are the
 * prototype's hard-coded numbers.
 */

export type StatTile = {
  label: string;
  value: string;
  /** Suffix rendered smaller next to the value. */
  unit?: string;
  /** Change indicator, e.g. `▲ 12%`. */
  delta?: string;
  highlight?: boolean;
};

export const STAT_TILES: readonly StatTile[] = [
  { label: '총 상담 건수', value: '128', delta: '▲ 12%' },
  { label: '평균 대기 시간', value: '42', unit: '초' },
  { label: '평균 상담 시간', value: '3', unit: '분 24초' },
  { label: '해결률', value: '94', unit: '%', highlight: true },
];

export type BarDatum = {
  label: string;
  /** Percentage of the total, 0–100. */
  pct: number;
  color: string;
};

export const ISSUE_BREAKDOWN: readonly BarDatum[] = [
  { label: '현재 위치를 못 찾겠어요', pct: 47, color: 'var(--color-mint-mid)' },
  { label: '출구를 못 찾겠어요', pct: 28, color: '#7fe0a8' },
  { label: '경로 안내가 이상해요', pct: 16, color: '#b3a9f5' },
  { label: '기타 문의', pct: 9, color: '#d4cdf7' },
];

export type LanguageDatum = BarDatum & { code: string };

export const LANGUAGE_BREAKDOWN: readonly LanguageDatum[] = [
  { code: 'KO', label: '한국어', pct: 54, color: 'var(--color-mint-mid)' },
  { code: 'EN', label: '영어', pct: 32, color: '#7fe0a8' },
  { code: 'JP', label: '일본어', pct: 9, color: '#b3a9f5' },
  { code: 'CN', label: '중국어', pct: 5, color: '#d4cdf7' },
];

export const HOURLY_VOLUME: readonly BarDatum[] = [
  { label: '07-09', pct: 28, color: 'var(--color-mint-veil)' },
  { label: '09-12', pct: 62, color: '#b3a9f5' },
  { label: '12-14', pct: 88, color: 'var(--color-mint-mid)' },
  { label: '14-18', pct: 45, color: '#b3a9f5' },
  { label: '18-21', pct: 100, color: 'var(--color-mint-mid)' },
  { label: '21-24', pct: 34, color: '#b3a9f5' },
];

export const TOP_EXITS: readonly { rank: number; name: string; count: string }[] = [
  { rank: 1, name: '3번 출구', count: '38건' },
  { rank: 2, name: '7번 출구', count: '24건' },
  { rank: 3, name: '1번 출구', count: '19건' },
];

export const AVERAGE_SATISFACTION = { score: '4.7', responses: '응답 112건' };
