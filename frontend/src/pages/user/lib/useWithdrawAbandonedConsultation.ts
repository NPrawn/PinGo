import { useEffect, useRef, useState } from 'react';
import { useConsultStore } from '@/entities/consult';
import { useUserSessionStore } from '@/entities/user-session';
import { releaseConsultMedia } from '@/features/consult-signaling';
import { cancelConsultation } from '@/shared/api';

/**
 * 대기 화면에서 되돌아 나온 상담을 거둬들인다. (S15P11A206-353)
 *
 * 취소 버튼을 거치지 않고 기기 뒤로가기로 대기 화면을 벗어나면 서버의 상담은 대기열에 그대로
 * 남고, 잡아 둔 카메라·마이크도 계속 물려 있다. 상담자가 수락해도 사용자는 이미 다른 화면에
 * 있어 아무 응답이 없다.
 *
 * **대기 화면 쪽에서 정리하는 방법은 둘 다 쓸 수 없었다.** 언마운트 정리는 StrictMode 가
 * 마운트 직후 한 번 실행해서, 개발 빌드에서는 기다리기도 전에 상담이 취소된다. `popstate` 는
 * 라우터가 먼저 받아 화면을 동기적으로 바꾸고, 그 과정에서 대기 화면이 떨어져 나가며 리스너도
 * 함께 사라진다 — 전달 중에 제거된 리스너는 호출되지 않는다(실제 브라우저에서 확인했다).
 * 그래서 되돌아 **도착하는** 화면에서 정리한다.
 *
 * 마운트 시점에 남아 있던 상담만 본다. 앞으로 나아가는 길에서는 이 값이 비어 있고 상담을
 * 만드는 것은 그 뒤의 일이라, 방금 만든 상담을 거둬들일 일은 없다.
 */
export function useWithdrawAbandonedConsultation() {
  const clearConsultation = useConsultStore((state) => state.clearConsultation);
  /*
    구독하지 않고 마운트 시점 값만 붙잡는다. 구독하면 이 화면에서 상담을 만드는 순간 값이
    바뀌면서 방금 만든 상담을 거둬들이게 된다.
  */
  const [abandoned] = useState(() => ({
    consultationId: useConsultStore.getState().consultationId,
    userSessionId: useUserSessionStore.getState().userSessionId,
  }));
  /* StrictMode 가 이 effect 를 두 번 실행해도 취소는 한 번만 보낸다. */
  const withdrawnRef = useRef(false);

  useEffect(() => {
    if (!abandoned.consultationId || withdrawnRef.current) return;

    withdrawnRef.current = true;
    releaseConsultMedia();
    if (abandoned.userSessionId) {
      void cancelConsultation(abandoned.consultationId, abandoned.userSessionId).catch(
        () => undefined,
      );
    }
    clearConsultation();
  }, [abandoned, clearConsultation]);
}
