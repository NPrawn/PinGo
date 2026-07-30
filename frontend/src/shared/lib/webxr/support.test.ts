import { describe, expect, it, vi } from 'vitest';
import { canAttemptXrSession, detectXrSupport } from './support';

/**
 * jsdom에는 navigator.xr이 없으므로 XRSystem을 주입해 검사한다.
 *
 * 실기기 동작은 S15P11A206-294에서 확인했고(`docs/WebXR_검증_결과.md` 3.0),
 * 여기서는 11.7 판별 규칙이 코드에 그대로 반영됐는지만 본다.
 */
function fakeXr(isSessionSupported: XRSystem['isSessionSupported']): XRSystem {
  return { isSessionSupported } as XRSystem;
}

describe('detectXrSupport', () => {
  it('navigator.xr이 없으면 no-xr-object를 반환한다', async () => {
    await expect(detectXrSupport(undefined)).resolves.toBe('no-xr-object');
  });

  it('immersive-ar를 지원하면 supported를 반환한다', async () => {
    const isSessionSupported = vi.fn().mockResolvedValue(true);

    await expect(detectXrSupport(fakeXr(isSessionSupported))).resolves.toBe('supported');
    expect(isSessionSupported).toHaveBeenCalledWith('immersive-ar');
  });

  it('immersive-ar를 지원하지 않으면 unsupported를 반환한다', async () => {
    await expect(detectXrSupport(fakeXr(vi.fn().mockResolvedValue(false)))).resolves.toBe(
      'unsupported',
    );
  });

  /**
   * 11.7이 오류 name을 판별 근거로 쓰지 않기로 한 항목이다.
   * 탐지 자체가 실패해도 세션을 열 수 없다는 결론은 같으므로 unsupported로 수렴한다.
   */
  it('isSessionSupported가 거부되면 unsupported로 수렴한다', async () => {
    await expect(
      detectXrSupport(fakeXr(vi.fn().mockRejectedValue(new Error('NotSupportedError')))),
    ).resolves.toBe('unsupported');
  });

  it('isSessionSupported가 동기로 던져도 unsupported로 수렴한다', async () => {
    await expect(
      detectXrSupport(
        fakeXr(
          vi.fn(() => {
            throw new TypeError('unsupported mode');
          }),
        ),
      ),
    ).resolves.toBe('unsupported');
  });
});

describe('canAttemptXrSession', () => {
  it('supported일 때만 세션 시도를 허용한다', () => {
    expect(canAttemptXrSession('supported')).toBe(true);
    expect(canAttemptXrSession('unsupported')).toBe(false);
    expect(canAttemptXrSession('no-xr-object')).toBe(false);
  });
});
