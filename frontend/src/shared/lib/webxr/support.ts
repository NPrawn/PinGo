import type { XrSupport } from './types';

/**
 * immersive-ar 지원 여부를 검사한다.
 *
 * `docs/기술_의사결정_정리.md` 11.7의 판별 기준을 따른다. 오류 name은 원인을 지시하지
 * 않으므로 사용하지 않고, navigator.xr 존재와 isSessionSupported 결과만 본다.
 *
 * isSessionSupported가 던지는 경우도 unsupported로 본다. 실측 대상 기기에서는 값을
 * 반환했으나 미지원 기기의 동작은 확인하지 못했고, 어느 쪽이든 세션을 열 수 없다는
 * 결론이 같기 때문이다.
 *
 * @param xr 테스트에서 가짜 XRSystem을 주입하기 위한 인자. 기본값은 navigator.xr이다.
 */
export async function detectXrSupport(xr: XRSystem | undefined = navigator.xr): Promise<XrSupport> {
  if (!xr) {
    return 'no-xr-object';
  }

  try {
    return (await xr.isSessionSupported('immersive-ar')) ? 'supported' : 'unsupported';
  } catch {
    return 'unsupported';
  }
}

/**
 * 지원 상태를 사용자에게 재시도 안내를 해도 되는지로 환산한다.
 *
 * 11.7은 immersive-ar 미지원 기기에 재시도 안내를 하지 않도록 정한다. 재시도해도 결과가
 * 바뀌지 않기 때문이다.
 */
export function canAttemptXrSession(support: XrSupport): boolean {
  return support === 'supported';
}
