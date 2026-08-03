import { useConsultStore } from './consultStore';

describe('useConsultStore', () => {
  afterEach(() => {
    useConsultStore.getState().reset();
  });

  /**
   * 이전 상담에서 매긴 별점이 다음 상담까지 넘어오면, 아직 아무것도 누르지 않았는데
   * 종료 화면에 이미 평가된 것처럼 별이 채워진 채로 보인다.
   */
  it('새 상담을 시작하면 이전 상담의 별점이 남아 있지 않다', () => {
    useConsultStore.getState().rate(4);
    expect(useConsultStore.getState().satisfaction).toBe(4);

    useConsultStore.getState().setConsultation('consultation-2');

    expect(useConsultStore.getState().satisfaction).toBe(0);
    expect(useConsultStore.getState().consultationId).toBe('consultation-2');
  });
});
