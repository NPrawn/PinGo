/**
 * 우리가 스피커로 내보낸 번역 음성이 우리 마이크로 되돌아오는 구간을 표시한다.
 *
 * 이 되먹임은 상담을 통째로 망가뜨린 적이 있다. 상담원 화면은 사용자 발화를 한국어로 옮겨
 * 소리내어 읽는데 상담원 인식기도 `ko-KR` 이라, 그 소리를 다시 알아들으면 **사용자가 한 말이
 * 상담원 발화로 기록된다.** 사용자 화면도 구조가 같다 — 읽어 주는 언어와 알아듣는 언어가
 * 양쪽 모두 일치한다. 전문이 통째로 한쪽 화자로 남던 원인이다.
 *
 * 소리의 출처가 **우리 기기**라는 점이 중요하다. 상대와 아무리 멀리 떨어져 있어도 이 되먹임은
 * 그대로 일어난다. 통화 오디오에 걸린 에코 제거도 도움이 되지 않는다 — Chrome 의 음성 인식은
 * 페이지의 `getUserMedia` 와 별도로 기본 입력 장치를 열기 때문이다.
 */

/**
 * 말이 끝난 뒤에도 이만큼은 되먹임으로 본다.
 *
 * 인식기는 소리를 받은 뒤 조금 늦게 문장을 확정한다. 발화가 끝나는 순간에 걸친 소리는
 * `speaking` 이 내려간 다음에야 결과로 나오므로, 말하는 동안만 막으면 문장 끝자락이 샌다.
 */
const ECHO_TAIL_MS = 700;

/**
 * 지금 읽고 있는 문장 수.
 *
 * 참·거짓 하나로 두면 문장이 잇따라 재생될 때 앞 문장의 `onend` 가 뒤 문장의 구간을 열어
 * 버린다. 세어서 마지막 하나가 끝날 때만 꼬리 시간을 시작한다.
 */
let speakingCount = 0;
let lastSpeechEndedAt = Number.NEGATIVE_INFINITY;

export function markSpeechStarted(): void {
  speakingCount += 1;
}

export function markSpeechEnded(): void {
  speakingCount = Math.max(0, speakingCount - 1);
  if (speakingCount === 0) lastSpeechEndedAt = Date.now();
}

/**
 * 지금 들린 소리를 우리가 낸 것으로 봐야 하는지.
 *
 * 우리가 센 것 외에 `speechSynthesis.speaking` 도 함께 본다. 다른 곳에서 시작한 발화나
 * 앞 화면이 남긴 대기열도 똑같이 마이크로 돌아오기 때문이다.
 */
export function isCaptionEchoWindow(): boolean {
  if (speakingCount > 0) return true;
  if ('speechSynthesis' in window && window.speechSynthesis.speaking) return true;
  return Date.now() - lastSpeechEndedAt < ECHO_TAIL_MS;
}

/** 테스트가 상태를 되돌릴 때 쓴다. 상담 사이에 앞 상담의 꼬리가 남지 않게 한다. */
export function resetCaptionEchoGuard(): void {
  speakingCount = 0;
  lastSpeechEndedAt = Number.NEGATIVE_INFINITY;
}
