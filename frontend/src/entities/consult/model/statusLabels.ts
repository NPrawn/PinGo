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

/** 사용자가 고른 문제 유형의 한국어 라벨. */
export const CONSULTATION_PROBLEM_LABELS: Record<string, string> = {
  CANNOT_FIND_EXIT: '출구를 찾을 수 없어요',
  LOST: '현재 위치를 모르겠어요',
  ROUTE_HELP: '경로 안내가 필요해요',
  OTHER: '기타 문의',
};

export function consultationProblemLabel(problemType: string) {
  return CONSULTATION_PROBLEM_LABELS[problemType] ?? problemType;
}
