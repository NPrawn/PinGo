import { updateUserSession } from '@/shared/api';
import { useUserSessionStore } from '../model/userSessionStore';

const RETRY_DELAYS_MS = [0, 500, 1500] as const;

let syncWorker: Promise<boolean> | undefined;

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

async function updateWithRetry(userSessionId: string, currentNodeId: number): Promise<boolean> {
  for (const delayMs of RETRY_DELAYS_MS) {
    if (delayMs > 0) await wait(delayMs);
    try {
      await updateUserSession(userSessionId, { currentNodeId });
      return true;
    } catch {
      // 다음 지연 구간에서 재시도한다. 모두 실패하면 보류 상태를 유지한다.
    }
  }
  return false;
}

async function drainPendingCurrentNode(): Promise<boolean> {
  while (true) {
    const { userSessionId, pendingCurrentNodeId, clearPendingCurrentNodeId } =
      useUserSessionStore.getState();
    if (!userSessionId || pendingCurrentNodeId == null) return true;

    const synced = await updateWithRetry(userSessionId, pendingCurrentNodeId);
    if (!synced) return false;

    // 동기화 중 더 최신 위치가 들어왔다면 그 값은 지우지 않고 다음 반복에서 이어서 보낸다.
    clearPendingCurrentNodeId(pendingCurrentNodeId);
  }
}

/** 저장된 현재 노드 동기화를 실행한다. 동시에 호출돼도 작업자는 하나만 유지한다. */
export function syncPendingCurrentNode(): Promise<boolean> {
  syncWorker ??= drainPendingCurrentNode().finally(() => {
    syncWorker = undefined;
  });
  return syncWorker;
}

/** 화면 전환 전에 보류 상태를 영속화하고 백그라운드 동기화를 시작한다. */
export function queueCurrentNodeSync(currentNodeId: number): void {
  useUserSessionStore.getState().setPendingCurrentNodeId(currentNodeId);
  void syncPendingCurrentNode();
}
