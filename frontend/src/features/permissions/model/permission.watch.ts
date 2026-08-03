import { useEffect, useState } from 'react';
import {
  queryPermissionStates,
  watchPermissionStates,
  UNKNOWN_PERMISSION_STATES,
  type BrowserPermissionStates,
} from './permission.query';

/**
 * 브라우저가 기억하는 권한 상태를 읽기만 한다. 요청하지 않으므로 팝업이 뜨지 않는다.
 *
 * 권한을 받아 내는 화면은 `usePermissionRequest`를 쓴다. 이 훅은 상태를 보여 주기만 하는
 * 쪽(설정 화면)과 상태가 유지되는지 지켜보기만 하는 쪽(경로 가드)을 위한 것이다.
 *
 * 저장된 값을 쓰지 않는 이유는 그것이 지난 요청의 기록일 뿐이기 때문이다. 사용자가 그 뒤
 * 브라우저 설정에서 권한을 껐어도 저장값은 그대로라, 설정 화면이 이미 꺼진 권한을 허용됨으로
 * 보여 주게 된다.
 */
export function useBrowserPermissionStates(): BrowserPermissionStates {
  const [states, setStates] = useState<BrowserPermissionStates>(UNKNOWN_PERMISSION_STATES);

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

  return states;
}
