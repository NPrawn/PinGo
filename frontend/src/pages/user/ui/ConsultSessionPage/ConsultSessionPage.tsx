import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isClosedConsultation, useConsultStore } from '@/entities/consult';
import { FACILITY_MAP_FILTERS, useStationFacilities, type Facility } from '@/entities/facility';
import { useStationFloorMaps } from '@/entities/floor-map';
import {
  routeDistanceScaleOf,
  routeProgressOf,
  useNavigationStore,
  type IndoorPoint,
} from '@/entities/navigation';
import { routeOriginOf, SEND_CURRENT_POSITION } from '@/entities/route';
import { useStationStore } from '@/entities/station';
import { useUserSessionStore } from '@/entities/user-session';
import {
  describeRemoteCaptionTrouble,
  releaseConsultMedia,
  useCaptionTranslation,
  useConsultSignaling,
  useTranslatedSpeech,
} from '@/features/consult-signaling';
import { usePermissionsRevoked } from '@/features/permissions';
import { readForwardMap } from '@/features/xr-tracking';
import { useRemoteScreenDraw, useSharedScreenGeometry } from '@/features/shared-screen-draw';
import { createIndoorRoute, endConsultationByUser, getConsultation, localize } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import { localizeUserLabel } from '@/shared/lib/localizeUserLabel';
import {
  xrSessionController,
  type XrCameraStreamHandle,
  type XrCameraStreamState,
} from '@/shared/lib/webxr';
import type { ConsultDataEvent } from '@/shared/types';
import { Icon, MapPreview } from '@/shared/ui';
import { IndoorMapView } from '@/widgets/indoor-map';
import { VPS_FRAME_SIZE } from '@/widgets/camera-preview';
import { PhoneFrame } from '@/widgets/phone-frame';
import { useXrNavigationSession, XrSessionNotice, XrTrackingBadge } from '@/widgets/xr-navigation';
import styles from './ConsultSessionPage.module.css';

/** 상담자가 끊었는지 확인하는 간격. 끊긴 걸 알아채기까지 사용자가 기다리는 시간이기도 하다. */
const CONSULTATION_WATCH_MS = 4000;

/**
 * 세션 안 위치 재인식 주기. (S15P11A206-89)
 *
 * **30초로 둔 이유.** 재인식 한 장은 GPU 리드백과 업로드를 함께 요구한다. 리드백은 추적과 같은
 * GPU를 쓰므로(11.8) 잦으면 pose 품질이 떨어지고, 업로드는 상담 영상과 대역폭을 다툰다. 반대로
 * 너무 드물면 상대 이동 오차가 그만큼 쌓인 뒤에야 바로잡힌다.
 *
 * 걸어서 30초면 20~30m다. 그 사이 누적되는 오차는 역 안에서 방향을 잃을 정도가 아니고, 상담자가
 * 짚어 주는 자리를 찾는 데도 지장이 없다.
 */
const RELOCALIZE_INTERVAL_MS = 30_000;

/** Screen 20 (FR-U-015 / FR-W-002) — live consultation from the user's side. */
export function ConsultSessionPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const userLanguage = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const consultationId = useConsultStore((state) => state.consultationId);
  const signalingRoomId = useConsultStore((state) => state.signalingRoomId);
  const signalingAccessToken = useConsultStore((state) => state.signalingAccessToken);
  const setSignalingRoom = useConsultStore((state) => state.setSignalingRoom);
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const [tokenError, setTokenError] = useState<string | null>(null);
  /**
   * 상담원이 화면 위에 그린 선을 받아 그대로 얹는다.
   *
   * 좌표는 0~1 정규화 값이다. 상담자 화면이 이 화면을 같은 비율로 비추므로(카메라 위·지도 아래),
   * 상담자가 거울의 지도 부분에 그으면 이 화면의 지도 부분에 그려진다. (S15P11A206-89)
   */
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
    remoteFinalCaption,
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
    remoteFinalCaption,
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
  const captionPrimary = remoteCaptionFinal
    ? translatedRemoteCaption || remoteCaption
    : remoteCaption;
  /** 큰 자리와 같은 말이면 두 번 쓰지 않는다(아직 옮기지 못해 원문이 위에 올라간 경우다). */
  const captionSource =
    remoteCaptionFinal && remoteCaption && remoteCaption !== captionPrimary ? remoteCaption : '';
  /** 상담원 쪽 자막이 죽었다는 사실. 이쪽 마이크 문제와 섞이지 않게 따로 띄운다. */
  const remoteCaptionNotice = describeRemoteCaptionTrouble(
    remoteCaptionError,
    t('user.consultSession.agent'),
    i18n.resolvedLanguage === 'en' ? 'en' : 'ko',
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
  const displayLanguage = i18n.resolvedLanguage === 'en' ? 'en' : 'ko';
  const displayedOrigin = localizeUserLabel(currentLocationLabel ?? station, displayLanguage);
  const displayedDestination = destination ? localizeUserLabel(destination, displayLanguage) : null;
  const currentFloorId = useNavigationStore((state) => state.currentFloorId);
  const currentMapX = useNavigationStore((state) => state.currentMapX);
  const currentMapY = useNavigationStore((state) => state.currentMapY);
  const storedRouteResult = useNavigationStore((state) => state.routeResult);
  const currentNodeId = useNavigationStore((state) => state.currentNodeId);
  const targetNodeId = useNavigationStore((state) => state.targetNodeId);
  const routeType = useNavigationStore((state) => state.route);
  const waypoints = useNavigationStore((state) => state.waypoints);
  const removeWaypoint = useNavigationStore((state) => state.removeWaypoint);
  const storedTravelledM = useNavigationStore((state) => state.travelledM);

  /**
   * 스토어에 들어 있는 지금의 확정 실내 위치. 앵커의 기준점이며 지도 마커의 바탕이다.
   *
   * **안내 화면과 달리 첫 렌더 값에 고정하지 않는다.** (S15P11A206-89)
   *
   * 안내 화면은 위치 인식을 끝낸 뒤에만 들어올 수 있어 진입 시점에 좌표가 늘 있다. 상담은 어느
   * 화면에서도 시작되므로 좌표 없이 들어오는 경우가 있고, 그때 위치는 나중에 도착한다 — 상담자가
   * 지도에서 짚어 주거나(`CURRENT_LOCATION_CORRECTED`) 위치 인식이 끝난 뒤다.
   *
   * 고정해 두면 그 좌표가 영원히 `null` 로 남아 **앵커가 만들어지지 않는다.** 앵커가 없으면
   * `useXrMapPosition` 이 pose 스냅숏과 heading 갱신을 둘 다 버리므로(`if (!anchor) return`),
   * XR 이 `tracking` 이어도 사용자의 방향과 이동이 잡히지 않는다. 실기기에서 그렇게 막혀 있었다.
   *
   * `useMemo` 로 참조를 안정시킨다. 렌더마다 새 객체를 만들면 앵커 발화 effect 가 헛돈다 —
   * 안내 화면이 값을 고정한 본래 이유가 그것이다. 값이 그대로면 참조도 그대로이므로 그 문제는
   * 생기지 않으면서, 값이 바뀌는 순간에만 effect 가 돈다.
   *
   * 앵커가 생긴 뒤의 변경은 훅이 조용히 무시한다(296 계약). 그 뒤로는 추적 좌표가 앞선다.
   */
  /**
   * 위치 인식이 확정한 방향. 앵커의 기준이다. (343 병합)
   *
   * **첫 렌더 값에 고정하지 않는다.** 안내 화면은 고정하는데, 그 화면은 위치 인식을 거친 직후에만
   * 열리므로 진입 시점에 이미 방향을 알고 있다. 상담 화면은 다르다 — 방향이 이 화면에 들어온
   * **뒤에** 정해질 수 있고, 고정해 두면 그 값이 영원히 닿지 않아 앵커가 만들어지지 않는다.
   * 앵커가 없으면 위치도 방향도 갱신되지 않는다. (S15P11A206-89)
   *
   * 고정하지 않아도 앵커가 흔들리지 않는다. 앵커는 한 번 성공하면 발화가 닫히므로(`anchorFiredRef`)
   * 그 뒤의 변경은 무시되고, 성공 전의 변경은 더 최신 방향으로 앵커를 만드는 쪽이 맞다.
   */
  const confirmedForwardMap = useNavigationStore((state) => state.currentForwardMap);

  const storedLocation = useMemo<IndoorPoint | null>(
    () =>
      currentFloorId != null && currentMapX != null && currentMapY != null
        ? { floorId: currentFloorId, mapX: currentMapX, mapY: currentMapY }
        : null,
    [currentFloorId, currentMapX, currentMapY],
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
   * **한 번만 부른다.** `replaceLocalVideoTrack` 이 지금 맺어진 연결과 재연결에 실릴 스트림을
   * 함께 바꾼다. 예전에는 이 화면이 `swapConsultVideoTrack` 을 따로 이어 불렀는데, 짝을 맞추는
   * 책임이 호출부에 있으면 한쪽을 빠뜨린 것을 아무도 알아채지 못한다. (S15P11A206-89 리뷰)
   *
   * 옛 카메라 트랙을 멈추는 것이 이 콜백의 본래 임무다. 남겨 두면 세션은 오류 없이 열리고
   * pose 만 영원히 들어오지 않는다.
   */
  const handOverCameraToSession = useCallback(async () => {
    const track = cameraStreamRef.current?.stream.getVideoTracks()[0] ?? null;

    await replaceLocalVideoTrack(track);
  }, [replaceLocalVideoTrack]);

  /**
   * 경로를 이 화면에서도 직접 조회한다. (S15P11A206-89)
   *
   * **예전에는 스토어에 있는 것만 그렸다.** 안내 화면이 조회해 넣어 둔 값을 읽을 뿐이라, 그것이
   * 비어 있으면 지도에 경로가 그려지지 않았다. 안내 화면을 거치지 않고 들어온 경우, 새로고침으로
   * 스토어가 초기화된 경우, 그리고 **상담자가 목적지를 바꾼 경우**가 그렇다 — 마지막 것이 특히
   * 문제였다. `DESTINATION_CHANGE_REQUESTED` 는 `targetNodeId` 만 바꾸는데 경로를 다시 받는
   * 사람이 없어, 화면에 적힌 목적지와 지도에 그려진 길이 서로 다른 곳을 가리켰다.
   *
   * 조회 키와 조건은 안내 화면과 같다. 같은 키를 쓰므로 안내 화면에서 이미 받은 경로가 있으면
   * 캐시에서 즉시 나오고 요청이 한 번 더 나가지 않는다.
   */
  const waypointNodeIds = waypoints.map((waypoint) => waypoint.nodeId);
  const origin = SEND_CURRENT_POSITION ? routeOriginOf(currentMapX, currentMapY) : null;
  const routeQuery = useQuery({
    queryKey: [
      'indoor-route',
      stationId,
      currentNodeId,
      targetNodeId,
      routeType,
      waypointNodeIds,
      origin?.currentMapX ?? null,
      origin?.currentMapY ?? null,
    ],
    queryFn: () =>
      createIndoorRoute({
        stationId: stationId!,
        startNodeId: currentNodeId!,
        targetNodeId: targetNodeId!,
        waypointNodeIds,
        routeType,
        ...(origin ?? {}),
      }),
    enabled: stationId != null && currentNodeId != null && targetNodeId != null,
    retry: false,
  });
  /**
   * 조회가 끝나기 전에는 스토어에 남은 경로를 그린다.
   *
   * 안내 화면에서 넘어온 순간에는 캐시가 있어 곧바로 나오지만, 새로고침 뒤에는 응답을 기다리는
   * 동안 경로가 비어 있다. 그 사이에 선을 지우면 상담자가 짚어 주는 자리를 맞춰 볼 수 없다.
   */
  const routeResult = routeQuery.data ?? storedRouteResult;

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
    /* 재인식이 확정한 좌표·방향으로 앵커를 다시 세우는 길. 아래 재인식 effect 가 쓴다. */
    setAnchor,
  } = useXrNavigationSession({
    currentIndoorLocation: storedLocation,
    /**
     * 위치 인식이 준 실제 방향과 거리 배율. **안내 화면과 같은 값을 쓴다.** (343 병합)
     *
     * `343` 이 앵커 계약을 바꿨다 — 목업 방향(`MOCK_ANCHOR_FORWARD_MAP`)이 없어지고, 방향이
     * 없으면 앵커를 아예 만들지 않는다("임의 방향을 쓰면 지도 경로를 가로지르는 오차가 생긴다").
     * 그래서 이 두 값을 넘기지 않으면 상담 화면의 앵커가 영원히 만들어지지 않고, 방향과 이동이
     * 다시 죽는다.
     *
     * 방향은 첫 렌더 값에 고정한다 — 앵커의 기준이라 도중에 바뀌면 짝이 어긋난다. 안내 화면도
     * 같은 방식이다.
     */
    anchorForwardMap: confirmedForwardMap,
    distanceScale: routeDistanceScaleOf(routeResult, storedLocation?.floorId),
    releaseCamera: handOverCameraToSession,
  });

  /**
   * 이 화면이 어떻게 나뉘어 있는지 재서 상담자에게 알린다. (S15P11A206-89)
   *
   * 상담자 화면은 이 값으로 같은 배치의 거울을 만들고 그 위에 그린다. 재지 않고 상담자 쪽에
   * 52:48 을 박아 두면 어긋난다 — 나뉘는 자리에 상단 여백 보정(`+22.08px`)이 더해져 있어 화면
   * 높이마다 실제 비율이 다르고, 카메라 원본 규격도 기기마다 다르다.
   *
   * 기준은 `overlayRef` 다. 상담원이 그린 선을 받는 캔버스가 이 요소를 덮고 있으므로, 0~1 의
   * 기준도 정확히 이 요소여야 한다.
   */
  /**
   * 카메라 원본 크기. 첫 프레임을 잡은 뒤에야 알 수 있다.
   *
   * `streaming` 이 되는 순간이 그 시점이다 — 컨트롤러가 원본 크기를 남긴 다음 상태를 바꾼다.
   */
  const cameraSourceSize = useMemo(
    () => (cameraStreamState === 'streaming' ? xrSessionController.getCameraSourceSize() : null),
    [cameraStreamState],
  );
  const {
    geometry: screenGeometry,
    screenRef: geometryScreenRef,
    lowerRef,
    mapRef: mapBoxRef,
  } = useSharedScreenGeometry(cameraSourceSize);

  /**
   * 오버레이 루트에 ref 를 둘 붙인다.
   *
   * XR 훅은 `dom-overlay` 루트로 이 요소를 쓰고, 배치 측정은 0~1 좌표의 기준으로 같은 요소를
   * 쓴다. 같은 요소를 두 곳이 필요로 하므로 한 콜백에서 둘 다 채운다 — 측정 쪽이 콜백 ref 인
   * 이유는 `useSharedScreenGeometry` 주석에 있다.
   */
  const setOverlayNode = useCallback(
    (node: HTMLDivElement | null) => {
      overlayRef.current = node;
      geometryScreenRef(node);
    },
    [geometryScreenRef, overlayRef],
  );

  /**
   * 세션 안 위치 재인식. (S15P11A206-89)
   *
   * **왜 필요한가.** 앵커는 진입 시점의 좌표와 방향으로 한 번 만들어지고, 그 뒤 위치는 WebXR
   * 상대 이동을 앵커에 더해 만든다. 상대 이동은 걸을수록 오차가 누적되므로 상담이 길어지면 마커가
   * 실제 위치에서 점점 벗어난다. 상담자는 그 어긋난 자리를 기준으로 안내하게 된다.
   *
   * 재인식은 그 누적을 초기화한다. 카메라 한 장을 위치 인식에 보내고, 확정되면 그 좌표·방향으로
   * 앵커를 다시 세운다.
   *
   * **성공만 받아들인다.** 촬영 화면은 여러 프레임의 가중 투표로 저신뢰 응답까지 확정하지만,
   * 상담 중에는 이미 표시되고 있는 위치가 있다. 확실하지 않은 값으로 그것을 흔드는 것이 가만히
   * 두는 것보다 나쁘다.
   */
  const relocalize = useCallback(async () => {
    if (!userSessionId || stationId == null) return;

    /**
     * 세션 카메라에서 큰 프레임 한 장을 뽑는다. 상담자에게 가는 320×240 트랙과 별개다 —
     * 그 크기로는 특징점 매칭이 되지 않는다.
     */
    const still = await xrSessionController.captureStillFrame({ maxSide: VPS_FRAME_SIZE });

    if (!still) return;

    const result = await localize(
      new File([still.blob], 'relocalize.jpg', { type: 'image/jpeg' }),
      {
        userSessionId,
        stationId,
        capturedAt: new Date().toISOString(),
        camera: {
          model: 'PINHOLE',
          // 보낸 그림과 같은 크기를 적는다. 어긋나면 내부 파라미터가 맞지 않아 좌표가 틀어진다.
          width: still.width,
          height: still.height,
          intrinsicsSource: 'browser',
        },
      },
    );

    const position = result.position;

    if (
      result.resultStatus !== 'success' ||
      result.startNodeId == null ||
      position?.floorId == null ||
      position.mapX == null ||
      position.mapY == null
    ) {
      return;
    }

    const forwardMap = readForwardMap(position);

    /**
     * 앵커를 다시 세운다. **이것이 재인식의 본체다.**
     *
     * 스토어의 확정 위치만 바꾸면 아무 일도 일어나지 않는다 — 추적 훅은 앵커가 생긴 뒤의
     * `currentIndoorLocation` 변경을 조용히 무시하고(296 계약), 계속 옛 앵커로 좌표를 만든다.
     *
     * 방향이 없으면(정합되지 않은 층 등) 앵커를 만들지 못한다. 그때는 지금 앵커를 그대로 두는
     * 편이 낫다 — 오차가 남더라도 방향 없는 앵커보다는 정확하다.
     */
    setAnchor({ floorId: position.floorId, mapX: position.mapX, mapY: position.mapY }, forwardMap);

    /**
     * 경로 시작 노드가 달라졌을 때만 스토어를 건드린다.
     *
     * `setCurrentLocation` 은 `routeResult` 를 비운다. 30초마다 부르면 같은 자리인데도 경로가
     * 매번 지워지고, 다시 조회되는 사이 `pathNodes` 가 비어 상담자 화면에서 경로선이 깜빡인다.
     * 노드가 그대로면 다시 계산할 경로도 같으므로 건드릴 이유가 없다.
     */
    if (result.startNodeId !== currentNodeId) {
      setCurrentLocation({
        nodeId: result.startNodeId,
        floorId: position.floorId,
        label: result.startNodeLabel ?? undefined,
        mapX: position.mapX,
        mapY: position.mapY,
        forwardMap,
      });
    }
  }, [currentNodeId, setAnchor, setCurrentLocation, stationId, userSessionId]);

  useEffect(() => {
    // 세션이 열려야 카메라 프레임이 나온다. 추적을 포기한 사용자에게는 재인식할 것도 없다.
    if (!isSessionOpen) return;

    let disposed = false;
    let timer: number | undefined;

    const schedule = () => {
      if (disposed) return;

      timer = window.setTimeout(() => void run(), RELOCALIZE_INTERVAL_MS);
    };

    const run = async () => {
      try {
        await relocalize();
      } catch {
        /*
          한 장 실패는 넘긴다. 사용자가 벽을 보고 있거나 망이 잠깐 끊긴 것일 수 있고, 다음
          주기에 다시 시도한다. 여기서 화면에 오류를 띄우면 상담 중에 손쓸 수 없는 경고가
          30초마다 뜬다.
        */
      }

      if (!disposed) schedule();
    };

    /**
     * 첫 재인식도 한 주기 뒤다.
     *
     * 진입 직후에는 촬영 화면에서 확정한 값이 아직 신선하고, 그때는 세션이 막 열려 추적이
     * 잡히기 전(warming-up)이라 앵커를 다시 세울 수도 없다.
     */
    schedule();

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [isSessionOpen, relocalize]);

  /**
   * 지도에 그릴 현재 위치. 추적 값을 우선하고, 없으면 스토어의 확정 위치를 쓴다.
   *
   * 추적이 잡히기 전(warming-up)이나 세션을 열지 않기로 한 경우에도 위치는 보여야 한다.
   * 그 구간에 마커를 지우면 사용자와 상담자 양쪽에서 위치가 사라진다.
   *
   * **예전에는 마운트 시점에 고정한 값을 썼다.** 그래서 상담 중에 위치가 바뀌어도 화면이 그
   * 자리에 머물렀다. 상담자가 `CURRENT_LOCATION_CORRECTED` 로 자리를 고쳐 주면
   * `handleDataEvent` 가 스토어에 써 넣는데, 화면은 그것을 읽지 않아 사용자 지도가 움직이지
   * 않았다 — 상담자는 고쳐 줬다고 믿고 사용자는 옛 자리를 보는 상태가 된다.
   *
   * 추적이 살아 있는 동안에는 추적 값이 이긴다. 실제로 걷고 있는 사람의 좌표가 더 최신이다.
   */
  const currentLocation = trackedLocation ?? storedLocation;

  /**
   * 층 선택과 시설 필터. 안내 화면과 같은 조작을 상담 중에도 쓸 수 있어야 한다.
   *
   * 이것이 없으면 상담자가 "한 층 위 엘리베이터로 가세요"라고 말해도 사용자는 그 층을 볼 방법이
   * 없고, 시설이 하나도 그려지지 않아 짚어 준 자리를 도면에서 찾을 수 없다.
   *
   * **층 목록은 지도 응답에서 만든다.** `floor_id` 는 auto-increment 라 코드↔id 매핑을 상수로
   * 두면 시드가 바뀔 때 조용히 어긋난다.
   */
  const floorMaps = useStationFloorMaps(stationId ?? 0).data ?? [];
  /** 사용자가 탭으로 고른 층. null 이면 현재 위치를 따라간다. */
  const [pickedFloorId, setPickedFloorId] = useState<number | null>(null);
  const displayedFloorId = pickedFloorId ?? currentLocation?.floorId ?? currentFloorId ?? undefined;

  /**
   * 시설 표시 상태. 안내 화면과 같은 모델이다 — `all`·`none`·유형 하나를 **한 상태로** 둔다.
   *
   * 유형과 숨김을 따로 두면 "숨김인데 유형도 켜져 있는" 조합이 생긴다.
   */
  const [facilityView, setFacilityView] = useState<string>('all');
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const facilities = useStationFacilities(stationId ?? 0).data;
  /**
   * 표시 층에 실제로 있는 유형만 칩으로 둔다. 눌러서 아무것도 나오지 않는 칩은 두지 않는다 —
   * 역삼역 B3 에는 승차권 충전기가 없는데 칩이 늘 떠 있으면 없다는 것을 눌러 봐야만 알 수 있다.
   */
  const floorFacilityTypes = new Set(
    (facilities ?? [])
      .filter((facility) => facility.floorId === displayedFloorId)
      .map((facility) => facility.facilityType),
  );
  const availableFilters = FACILITY_MAP_FILTERS.filter((filter) =>
    floorFacilityTypes.has(filter.facilityType),
  );
  /**
   * 켜 둔 유형이 표시 층에 없으면 전체 표시로 친다. 고른 값 자체는 지우지 않는다 — 층을 넘길
   * 때마다 사라지면 돌아왔을 때 매번 다시 눌러야 한다. 숨김은 층과 무관하므로 그대로 둔다.
   */
  const effectiveView =
    facilityView !== 'all' &&
    facilityView !== 'none' &&
    facilities !== undefined &&
    !floorFacilityTypes.has(facilityView)
      ? 'all'
      : facilityView;
  /** 위젯에 넘길 유형. 전부 보이거나 전부 감출 때는 유형이 없다. */
  const effectiveType = effectiveView === 'all' || effectiveView === 'none' ? null : effectiveView;

  /**
   * 연결이 지금 어떤 상태인지. **`상담 연결됨`을 고정으로 쓰지 않는다.**
   *
   * 예전에는 세 갈래 모두 `상담 연결됨`으로 시작했다. `status`를 보지 않았으므로 협상 중이거나
   * 실패한 상담에서도 연결됐다고 적혔고, 사용자는 상담자가 자기 말을 듣고 있다고 믿은 채
   * 기다렸다. 아래 `연결 상태:` 줄에 사실이 적혀 있었지만 그 둘이 서로 어긋났다.
   *
   * **실패는 이 칩에 적지 않는다.** 붙는 과정에서 오류가 한 번 스치는 것이 정상이라(토큰을 아직
   * 받지 못했거나 첫 handshake 가 늦은 경우) 접속 직후부터 `연결 실패`가 뜨는데, 곧 붙을 상담을
   * 실패라고 읽으면 사용자는 그 자리에서 나간다. 재시도가 자동으로 이어지는 동안에는 아직 붙는
   * 중이라고 말하는 것이 맞다. 원인 문구는 아래 `연결 상태:` 줄이 `role="alert"` 로 따로 알린다.
   */
  const connected = status === 'connected' && !reconnecting;
  const connectionLabel = reconnecting
    ? t('user.consultSession.retrying')
    : connected
      ? t('user.consultSession.connected')
      : t('user.consultSession.connecting');

  /**
   * 카메라가 지금 어디까지 왔는지.
   *
   * `unsupported`를 숨기지 않는다. 이 기기에서는 세션 카메라를 얻을 수 없다는 뜻이고, 그 상태로
   * 상담을 이어 가면 상담자는 검은 화면을 보면서 사용자는 보이고 있다고 믿는다. 무엇이 막혔는지
   * 적어야 사용자가 말로 설명할 수 있다.
   *
   * TODO(S15P11A206-89): `unsupported`인 기기의 대체 경로가 아직 없다. 실기기 확인 뒤 정한다.
   */
  const cameraLabel =
    cameraStreamState === 'streaming'
      ? t('user.consultSession.cameraSharing')
      : cameraStreamState === 'unsupported'
        ? t('user.consultSession.cameraUnsupported')
        : t('user.consultSession.cameraPreparing');

  /**
   * 붙지 않은 상담에서는 카메라 이야기를 하지 않는다.
   *
   * 트랙이 준비됐든 아니든 건너가는 곳이 없다. `연결 중 · 카메라 공유 중`은 사용자에게 영상이
   * 이미 가고 있다고 읽힌다.
   */
  const cameraShareLabel = connected ? `${connectionLabel} · ${cameraLabel}` : connectionLabel;

  /**
   * 연결 상태 줄에 **이벤트 채널이 열렸는지도 함께 적는다.** (S15P11A206-89)
   *
   * 지도 동기화와 그리기는 피어 연결이 아니라 그 위의 DataChannel 로 오간다. 둘은 따로 붙고 따로
   * 실패한다 — 목소리는 들리는데 지도가 오지 않는 상담이 실제로 있었고, 화면에는 `connected` 만
   * 적혀 있어 무엇이 막혔는지 말할 수 없었다.
   *
   * **채널이 닫힌 것이 곧 실패는 아니다.** 닫혀 있으면 서버를 거치는 우회로로 보낸다. 다만 그
   * 우회로는 상담자→사용자 한 방향뿐이라(서버가 상담 하나당 SSE 구독자를 하나만 두므로 받는
   * 쪽인 사용자만 구독한다) **사용자→상담자 지도 동기화는 채널이 열려야 간다.** 그래서 이 표시가
   * 지도가 상담자 화면에 뜨는지와 직접 맞물린다.
   */
  const connectionDetail = t('user.consultSession.statusWithChannel', {
    status,
    channel: eventChannelOpen
      ? t('user.consultSession.channelOpen')
      : t('user.consultSession.channelClosed'),
  });

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
   * 경로 진행도. 다리별 명도를 정하는 데 쓴다. (S15P11A206-89)
   *
   * **진행 거리는 스토어 값을 읽기만 한다.** 되돌아가지 않게 최대값을 남기는 일은 안내 화면이
   * 한다 — 두 화면이 같은 열쇠에 각자 쓰면 어느 값이 남는지 순서에 달리고, 상담 중 잠깐 뒤로
   * 잡힌 좌표가 안내 화면의 진행도를 되돌릴 수 있다. 여기서 필요한 것은 지금 어느 다리를 걷는지
   * 판단하는 것뿐이며, 진행 거리가 0이어도 경로선은 그대로 그려진다.
   */
  const progress = routeProgressOf({
    pathNodes,
    steps: routeResult?.steps,
    currentLocation,
    travelledM: storedTravelledM,
  });
  /**
   * 지금 걷고 있는 다리. 지나온 경유지 수가 곧 다리 번호다.
   *
   * 경유지가 없으면 나눌 다리가 없고, 경로에서 벗어난 동안에는 어느 다리인지 말할 근거가 없다.
   * 둘 다 null 이며 지도는 한 색으로 그린다.
   */
  const activeLeg =
    progress.offRoute || waypoints.length === 0
      ? null
      : waypointNodeIds.filter((nodeId) => progress.passedNodeIds.includes(nodeId)).length;

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
        /**
         * 이 화면이 나뉜 자리. 상담자 화면이 같은 배치의 거울을 만드는 근거다.
         *
         * 아직 재지 못했으면 null 로 간다 — 그 구간에도 지도는 보내야 하고, 상담자 화면은
         * 배치를 모르는 동안 기본 비율로 그린 뒤 곧 오는 스냅숏으로 맞춘다.
         */
        screen: screenGeometry,
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
    /**
     * 배치가 바뀌면 다시 보낸다. 화면 회전이나 주소창 접힘으로 나뉘는 자리가 달라지는데,
     * 그때 알리지 않으면 상담자는 옛 배치의 거울에 계속 그린다.
     */
    screenGeometry,
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
          setTokenError(t('user.consultSession.tokenError'));
          return;
        }
        setSignalingRoom(consultation.signalingRoomId, consultation.signalingAccessToken);
      })
      .catch(() => setTokenError(t('user.consultSession.tokenError')));
  }, [consultationId, setSignalingRoom, signalingAccessToken, signalingRoomId, t, userSessionId]);

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
      phoneClassName={styles.phone}
      /*
        상단 여백은 `.bar` 가 자기 패딩으로 만든다.

        세션이 열리면 `dom-overlay` 가 오버레이 루트만 화면 전체에 그리므로, PhoneFrame 이 루트
        밖에 두는 여백은 컴포지터에게 버려진다. 여백이 루트 안에 있어야 세션 전후로 헤더 영역이
        같다. 여기서 켜 두면 세션 전에만 46px 이 두 번 들어간다.
      */
      reserveTopSpace={false}
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
      <div className={styles.overlayRoot} ref={setOverlayNode}>
        {/* 상담원이 카메라 영상 위에 그린 선. 좌표는 0~1 정규화 값이라 화면을 덮어 얹는다. */}
        <canvas ref={annotationRef} className={styles.annotation} aria-hidden />
        <div className={styles.bar}>
          {/* 붙지 않았으면 초록으로 칠하지 않는다. 색도 문구와 같은 말을 해야 한다. */}
          <span
            className={[styles.liveChip, !connected && styles.liveChipOff]
              .filter(Boolean)
              .join(' ')}
          >
            <span className={styles.liveDotWrap}>
              <span className={styles.liveDot} />
              {/* 퍼지는 고리는 살아 있는 연결에만 둔다. */}
              {connected && <span className={styles.liveRing} />}
            </span>
            {/* 무엇이 건너가고 있는지 그대로 적는다. 준비 중인 것을 공유 중이라고 말하면
                사용자는 상담자가 이미 보고 있다고 믿는다. */}
            {cameraShareLabel}
            <span className={styles.liveShine} />
          </span>
          {/* 추적 상태는 안내 화면과 같은 자리(상단 줄 가운데)에 둔다. */}
          <XrTrackingBadge status={xrStatus} anchorStatus={anchorStatus} source={source} />
          <button type="button" className={styles.endCall} onClick={() => void endCall()}>
            {t('user.consultSession.end')}
          </button>
        </div>

        <div className={[styles.cam, isSessionOpen && styles.camLive].filter(Boolean).join(' ')}>
          {/*
            signaling이 붙기 전에 끊기면(1009 등) 원인 코드만 화면에 남아 있었다. 자동으로
            다시 맺는 동안에는 그 문구 대신 로딩 화면을 보여 준다 — 재시도가 곧 이어지므로
            사용자가 새로고침 말고는 손쓸 방법이 없다고 오해하지 않게 한다.
          */}
          {reconnecting && (
            <div className={styles.reconnecting} role="status">
              <span className={styles.reconnectingSpinner} aria-hidden />
              <span>{t('user.consultSession.reconnecting')}</span>
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

            **병합 판단(S15P11A206-89):** develop 이 셀프뷰를 다시 넣었는데 여기서는 걷어 냈다.
            그쪽은 XR 카메라 경로가 없어 셀프뷰가 유일한 확인 수단이었지만, 이 화면은 카메라가
            배경으로 깔린다. 사용자도 "셀프뷰는 필요 없다"고 확인했다.
          */}
          <span
            className={styles.connectionStatus}
            role={!reconnecting && (error ?? tokenError) ? 'alert' : undefined}
          >
            {/* 재시도 중에는 위 로딩 화면이 안내를 대신하므로 원인 코드를 여기 또 띄우지 않는다. */}
            {reconnecting
              ? t('user.consultSession.retryingStatus')
              : (error ?? tokenError ?? connectionDetail)}
          </span>
          <div
            className={[styles.routeHeader, waypoints.length > 0 && styles.routeHeaderCompact]
              .filter(Boolean)
              .join(' ')}
            aria-label={t('user.consultSession.routeLabel')}
          >
            <div className={styles.routePoint}>
              <span className={styles.routeLabel}>
                <span className={styles.pointDot} aria-hidden />
                <small>{t('user.station.origin')}</small>
              </span>
              {/* 위치 인식이 확정한 지점. 아직 모르면 역 이름만 적고 층을 지어내지 않는다. */}
              <strong>{displayedOrigin}</strong>
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
                    aria-label={t('user.consultSession.removeWaypoint', { name: waypoint.nameKo })}
                    title={t('user.consultSession.removeWaypoint', { name: waypoint.nameKo })}
                  >
                    ×
                  </button>
                  <span className={styles.routeLabel}>
                    <span className={`${styles.pointDot} ${styles.pointDotWaypoint}`} aria-hidden />
                    <small>{t('user.consultSession.waypoint', { order: index + 1 })}</small>
                  </span>
                  <strong title={localizeUserLabel(waypoint.nameKo, displayLanguage)}>
                    {localizeUserLabel(waypoint.nameKo, displayLanguage)}
                  </strong>
                </div>
              </Fragment>
            ))}
            <span className={styles.routeArrow} aria-hidden>
              <Icon name="arrow-right" size={16} />
            </span>
            <div className={styles.routePoint}>
              <span className={styles.routeLabel}>
                <span className={`${styles.pointDot} ${styles.pointDotDestination}`} aria-hidden />
                <small>{t('user.station.destination')}</small>
              </span>
              <strong title={displayedDestination ?? undefined}>
                {displayedDestination ?? t('user.consultSession.noDestination')}
              </strong>
            </div>
          </div>
          <div className={styles.translation}>
            <div className={styles.translationLabel}>
              <Icon name="globe" size={13} />
              {t('user.consultSession.captionLabel')}
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
                    ? t('user.consultSession.captionWaiting')
                    : t('user.consultSession.captionUnsupported')))}
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

        {/* `ref` 는 상담자에게 보낼 배치를 재는 데 쓴다 — 카메라가 끝나는 자리다. */}
        <div className={styles.lower} ref={lowerRef}>
          {/*
            안내 화면(/user/navigation)과 같은 실내 지도를 그대로 쓴다.
            예전에는 실제 도면과 아무 상관 없는 스키매틱 SVG와 `3번 출구` 라벨이 고정으로
            박혀 있었다. 상담원이 그 위에 길을 그려 줘도 사용자가 실제로 서 있는 곳과는
            무관한 그림이라, 짚어 준 자리를 현장에서 찾을 수 없었다.
          */}
          <MapPreview className={styles.map}>
            {/* 도면이 그려지는 자리. 상담자 거울의 지도도 정확히 이 비율·이 자리에 놓인다. */}
            <div className={styles.mapCanvas} ref={mapBoxRef}>
              <IndoorMapView
                stationId={stationId ?? 0}
                floorId={displayedFloorId}
                currentLocation={currentLocation}
                /* 사용자 화면은 안내 화면과 같이 진행 방향이 위를 향하게 돈다. */
                currentHeadingDeg={headingDeg}
                destination={destinationPoint}
                destinationLabel={destination}
                pathNodes={pathNodes}
                /* 경유지 번호 핀과 다리별 색. 겹치는 복도에서 순서를 알려주는 것이 이 번호다. */
                waypointNodeIds={waypointNodeIds}
                /* 지나온 다리는 흐리게, 지금 다리는 진하게, 남은 다리는 연하게 그린다. */
                activeLeg={activeLeg}
                /*
                  내 점과 경로 사이의 빈 자리를 잇는다. **벗어난 동안에도 잇는다.**

                  서버가 진입 노드를 목적지 기준으로 다시 고르면 그 노드가 수십 m 떨어질 수 있고,
                  그 층에 남는 경로 노드가 그것 하나뿐이면 이탈로 판정되어 지도가 통째로 빈다.
                  아무것도 그리지 않으면 사용자는 자기 층에 경로가 없다고 읽는다. (S15P11A206-83)
                */
                connectCurrentToRoute
                followCamera
                /* `내 위치` 버튼은 고른 층까지 함께 되돌린다. 시점만 돌리면 다른 층을 보던
                   사용자는 그 층 지도가 자기 좌표로 옮겨진 것만 보고 마커는 그려지지 않는다. */
                onRecenter={() => setPickedFloorId(null)}
                facilityType={effectiveType}
                /* 유형을 고르기 전에는 그 층 시설을 모두 보여 준다. 숨김이면 둘 다 꺼진다. */
                showAllFacilities={effectiveView === 'all'}
                selectedFacilityId={selectedFacility?.facilityId}
              />
            </div>

            <div className={styles.floorButtons} role="group" aria-label="층 선택">
              {floorMaps.map((map) => {
                const on = map.floorId === displayedFloorId;

                return (
                  <button
                    key={map.floorId}
                    type="button"
                    aria-pressed={on}
                    className={[styles.floorButton, on && styles.floorButtonOn]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      setPickedFloorId(map.floorId);
                      // 다른 층의 시설을 고른 상태로 남기지 않는다.
                      setSelectedFacility(null);
                    }}
                  >
                    {map.floorCode}
                  </button>
                );
              })}
            </div>

            <div className={styles.facilityFilters} role="group" aria-label="시설 필터">
              {availableFilters.map((filter) => {
                const active = effectiveView === filter.facilityType;

                return (
                  <button
                    key={filter.facilityType}
                    type="button"
                    className={[styles.facilityFilter, active && styles.facilityFilterOn]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={`${filter.name} ${active ? '필터 해제' : '필터 적용'}`}
                    aria-pressed={active}
                    title={filter.name}
                    onClick={() => {
                      // 켜 둔 것을 다시 누르면 전체 표시로 돌아간다.
                      setFacilityView(active ? 'all' : filter.facilityType);
                      setSelectedFacility(null);
                    }}
                  >
                    <Icon name={filter.icon} size={14} />
                  </button>
                );
              })}

              {/*
                전부 감추기.

                유형 칩만으로는 시설을 하나도 없는 상태로 만들 수 없다. 다시 누르면 전체 표시로
                돌아온다 — 되돌릴 방법이 없으면 누르기를 망설이게 된다. 목적지·내 위치·경로는
                그대로 둔다. 안내에 필요한 표시까지 사라지면 지도가 길을 알려 주지 못한다.
              */}
              <button
                type="button"
                className={[
                  styles.facilityFilter,
                  effectiveView === 'none' && styles.facilityFilterOn,
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={
                  effectiveView === 'none' ? '시설 아이콘 다시 보기' : '시설 아이콘 모두 숨기기'
                }
                aria-pressed={effectiveView === 'none'}
                title={effectiveView === 'none' ? '시설 아이콘 다시 보기' : '시설 아이콘 숨기기'}
                onClick={() => {
                  setFacilityView(effectiveView === 'none' ? 'all' : 'none');
                  setSelectedFacility(null);
                }}
              >
                <Icon name={effectiveView === 'none' ? 'eye' : 'eye-off'} size={14} />
              </button>
            </div>
          </MapPreview>

          <div className={styles.syncNote}>
            <span className={styles.syncDot} aria-hidden />
            <p className={styles.syncText}>{t('user.consultSession.mapSync')}</p>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
