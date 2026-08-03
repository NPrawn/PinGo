/**
 * 상담자 화면이 상담 데이터를 사람이 읽을 수 있는 문자열로 바꾸는 함수들.
 *
 * 서버 값을 그대로 두면 상담자에게 의미가 없는 것들이 있다. 분 단위로만 늘어나는 대기
 * 시간, 32자리 식별자, 날짜가 빠진 시각 같은 것들이다.
 */

/** 상담 대기 시간. 분이 계속 커지면 읽을 수 없으므로 시·일 단위로 접는다. */
export function waitedLabel(requestedAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(requestedAt).getTime()) / 60_000));
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return minutes % 60 === 0 ? `${hours}시간` : `${hours}시간 ${minutes % 60}분`;
  }

  const days = Math.floor(hours / 24);
  return hours % 24 === 0 ? `${days}일` : `${days}일 ${hours % 24}시간`;
}

/** 날짜까지 함께 보여 준다. 시각만 있으면 오늘 것인지 지난주 것인지 알 수 없다. */
export function consultationDateTimeLabel(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 화면에 쓰는 짧은 상담 번호.
 *
 * 서버 식별자는 `cs_` 뒤에 32자리가 붙어서 상담자가 읽거나 불러 줄 수 없다. 문의를 남길 때
 * 쓰라고 뒤 6자리만 보여 주고, 전체 값은 표시하는 쪽에서 `title`로 남긴다.
 */
export function consultationRef(consultationId: string) {
  return `#${consultationId.slice(-6).toUpperCase()}`;
}

/** 목적지를 무엇으로 골랐는지. 서버가 자유 문자열로 주므로 모르는 값은 그대로 둔다. */
const DESTINATION_TYPE_LABELS: Record<string, string> = {
  facility: '역 시설',
  place: '역 주변 장소',
  exit: '출구',
};

export function destinationTypeLabel(destinationType?: string) {
  if (!destinationType) return null;
  return DESTINATION_TYPE_LABELS[destinationType] ?? destinationType;
}
