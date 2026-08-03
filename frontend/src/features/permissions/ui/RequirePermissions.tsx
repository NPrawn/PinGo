import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { usePermissionStore } from '@/entities/permission';
import { USER_ROUTES } from '@/shared/config';
import { hasKnownPermissionState, revokedKindsOf } from '../model/permission.query';
import { getStoredRequiredPermissionState } from '../model/permission.storage';
import { useBrowserPermissionStates } from '../model/permission.watch';

/**
 * 권한이 살아 있는 동안에만 안쪽 화면을 보여 준다.
 *
 * 권한 화면은 진입할 때 한 번 묻고 끝난다. 그래서 사용자가 다음 화면으로 넘어간 뒤 브라우저
 * 설정에서 권한을 꺼도 서비스는 그대로 돌아갔다 — 카메라가 꺼진 채 촬영 화면이 열리고,
 * 마이크 없이 상담이 연결되는 식이다. 세 권한을 모두 요구하기로 한 이상, 도중에 사라진 것도
 * 처음부터 없었던 것과 같게 다뤄야 한다.
 *
 * 조회할 수 없는 브라우저(Safari 등)에서는 아무것도 막지 않는다. 모르는 것을 없는 것으로
 * 치면 권한이 멀쩡한 사용자까지 되돌려 보내게 된다.
 */
export function RequirePermissions() {
  const states = useBrowserPermissionStates();
  const sync = usePermissionStore((state) => state.sync);

  /**
   * 공유 상태를 실제 권한에 맞춘다.
   *
   * 상담·설정 화면이 이 값을 읽어 "허용됨"을 표시한다. 갱신하지 않으면 이미 꺼진 권한을
   * 켜져 있다고 말하게 된다.
   *
   * 조회할 수 없는 브라우저에서는 지난 요청의 기록으로 채운다. 그냥 두면 전역 상태가 초기값
   * (전부 거부)에 머무는데, Zustand 는 새로고침하면 비므로 Safari 사용자는 권한을 멀쩡히
   * 허용해 두고도 다음 화면에서 거부한 사람으로 취급된다. 지난 기록은 지금 이 순간의 사실이
   * 아니지만, 아무 근거 없는 초기값보다는 실제에 가깝다.
   */
  useEffect(() => {
    if (hasKnownPermissionState(states)) {
      sync({
        loc: states.location === 'granted',
        cam: states.camera === 'granted',
        mic: states.microphone === 'granted',
      });
      return;
    }

    const stored = getStoredRequiredPermissionState();
    if (!stored) {
      return;
    }

    sync({
      loc: stored.location === 'granted',
      cam: stored.camera === 'granted',
      mic: stored.microphone === 'granted',
    });
  }, [states, sync]);

  /*
    조회 결과가 오기 전에는 막지 않는다. 첫 프레임에 되돌려 보내면 권한이 멀쩡한 사용자도
    화면을 여는 순간 권한 화면으로 튕겨 나간다.
  */
  if (revokedKindsOf(states).length > 0) {
    return <Navigate to={USER_ROUTES.PERMISSION} replace />;
  }

  return <Outlet />;
}
