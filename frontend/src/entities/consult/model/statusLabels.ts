/** 상담 세션 상태의 한국어 라벨. 상담자 콘솔의 목록·상세·이력에서 함께 쓴다. */
export const CONSULTATION_STATUS_LABELS: Record<string, string> = {
  WAITING: '대기 중',
  ACCEPTED: '상담 중',
  IN_PROGRESS: '진행 중',
  ENDED: '상담 종료',
  CANCELED: '사용자 취소',
  REJECTED: '거절됨',
  FAILED: '연결 실패',
};

export function consultationStatusLabel(status: string) {
  return CONSULTATION_STATUS_LABELS[status] ?? status;
}

/** 더 이상 이어 갈 수 없는 상담. 누가 끝냈든 양쪽 화면이 상담을 접어야 하는 상태들이다. */
export const CLOSED_CONSULTATION_STATUSES = new Set(['ENDED', 'CANCELED', 'REJECTED', 'FAILED']);

export function isClosedConsultation(status?: string) {
  return status != null && CLOSED_CONSULTATION_STATUSES.has(status);
}

/**
 * 사용자가 고른 문제 유형의 한국어 라벨.
 *
 * 서버 `ProblemType` 의 7개 값을 모두 덮는다. 빠진 값이 있으면 상담자 화면에
 * `CANNOT_FIND_LOCATION` 같은 코드가 그대로 노출된다.
 */
export const CONSULTATION_PROBLEM_LABELS: Record<string, string> = {
  CANNOT_FIND_LOCATION: '현재 위치를 못 찾겠어요',
  WRONG_DIRECTION: '길을 잘못 든 것 같아요',
  CANNOT_FIND_EXIT: '출구를 못 찾겠어요',
  GATE_PROBLEM: '개찰구에서 막혔어요',
  ELEVATOR_NEEDED: '엘리베이터가 필요해요',
  CARD_PROBLEM: '교통카드에 문제가 있어요',
  OTHER: '기타 문의',
};

export function consultationProblemLabel(problemType?: string) {
  if (!problemType) return '문의 유형 미지정';
  return CONSULTATION_PROBLEM_LABELS[problemType] ?? problemType;
}
