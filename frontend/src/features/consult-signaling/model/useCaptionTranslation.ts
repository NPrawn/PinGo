import { useEffect, useRef, useState } from 'react';
import { translateConsultationCaption } from '@/shared/api';
import { demoCaptionTranslationOf } from './demoCaptions';

type TranslationResult = {
  consultationId: string;
  targetLanguage: string;
  captionId: string;
  text: string;
};

/** Translates each confirmed caption once and keeps results associated with its caption ID. */
export function useCaptionTranslation(
  consultationId: string | null,
  text: string,
  targetLanguage: string,
  captionId: string | null = null,
  onTranslated?: (captionId: string, source: string, translated: string) => void,
) {
  const [result, setResult] = useState<TranslationResult | null>(null);
  const queuedRef = useRef(new Set<string>());
  const timersRef = useRef(new Map<string, number>());
  const disposedRef = useRef(false);
  const currentCaptionIdRef = useRef<string | null>(null);
  const source = text.trim();

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!source || !consultationId || !captionId) return;

    currentCaptionIdRef.current = captionId;
    const requestKey = `${consultationId}:${targetLanguage}:${captionId}`;
    if (queuedRef.current.has(requestKey)) return;
    queuedRef.current.add(requestKey);

    const timer = window.setTimeout(() => {
      timersRef.current.delete(requestKey);
      const demoTranslation = captionId.includes(':demo:')
        ? demoCaptionTranslationOf(source, targetLanguage)
        : null;
      if (demoTranslation !== null) {
        if (captionId === currentCaptionIdRef.current) {
          setResult({ consultationId, targetLanguage, captionId, text: demoTranslation });
        }
        onTranslated?.(captionId, source, demoTranslation);
        return;
      }

      void translateConsultationCaption(consultationId, { text: source, targetLanguage })
        .then((response) => {
          if (disposedRef.current) return;

          const translated = response.text || source;
          if (captionId === currentCaptionIdRef.current) {
            setResult({ consultationId, targetLanguage, captionId, text: translated });
          }
          onTranslated?.(captionId, source, translated);
        })
        .catch(() => {
          if (disposedRef.current) return;

          if (captionId === currentCaptionIdRef.current) {
            setResult({ consultationId, targetLanguage, captionId, text: source });
          }
          onTranslated?.(captionId, source, source);
        });
    }, 250);

    timersRef.current.set(requestKey, timer);
  }, [captionId, consultationId, onTranslated, source, targetLanguage]);

  return source &&
    result?.consultationId === consultationId &&
    result.targetLanguage === targetLanguage
    ? result.text
    : '';
}
