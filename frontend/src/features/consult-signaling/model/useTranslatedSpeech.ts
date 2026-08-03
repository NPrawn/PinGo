import { useEffect, useRef } from 'react';

/** Reads each newly translated final caption aloud on the receiving device. */
export function useTranslatedSpeech(text: string, language: string, enabled = true) {
  const lastSpokenRef = useRef('');

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
