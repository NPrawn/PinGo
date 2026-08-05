import { act, renderHook } from '@testing-library/react';
import { useCaptionTranslation } from './useCaptionTranslation';

const apiMocks = vi.hoisted(() => ({
  translateConsultationCaption: vi.fn(),
}));

vi.mock('@/shared/api', () => ({
  translateConsultationCaption: apiMocks.translateConsultationCaption,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('useCaptionTranslation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiMocks.translateConsultationCaption.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps each confirmed caption request and maps out-of-order results by captionId', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<{ text: string }>>>();
    apiMocks.translateConsultationCaption.mockImplementation(
      (_consultationId: string, request: { text: string }) => {
        const requestState = deferred<{ text: string }>();
        pending.set(request.text, requestState);
        return requestState.promise;
      },
    );
    const onTranslated = vi.fn();

    const { result, rerender } = renderHook(
      ({ captionId, text }: { captionId: string; text: string }) =>
        useCaptionTranslation('cs_1', text, 'ko', captionId, onTranslated),
      { initialProps: { captionId: 'caption-1', text: '첫 번째 문장' } },
    );

    rerender({ captionId: 'caption-2', text: '두 번째 문장' });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(apiMocks.translateConsultationCaption).toHaveBeenCalledTimes(2);

    await act(async () => {
      pending.get('두 번째 문장')?.resolve({ text: 'second' });
    });
    expect(result.current).toBe('second');

    await act(async () => {
      pending.get('첫 번째 문장')?.resolve({ text: 'first' });
    });
    expect(result.current).toBe('second');
    expect(onTranslated).toHaveBeenCalledWith('caption-1', '첫 번째 문장', 'first');
    expect(onTranslated).toHaveBeenCalledWith('caption-2', '두 번째 문장', 'second');
  });
});
