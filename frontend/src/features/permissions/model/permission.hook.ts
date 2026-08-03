import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deniedKindsOf,
  hasKnownPermissionState,
  promptableKindsOf,
  queryPermissionStates,
  watchPermissionStates,
  UNKNOWN_PERMISSION_STATES,
  type BrowserPermissionState,
  type BrowserPermissionStates,
} from './permission.query';
import {
  requestRequiredPermissions,
  type PermissionKind,
  type PermissionStatus,
  type RequiredPermissionsProgress,
  type RequiredPermissionsResult,
} from './permission.service';
import {
  clearStoredRequiredPermissionState,
  getStoredRequiredPermissionState,
  saveRequiredPermissionState,
  type StoredRequiredPermissionState,
} from './permission.storage';

/**
 * 권한 요청 진행 단계.
 *
 * - idle: 아직 요청하지 않음
 * - requesting: 브라우저 권한 요청 진행 중
 * - completed: 요청이 끝나고 결과가 준비됨
 */
export type PermissionRequestPhase = 'idle' | 'requesting' | 'completed';

/**
 * 세 권한의 현재 상태.
 *
 * 요청이 진행되는 동안 단계별로 갱신되므로, 화면은 위치 팝업에 답한 시점에
 * 카메라·마이크를 아직 묻기 전이어도 위치 결과를 먼저 반영할 수 있다.
 */
export type RequiredPermissionStatuses = Record<PermissionKind, PermissionStatus>;

/**
 * usePermissionRequest 훅이 화면에 제공하는 값.
 *
 * 이 훅은 권한 요청 실행과 상태 저장까지의 "로직"만 담당한다.
 * 실제 권한 요청 화면(UI)이나 화면 전환은 이 훅을 사용하는 쪽에서 처리한다.
 */
export interface UsePermissionRequestValue {
  /** 권한 요청 진행 단계. */
  phase: PermissionRequestPhase;
  /** 권한 요청이 진행 중인지 여부. */
  isRequesting: boolean;
  /** 이번 세션에서 실행한 권한 요청 결과. 아직 요청하지 않았으면 null. */
  result: RequiredPermissionsResult | null;
  /** sessionStorage에 마지막으로 저장된 권한 상태. 저장된 값이 없으면 null. */
  stored: StoredRequiredPermissionState | null;
  /** 권한별 현재 상태. 요청이 진행되는 동안 단계별로 갱신된다. */
  statuses: RequiredPermissionStatuses;
  /** 브라우저가 기억하고 있는 권한 상태. 조회할 수 없으면 모두 `unknown`이다. */
  browserStates: BrowserPermissionStates;
  /**
   * 요청해도 팝업이 뜨지 않는 권한.
   *
   * 비어 있지 않으면 화면은 재요청 대신 브라우저 설정 안내로 갈아타야 한다. 다시 요청해 봐야
   * 즉시 거절돼 같은 화면으로 되돌아올 뿐이다.
   */
  blockedKinds: PermissionKind[];
  /** 요청하면 팝업이 뜨는 권한. 하나라도 있으면 재요청이 의미가 있다. */
  promptableKinds: PermissionKind[];
  /** 세 권한이 모두 허용되어 서비스 전체 기능을 사용할 수 있는지 여부. */
  canUseService: boolean;
  /** 위치, 카메라, 마이크 권한을 요청하고 결과를 저장한다. */
  requestPermissions: () => Promise<RequiredPermissionsResult>;
  /** 요청 상태와 저장된 권한 상태를 초기화한다. */
  reset: () => void;
}

const idleStatuses: RequiredPermissionStatuses = {
  location: 'idle',
  camera: 'idle',
  microphone: 'idle',
};

/**
 * 이전에 저장된 상태를 화면 표시용 상태로 되돌린다.
 *
 * 사용자가 권한 화면으로 되돌아왔을 때 이미 확인된 권한을 다시 미요청으로
 * 보여주지 않기 위한 것이다.
 */
function toStatuses(stored: StoredRequiredPermissionState | null): RequiredPermissionStatuses {
  if (!stored) {
    return idleStatuses;
  }

  return {
    location: stored.location,
    camera: stored.camera,
    microphone: stored.microphone,
  };
}

/**
 * 브라우저가 아는 상태 하나를 화면 표시용 상태로 옮긴다.
 *
 * `unknown`은 있던 값을 그대로 둔다. 조회할 수 없다는 뜻이지 미요청이라는 뜻이 아니어서,
 * `idle`로 덮으면 방금 확인한 결과가 "아직 안 물어봤음"으로 되돌아간다.
 */
function reconcileStatus(
  previous: PermissionStatus,
  state: BrowserPermissionState,
): PermissionStatus {
  if (state === 'granted') {
    return 'granted';
  }

  if (state === 'denied') {
    return 'denied';
  }

  return state === 'prompt' ? 'idle' : previous;
}

function withBrowserStates(
  previous: RequiredPermissionStatuses,
  states: BrowserPermissionStates,
): RequiredPermissionStatuses {
  return {
    location: reconcileStatus(previous.location, states.location),
    camera: reconcileStatus(previous.camera, states.camera),
    microphone: reconcileStatus(previous.microphone, states.microphone),
  };
}

/**
 * 권한 요청이 예상치 못한 예외로 끝난 경우의 결과.
 *
 * 이미 확정된 권한은 그대로 두고, 확인하지 못한 권한만 error로 표시한다.
 * 어느 단계에서 실패했는지와 무관하게 서비스 진입은 막는다.
 */
function toFailedResult(confirmed: RequiredPermissionsProgress): RequiredPermissionsResult {
  return {
    canUseService: false,
    location: { kind: 'location', status: confirmed.location ?? 'error' },
    camera: { kind: 'camera', status: confirmed.camera ?? 'error' },
    microphone: { kind: 'microphone', status: confirmed.microphone ?? 'error' },
  };
}

/**
 * 위치, 카메라, 마이크 권한 요청 로직을 React 화면에서 쓸 수 있게 감싼 훅.
 *
 * - 마운트 시 sessionStorage에 저장된 이전 권한 상태를 불러온다.
 *   (재방문 시 화면이 재요청 여부를 판단할 수 있도록 참조값을 제공한다.)
 * - requestPermissions 호출 시 service의 requestRequiredPermissions를 실행하고
 *   결과를 storage에 저장한다.
 *
 * MediaStream, GeolocationPosition 같은 브라우저 객체는 저장하지 않고,
 * 화면 분기에 필요한 상태 문자열만 storage에 남긴다. (AGENTS.md 규칙)
 */
export function usePermissionRequest(): UsePermissionRequestValue {
  const [phase, setPhase] = useState<PermissionRequestPhase>('idle');
  const [result, setResult] = useState<RequiredPermissionsResult | null>(null);
  const [stored, setStored] = useState<StoredRequiredPermissionState | null>(() =>
    getStoredRequiredPermissionState(),
  );
  const [statuses, setStatuses] = useState<RequiredPermissionStatuses>(() =>
    toStatuses(getStoredRequiredPermissionState()),
  );

  /**
   * 브라우저가 기억하고 있는 권한 상태.
   *
   * 저장된 값(sessionStorage)은 "지난번에 물었더니 이랬다"일 뿐이라 그 사이 사용자가 설정에서
   * 바꾼 것을 모른다. 실제로 권한을 재설정하고 새로고침해도 화면이 옛 상태를 그대로 보여 주던
   * 이유가 이것이다. 조회할 수 있는 브라우저에서는 이쪽을 진실로 삼는다.
   */
  const [browserStates, setBrowserStates] =
    useState<BrowserPermissionStates>(UNKNOWN_PERMISSION_STATES);

  /**
   * 브라우저에 한 번이라도 물어봤는지.
   *
   * 묻기 전에는 저장값만으로 진입을 허락하지 않는다. 그 짧은 사이에 진입을 허락하면, 지난번
   * 기록이 남아 있는 사용자는 권한을 꺼 두었더라도 조회 결과가 도착하기 전에 다음 화면으로
   * 넘어가 버린다.
   */
  const [checked, setChecked] = useState(false);

  /**
   * 언마운트 이후 상태 갱신을 막기 위한 마운트 여부 참조.
   */
  const isMountedRef = useRef(true);

  /**
   * 진행 중인 요청.
   *
   * phase 상태만으로는 같은 tick 안의 연속 호출을 막지 못하므로 ref를 함께 사용한다.
   * 중복 호출에는 새 요청을 시작하지 않고 진행 중인 Promise를 그대로 공유한다.
   * 지난 요청 결과를 대신 반환하면 호출한 화면이 낡은 결과로 상태를 덮거나
   * 화면을 옮길 수 있다.
   */
  const inFlightRef = useRef<Promise<RequiredPermissionsResult> | null>(null);

  /** 요청을 시작할 때 읽어야 하는 최신 조회 결과. 콜백은 렌더마다 새로 만들지 않는다. */
  const browserStatesRef = useRef<BrowserPermissionStates>(UNKNOWN_PERMISSION_STATES);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * 조회 결과를 화면 상태에 반영한다.
   *
   * 요청이 진행 중이면 건너뛴다. 그때는 팝업에 답할 때마다 `onProgress`가 더 정확한 상태를
   * 넣고 있어서, 뒤늦게 도착한 조회 결과가 그것을 되돌릴 수 있다.
   */
  const applyBrowserStates = useCallback((states: BrowserPermissionStates) => {
    browserStatesRef.current = states;

    if (!isMountedRef.current) {
      return;
    }

    // 조회에 실패했더라도 물어보기는 했다. 그 사실 자체가 저장값을 쓸지 가르는 기준이다.
    setChecked(true);

    if (!hasKnownPermissionState(states)) {
      return;
    }

    setBrowserStates(states);

    if (inFlightRef.current === null) {
      setStatuses((previous) => withBrowserStates(previous, states));
    }
  }, []);

  /**
   * 마운트할 때 실제 권한 상태를 확인하고, 그 뒤 변화를 계속 따라간다.
   *
   * 구독이 중요한 이유는 거부된 권한 때문이다. 브라우저 설정에서 권한을 켜는 순간을 페이지가
   * 알 수 있는 유일한 방법이라, 이것이 없으면 안내를 따른 사용자도 새로고침해야 한다.
   */
  useEffect(() => {
    void queryPermissionStates().then(applyBrowserStates);

    return watchPermissionStates(applyBrowserStates);
  }, [applyBrowserStates]);

  const requestPermissions = useCallback((): Promise<RequiredPermissionsResult> => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    if (isMountedRef.current) {
      setPhase('requesting');
      /**
       * 이전 결과가 남아 있으면 새 요청의 진행 상황과 섞이므로 먼저 비운다.
       *
       * 다만 브라우저가 아는 것까지 지우지는 않는다. 이미 막혀 있는 권한을 잠시 `미요청`으로
       * 되돌리면, 곧 같은 자리에 `거부됨`이 다시 찍히면서 화면이 깜빡인다.
       */
      setStatuses(withBrowserStates(idleStatuses, browserStatesRef.current));
    }

    /**
     * 예외로 중단된 경우에도 어디까지 확인했는지 알아야 하므로,
     * onProgress로 들어온 확정 상태를 따로 모아 둔다.
     */
    const confirmed: RequiredPermissionsProgress = {};

    const settle = (settledResult: RequiredPermissionsResult): RequiredPermissionsResult => {
      const savedState = saveRequiredPermissionState(settledResult);

      if (isMountedRef.current) {
        setResult(settledResult);
        setStored(savedState);
        setStatuses({
          location: settledResult.location.status,
          camera: settledResult.camera.status,
          microphone: settledResult.microphone.status,
        });
        setPhase('completed');
      }

      return settledResult;
    };

    const run = async (): Promise<RequiredPermissionsResult> => {
      try {
        return settle(
          await requestRequiredPermissions({
            deniedKinds: deniedKindsOf(browserStatesRef.current),
            onProgress: (progress) => {
              Object.assign(confirmed, progress);

              if (isMountedRef.current) {
                setStatuses((previous) => ({ ...previous, ...progress }));
              }
            },
          }),
        );
      } catch {
        /**
         * 브라우저 API가 예외를 던진 경우.
         *
         * 여기서 다시 throw하면 호출한 화면이 요청 중 상태에 갇히므로,
         * 진입 불가 결과로 정리해서 반환한다.
         */
        return settle(toFailedResult(confirmed));
      }
    };

    /**
     * 요청이 끝나도 다시 조회하지 않는다.
     *
     * 어느 쪽이 막혔는지 가려내려고 한 번 넣었다가 뺐다. 조회는 방금 받아 낸 허용을
     * 되돌릴 수 있기 때문이다 — 크롬의 "이번만 허용"은 요청이 성공해도 `prompt`로 남아서,
     * 그 값을 그대로 반영하면 방금 켜진 권한이 미요청으로 되돌아간다.
     *
     * 잃는 것도 없다. 실제로 상태가 바뀌었다면 구독이 알려 주고, 이미 막힌 권한은
     * `deniedKinds`로 걸러 각각 따로 요청하므로 결과가 뭉뚱그려지지 않는다.
     */
    const pending = run().finally(() => {
      inFlightRef.current = null;
    });

    inFlightRef.current = pending;

    return pending;
  }, []);

  const reset = useCallback(() => {
    clearStoredRequiredPermissionState();

    if (isMountedRef.current) {
      setPhase('idle');
      setResult(null);
      setStored(null);
      // 저장값만 지운다. 브라우저가 기억하는 권한은 이 앱이 되돌릴 수 있는 것이 아니다.
      setStatuses(withBrowserStates(idleStatuses, browserStatesRef.current));
    }
  }, []);

  /**
   * 세 권한이 모두 허용됐는지.
   *
   * 조회할 수 있으면 그쪽을 먼저 본다. 저장값은 지난 요청의 기록이라, 그 뒤 사용자가 설정에서
   * 권한을 껐거나 켠 것을 반영하지 못한다.
   */
  const canUseService = !checked
    ? false
    : hasKnownPermissionState(browserStates)
      ? statuses.location === 'granted' &&
        statuses.camera === 'granted' &&
        statuses.microphone === 'granted'
      : result
        ? result.canUseService
        : (stored?.canUseService ?? false);

  return {
    phase,
    isRequesting: phase === 'requesting',
    result,
    stored,
    statuses,
    browserStates,
    blockedKinds: deniedKindsOf(browserStates),
    promptableKinds: promptableKindsOf(browserStates),
    canUseService,
    requestPermissions,
    reset,
  };
}
