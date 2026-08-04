import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isClosedConsultation, useConsultStore } from '@/entities/consult';
import { useNavigationStore, type IndoorPoint } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { useUserSessionStore } from '@/entities/user-session';
import {
  describeRemoteCaptionTrouble,
  releaseConsultMedia,
  swapConsultVideoTrack,
  useCaptionTranslation,
  useConsultSignaling,
  useTranslatedSpeech,
} from '@/features/consult-signaling';
import { usePermissionsRevoked } from '@/features/permissions';
import { useRemoteScreenDraw } from '@/features/shared-screen-draw';
import { endConsultationByUser, getConsultation } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import {
  xrSessionController,
  type XrCameraStreamHandle,
  type XrCameraStreamState,
} from '@/shared/lib/webxr';
import type { ConsultDataEvent } from '@/shared/types';
import { Icon, MapPreview } from '@/shared/ui';
import { IndoorMapView } from '@/widgets/indoor-map';
import { PhoneFrame } from '@/widgets/phone-frame';
import { useXrNavigationSession, XrSessionNotice, XrTrackingBadge } from '@/widgets/xr-navigation';
import styles from './ConsultSessionPage.module.css';

/** 상담자가 끊었는지 확인하는 간격. 끊긴 걸 알아채기까지 사용자가 기다리는 시간이기도 하다. */
const CONSULTATION_WATCH_MS = 4000;

/** Screen 20 (FR-U-015 / FR-W-002) — live consultation from the user's side. */
export function ConsultSessionPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const userLanguage = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const consultationId = useConsultStore((state) => state.consultationId);
  const signalingRoomId = useConsultStore((state) => state.signalingRoomId);
  const signalingAccessToken = useConsultStore((state) => state.signalingAccessToken);
  const setSignalingRoom = useConsultStore((state) => state.setSignalingRoom);
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const [tokenError, setTokenError] = useState<string | null>(null);
  /** 상담원이 화면 위에 그린 선을 받아 그대로 얹는다. */
  const { canvasRef: annotationRef, apply: applyAnnotation } = useRemoteScreenDraw();
  const setDestinationName = useNavigationStore((state) => state.setDestination);
  const setTargetNode = useNavigationStore((state) => state.setTargetNode);
  const setCurrentLocation = useNavigationStore((state) => state.setCurrentLocation);

  /**
   * 상담원이 보낸 이벤트를 화면에 옮긴다.
   *
   * 그리기는 캔버스로, 지도 지점 변경은 안내 상태로 간다. 상담원이 지도에서 짚어 준 곳을
   * 그대로 목적지·현재 위치로 삼는다. 바뀐 값은 곧 새 MAP_SYNC 로 상담원 화면에도 돌아가
   * 양쪽이 같은 곳을 가리키게 된다.
   */
  const handleDataEvent = useCallback(
    (event: ConsultDataEvent) => {
      // 지도 상태는 이쪽이 보내는 것이라 되받을 것이 없다.
      if (event.eventType === 'MAP_SYNC') return;

      if (event.eventType === 'DESTINATION_CHANGE_REQUESTED') {
        const { nameKo, linkedNodeId } = event.payload;
        setDestinationName(nameKo);
        /**
         * 도착 노드까지 함께 옮긴다. 이름만 바꾸면 경로는 옛 목적지를 향한 채로 남아,
         * 화면에 적힌 곳과 지도에 그려진 길이 서로 다른 곳을 가리킨다.
         */
        if (linkedNodeId != null) setTargetNode(linkedNodeId, nameKo);
        return;
      }

      if (event.eventType === 'CURRENT_LOCATION_CORRECTED') {
        const { nameKo, floorId, mapX, mapY, linkedNodeId } = event.payload;
        // 노드를 모르는 시설이면 경로를 다시 계산할 수 없어 위치만 옮긴다.
        if (linkedNodeId != null) {
          setCurrentLocation({ nodeId: linkedNodeId, floorId, label: nameKo, mapX, mapY });
        }
        return;
      }

      applyAnnotation(event);
    },
    [applyAnnotation, setCurrentLocation, setDestinationName, setTargetNode],
  );
  const {
    remoteVideoRef,
    status,
    error,
    reconnecting,
    remoteCaption,
    remoteCaptionFinal,
    remoteCaptionError,
    captionsSupported,
    captionError,
    sendConsultEvent,
    eventChannelOpen,
    tokenRejected,
    replaceLocalVideoTrack,
  } = useConsultSignaling(
    signalingRoomId,
    'USER',
    signalingAccessToken,
    handleDataEvent,
    userLanguage,
  );
  /** 상담원이 말한 한국어를 영어 자막으로 옮겨 보여 준다. */
  const translatedRemoteCaption = useCaptionTranslation(
    consultationId,
    remoteCaption,
    userLanguage,
  );
  useTranslatedSpeech(translatedRemoteCaption, userLanguage, remoteCaptionFinal);
  /**
   * 옮긴 문장을 큰 자리에, 지금 들어오는 원문을 아래 줄에 둔다.
   *
   * 번역은 말이 끝난 문장에만 건다 — 중간 결과는 계속 고쳐 쓰여 옮겨 봐야 곧 달라지고,
   * 번역 요청도 초당 몇 번씩 나간다. 그런데 옮긴 문장만 띄우면 상담원이 다음 말을 하는
   * 내내 화면이 지난 문장에서 멈춰 있다. 첫 문장만 실시간으로 흐르고 그 뒤로는 문장이
   * 끝날 때까지 아무 변화가 없어, 사용자는 자막이 멈춘 것으로 본다.
   *
   * 그래서 옮긴 문장은 큰 자리에 그대로 두되(읽어야 하는 것은 자기 언어로 된 쪽이다),
   * 지금 들어오는 원문은 아래 줄에 흘려보낸다.
   */
  const captionPrimary = translatedRemoteCaption || remoteCaption;
  /** 큰 자리와 같은 말이면 두 번 쓰지 않는다(아직 옮기지 못해 원문이 위에 올라간 경우다). */
  const captionSource = remoteCaption && remoteCaption !== captionPrimary ? remoteCaption : '';
  /** 상담원 쪽 자막이 죽었다는 사실. 이쪽 마이크 문제와 섞이지 않게 따로 띄운다. */
  const remoteCaptionNotice = describeRemoteCaptionTrouble(remoteCaptionError, '상담원');
  const station = useStationStore((state) => state.station);
  const stationId = useStationStore((state) => state.stationId);
  /**
   * 안내 화면이 쓰는 값을 그대로 읽는다.
   *
   * 예전에는 목적지가 없을 때 `강남파이낸스센터`로 채웠는데, 사용자가 고른 적 없는 곳을
   * 목적지라고 띄우면 상담자도 그것을 보고 안내를 시작한다.
   */
  const destination = useNavigationStore((state) => state.destination);
  const currentLocationLabel = useNavigationStore((state) => state.currentLocationLabel);
  const currentFloorId = useNavigationStore((state) => state.currentFloorId);
  const currentMapX = useNavigationStore((state) => state.currentMapX);
  const currentMapY = useNavigationStore((state) => state.currentMapY);
  const routeResult = useNavigationStore((state) => state.routeResult);
  const waypoints = useNavigationStore((state) => state.waypoints);
  const removeWaypoint = useNavigationStore((state) => state.removeWaypoint);

  /**
   * 상담 진입 시점의 확정 실내 위치. 앵커의 기준점이다.
   *
   * **첫 렌더 값에 고정한다.** 296 훅이 이 값을 진입 시점의 입력으로 다루므로(앵커가 생긴 뒤
   * 바꾸면 조용히 무시된다) 렌더마다 새 객체를 만들면 앵커 발화 effect 가 헛돈다. 안내 화면과
   * 같은 방식이다.
   */
  const [confirmedLocation] = useState<IndoorPoint | null>(() =>
    currentFloorId != null && currentMapX != null && currentMapY != null
      ? { floorId: currentFloorId, mapX: currentMapX, mapY: currentMapY }
      : null,
  );

  /**
   * 상담자에게 보낼 카메라 트랙. **세션보다 먼저 켠다.** (S15P11A206-89)
   *
   * 협상은 상담자가 시작하고 이 화면이 마운트되는 즉시 진행될 수 있다. 그때 실을 트랙이 이미
   * 있어야 하므로 캔버스 트랙을 먼저 만들어 둔다. 프레임은 세션이 열리고 추적이 잡힌 뒤부터
   * 흘러 들어온다 — 그동안 상담자 화면에는 검은 영상이 간다.
   */
  const cameraStreamRef = useRef<XrCameraStreamHandle | null>(null);
  const [cameraStreamState, setCameraStreamState] = useState<XrCameraStreamState>('idle');

  useEffect(() => {
    /**
     * **구독을 먼저 걸고 켠다.** 트랙을 만들 수 없는 기기에서는 켜는 순간 `unsupported`가
     * 되는데, 순서를 뒤집으면 그 전이를 놓쳐 화면이 영원히 "준비 중"에 머문다.
     */
    const unsubscribe = xrSessionController.subscribeCameraStream(setCameraStreamState);

    cameraStreamRef.current = xrSessionController.startCameraStream();

    return () => {
      unsubscribe();
      cameraStreamRef.current?.stop();
      cameraStreamRef.current = null;
    };
  }, []);

  /**
   * 세션을 열기 직전에 `getUserMedia` 카메라를 세션 카메라로 갈아 끼운다. (11.8)
   *
   * 두 가지를 함께 해야 한다. `replaceLocalVideoTrack`은 **지금 맺어진 연결**의 트랙을 재협상
   * 없이 바꾸고, `swapConsultVideoTrack`은 **맡겨 둔 스트림**을 바꿔 재연결에서도 같은 트랙이
   * 실리게 한다. 하나만 하면 지금은 되고 재연결에서 검은 화면이 되거나, 그 반대가 된다.
   *
   * 옛 카메라 트랙을 멈추는 것이 이 콜백의 본래 임무다. 남겨 두면 세션은 오류 없이 열리고
   * pose 만 영원히 들어오지 않는다.
   */
  const handOverCameraToSession = useCallback(async () => {
    const track = cameraStreamRef.current?.stream.getVideoTracks()[0] ?? null;

    // 연결이 먼저다. 트랙을 멈춘 뒤에 바꾸면 그 사이 프레임이 검게 나간다.
    await replaceLocalVideoTrack(track);
    swapConsultVideoTrack(track);
  }, [replaceLocalVideoTrack]);

  /**
   * XR 세션. 안내 화면과 같은 게이트를 쓴다.
   *
   * 상담 화면도 세션을 열어야 위치와 방향이 실시간으로 갱신된다. 열지 않으면 상담자가 보는 것은
   * 진입 순간의 스냅숏뿐이고, 사용자가 걸어가도 마커는 그 자리에 남는다.
   */
  const {
    overlayRef,
    isNoticeOpen,
    isSessionOpen,
    support,
    status: xrStatus,
    reason: xrReason,
    canRetry,
    confirm: startXrSession,
    continueWithoutTracking,
    currentLocation: trackedLocation,
    headingDeg,
    source,
    anchorStatus,
  } = useXrNavigationSession({
    currentIndoorLocation: confirmedLocation,
    releaseCamera: handOverCameraToSession,
  });

  /**
   * 지도에 그릴 현재 위치. 추적 값을 우선하고, 없으면 진입 시점 확정 위치를 쓴다.
   *
   * 추적이 잡히기 전(warming-up)이나 세션을 열지 않기로 한 경우에도 위치는 보여야 한다.
   * 그 구간에 마커를 지우면 사용자와 상담자 양쪽에서 위치가 사라진다.
   */
  const currentLocation = trackedLocation ?? confirmedLocation;

  /**
   * 지금 상담자에게 무엇이 건너가고 있는지.
   *
   * `unsupported`를 숨기지 않는다. 이 기기에서는 세션 카메라를 얻을 수 없다는 뜻이고, 그 상태로
   * 상담을 이어 가면 상담자는 검은 화면을 보면서 사용자는 보이고 있다고 믿는다. 무엇이 막혔는지
   * 적어야 사용자가 말로 설명할 수 있다.
   *
   * TODO(S15P11A206-89): `unsupported`인 기기의 대체 경로가 아직 없다. 실기기 확인 뒤 정한다.
   */
  const cameraShareLabel =
    cameraStreamState === 'streaming'
      ? '상담 연결됨 · 카메라 공유 중'
      : cameraStreamState === 'unsupported'
        ? '상담 연결됨 · 이 기기는 카메라를 보낼 수 없어요'
        : '상담 연결됨 · 카메라 준비 중';
  /**
   * 경로의 마지막 노드를 목적지 마커로 쓴다.
   *
   * 이름으로 시설을 되찾아 좌표를 맞추는 대신 경로 응답을 그대로 쓴다. 이름과 좌표가 서로
   * 다른 곳을 가리킬 일이 없고, 상담자에게도 같은 값을 그대로 넘길 수 있다.
   */
  const pathNodes = useMemo(
    () =>
      (routeResult?.pathNodes ?? []).filter(
        (node): node is { nodeId: number; floorId: number; mapX: number; mapY: number } =>
          node.nodeId != null && node.floorId != null && node.mapX != null && node.mapY != null,
      ),
    [routeResult],
  );
  const destinationPoint = pathNodes.at(-1) ?? null;

  /**
   * 보고 있는 지도를 상담자 화면에 그대로 옮긴다.
   *
   * 상담자는 사용자의 안내 상태를 알 방법이 없다. 이 스냅숏이 없으면 상담자 화면은 사용자와
   * 무관한 지도를 띄우고, 거기에 그린 길은 사용자가 보는 자리와 어긋난다.
   */
  useEffect(() => {
    if (stationId == null) return;

    sendConsultEvent({
      eventType: 'MAP_SYNC',
      payload: {
        stationId,
        floorId: currentLocation?.floorId ?? currentFloorId,
        current: currentLocation,
        /**
         * 사용자가 바라보는 방향. 상담자 화면은 이것으로 마커의 부채꼴만 돌린다 — 지도는
         * 북쪽에 고정한다(`rotateWithHeading={false}`). 역 구조를 짚어 주려면 도면의 방위가
         * 고정돼 있어야 한다.
         */
        headingDeg,
        destination: destinationPoint,
        destinationLabel: destination,
        pathNodes,
      },
    });
  }, [
    currentFloorId,
    currentLocation,
    destination,
    destinationPoint,
    /**
     * 방향이 바뀔 때도 다시 보낸다.
     *
     * 이 값은 위치와 **별도 주기**로 온다(11.4 — 회전은 위치 확정 트리거가 아니다). 의존성에
     * 넣지 않으면 제자리에서 몸만 돌렸을 때 상담자 화면이 따라오지 않는다.
     */
    headingDeg,
    pathNodes,
    sendConsultEvent,
    stationId,
    /**
     * 이벤트 채널이 열린 뒤에 다시 보낸다.
     *
     * 연결 상태가 `connected` 가 되는 것과 채널이 열리는 것은 같은 순간이 아니다. 그 틈에
     * 보낸 스냅숏은 상담자에게 닿지 못하고, 지도는 "기다리는 중"에서 멈춘다.
     */
    eventChannelOpen,
  ]);

  /**
   * 거절당한 토큰을 버린다. 아래 복구 effect 가 곧바로 새 토큰을 받아 온다.
   *
   * 토큰은 10분이면 만료되는데 상담은 그보다 오래간다. 예전에는 한 번 받은 토큰을 상담이
   * 끝날 때까지 그대로 썼기 때문에, 연결을 다시 맺어야 하는 순간 — 상담원이 새로고침했거나
   * 망이 끊긴 때 — handshake 가 401 로 거절되고 그대로 끝이었다. 상담원 화면에는
   * `연결 상태: signaling` 만 남고 사용자 화면은 영영 도착하지 않았다.
   */
  useEffect(() => {
    if (!tokenRejected || !signalingRoomId) return;
    setSignalingRoom(signalingRoomId, null);
  }, [setSignalingRoom, signalingRoomId, tokenRejected]);

  /**
   * 새로고침하면 signaling 토큰이 남지 않는다(짧은 만료 시간). 방은 알고 있으므로
   * 상세 조회로 토큰만 다시 받아 WebSocket 접속이 401로 거절되지 않게 한다.
   */
  useEffect(() => {
    if (!consultationId || !userSessionId || !signalingRoomId || signalingAccessToken) return;

    void getConsultation(consultationId, userSessionId)
      .then((consultation) => {
        if (!consultation.signalingRoomId || !consultation.signalingAccessToken) {
          setTokenError('상담 연결 정보를 받지 못했습니다.');
          return;
        }
        setSignalingRoom(consultation.signalingRoomId, consultation.signalingAccessToken);
      })
      .catch(() => setTokenError('상담 연결 정보를 받지 못했습니다.'));
  }, [consultationId, setSignalingRoom, signalingAccessToken, signalingRoomId, userSessionId]);

  /**
   * 상담자가 먼저 끊었는지 지켜본다.
   *
   * 종료는 서버 상태로만 확정된다. signaling 연결이 끊긴 것만으로는 상담이 끝난 것인지
   * 잠시 네트워크가 나쁜 것인지 구분할 수 없어서, 상담 상태를 직접 물어본다.
   */
  const consultationQuery = useQuery({
    queryKey: ['consultation', consultationId],
    queryFn: () => getConsultation(consultationId!, userSessionId!),
    enabled: Boolean(consultationId && userSessionId),
    refetchInterval: CONSULTATION_WATCH_MS,
  });
  const closed = isClosedConsultation(consultationQuery.data?.status);

  useEffect(() => {
    if (!closed) return;
    void navigate(USER_ROUTES.CONSULT_ENDED);
  }, [closed, navigate]);

  /**
   * 종료를 서버에도 알린다. 알리지 않으면 상담이 계속 진행 중으로 남아 상담자가 다음
   * 요청을 받지 못하고, 평가 화면의 만족도도 받아 주지 않는다.
   *
   * 상담자가 먼저 끝냈다면 이미 종료된 상담이라 거절된다. 그래도 화면은 넘어간다.
   */
  const endCall = useCallback(async () => {
    if (consultationId && userSessionId) {
      await endConsultationByUser(consultationId, userSessionId).catch(() => undefined);
    }
    void navigate(USER_ROUTES.CONSULT_ENDED);
  }, [consultationId, navigate, userSessionId]);

  /**
   * 상담 도중 권한이 사라지면 상담을 끝낸다.
   *
   * 이 화면은 경로 가드(`RequirePermissions`) 밖에 있다. 가드에 맡기면 권한 화면으로 튕겨
   * 나가면서 잡아 둔 카메라·마이크가 그대로 남고, 서버의 상담도 진행 중으로 남는다. 상담자는
   * 연결돼 있다고 믿은 채 빈 화면에 대고 안내를 이어 가게 된다.
   *
   * 장치를 먼저 놓아 준다. 서버 응답을 기다리는 동안 표시등이 켜져 있을 이유가 없다.
   */
  const permissionsRevoked = usePermissionsRevoked();
  const endingRef = useRef(false);

  useEffect(() => {
    if (!permissionsRevoked || endingRef.current) return;

    endingRef.current = true;
    releaseConsultMedia();
    void endCall();
  }, [endCall, permissionsRevoked]);

  return (
    <PhoneFrame
      dark
      layout="flush"
      overlay={
        /**
         * 세션 안내가 화면 전체를 덮는다. 세션을 열기 전에는 위치도 카메라도 흐르지 않으므로
         * 다른 조작을 받을 이유가 없다.
         */
        isNoticeOpen ? (
          <XrSessionNotice
            support={support}
            status={xrStatus}
            reason={xrReason}
            canRetry={canRetry}
            onConfirm={startXrSession}
            onContinueWithoutTracking={continueWithoutTracking}
          />
        ) : undefined
      }
    >
      <div className={styles.overlayRoot} ref={overlayRef}>
        {/* 상담원이 카메라 영상 위에 그린 선. 좌표는 0~1 정규화 값이라 화면을 덮어 얹는다. */}
        <canvas ref={annotationRef} className={styles.annotation} aria-hidden />
        <div className={styles.bar}>
          <span className={styles.liveChip}>
            <span className={styles.liveDotWrap}>
              <span className={styles.liveDot} />
              <span className={styles.liveRing} />
            </span>
            {/* 무엇이 건너가고 있는지 그대로 적는다. 준비 중인 것을 공유 중이라고 말하면
                사용자는 상담자가 이미 보고 있다고 믿는다. */}
            {cameraShareLabel}
            <span className={styles.liveShine} />
          </span>
          <button type="button" className={styles.endCall} onClick={() => void endCall()}>
            상담 종료
          </button>
        </div>

        <div className={[styles.cam, isSessionOpen && styles.camLive].filter(Boolean).join(' ')}>
          <XrTrackingBadge status={xrStatus} anchorStatus={anchorStatus} source={source} />
          {/*
            signaling이 붙기 전에 끊기면(1009 등) 원인 코드만 화면에 남아 있었다. 자동으로
            다시 맺는 동안에는 그 문구 대신 로딩 화면을 보여 준다 — 재시도가 곧 이어지므로
            사용자가 새로고침 말고는 손쓸 방법이 없다고 오해하지 않게 한다.
          */}
          {reconnecting && (
            <div className={styles.reconnecting} role="status">
              <span className={styles.reconnectingSpinner} aria-hidden />
              <span>연결을 다시 시도하고 있어요</span>
            </div>
          )}
          {/*
            상담원은 목소리만 보낸다. 소리를 내려면 요소 자체는 있어야 하므로 보이지 않게만
            둔다.
          */}
          <video ref={remoteVideoRef} autoPlay playsInline className={styles.remoteAudio} />
          {/*
            셀프뷰를 두지 않는다. XR 세션이 그리는 카메라 영상이 이 화면의 배경이므로, 사용자가
            보고 있는 것이 곧 상담자에게 건너가는 것이다. 같은 그림을 작은 창으로 한 번 더
            겹쳐 보여 줄 이유가 없다.
          */}
          <span
            className={styles.connectionStatus}
            role={!reconnecting && (error ?? tokenError) ? 'alert' : undefined}
          >
            {/* 재시도 중에는 위 로딩 화면이 안내를 대신하므로 원인 코드를 여기 또 띄우지 않는다. */}
            {reconnecting
              ? '연결 상태: 재시도 중'
              : (error ?? tokenError ?? `연결 상태: ${status}`)}
          </span>
          <div
            className={[styles.routeHeader, waypoints.length > 0 && styles.routeHeaderCompact]
              .filter(Boolean)
              .join(' ')}
            aria-label="상담 중인 경로"
          >
            <div className={styles.routePoint}>
              <span className={styles.routeLabel}>
                <span className={styles.pointDot} aria-hidden />
                <small>출발지</small>
              </span>
              {/* 위치 인식이 확정한 지점. 아직 모르면 역 이름만 적고 층을 지어내지 않는다. */}
              <strong>{currentLocationLabel ?? station}</strong>
            </div>
            {waypoints.map((waypoint, index) => (
              <Fragment key={waypoint.nodeId}>
                <span className={styles.routeArrow} aria-hidden>
                  <Icon name="arrow-right" size={16} />
                </span>
                <div className={`${styles.routePoint} ${styles.waypointPoint}`}>
                  <button
                    type="button"
                    className={styles.removeWaypoint}
                    onClick={() => removeWaypoint(waypoint.nodeId)}
                    aria-label={`${waypoint.nameKo} 경유지 삭제`}
                    title={`${waypoint.nameKo} 경유지 삭제`}
                  >
                    ×
                  </button>
                  <span className={styles.routeLabel}>
                    <span className={`${styles.pointDot} ${styles.pointDotWaypoint}`} aria-hidden />
                    <small>경유 {index + 1}</small>
                  </span>
                  <strong title={waypoint.nameKo}>{waypoint.nameKo}</strong>
                </div>
              </Fragment>
            ))}
            <span className={styles.routeArrow} aria-hidden>
              <Icon name="arrow-right" size={16} />
            </span>
            <div className={styles.routePoint}>
              <span className={styles.routeLabel}>
                <span className={`${styles.pointDot} ${styles.pointDotDestination}`} aria-hidden />
                <small>목적지</small>
              </span>
              <strong title={destination ?? undefined}>{destination ?? '목적지 미지정'}</strong>
            </div>
          </div>
          <div className={styles.translation}>
            <div className={styles.translationLabel}>
              <Icon name="globe" size={13} />
              실시간 자막 · 상담원
            </div>
            {/*
              상담원 쪽 자막이 죽었다는 사실은 자막이 있든 없든 보여야 한다. 아래 본문
              자리에만 끼워 넣으면, 상담 도중에 인식이 멈춘 경우 마지막 문장에 가려 영영
              뜨지 않는다.
            */}
            {remoteCaptionNotice && (
              <div className={styles.translationAlert} role="alert">
                <Icon name="warning" size={12} />
                <span>{remoteCaptionNotice}</span>
              </div>
            )}
            {/*
              옮긴 문장을 크게, 원문을 그 아래 작게 둔다. 사용자가 읽어야 하는 것은 자기
              언어로 된 쪽이고, 원문은 숫자나 출구 이름을 눈으로 맞춰 보는 데 쓴다.
              아직 옮기지 못했으면 원문이라도 큰 자리에 띄운다 — 빈 화면보다 낫다.
            */}
            <div className={styles.translationPrimary}>
              {captionPrimary ||
                remoteCaptionNotice ||
                (captionError ??
                  (captionsSupported
                    ? '상담원이 말하면 이 자리에 표시됩니다.'
                    : '이 브라우저에서는 음성 자막을 지원하지 않습니다.'))}
            </div>
            {/*
              상담원이 말하는 중에는 이 줄이 한 마디씩 흘러간다. 위의 옮긴 문장은 말이
              끝나야 바뀌므로, 이 줄이 없으면 화면은 멈춰 있는 것처럼 보인다.
            */}
            {captionSource && (
              <div
                className={[styles.translationSource, !remoteCaptionFinal && styles.captionLive]
                  .filter(Boolean)
                  .join(' ')}
              >
                {captionSource}
              </div>
            )}
          </div>
        </div>

        <div className={styles.lower}>
          {/*
            안내 화면(/user/navigation)과 같은 실내 지도를 그대로 쓴다.
            예전에는 실제 도면과 아무 상관 없는 스키매틱 SVG와 `3번 출구` 라벨이 고정으로
            박혀 있었다. 상담원이 그 위에 길을 그려 줘도 사용자가 실제로 서 있는 곳과는
            무관한 그림이라, 짚어 준 자리를 현장에서 찾을 수 없었다.
          */}
          <MapPreview className={styles.map}>
            <div className={styles.mapCanvas}>
              <IndoorMapView
                stationId={stationId ?? 0}
                floorId={currentLocation?.floorId ?? currentFloorId ?? undefined}
                currentLocation={currentLocation}
                /* 사용자 화면은 안내 화면과 같이 진행 방향이 위를 향하게 돈다. */
                currentHeadingDeg={headingDeg}
                destination={destinationPoint}
                destinationLabel={destination}
                pathNodes={pathNodes}
                followCamera
                useMockData
              />
            </div>
          </MapPreview>

          <div className={styles.syncNote}>
            <span className={styles.syncDot} aria-hidden />
            <p className={styles.syncText}>
              상담원이 <b>같은 지도</b>를 보며 안내 중이에요
            </p>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
