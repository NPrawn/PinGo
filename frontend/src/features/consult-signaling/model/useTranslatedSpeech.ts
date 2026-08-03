import { useEffect, useRef } from 'react';

/** Reads each newly translated final caption aloud on the receiving device. */
export function useTranslatedSpeech(text: string, language: string, enabled = true) {
  const lastSpokenRef = useRef('');

  /** 상담 화면을 떠난 뒤 이전 번역 음성이 계속 재생되지 않게 대기열까지 비운다. */
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
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
    window.speechSynthesis.speak(utterance);
  }, [enabled, language, text]);
}
