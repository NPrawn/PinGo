import type { XrFailureReason, XrSupport } from './types';

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

/**
 * 실패한 세션을 다시 시도해도 결과가 달라질 수 있는지 판단한다.
 *
 * 11.7의 사용자 안내 기준을 그대로 옮긴 것이다. 다음 세 경우는 재시도해도 같은 결과이므로
 * 화면에 재시도 수단을 두지 않는다.
 *
 * - no-xr-object / unsupported: 브라우저·기기가 immersive-ar을 지원하지 않는다.
 * - permission-blocked: 한 번 거부하면 프롬프트 없이 즉시 실패한다. **앱 안에서 되돌릴 수
 *   없고** 브라우저 사이트 설정에서 권한을 초기화해야 한다.
 *
 * 어느 경우든 추적 없이 위치 재인식과 수동 위치 선택으로 안내가 완결되어야 한다.
 *
 * `no-render-layer`는 재시도 대상에 넣는다. GL 컨텍스트 확보는 기기 능력이 아니라 그 시점의
 * 자원 상황에 달려 있어(다른 탭이 컨텍스트를 많이 물고 있으면 실패할 수 있다) 다시 시도하면
 * 결과가 달라질 수 있다.
 */
export function canRetryXrSession(reason: XrFailureReason | undefined): boolean {
  return (
    reason === 'request-rejected' ||
    reason === 'no-reference-space' ||
    reason === 'no-render-layer'
  );
}
