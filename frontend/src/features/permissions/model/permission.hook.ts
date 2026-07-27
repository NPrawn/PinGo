import { useCallback, useEffect, useRef, useState } from 'react';
import { requestRequiredPermissions, type RequiredPermissionsResult } from './permission.service';
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
    }

    try {
      const requestResult = await requestRequiredPermissions();
      const savedState = saveRequiredPermissionState(requestResult);

      if (isMountedRef.current) {
        setResult(requestResult);
        setStored(savedState);
        setPhase('completed');
      }

      return requestResult;
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
    }
  }, []);

  const canUseService = result ? result.canUseService : (stored?.canUseService ?? false);

  return {
    phase,
    isRequesting: phase === 'requesting',
    result,
    stored,
    canUseService,
    requestPermissions,
    reset,
  };
}
