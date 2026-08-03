import type { PermissionKind } from './permission.service';

/**
 * 브라우저가 기억하고 있는 권한 상태.
 *
 * `PermissionStatus`(요청 결과)와는 다르다. 그쪽은 "이번에 물어봤더니 이랬다"이고, 이쪽은
 * "물어보기 전에 이미 이렇게 정해져 있다"이다. 둘을 구분해야 하는 이유는 하나뿐이다 —
 * **`denied`는 페이지가 되돌릴 수 없다.** 브라우저는 거부한 오리진을 기억하고, 다시
 * `getUserMedia`·`getCurrentPosition`을 불러도 팝업 없이 즉시 거절한다. 그걸 모르고 재요청하면
 * 화면은 "허용해 주세요"와 즉시 거절 사이를 무한히 오간다.
 *
 * - granted: 이미 허용됨. 물어볼 필요가 없다
 * - prompt: 아직 묻지 않았다. 요청하면 실제로 팝업이 뜬다
 * - denied: 거부돼 있다. 요청해도 팝업이 뜨지 않는다. 브라우저 설정에서만 풀 수 있다
 * - unknown: 조회할 수 없다. 판단 근거가 없으므로 요청해 보는 수밖에 없다
 */
export type BrowserPermissionState = 'granted' | 'prompt' | 'denied' | 'unknown';

export type BrowserPermissionStates = Record<PermissionKind, BrowserPermissionState>;

export const PERMISSION_KINDS: readonly PermissionKind[] = ['location', 'camera', 'microphone'];

export const UNKNOWN_PERMISSION_STATES: BrowserPermissionStates = {
  location: 'unknown',
  camera: 'unknown',
  microphone: 'unknown',
};

/** Permissions API가 쓰는 이름. 위치만 표준 이름이 다르다. */
const PERMISSION_NAMES: Record<PermissionKind, string> = {
  location: 'geolocation',
  camera: 'camera',
  microphone: 'microphone',
};

/**
 * `PermissionStatus`의 필요한 부분만.
 *
 * DOM 타입을 그대로 쓰지 않는 이유는 `camera`·`microphone`이 표준 `PermissionName`에 없어
 * 어차피 조회 인자를 캐스팅해야 하고, 이 모듈이 쓰는 것은 `state`와 `onchange` 둘뿐이기
 * 때문이다.
 */
type PermissionStatusLike = {
  state: BrowserPermissionState;
  onchange: (() => void) | null;
};

/**
 * 권한 하나를 조회한다. 조회할 수 없으면 `null`이다.
 *
 * Safari는 Permissions API 자체가 없고, Firefox는 있지만 `camera`·`microphone`을 모르는 이름으로
 * 보고 `TypeError`를 던진다. 둘 다 "조회 불가"로 같게 다루고 호출부가 요청으로 확인하게 한다.
 */
async function queryOne(kind: PermissionKind): Promise<PermissionStatusLike | null> {
  const permissions = navigator.permissions;

  if (!permissions?.query) {
    return null;
  }

  try {
    const status = await permissions.query({
      name: PERMISSION_NAMES[kind],
    } as unknown as PermissionDescriptor);

    return status as unknown as PermissionStatusLike;
  } catch {
    return null;
  }
}

/**
 * 세 권한의 현재 상태를 브라우저에 직접 묻는다.
 *
 * 팝업이 뜨지 않는다. 이 함수는 상태를 읽기만 하며 권한을 요청하지 않는다.
 */
export async function queryPermissionStates(): Promise<BrowserPermissionStates> {
  const entries = await Promise.all(
    PERMISSION_KINDS.map(
      async (kind) => [kind, (await queryOne(kind))?.state ?? 'unknown'] as const,
    ),
  );

  return Object.fromEntries(entries) as BrowserPermissionStates;
}

/**
 * 권한 상태가 바뀌면 알려 준다. 정리 함수를 돌려준다.
 *
 * **거부된 권한에서 빠져나오는 유일한 길이다.** 사용자가 주소창이나 설정에서 권한을 켜면
 * 페이지는 그 사실을 알 방법이 없어 새로고침을 해야 했다. `onchange`를 구독하면 켜는 즉시
 * 화면이 따라가므로, 안내를 읽고 설정을 바꾼 사용자가 같은 화면에 그대로 남지 않는다.
 *
 * 조회할 수 없는 브라우저에서는 구독할 것이 없어 아무 일도 하지 않는다.
 */
export function watchPermissionStates(
  listener: (states: BrowserPermissionStates) => void,
): () => void {
  let disposed = false;
  const watched: PermissionStatusLike[] = [];

  void (async () => {
    const statuses = await Promise.all(PERMISSION_KINDS.map((kind) => queryOne(kind)));

    // 구독을 준비하는 사이에 화면을 벗어났으면 붙이지 않는다.
    if (disposed) {
      return;
    }

    statuses.forEach((status) => {
      if (!status) {
        return;
      }

      watched.push(status);
      status.onchange = () => {
        void queryPermissionStates().then((states) => {
          if (!disposed) {
            listener(states);
          }
        });
      };
    });
  })();

  return () => {
    disposed = true;
    watched.forEach((status) => {
      status.onchange = null;
    });
  };
}

/** 하나라도 조회에 성공했는지. 전부 실패했으면 조회 결과로 판단할 것이 없다. */
export function hasKnownPermissionState(states: BrowserPermissionStates): boolean {
  return PERMISSION_KINDS.some((kind) => states[kind] !== 'unknown');
}

/**
 * 허용돼 있지 않다고 **확인된** 권한.
 *
 * `unknown`은 넣지 않는다. 조회할 수 없는 브라우저에서 모르는 것을 없는 것으로 치면, 권한이
 * 멀쩡한 사용자까지 권한 화면으로 돌려보내게 된다.
 *
 * `prompt`는 넣는다. 사용자가 설정에서 권한을 초기화하면 그 값으로 돌아가므로, 허용된 적이
 * 있었더라도 지금은 없는 것이 맞다.
 */
export function revokedKindsOf(states: BrowserPermissionStates): PermissionKind[] {
  return PERMISSION_KINDS.filter(
    (kind) => states[kind] === 'denied' || states[kind] === 'prompt',
  );
}

/** 요청해도 팝업이 뜨지 않는 권한. 화면이 설정 안내로 갈아탈 기준이다. */
export function deniedKindsOf(states: BrowserPermissionStates): PermissionKind[] {
  return PERMISSION_KINDS.filter((kind) => states[kind] === 'denied');
}

/** 이미 허용돼 있어 물어볼 필요가 없는 권한. 확인하겠다고 장치를 다시 잡으면 오히려 실패한다. */
export function grantedKindsOf(states: BrowserPermissionStates): PermissionKind[] {
  return PERMISSION_KINDS.filter((kind) => states[kind] === 'granted');
}

/** 요청하면 팝업이 뜨는 권한. 하나라도 있으면 [모두 허용하기]가 실제로 무언가를 한다. */
export function promptableKindsOf(states: BrowserPermissionStates): PermissionKind[] {
  return PERMISSION_KINDS.filter((kind) => states[kind] === 'prompt' || states[kind] === 'unknown');
}
