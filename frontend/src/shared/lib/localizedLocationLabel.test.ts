import { localizedLocationLabelOf } from './localizedLocationLabel';

describe('localizedLocationLabelOf', () => {
  it('현재 언어의 사용자용 위치명을 고른다', () => {
    expect(
      localizedLocationLabelOf('B2 · 개찰구 A 인근', 'B2 · Near Fare Gate A', 'ko', 'B2'),
    ).toBe('B2 · 개찰구 A 인근');
    expect(
      localizedLocationLabelOf('B2 · 개찰구 A 인근', 'B2 · Near Fare Gate A', 'en', 'B2'),
    ).toBe('B2 · Near Fare Gate A');
  });

  it('내부 노드 코드만 있으면 안전한 기본 문구를 쓴다', () => {
    expect(localizedLocationLabelOf('B3_R006', null, 'ko', 'B3')).toBe('B3');
    expect(localizedLocationLabelOf('B3_R006', null, 'en', 'Yeoksam Station')).toBe(
      'Yeoksam Station',
    );
  });
});
