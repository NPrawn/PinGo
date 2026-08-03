import { useEffect, useState } from 'react';
import {
  queryPermissionStates,
  revokedKindsOf,
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

/**
 * 세 권한 중 하나라도 사라졌는지.
 *
 * 경로 가드는 이 경우 권한 화면으로 돌려보내면 그만이지만, 상담 화면은 그럴 수 없다. 잡아 둔
 * 카메라·마이크를 놓아 주고 서버의 상담도 끝내야 해서, 되돌려 보내기 전에 할 일이 있다.
 * 그래서 상담 화면들은 가드 대신 이 훅으로 직접 알아채고 스스로 정리한다.
 *
 * 조회할 수 없는 브라우저에서는 늘 거짓이다. 모르는 것을 사라진 것으로 치면 멀쩡히 진행 중인
 * 상담을 끊게 된다.
 */
export function usePermissionsRevoked(): boolean {
  const states = useBrowserPermissionStates();
  return revokedKindsOf(states).length > 0;
}
