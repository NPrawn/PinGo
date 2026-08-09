import { sessionExpiryMs } from './sessionExpiry';

describe('sessionExpiryMs', () => {
  it('시간대가 없는 백엔드 세션 시각을 UTC로 해석한다', () => {
    expect(sessionExpiryMs('2026-08-04T07:52:58.67128769')).toBe(
      Date.parse('2026-08-04T07:52:58.67128769Z'),
    );
  });

  it('명시된 시간대는 그대로 사용한다', () => {
    expect(sessionExpiryMs('2026-08-04T16:52:58+09:00')).toBe(
      Date.parse('2026-08-04T16:52:58+09:00'),
    );
  });
});
