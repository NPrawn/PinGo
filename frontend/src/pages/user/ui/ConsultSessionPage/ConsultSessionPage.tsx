import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { isClosedConsultation, useConsultStore } from '@/entities/consult';
import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { useUserSessionStore } from '@/entities/user-session';
import { useTranslation } from 'react-i18next';
import {
  peekConsultCamera,
  useCaptionTranslation,
  useConsultSignaling,
} from '@/features/consult-signaling';
import { useRemoteScreenDraw } from '@/features/shared-screen-draw';
import { endConsultationByUser, getConsultation } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import type { ConsultDataEvent } from '@/shared/types';
import { Icon, MapPreview } from '@/shared/ui';
import { IndoorMapView } from '@/widgets/indoor-map';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './ConsultSessionPage.module.css';

/** 상담자가 끊었는지 확인하는 간격. 끊긴 걸 알아채기까지 사용자가 기다리는 시간이기도 하다. */
const CONSULTATION_WATCH_MS = 4000;

/** Screen 20 (FR-U-015 / FR-W-002) — live consultation from the user's side. */
export function ConsultSessionPage() {
  const navigate = useNavigate();
  const consultationId = useConsultStore((state) => state.consultationId);
  const signalingRoomId = useConsultStore((state) => state.signalingRoomId);
  const signalingAccessToken = useConsultStore((state) => state.signalingAccessToken);
  const setSignalingRoom = useConsultStore((state) => state.setSignalingRoom);
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const [tokenError, setTokenError] = useState<string | null>(null);
  /** 상담원이 화면 위에 그린 선을 받아 그대로 얹는다. */
  const { canvasRef: annotationRef, apply: applyAnnotation } = useRemoteScreenDraw();
  /**
   * 상담 요청 화면에서 잡아 둔 카메라를 셀프뷰에 붙인다.
   *
   * 예전에는 카메라를 잡지도 않고 권한만 허용된 것으로 기록해, 상담 내내 카메라가 꺼진
   * 채였다. 상담자 화면에는 카메라가 온다고 적혀 있는데 정작 사용자 모습은 어디에도 없었다.
   *
   * 같은 영상 트랙이 상담자에게도 건너간다. 여기 보이는 것과 상담자가 보는 것이 같다.
   */
  const cameraRef = useRef<HTMLVideoElement>(null);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    const camera = peekConsultCamera();
    const element = cameraRef.current;
    if (!camera || !element) return;

    element.srcObject = camera;
    setCameraOn(true);
    const played = element.play?.();
    if (played && typeof played.catch === 'function') played.catch(() => undefined);
  }, []);
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
    remoteCaption,
    remoteFinalCaption,
    captionsSupported,
    captionError,
    sendConsultEvent,
    eventChannelOpen,
  } = useConsultSignaling(signalingRoomId, 'USER', signalingAccessToken, handleDataEvent);
  /**
   * 상담원이 한 말을 사용자가 고른 언어로 옮겨 보여 준다.
   *
   * 표시 언어는 화면 전체가 쓰는 i18n 언어를 그대로 따른다. 상담을 위해 따로 고르게 하면
   * 사용자가 이미 언어 화면(U-02)에서 고른 것과 어긋난다.
   */
  const { i18n } = useTranslation();
  const translatedRemoteCaption = useCaptionTranslation(
    consultationId,
    remoteFinalCaption,
    i18n.language,
  );
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

  /** 안내 화면과 같은 입력으로 지도를 그린다. 좌표가 없는 층에서는 마커를 그리지 않는다. */
  const currentLocation = useMemo(
    () =>
      currentFloorId != null && currentMapX != null && currentMapY != null
        ? { floorId: currentFloorId, mapX: currentMapX, mapY: currentMapY }
        : null,
    [currentFloorId, currentMapX, currentMapY],
  );
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
        floorId: currentFloorId,
        current: currentLocation,
        // 상담 화면은 XR 세션을 열지 않아 방향을 알 수 없다.
        headingDeg: null,
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
  const endCall = async () => {
    if (consultationId && userSessionId) {
      await endConsultationByUser(consultationId, userSessionId).catch(() => undefined);
    }
    void navigate(USER_ROUTES.CONSULT_ENDED);
  };

  return (
    <PhoneFrame dark layout="flush">
      <>
        {/* 상담원이 카메라 영상 위에 그린 선. 좌표는 0~1 정규화 값이라 화면을 덮어 얹는다. */}
        <canvas ref={annotationRef} className={styles.annotation} aria-hidden />
        <div className={styles.bar}>
          <span className={styles.liveChip}>
            <span className={styles.liveDotWrap}>
              <span className={styles.liveDot} />
              <span className={styles.liveRing} />
            </span>
            {/* 무엇이 건너가고 있는지 그대로 적는다. 카메라를 끈 사용자에게 켜져 있다고
                말하면 안 된다. */}
            {cameraOn ? '상담 연결됨 · 카메라 공유 중' : '상담 연결됨 · 음성만'}
            <span className={styles.liveShine} />
          </span>
          <button type="button" className={styles.endCall} onClick={() => void endCall()}>
            상담 종료
          </button>
        </div>

        <div className={styles.cam}>
          {/*
            상담원은 목소리만 보낸다. 소리를 내려면 요소 자체는 있어야 하므로 보이지 않게만
            둔다.
          */}
          <video ref={remoteVideoRef} autoPlay playsInline className={styles.remoteAudio} />
          {/* 사용자 카메라 셀프뷰. 이 트랙이 그대로 상담자에게 건너간다. */}
          <video
            ref={cameraRef}
            autoPlay
            playsInline
            muted
            className={[styles.selfView, !cameraOn && styles.selfViewOff].filter(Boolean).join(' ')}
            aria-label="내 카메라"
          />
          <span
            className={styles.connectionStatus}
            role={(error ?? tokenError) ? 'alert' : undefined}
          >
            {error ?? tokenError ?? `연결 상태: ${status}`}
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
              <Fragment key={waypoint}>
                <span className={styles.routeArrow} aria-hidden>
                  <Icon name="arrow-right" size={16} />
                </span>
                <div className={`${styles.routePoint} ${styles.waypointPoint}`}>
                  <button
                    type="button"
                    className={styles.removeWaypoint}
                    onClick={() => removeWaypoint(waypoint)}
                    aria-label={`${waypoint} 경유지 삭제`}
                    title={`${waypoint} 경유지 삭제`}
                  >
                    ×
                  </button>
                  <span className={styles.routeLabel}>
                    <span className={`${styles.pointDot} ${styles.pointDotWaypoint}`} aria-hidden />
                    <small>경유 {index + 1}</small>
                  </span>
                  <strong title={waypoint}>{waypoint}</strong>
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
              옮긴 문장을 크게, 원문을 그 아래 작게 둔다. 사용자가 읽어야 하는 것은 자기
              언어로 된 쪽이고, 원문은 숫자나 출구 이름을 눈으로 맞춰 보는 데 쓴다.
              아직 옮기지 못했으면 원문이라도 큰 자리에 띄운다 — 빈 화면보다 낫다.
            */}
            <div className={styles.translationPrimary}>
              {translatedRemoteCaption ||
                remoteCaption ||
                (captionError ??
                  (captionsSupported
                    ? '상담원이 말하면 이 자리에 표시됩니다.'
                    : '이 브라우저에서는 음성 자막을 지원하지 않습니다.'))}
            </div>
            {translatedRemoteCaption && remoteFinalCaption !== translatedRemoteCaption && (
              <div className={styles.translationSource}>{remoteFinalCaption}</div>
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
                floorId={currentFloorId ?? undefined}
                currentLocation={currentLocation}
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
      </>
    </PhoneFrame>
  );
}
