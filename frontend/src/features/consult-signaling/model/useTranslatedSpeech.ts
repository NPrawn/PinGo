import { useEffect, useRef } from 'react';
import { markSpeechEnded, markSpeechStarted, resetCaptionEchoGuard } from './captionEchoGuard';

/** Reads each newly translated final caption aloud on the receiving device. */
export function useTranslatedSpeech(text: string, language: string, enabled = true) {
  const lastSpokenRef = useRef('');

  /** 상담 화면을 떠난 뒤 이전 번역 음성이 계속 재생되지 않게 대기열까지 비운다. */
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      // 대기열을 비우면 `onend` 가 오지 않을 수 있다. 남은 셈을 여기서 털어야 다음 상담이
      // 열리지 않는 되먹임 구간에 갇히지 않는다.
      resetCaptionEchoGuard();
    };
  }, []);

  useEffect(() => {
    const value = text.trim();
    if (!enabled || !value || value === lastSpokenRef.current || !('speechSynthesis' in window)) {
      return;
    }

    lastSpokenRef.current = value;
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = language;
    /**
     * 읽는 동안과 그 직후를 되먹임 구간으로 표시한다.
     *
     * 이 소리는 우리 스피커에서 나와 우리 마이크로 돌아온다. 표시해 두지 않으면 인식기가
     * 그것을 이 사람의 발화로 알아듣고 전문에 남긴다 — 상대가 한 말이 내 발화로 기록된다.
     */
    markSpeechStarted();
    utterance.onend = markSpeechEnded;
    // 재생이 중간에 끊겨도 셈은 반드시 돌려놓는다. 안 그러면 구간이 영영 닫히지 않는다.
    utterance.onerror = markSpeechEnded;
    window.speechSynthesis.speak(utterance);
  }, [enabled, language, text]);
}
