export type DemoCaption = {
  delayMs: number;
  durationMs: number;
  text: string;
  language: string;
};

export const DEMO_PHARMACY_DRAW_DELAY_MS = 19500;

/** Fixed conversation used by the presentation build. Delays are relative to screen entry. */
export const DEMO_CAPTIONS: Record<'USER' | 'COUNSELOR', readonly DemoCaption[]> = {
  USER: [
    {
      delayMs: 10000,
      durationMs: 2200,
      text: "Hello. I'm looking for a pharmacy.",
      language: 'en-US',
    },
    { delayMs: 23500, durationMs: 1400, text: 'Thank you very much.', language: 'en-US' },
  ],
  COUNSELOR: [
    {
      delayMs: 5000,
      durationMs: 1600,
      text: '안녕하세요. 무엇을 도와드릴까요?',
      language: 'ko-KR',
    },
    {
      delayMs: 16000,
      durationMs: 3000,
      text: '알겠습니다. 지도에 약국 위치를 표시해 드릴게요. 여기로 표시해 드리겠습니다.',
      language: 'ko-KR',
    },
  ],
};

const DEMO_TRANSLATIONS: Record<string, { ko: string; en: string }> = {
  "Hello. I'm looking for a pharmacy.": {
    ko: '안녕하세요. 약국을 찾고 있어요.',
    en: "Hello. I'm looking for a pharmacy.",
  },
  'Thank you very much.': {
    ko: '정말 감사합니다.',
    en: 'Thank you very much.',
  },
  '안녕하세요. 무엇을 도와드릴까요?': {
    ko: '안녕하세요. 무엇을 도와드릴까요?',
    en: 'Hello. How can I help you?',
  },
  '알겠습니다. 지도에 약국 위치를 표시해 드릴게요. 여기로 표시해 드리겠습니다.': {
    ko: '알겠습니다. 지도에 약국 위치를 표시해 드릴게요. 여기로 표시해 드리겠습니다.',
    en: 'Of course. I will mark the pharmacy on the map for you, right here.',
  },
};

export function demoCaptionTranslationOf(text: string, targetLanguage: string): string | null {
  const translation = DEMO_TRANSLATIONS[text];
  if (!translation) return null;

  return targetLanguage.toLowerCase().startsWith('ko') ? translation.ko : translation.en;
}
