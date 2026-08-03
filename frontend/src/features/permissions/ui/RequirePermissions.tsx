import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { usePermissionStore } from '@/entities/permission';
import { USER_ROUTES } from '@/shared/config';
import {
  hasKnownPermissionState,
  queryPermissionStates,
  revokedKindsOf,
  watchPermissionStates,
  UNKNOWN_PERMISSION_STATES,
  type BrowserPermissionStates,
} from '../model/permission.query';

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
  const [states, setStates] = useState<BrowserPermissionStates>(UNKNOWN_PERMISSION_STATES);
  const sync = usePermissionStore((state) => state.sync);

  useEffect(() => {
    let disposed = false;
    const apply = (next: BrowserPermissionStates) => {
      if (!disposed) {
        setStates(next);
      }
    };

    void queryPermissionStates().then(apply);
    const unwatch = watchPermissionStates(apply);

    return () => {
      disposed = true;
      unwatch();
    };
  }, []);

  /**
   * 공유 상태를 실제 권한에 맞춘다.
   *
   * 상담·설정 화면이 이 값을 읽어 "허용됨"을 표시한다. 갱신하지 않으면 이미 꺼진 권한을
   * 켜져 있다고 말하게 된다.
   */
  useEffect(() => {
    if (!hasKnownPermissionState(states)) {
      return;
    }

    sync({
      loc: states.location === 'granted',
      cam: states.camera === 'granted',
      mic: states.microphone === 'granted',
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
