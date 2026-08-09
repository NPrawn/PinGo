import { renderHook } from '@testing-library/react';
import { useTranslatedSpeech } from './useTranslatedSpeech';

class SpeechSynthesisUtteranceStub {
  lang = '';
  readonly text: string;

  constructor(text: string) {
    this.text = text;
  }
}

describe('useTranslatedSpeech', () => {
  const speak = vi.fn();
  const cancel = vi.fn();

  beforeEach(() => {
    speak.mockReset();
    cancel.mockReset();
    vi.stubGlobal('SpeechSynthesisUtterance', SpeechSynthesisUtteranceStub);
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speak, cancel },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('새 번역문으로 갱신될 때 재생 중인 음성을 취소하지 않는다', () => {
    const { rerender } = renderHook(
      ({ text }) => useTranslatedSpeech(text, 'ko-KR'),
      { initialProps: { text: '첫 번째 안내입니다.' } },
    );

    rerender({ text: '두 번째 안내입니다.' });

    expect(speak).toHaveBeenCalledTimes(2);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('상담 화면을 떠나면 재생 중인 음성과 대기열을 취소한다', () => {
    const { unmount } = renderHook(() => useTranslatedSpeech('안내 음성입니다.', 'ko-KR'));

    unmount();

    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
