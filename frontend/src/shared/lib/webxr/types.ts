/**
 * WebXR 상대 위치 추적 모듈의 공통 타입. (S15P11A206-295)
 *
 * 이 모듈은 XR reference space 안에서 끝난다. 지도 미터 좌표 변환과 floorId 판정은
 * 앵커의 forwardMap 출처가 미결이므로(`docs/역삼역_FE_좌표연동_스펙.md` 8.5) 다루지 않는다.
 */

/**
 * `immersive-ar` 지원 여부.
 *
 * `docs/기술_의사결정_정리.md` 11.7의 앞 두 조건에 대응한다.
 * - no-xr-object: navigator.xr 자체가 없다. 이 브라우저에서는 추적을 쓸 수 없다.
 * - unsupported: isSessionSupported가 false다. 이 기기에서는 쓸 수 없고 재시도 안내를 하지 않는다.
 * - supported: 세션을 시도할 수 있다. 권한 허용 여부는 여기서 알 수 없다.
 *
 * 지원 여부와 권한은 별개다. 11.7대로 동의 상태는 미리 조회할 수 없으므로
 * supported가 곧 세션 시작 성공을 뜻하지 않는다.
 */
export type XrSupport = 'no-xr-object' | 'unsupported' | 'supported';

/**
 * 추적 상태.
 *
 * - idle: 아직 세션을 시작하지 않았다.
 * - starting: requestSession 진행 중이다.
 * - warming-up: reference space까지 성공했으나 첫 pose가 아직 없다.
 *   실측에서 0.96~1.54초가 걸리며, 이 구간에는 확정 위치를 만들지 않는다(11.4).
 * - tracking: pose가 들어오고 있다.
 * - lost: pose가 연속으로 없다. 위치 갱신을 멈추고 복구되면 자동 재개한다(11.7).
 * - ended: 세션이 정상 종료됐다. 재시작은 사용자 조작으로만 한다.
 * - failed: 세션을 시작하지 못했다. 사유는 XrFailureReason에 담긴다.
 */
export type XrTrackingStatus =
  'idle' | 'starting' | 'warming-up' | 'tracking' | 'lost' | 'ended' | 'failed';

/**
 * 세션 시작 실패 사유.
 *
 * **오류 name으로 판별하지 않는다.** 1차 실기기 검증에서 권한 거부가 NotAllowedError가
 * 아니라 NotSupportedError로 나타났다(11.7). 판별은 isSessionSupported 결과와
 * requestSession 실패까지 걸린 시간으로 한다.
 *
 * - no-xr-object / unsupported: XrSupport 검사에서 이미 걸러진 경우다.
 * - permission-blocked: 이전에 거부해 프롬프트 없이 즉시 실패한 것으로 보인다.
 *   앱 안에서 복구할 수 없고 브라우저 사이트 설정에서 권한을 초기화해야 한다.
 * - request-rejected: 이번 요청을 거부했거나 일시적으로 실패했다. 재시도할 수 있다.
 * - no-reference-space: 세션은 열렸으나 쓸 수 있는 reference space가 없다.
 */
export type XrFailureReason =
  'no-xr-object' | 'unsupported' | 'permission-blocked' | 'request-rejected' | 'no-reference-space';

/**
 * 한 XR frame에서 읽은 pose 값.
 *
 * 확정 주기를 통과하기 전의 원시 관측값이다. 좌표는 XR reference space 기준이며
 * 미터 단위다. 평면은 (x, z)이고 y가 상하다.
 */
export interface XrPoseReading {
  /** reference space 원점 기준 위치. 원점은 세션을 시작한 순간의 단말 위치다. */
  position: { x: number; y: number; z: number };
  /** 단말 방향 쿼터니언. */
  orientation: { x: number; y: number; z: number; w: number };
  /**
   * +y 축 기준 우수 회전각(도). 전방 벡터는 (-sin yaw, -cos yaw)다.
   *
   * 회전은 확정 트리거가 아니지만(11.4) 표시 갱신과 정렬 계산에 필요하므로 함께 담는다.
   */
  yawDeg: number;
  /** XRFrame이 전달한 시각. performance.now()와 같은 기준이다. */
  timestamp: DOMHighResTimeStamp;
}

/**
 * 확정된 pose 스냅샷.
 *
 * 매 XR frame이 아니라 11.4 확정 주기를 통과한 프레임만 스냅샷이 된다.
 * **이 주기는 이 모듈이 책임진다.** 스냅샷을 받는 쪽은 다시 throttle하지 않는다.
 */
export interface XrPoseSnapshot extends XrPoseReading {
  /** 이 스냅샷을 발화시킨 조건. */
  trigger: XrSnapshotTrigger;
}

/**
 * 스냅샷 발화 조건.
 *
 * - first: 추적이 잡힌 뒤 첫 스냅샷.
 * - move: 직전 스냅샷 대비 기준 거리 이상 이동했다.
 * - heartbeat: 이동이 없어도 heartbeat 간격이 지났다.
 *
 * 회전은 포함하지 않는다. 1차 실측에서 손에 든 단말의 yaw 흔들림만으로 상시 참이 되어
 * 규칙이 "1초마다 갱신"으로 퇴화했다(11.4).
 */
export type XrSnapshotTrigger = 'first' | 'move' | 'heartbeat';

/**
 * 확정 주기 기준값. `docs/기술_의사결정_정리.md` 11.4 표와 같다.
 */
export interface XrSamplingRule {
  /** 직전 확정 위치 대비 이 거리(m) 이상 이동하면 확정한다. */
  moveM: number;
  /** 확정 사이 최소 간격(ms). */
  minIntervalMs: number;
  /** 이동이 없을 때 이 간격(ms)마다 한 번 확정한다. */
  heartbeatMs: number;
}
