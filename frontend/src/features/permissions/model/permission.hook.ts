import { useCallback, useEffect, useRef, useState } from 'react';
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
  /** 세 권한이 모두 허용되어 서비스 전체 기능을 사용할 수 있는지 여부. */
  canUseService: boolean;
  /** 위치, 카메라, 마이크 권한을 요청하고 결과를 저장한다. */
  requestPermissions: () => Promise<RequiredPermissionsResult>;
  /** 요청 상태와 저장된 권한 상태를 초기화한다. */
  reset: () => void;
}

/**
 * 아직 요청하지 않은 상태를 나타내는 기본 결과.
 *
 * 요청이 이미 진행 중일 때 중복 호출이 들어오면 이 값을 반환한다.
 */
const idleRequiredPermissionsResult: RequiredPermissionsResult = {
  canUseService: false,
  location: { kind: 'location', status: 'idle' },
  camera: { kind: 'camera', status: 'idle' },
  microphone: { kind: 'microphone', status: 'idle' },
};

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
   * 언마운트 이후 상태 갱신을 막기 위한 마운트 여부 참조.
   */
  const isMountedRef = useRef(true);

  /**
   * 요청 중복 실행을 막기 위한 진행 여부 참조.
   *
   * phase 상태만으로는 같은 tick 안의 연속 호출을 막지 못하므로 ref를 함께 사용한다.
   */
  const isRequestingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const requestPermissions = useCallback(async (): Promise<RequiredPermissionsResult> => {
    /**
     * 이미 요청이 진행 중이면 새 요청을 시작하지 않는다.
     * 진행 중일 때는 마지막 결과(없으면 idle 결과)를 그대로 반환한다.
     */
    if (isRequestingRef.current) {
      return result ?? idleRequiredPermissionsResult;
    }

    isRequestingRef.current = true;

    if (isMountedRef.current) {
      setPhase('requesting');
      // 이전 결과가 남아 있으면 새 요청의 진행 상황과 섞이므로 먼저 비운다.
      setStatuses(idleStatuses);
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

    try {
      return settle(
        await requestRequiredPermissions({
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
    } finally {
      isRequestingRef.current = false;
    }
  }, [result]);

  const reset = useCallback(() => {
    clearStoredRequiredPermissionState();

    if (isMountedRef.current) {
      setPhase('idle');
      setResult(null);
      setStored(null);
      setStatuses(idleStatuses);
    }
  }, []);

  const canUseService = result ? result.canUseService : (stored?.canUseService ?? false);

  return {
    phase,
    isRequesting: phase === 'requesting',
    result,
    stored,
    statuses,
    canUseService,
    requestPermissions,
    reset,
  };
}
