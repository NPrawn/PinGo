import { consultationRef, destinationTypeLabel, waitedLabel } from './format';

describe('waitedLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

  /** 3572분처럼 분만 계속 커지면 상담자가 얼마나 기다렸는지 가늠할 수 없다. */
  it('한 시간이 넘으면 시간과 일 단위로 접는다', () => {
    expect(waitedLabel(minutesAgo(0))).toBe('방금');
    expect(waitedLabel(minutesAgo(42))).toBe('42분');
    expect(waitedLabel(minutesAgo(90))).toBe('1시간 30분');
    expect(waitedLabel(minutesAgo(120))).toBe('2시간');
    expect(waitedLabel(minutesAgo(3572))).toBe('2일 11시간');
  });

  /** 서버 시각이 클라이언트보다 조금 앞서도 음수가 보이면 안 된다. */
  it('미래 시각은 방금으로 본다', () => {
    expect(waitedLabel(minutesAgo(-5))).toBe('방금');
  });
});

describe('consultationRef', () => {
  it('상담자가 불러 줄 수 있는 짧은 번호로 줄인다', () => {
    expect(consultationRef('cs_340992da17324de2a638795abe22d897')).toBe('#22D897');
  });
});

describe('destinationTypeLabel', () => {
  it('모르는 값은 그대로 두고, 없으면 null이다', () => {
    expect(destinationTypeLabel('facility')).toBe('역 시설');
    expect(destinationTypeLabel('parking')).toBe('parking');
    expect(destinationTypeLabel(undefined)).toBeNull();
  });
});
