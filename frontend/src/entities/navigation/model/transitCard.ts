export type TransitCardRecommendation = {
  name: string;
  reason: string;
  note: string;
};

/**
 * Recommends a transit card from trip length and daily ride count.
 *
 * Ported verbatim from the prototype's `cardRec()`.
 *
 * TODO: Confirm with the product team whether these thresholds and card names
 * should come from the backend instead of being hard-coded.
 */
export function recommendTransitCard(days: number, trips: number): TransitCardRecommendation {
  if (days >= 7) {
    return {
      name: '기후동행카드 (무제한권)',
      reason: `${days}일 · 하루 약 ${trips}회 이동이면 무제한권이 유리해요. 서울 지하철·버스를 마음껏 탈 수 있어요.`,
      note: '외국인은 실물 카드 구매 후 충전이 필요해요.',
    };
  }
  if (trips >= 5) {
    return {
      name: '1일권 · M-PASS',
      reason: `하루 ${trips}회 이상 자주 이동하면 정액 1일권이 절약돼요.`,
      note: '사용 당일 자정까지 유효해요.',
    };
  }
  return {
    name: '티머니 카드 (충전식)',
    reason: `${days}일 · 하루 ${trips}회 정도면 충전식이 가장 부담 없어요. 편의점에서 바로 구매·충전 가능해요.`,
    note: '잔액은 여행 후 환급 받을 수 있어요.',
  };
}
