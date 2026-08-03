/**
 * 자막이 왜 오지 않는지 상대에게 알릴 때 쓰는 사유.
 *
 * 안내 문구가 아니라 사유만 보낸다. 같은 고장이라도 읽는 쪽에 따라 할 말이 다르기
 * 때문이다 — 상담원 콘솔에는 "주소창의 자물쇠에서 마이크를 허용해 주세요"가 맞지만,
 * 그 문장이 사용자 화면에 그대로 뜨면 사용자는 자기 마이크를 고치려 든다. 정작 고쳐야
 * 할 사람은 반대편에 있다.
 */
export type CaptionTrouble =
  /** 브라우저에 음성 인식 자체가 없다. Chrome·Edge 가 아닌 경우다. */
  | 'unsupported'
  /** 마이크 권한이 막혔다. */
  | 'blocked'
  /** 음성 인식 서버에 닿지 못한다. */
  | 'network'
  /** 인식은 돌고 있는데 소리가 한 조각도 들어오지 않는다. */
  | 'silent'
  /** 그 밖의 이유로 멈췄다. */
  | 'stopped';

const REASONS: Record<CaptionTrouble, string> = {
  unsupported: '브라우저가 음성 인식을 지원하지 않아',
  blocked: '마이크가 차단돼',
  network: '음성 인식 서버에 연결하지 못해',
  silent: '마이크 소리가 인식되지 않아',
  stopped: '음성 인식이 멈춰',
};

/**
 * 상대 쪽 자막이 오지 않는 이유를 읽을 수 있는 한 줄로 만든다.
 *
 * 자막이 비어 있는 것과 고장난 것은 화면에서 똑같아 보인다. 상대가 조용한 것인지 자막이
 * 죽은 것인지 구분할 수 없으면, 사용자는 아무 말도 오지 않는 화면을 계속 들여다보게 된다.
 *
 * 목소리는 WebRTC 로 따로 흐르므로 자막이 죽어도 들린다. 그 사실을 함께 알려야 사용자가
 * 상담을 끊지 않는다.
 */
export function describeRemoteCaptionTrouble(trouble: string | null | undefined, speaker: string) {
  if (!trouble) return null;

  const reason = REASONS[trouble as CaptionTrouble] ?? REASONS.stopped;
  return `${speaker} 쪽 ${reason} 자막이 오지 않습니다. 목소리는 그대로 들립니다.`;
}
