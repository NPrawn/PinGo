import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  consultationProblemLabel,
  destinationTypeLabel,
  isClosedConsultation,
  useConsultStore,
  useCounselorQueueStore,
  waitedLabel,
} from '@/entities/consult';
import { FACILITY_MAP_FILTERS, useStationFacilities, type Facility } from '@/entities/facility';
import { useStationFloorMaps } from '@/entities/floor-map';
import {
  describeRemoteCaptionTrouble,
  useCaptionTranslation,
  useConsultSignaling,
  useTranslatedSpeech,
} from '@/features/consult-signaling';
import type {
  ConsultDataEvent,
  ConsultEventBody,
  MapSyncPayload,
  NormalizedRect,
} from '@/shared/types';
import { useScreenDraw } from '@/features/shared-screen-draw';
import { COUNSELOR_ROUTES } from '@/shared/config';
import {
  ApiError,
  endConsultation,
  getCounselorConsultation,
  getCounselorConsultations,
  queryKeys,
  submitConsultationTranscript,
} from '@/shared/api';
import { Badge, Button, FloorRail, Icon, MapPreview, MapToggle, PillButton } from '@/shared/ui';
import { CounselorConsoleShell } from '@/widgets/counselor-console';
import { IndoorMapView } from '@/widgets/indoor-map';
import styles from './SessionPage.module.css';

/** 사용자가 끊었는지 확인하는 간격. 사용자 화면의 감시 주기와 맞춘다. */
const CONSULTATION_WATCH_MS = 4000;
const TRANSCRIPT_SAVE_ATTEMPTS = 3;
const TRANSCRIPT_RETRY_DELAY_MS = 500;

type TranscriptRequest = Parameters<typeof submitConsultationTranscript>[1];

async function submitTranscriptWithRetry(
  consultationId: string,
  transcript: TranscriptRequest['transcript'],
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < TRANSCRIPT_SAVE_ATTEMPTS; attempt += 1) {
    try {
      await submitConsultationTranscript(consultationId, { transcript });
      return;
    } catch (cause) {
      lastError = cause;
      if (attempt < TRANSCRIPT_SAVE_ATTEMPTS - 1) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, TRANSCRIPT_RETRY_DELAY_MS));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('transcript_save_failed');
}

type DrawStrokeStart = Extract<ConsultEventBody, { eventType: 'DRAW_STROKE_START' }>['payload'];
type DrawStrokeMove = Extract<ConsultEventBody, { eventType: 'DRAW_STROKE_MOVE' }>['payload'];
type DrawStrokeEnd = Extract<ConsultEventBody, { eventType: 'DRAW_STROKE_END' }>['payload'];

/* 층 목록은 더 이상 상수로 두지 않는다. 사용자가 보고 있는 역의 실제 지도에서 만든다. */

/**
 * 배치가 아직 도착하지 않았을 때 쓸 화면 비율. `PhoneFrame` 의 기준 크기(342×726)다.
 *
 * **어림값이라는 것을 분명히 한다.** 실제 비율은 사용자가 재서 보내며, 이 값은 첫 스냅숏이
 * 오기 전 몇 백 밀리초를 위한 것이다. 비율이 틀린 동안에도 0~1 좌표는 축마다 따로 나뉘므로
 * 그은 자리는 맞고 모양만 늘어난다.
 */
const FALLBACK_MIRROR_ASPECT = 342 / 726;

/**
 * 카메라 원본 규격을 모르는 동안 쓸 비율.
 *
 * 받는 트랙은 320×240 고정이므로 이 값을 쓰면 늘어난 그대로 보여 준다 — 되돌릴 근거가 없을 때
 * 임의로 자르면 사용자가 보는 것과 다른 장면을 보여 주게 된다.
 */
const FALLBACK_CAMERA_ASPECT = 320 / 240;

/**
 * 0~1 값을 백분율 문자열로. 끝자리를 자른다 — `0.041 * 100` 은 `4.1000000000000005` 다.
 */
function percent(value: number): string {
  return `${Number((value * 100).toFixed(4))}%`;
}

/** 화면 기준 0~1 사각형을 거울 안의 자리로 옮긴다. */
function rectStyle(rect: NormalizedRect): CSSProperties {
  return {
    left: percent(rect.x),
    top: percent(rect.y),
    width: percent(rect.width),
    height: percent(rect.height),
  };
}

/** Screen 30 (FR-C-004 / FR-W-002) — the counselor's live consultation view. */
export function SessionPage() {
  const navigate = useNavigate();
  const signalingRoomId = useConsultStore((state) => state.signalingRoomId);
  const signalingAccessToken = useConsultStore((state) => state.signalingAccessToken);
  const consultationId = useConsultStore((state) => state.consultationId);
  const setSignalingRoom = useConsultStore((state) => state.setSignalingRoom);
  const clearConsultation = useConsultStore((state) => state.clearConsultation);
  const queryClient = useQueryClient();
  const [tokenError, setTokenError] = useState<string | null>(null);
  /** 상담자가 직접 종료를 진행 중인지. 종료 감시와 겹쳐 화면이 두 번 넘어가지 않게 한다. */
  const [ending, setEnding] = useState(false);
  /**
   * 종료가 서버에 받아들여지지 않은 이유.
   *
   * 이걸 보여 주지 않으면 상담자는 끝냈다고 믿고 자리를 뜨는데, 서버에는 상담이 그대로
   * 남아 다음 요청을 받지 못한다.
   */
  const [endError, setEndError] = useState<string | null>(null);
  /**
   * 사용자가 보내온 지도 상태.
   *
   * 상담자는 사용자의 안내 상태를 알 방법이 없다. 이 스냅숏을 받기 전에는 그릴 지도가 없어
   * 예전처럼 아무 지도나 띄우지 않는다 — 사용자와 다른 지도를 띄우면 거기에 그린 길이
   * 현장에서는 다른 곳을 가리킨다.
   */
  const [mapSync, setMapSync] = useState<MapSyncPayload | null>(null);
  const handleDataEvent = useCallback((event: ConsultDataEvent) => {
    if (event.eventType !== 'MAP_SYNC') return;
    setMapSync(event.payload);
  }, []);
  const {
    remoteVideoRef,
    status,
    error,
    reconnecting,
    localCaption,
    localCaptionFinal,
    localFinalCaptionId,
    remoteCaption,
    remoteFinalCaption,
    remoteFinalCaptionId,
    remoteCaptionFinal,
    remoteCaptionError,
    captionsSupported,
    captionError,
    restartCaptions,
    transcript,
    transcriptTimeline,
    updateTranscriptTranslation,
    sendConsultEvent,
    tokenRejected,
  } = useConsultSignaling(signalingRoomId, 'COUNSELOR', signalingAccessToken, handleDataEvent);

  /**
   * 사용자가 한 말을 한국어로 옮겨 둔다.
   *
   * 상담자 콘솔은 한국어로 쓰인다. 사용자가 다른 언어로 말하면 상담자는 자막을 읽고도
   * 무슨 말인지 알 수 없어, 실시간 자막이 있으나 마나가 된다.
   */
  const handleUserCaptionTranslation = useCallback(
    (captionId: string, _source: string, translated: string) =>
      updateTranscriptTranslation(captionId, translated),
    [updateTranscriptTranslation],
  );
  const handleCounselorCaptionTranslation = useCallback(
    (captionId: string, _source: string, translated: string) =>
      updateTranscriptTranslation(captionId, translated),
    [updateTranscriptTranslation],
  );
  const translatedUserCaption = useCaptionTranslation(
    consultationId,
    remoteFinalCaption,
    'ko',
    remoteFinalCaptionId,
    handleUserCaptionTranslation,
  );
  useCaptionTranslation(
    consultationId,
    localCaptionFinal ? localCaption : '',
    'en',
    localFinalCaptionId,
    handleCounselorCaptionTranslation,
  );
  useTranslatedSpeech(translatedUserCaption, 'ko-KR', remoteCaptionFinal);
  /**
   * 옮긴 문장은 큰 줄에, 지금 들어오는 원문은 아래 줄에 흘려보낸다.
   *
   * 번역은 말이 끝난 문장에만 걸리므로, 옮긴 문장만 띄우면 사용자가 말하는 내내 화면이
   * 지난 문장에서 멈춰 있다. 상담원은 사용자가 말하는 중인지 끝난 것인지 알 수 없다.
   */
  /** 확정 자막도 다음 발화가 시작될 때까지 실시간 영역에 유지해 언어별 표시 차이를 없앤다. */
  const liveUserCaption = remoteCaption;
  const userCaptionPrimary = translatedUserCaption || liveUserCaption;
  const userCaptionSource =
    translatedUserCaption && translatedUserCaption !== liveUserCaption ? liveUserCaption : '';
  /** 사용자 쪽 자막이 죽었다는 사실. 상담원 자신의 마이크 문제와 섞이지 않게 따로 띄운다. */
  const userCaptionNotice = describeRemoteCaptionTrouble(remoteCaptionError, '사용자');
  const displayTranscript = (
    transcriptTimeline ??
    transcript.map((segment) => ({
      ...segment,
      captionId: `${segment.speaker}:${segment.seq}`,
    }))
  ).filter(
    (segment) =>
      segment.captionId !== localFinalCaptionId && segment.captionId !== remoteFinalCaptionId,
  );

  /** 그린 선을 사용자 화면에도 그대로 보낸다(명세 7장). */
  const drawEmitter = useMemo(
    () => ({
      onStrokeStart: (payload: DrawStrokeStart) =>
        sendConsultEvent({ eventType: 'DRAW_STROKE_START', payload }),
      onStrokeMove: (payload: DrawStrokeMove) =>
        sendConsultEvent({ eventType: 'DRAW_STROKE_MOVE', payload }),
      onStrokeEnd: (payload: DrawStrokeEnd) =>
        sendConsultEvent({ eventType: 'DRAW_STROKE_END', payload }),
      onClear: () => sendConsultEvent({ eventType: 'DRAW_CLEAR', payload: {} }),
    }),
    [sendConsultEvent],
  );
  const selected = useCounselorQueueStore((state) => state.selected);
  const complete = useCounselorQueueStore((state) => state.complete);
  /** 상담자가 직접 고른 층. 자유 탐색일 때만 쓴다. */
  const [pickedFloorId, setPickedFloorId] = useState<number | null>(null);
  const [synced, setSynced] = useState(true);
  /** 사용자 영상이 실제로 들어오고 있는지. 패널 문구와 상태 칩이 이 값을 따른다. */
  const sharing = status === 'connected';
  /**
   * Which pin the counselor is repositioning.
   *
   * TODO: Arming a mode is all the UI can do until the indoor-map editor lands;
   * dropping the new pin needs the map coordinate contract.
   */
  const [repinning, setRepinning] = useState<'dest' | 'origin' | null>(null);
  /**
   * 거울 전체에 그린다. **영상 요소를 기준으로 삼지 않는다.** (S15P11A206-89)
   *
   * 예전에는 `remoteVideoRef` 를 넘겼다. 그러면 좌표가 `object-fit: contain` 으로 맞춰진
   * **영상 안쪽**을 기준으로 정규화되는데, 영상은 카메라 부분만 차지하므로 지도 위에 그은 선이
   * 1을 넘는 값으로 나가 사용자 화면 밖에 찍혔다.
   *
   * 캔버스는 거울 전체를 덮고, 거울은 사용자 화면과 같은 비율이다. 그래서 캔버스 기준 0~1 이
   * 곧 사용자 화면 기준 0~1 이다.
   */
  const {
    canvasRef,
    enabled: drawing,
    toggle: toggleDraw,
    clear: clearDraw,
  } = useScreenDraw(drawEmitter);

  /**
   * 층 목록은 사용자가 보고 있는 역의 실제 지도에서 만든다.
   *
   * 예전에는 `1F·B1·B2`가 상수로 박혀 있었다. 역마다 등록된 층이 다르고 `floorId`는
   * auto-increment라, 상수로 두면 있지도 않은 층을 눌러 빈 화면을 보게 된다.
   */
  const floorMapsQuery = useStationFloorMaps(mapSync?.stationId ?? 0);
  const floorMaps = useMemo(() => floorMapsQuery.data ?? [], [floorMapsQuery.data]);
  /**
   * 화면에 띄울 층.
   *
   * 동기화 중이면 사용자가 보는 층을 그대로 따라간다. 자유 탐색이면 상담자가 고른 층을 쓴다.
   * 사용자가 아직 위치를 확정하지 않아 층을 모를 수도 있는데, 그때 빈 화면을 보여 주면
   * 상담자가 역 구조조차 볼 수 없다. 등록된 첫 층으로라도 열어 둔다.
   */
  const displayedFloorId =
    (synced ? null : pickedFloorId) ?? mapSync?.floorId ?? floorMaps[0]?.floorId;

  /**
   * 지도에 켜 둔 시설 표시. **사용자 화면과 같은 세 상태 모델이다.**
   *
   * - `all` — 그 층 시설을 모두 보여 준다. **첫 화면이 이것이다.**
   * - `none` — 아무것도 보여 주지 않는다.
   * - 그 외 — 그 `facilityType` 만.
   *
   * 셋을 한 값에 담는다. 유형과 숨김을 따로 두면 "숨김인데 유형도 켜져 있는" 조합이 생긴다.
   *
   * 예전에는 `null` 로 시작해 아무 시설도 그리지 않았다. 상담자는 역에 무엇이 어디 있는지부터
   * 봐야 짚어 줄 수 있는데, 빈 도면에서 시작하면 유형 칩을 하나씩 눌러 가며 찾아야 했다.
   * 사용자 화면은 처음부터 전체를 보여 주므로 두 화면이 서로 다른 지도를 보고 있었다.
   * (S15P11A206-89)
   */
  const [facilityView, setFacilityView] = useState<string>('all');

  /**
   * 표시 층에 실제로 있는 시설 유형. 칩의 진하기를 가르는 값이다. (S15P11A206-89)
   *
   * **사용자 화면은 없는 유형을 아예 빼지만 여기서는 연하게 남긴다.** 상담자는 층을 오가며
   * 보는 사람이라 칩이 층마다 나타나고 사라지면 누르려던 자리가 계속 바뀐다. 연하게 두면 줄이
   * 고정되고, 그 층에 없다는 것도 눌러 보지 않고 알 수 있다 — 역삼역 B3 에는 승차권 충전기가
   * 없는데 예전에는 눌러서 빈 지도를 봐야만 알 수 있었다.
   */
  const facilities = useStationFacilities(mapSync?.stationId ?? 0).data;
  const floorFacilityTypes = new Set(
    (facilities ?? [])
      .filter((facility) => facility.floorId === displayedFloorId)
      .map((facility) => facility.facilityType),
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
  const facilityType = effectiveView === 'all' || effectiveView === 'none' ? null : effectiveView;
  /**
   * 사용자 화면 거울의 배치. 사용자가 직접 재서 보낸 값을 그대로 쓴다. (S15P11A206-89)
   *
   * **여기서 계산하지 않는다.** 카메라와 지도가 나뉘는 자리는 화면 높이에 따라 달라지고 카메라
   * 원본 규격도 기기마다 달라서, 이쪽에서 짐작하면 어느 기기에서는 맞고 어느 기기에서는
   * 어긋난다. 어긋나는 쪽에서는 상담자가 짚어 준 자리가 사용자 화면의 다른 곳에 찍힌다.
   */
  const screen = mapSync?.screen ?? null;
  const mirrorStyle = {
    '--mirror-aspect': screen ? screen.width / screen.height : FALLBACK_MIRROR_ASPECT,
    /**
     * 카메라 영상의 원본 비율.
     *
     * 트랙은 320×240 고정이라 원본이 16:9면 늘어난 채로 도착한다. 원본 비율의 상자에 영상을
     * 늘려 채우면(`object-fit: fill`) 그 늘어남이 정확히 되돌아가고, 그 상자를 거울에 맞춰
     * 잘라 내면 사용자가 보는 것과 같은 화각이 된다.
     */
    '--mirror-camera-aspect': screen?.cameraSource
      ? screen.cameraSource.width / screen.cameraSource.height
      : FALLBACK_CAMERA_ASPECT,
  } as CSSProperties;
  /** 방금 사용자에게 보낸 변경. 상담자가 무엇을 눌렀는지 화면에 남긴다. */
  const [lastPick, setLastPick] = useState<string | null>(null);

  /**
   * 상담자가 지도에서 지점을 짚었다. 사용자 화면의 목적지·현재 위치를 그리로 옮긴다.
   *
   * 이름이 아니라 좌표와 노드까지 함께 보낸다. 이름만 넘기면 사용자 화면이 그 이름으로
   * 시설을 다시 찾아야 하는데, 표기가 조금만 달라도 엉뚱한 곳을 가리킨다.
   *
   * 사용자 화면이 값을 바꾸면 곧 새 MAP_SYNC 가 돌아와 이 지도에도 반영된다. 여기서 미리
   * 그려 두지 않는 이유다 — 실제로 사용자 화면이 받아들인 것만 보여야 한다.
   */
  const pickOnMap = useCallback(
    (facility: Facility) => {
      if (!repinning) return;

      const payload = {
        facilityId: facility.facilityId,
        nameKo: facility.nameKo,
        floorId: facility.floorId,
        mapX: facility.mapX,
        mapY: facility.mapY,
        linkedNodeId: facility.linkedNodeId ?? null,
      };
      const sent = sendConsultEvent(
        repinning === 'dest'
          ? { eventType: 'DESTINATION_CHANGE_REQUESTED', payload }
          : { eventType: 'CURRENT_LOCATION_CORRECTED', payload },
      );

      setLastPick(
        sent
          ? `${facility.nameKo}(으)로 ${repinning === 'dest' ? '목적지' : '현재 위치'}를 옮겼어요`
          : '사용자에게 전달하지 못했어요. 연결을 확인해 주세요.',
      );
      setRepinning(null);
    },
    [repinning, sendConsultEvent],
  );

  /**
   * 새로고침하면 signaling 토큰이 남지 않는다(짧은 만료 시간). 방은 알고 있으므로
   * 상세 조회로 토큰만 다시 받아 WebSocket 접속이 401로 거절되지 않게 한다.
   */
  /**
   * 거절당한 토큰을 버린다. 아래 복구 effect 가 곧바로 새 토큰을 받아 온다.
   *
   * 토큰은 10분이면 만료되는데 상담은 그보다 오래간다. 예전에는 한 번 받은 토큰을 상담이
   * 끝날 때까지 그대로 썼기 때문에, 연결을 다시 맺어야 하는 순간 handshake 가 401 로
   * 거절되고 그대로 끝이었다 — 화면은 `연결 상태: signaling` 에서 멈췄다.
   */
  useEffect(() => {
    if (!tokenRejected || !signalingRoomId) return;
    setSignalingRoom(signalingRoomId, null);
  }, [setSignalingRoom, signalingRoomId, tokenRejected]);

  useEffect(() => {
    if (!consultationId || !signalingRoomId || signalingAccessToken) return;

    void getCounselorConsultation(consultationId)
      .then((detail) => {
        if (!detail.signalingRoomId || !detail.signalingAccessToken) {
          setTokenError('상담 연결 정보를 받지 못했습니다. 상담 요청 목록에서 다시 입장해 주세요.');
          return;
        }
        setSignalingRoom(detail.signalingRoomId, detail.signalingAccessToken);
      })
      .catch(() =>
        setTokenError('상담 연결 정보를 받지 못했습니다. 상담 요청 목록에서 다시 입장해 주세요.'),
      );
  }, [consultationId, setSignalingRoom, signalingAccessToken, signalingRoomId]);

  /**
   * 사용자가 먼저 끊었는지 지켜본다. 상담 목록으로 확인하는 이유는 상세 조회가 부를 때마다
   * signaling 토큰을 새로 발급하기 때문이다. 상태만 알면 되는 자리에서 쓸 요청이 아니다.
   */
  const queueQuery = useQuery({
    queryKey: queryKeys.counselorConsultations(),
    queryFn: () => getCounselorConsultations(),
    enabled: Boolean(consultationId),
    refetchInterval: CONSULTATION_WATCH_MS,
  });
  /**
   * 지금 상담 중인 요청. 위 목록 조회에서 그대로 꺼낸다.
   *
   * 상세 조회(`getCounselorConsultation`)를 쓰지 않는 이유는 그쪽이 부를 때마다 signaling
   * 토큰을 새로 발급하기 때문이다. 여기서 쓰면 4초마다 토큰이 바뀌어 연결이 끊었다 붙기를
   * 되풀이한다. 출발지·목적지·문의 유형은 목록 응답에도 모두 들어 있다.
   */
  const consultation = consultationId
    ? queueQuery.data?.find((item) => item.consultationId === consultationId)
    : undefined;
  const destinationKind = destinationTypeLabel(consultation?.destinationType);
  const closedByUser = Boolean(consultation && isClosedConsultation(consultation.status));

  /**
   * 사용자가 먼저 끝냈을 때도 상담 전문을 남긴다.
   *
   * 예전에는 상담자가 직접 '상담 종료'를 누른 경우에만 저장했다. 실제로는 사용자가 먼저
   * 끊는 일이 더 잦은데, 그때는 화면만 목록으로 넘어가고 방금 나눈 대화가 통째로 사라졌다.
   * 상담 내역에는 '저장된 상담 내용이 없습니다'만 남고 AI 요약도 만들어지지 않았다.
   *
   * 상담자가 직접 끝내는 중이라면 그쪽이 저장까지 마치고 나가게 둔다. 여기가 먼저 화면을
   * 넘겨 버리면 종료 도중에 화면이 사라진다.
   */
  const leavingRef = useRef(false);
  useEffect(() => {
    if (!closedByUser || ending || leavingRef.current) return;
    leavingRef.current = true;

    const leave = async () => {
      // 사용자가 끝냈으니 상담은 이미 `ENDED`다. 종료 요청 없이 바로 전문만 올린다.
      if (consultationId && transcript.length > 0) {
        try {
          await submitTranscriptWithRetry(consultationId, transcript);
        } catch {
          setEndError('상담 전문을 저장하지 못했습니다. 네트워크를 확인해 주세요.');
          return;
        }
      }
      complete(selected);
      void queryClient.invalidateQueries({ queryKey: queryKeys.counselorConsultations() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.counselorMe() });
      clearConsultation();
      void navigate(COUNSELOR_ROUTES.REQUESTS);
    };

    void leave();
  }, [
    closedByUser,
    complete,
    consultationId,
    ending,
    navigate,
    queryClient,
    selected,
    transcript,
    clearConsultation,
  ]);

  /**
   * 상담을 끝내고 목록으로 돌아간다.
   *
   * 종료를 서버가 받아들였을 때만 화면을 넘긴다. 예전에는 실패를 통째로 삼키고 그대로
   * 나가 버려서, 상담자는 끝냈다고 믿는데 서버에는 계속 `IN_PROGRESS` 로 남았다. 그 상담은
   * 요청 목록에서 사라지지 않고, 상담자 상태도 '상담 중'에 묶여 다음 요청을 받지 못했다.
   * 무엇이 잘못됐는지 화면 어디에도 나오지 않아 원인을 짚을 수도 없었다.
   */
  const endCall = async () => {
    if (!consultationId) {
      setEndError(
        '상담 정보를 찾을 수 없어 종료를 서버에 알리지 못했습니다. 상담 요청 목록에서 다시 들어와 주세요.',
      );
      return;
    }

    setEnding(true);
    setEndError(null);

    try {
      await endConsultation(consultationId);
    } catch (cause) {
      /**
       * 여기서 나가면 안 된다. 서버는 아직 이 상담을 진행 중으로 알고 있어서, 화면만
       * 넘어가면 목록에 그대로 남은 상담을 상담자가 다시 끝낼 방법이 없다.
       */
      setEnding(false);
      setEndError(
        cause instanceof ApiError
          ? `상담을 종료하지 못했습니다. ${cause.message} 상담은 아직 진행 중입니다.`
          : '상담을 종료하지 못했습니다. 네트워크를 확인하고 다시 눌러 주세요. 상담은 아직 진행 중입니다.',
      );
      return;
    }

    /**
     * 전문은 상담이 `ENDED`가 된 뒤에만 받는다.
     *
     * 저장에 실패해도 종료 흐름은 막지 않는다. 요약은 부가 기능이고, 실패하면 상담 내역
     * 상세에 '저장된 요약이 없습니다'로 드러난다.
     *
     * TODO: 출발지·안내한 출구·경로 유형은 상담 화면이 아직 실제 값을 들고 있지 않아
     * 보내지 않는다. 지도 연동이 끝나면 함께 싣는다.
     */
    if (transcript.length > 0) {
      try {
        await submitTranscriptWithRetry(consultationId, transcript);
      } catch {
        setEnding(false);
        setEndError('상담 전문을 저장하지 못했습니다. 네트워크를 확인해 주세요.');
        return;
      }
    }

    /**
     * 목록을 서버에서 다시 읽게 한다. 캐시에 남은 옛 목록에는 방금 끝낸 상담이 그대로
     * 있어서, 목록으로 돌아간 순간 아직 진행 중인 것처럼 보인다.
     */
    void queryClient.invalidateQueries({ queryKey: queryKeys.counselorConsultations() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.counselorMe() });
    complete(selected);
    clearConsultation();
    void navigate(COUNSELOR_ROUTES.REQUESTS);
  };

  return (
    <CounselorConsoleShell connected>
      <div className={styles.layout}>
        <div className={styles.main}>
          {/* 사용자 영상은 오른쪽 패널이 맡는다. 상담자 자신의 카메라는 되비추지 않는다. */}
          {/*
            연결이 정상일 때는 아무것도 적지 않는다. (S15P11A206-89)

            예전에는 `연결 상태: connected` 가 늘 떠 있었다. 잘 되고 있다는 말을 계속 하는 표시는
            읽을 이유가 없는데도 지도 오른쪽 아래를 덮고 있었다. 상담자가 알아야 하는 것은 연결이
            **깨졌을 때**이고, 붙어 있는 동안에는 사용자 영상이 흐르는 것으로 이미 보인다.

            실패는 남긴다. peer 상태를 함께 적는 이유는 'new'(협상 시작 못 함)인지
            'connecting'(상대를 못 찾음)인지 'failed'(ICE 실패)인지에 따라 볼 곳이 완전히
            달라서, 문구만으로는 어디부터 봐야 할지 알 수 없기 때문이다.

            재시도 중에는 적지 않는다 — 거울의 로딩 화면이 그 사실을 대신 보여 주고, 곧 결론이
            나므로 원인 코드를 두 곳에 띄울 이유가 없다.
          */}
          {!reconnecting && (error ?? tokenError) && (
            <span className={styles.connectionStatus} role="alert">
              {`${error ?? tokenError} · 연결 상태: ${status}`}
            </span>
          )}
          <div className={styles.summary}>
            <div className={styles.summaryBody}>
              <div className={styles.summaryHead}>
                <span className={styles.summaryMark}>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0F5A3E"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" />
                    <circle cx="12" cy="10" r="2.4" />
                  </svg>
                </span>
                <div>
                  <div className={styles.summaryLabel}>사용자 정보</div>
                  {/*
                    상담 요청에 실제로 담겨 온 출발지·목적지. 예전에는 `역삼역 2번 개찰구 →
                    3번 출구`가 그대로 적혀 있어, 상담자가 사용자와 무관한 경로를 읽고 안내를
                    시작했다. 서버가 채우지 못한 값은 지어내지 않고 모른다고 적는다.
                  */}
                  <div className={styles.summaryRoute}>
                    {consultation?.currentLocationLabel ?? '출발지 미확인'}
                    <span className={styles.summaryArrow}>→</span>
                    {consultation?.destinationLabel ?? '목적지 미지정'}
                  </div>
                </div>
              </div>
              <div className={styles.tags}>
                <Badge tone="neutral" className={styles.tag}>
                  <Icon name="chat" size={12} />
                  {consultationProblemLabel(consultation?.problemType)}
                </Badge>
                {destinationKind && (
                  <Badge className={styles.tag}>
                    <Icon name="pin" size={12} />
                    {destinationKind}
                  </Badge>
                )}
                {consultation?.requestedAt && (
                  <Badge className={styles.tag}>
                    <Icon name="clock" size={12} />
                    대기 {waitedLabel(consultation.requestedAt)}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              size="sm"
              className={styles.endCall}
              disabled={ending}
              onClick={() => void endCall()}
            >
              {ending ? '종료하는 중…' : '상담 종료'}
            </Button>
          </div>

          {/*
            종료가 서버에 닿지 않았다는 사실. 이걸 감추면 상담자는 끝냈다고 믿고 자리를
            뜨는데, 서버에는 상담이 그대로 남아 다음 요청을 받지 못한다.
          */}
          {endError && (
            <div className={styles.endAlert} role="alert">
              <Icon name="warning" size={13} />
              <span>{endError}</span>
            </div>
          )}

          <div className={styles.syncBar}>
            {synced ? (
              <>
                <span className={`${styles.syncChip} ${styles.syncOn}`}>
                  <span className={styles.syncDotOn} aria-hidden />
                  <span className={styles.syncLabelOn}>사용자 화면과 동기화 중</span>
                </span>
                <span className={styles.syncHint}>
                  사용자가 보는 지도·층·경로가 그대로 표시돼요
                </span>
              </>
            ) : (
              <>
                <span className={`${styles.syncChip} ${styles.syncOff}`}>
                  <span className={styles.syncDotOff} aria-hidden />
                  <span className={styles.syncLabelOff}>동기화 해제 · 자유 탐색</span>
                </span>
                <span className={styles.syncHint}>지금 보는 화면은 사용자에게 보이지 않아요</span>
              </>
            )}
            <div className={styles.syncModes}>
              <MapToggle
                on={synced}
                onClick={() => {
                  setSynced(true);
                  // 따라가기로 돌아오면 직접 고른 층은 버린다. 남겨 두면 다음 자유 탐색이
                  // 사용자 층이 아니라 한참 전에 보던 층에서 시작한다.
                  setPickedFloorId(null);
                }}
              >
                사용자 시점 따라가기
              </MapToggle>
              <MapToggle on={!synced} onClick={() => setSynced(false)}>
                자유 탐색
              </MapToggle>
            </div>
          </div>

          <div className={styles.legend}>
            {/* 색 이름을 적지 않는다. 스와치가 지도 마커와 같은 변수를 쓰므로 색은 그것이
                보여 주고, 글자로 적으면 색이 바뀔 때 조용히 거짓이 된다. */}
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendMe}`} />
              사용자 현 위치
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.legendDest}`} />
              목적지
            </span>
          </div>

          <div className={styles.mapRow}>
            {/*
              층 목록·도면·마커를 모두 사용자가 보내온 지도 상태에서 그린다.
              예전에는 층별로 손으로 그린 스키매틱 SVG와 고정 좌표 핀이 있었는데, 실제 역
              도면과 아무 관계가 없어 상담자가 짚어 준 자리를 사용자가 현장에서 찾을 수 없었다.
            */}
            <FloorRail
              options={floorMaps.map((map) => ({
                value: String(map.floorId),
                label: map.floorCode,
              }))}
              value={displayedFloorId == null ? '' : String(displayedFloorId)}
              onChange={(value) => {
                // 층을 직접 고르는 것은 사용자 시점을 벗어나겠다는 뜻이다.
                setSynced(false);
                setPickedFloorId(Number(value));
              }}
            />
            <MapPreview className={styles.map}>
              {mapSync ? (
                <>
                  <div className={styles.mapCanvas}>
                    <IndoorMapView
                      stationId={mapSync.stationId}
                      floorId={displayedFloorId}
                      currentLocation={mapSync.current}
                      currentHeadingDeg={mapSync.headingDeg}
                      destination={mapSync.destination}
                      destinationLabel={mapSync.destinationLabel}
                      pathNodes={mapSync.pathNodes}
                      /* 마우스만 있는 화면이라 휠 말고 눌러서 확대할 길도 둔다. */
                      showZoomControls
                      facilityType={facilityType}
                      /* 유형을 고르기 전에는 그 층 시설을 모두 보여 준다. 숨김이면 둘 다 꺼진다. */
                      showAllFacilities={effectiveView === 'all'}
                      /*
                        재지정 모드일 때만 시설 선택을 사용자에게 보낸다. 켜지 않은 채로
                        지도를 훑어보다 잘못 눌러 사용자의 목적지가 바뀌면 안 된다.
                      */
                      onSelectFacility={repinning ? pickOnMap : undefined}
                      /* 따라가기일 때만 사용자 위치를 좇는다. 자유 탐색은 층 전체를 본다. */
                      followCamera={synced}
                      /*
                        사용자를 좇되 지도는 돌리지 않는다.
                        사용자 화면은 진행 방향이 위를 향하게 돌아가지만(네비게이션 모드), 상담자
                        화면까지 같이 돌면 도면의 방위가 계속 바뀌어 역 구조를 짚어 줄 수 없다.
                        사용자가 보고 있는 방향은 마커의 부채꼴로 그대로 나타난다.
                      */
                      rotateWithHeading={false}
                    />
                  </div>
                </>
              ) : (
                <p className={styles.mapPlaceholder}>사용자 화면의 지도를 기다리는 중입니다.</p>
              )}
            </MapPreview>
          </div>

          {/*
            시설 표시 칩. **지도 밖, 지도 아래에 둔다.**

            예전에는 지도 위에 얹혀 있었다(`position: absolute`). 유형이 일곱 개로 늘자 세 줄이
            되어 도면의 절반 가까이를 덮었고, 상담자가 역 구조를 보려면 먼저 시설을 숨겨야 했다.
            가리는 것을 치우려고 누르는 버튼이 그 자리를 가리고 있었다. (S15P11A206-89)

            처음에는 그 층 시설을 모두 보여 주고, 유형을 누르면 그것만 남긴다. 전체 표시는 마커가
            서로 겹친다 — 역삼역 B2 는 1m 가 몇 px 이라 36개가 붙어 선다. 훑어보는 용도이고,
            짚으려면 유형으로 좁힌다. 목록은 안내 화면과 같은 것을 쓴다 — 사용자 화면에 없는
            유형을 상담자가 짚으면 현장에서 찾을 수 없다.
          */}
          {mapSync && (
            <div className={styles.facilityBar} role="group" aria-label="시설 표시">
              <div className={styles.facilityFilters}>
                {FACILITY_MAP_FILTERS.map((filter) => {
                  const active = effectiveView === filter.facilityType;
                  /*
                    이 층에 없는 유형. 조회가 오기 전에는 판정하지 않는다 — 아직 모르는 것을
                    없다고 그리면 모든 칩이 잠깐 연해진다.
                  */
                  const absent =
                    facilities !== undefined && !floorFacilityTypes.has(filter.facilityType);

                  return (
                    <MapToggle
                      key={filter.facilityType}
                      on={active}
                      className={absent ? styles.facilityFilterAbsent : undefined}
                      /* 없는 유형은 누를 수 없다. 눌러도 빈 지도가 나오므로 고장으로 읽힌다. */
                      disabled={absent}
                      title={absent ? `이 층에는 ${filter.name}이 없어요` : undefined}
                      /* 켜 둔 것을 다시 누르면 전체 표시로 돌아간다. 되돌릴 길이 없으면
                         누르기를 망설이게 된다. */
                      onClick={() => setFacilityView(active ? 'all' : filter.facilityType)}
                    >
                      <Icon name={filter.icon} size={13} />
                      {filter.name}
                    </MapToggle>
                  );
                })}
              </div>

              {/*
                전부 감추기. **유형 칩과 다른 칸에 둔다.**

                이것은 유형이 아니라 표시 모드다. 같은 줄에 섞어 두면 여덜 번째 유형처럼 보여,
                누르면 그 유형만 남는 것으로 읽힌다. 유형이 줄바꿈으로 늘어나도 이 칩은 첫 줄
                오른쪽에 그대로 있어 찾는 자리가 바뀌지 않는다. (S15P11A206-89)

                유형 칩만으로는 시설을 하나도 없는 상태로 만들 수 없다. 겹쳐 선 마커가 도면을
                가려 역 구조나 경로선을 확인하기 어려울 때 쓴다. 다시 누르면 전체 표시로
                돌아온다. 현재 위치·목적지·경로는 그대로 둔다 — 안내에 필요한 표시까지 사라지면
                상담자가 짚어 줄 근거가 없어진다.
              */}
              <div className={styles.facilityVisibility}>
                <MapToggle
                  on={effectiveView === 'none'}
                  onClick={() => setFacilityView(effectiveView === 'none' ? 'all' : 'none')}
                >
                  <Icon name={effectiveView === 'none' ? 'eye' : 'eye-off'} size={13} />
                  {effectiveView === 'none' ? '다시 보기' : '숨기기'}
                </MapToggle>
              </div>
            </div>
          )}

          <div className={styles.mapActions}>
            <PillButton
              className={styles.mapAction}
              on={repinning === 'dest'}
              onClick={() => {
                setRepinning(repinning === 'dest' ? null : 'dest');
                setLastPick(null);
              }}
            >
              <Icon name="target" size={14} />
              목적지 재지정
            </PillButton>
            <PillButton
              className={styles.mapAction}
              on={repinning === 'origin'}
              onClick={() => {
                setRepinning(repinning === 'origin' ? null : 'origin');
                setLastPick(null);
              }}
            >
              <Icon name="pin" size={14} />
              현재 위치 수정
            </PillButton>
          </div>

          {/*
            무엇을 눌러야 하는지, 무엇이 사용자에게 갔는지 알려 준다. 예전에는 버튼이 켜지기만
            하고 아무 일도 일어나지 않아, 상담자는 자기가 목적지를 바꾼 줄 알았다.
          */}
          {(repinning || lastPick) && (
            <p className={styles.mapHint} role="status">
              {repinning
                ? `지도에서 ${repinning === 'dest' ? '새 목적지' : '사용자의 실제 위치'}를 누르세요. 시설이 안 보이면 아래 시설 버튼을 켜 주세요.`
                : lastPick}
            </p>
          )}

          <div className={styles.notes}>
            <div className={styles.notesLabel}>
              <Icon name="note" size={13} />
              상담 메모 · 실시간 STT
              {/*
                지금까지 쌓인 줄 수를 함께 보여 준다. 이 값이 그대로 상담 전문으로 저장돼
                AI 요약의 입력이 되는데, 예전에는 마지막 한 줄만 보여서 실제로 남고 있는지
                끝날 때까지 알 수 없었다. 0에서 멈춰 있으면 음성 인식이 안 되고 있다는 뜻이다.
              */}
              <span className={styles.notesCount}>{displayTranscript.length}줄 기록됨</span>
            </div>
            {/*
              기록이 안 되고 있으면 그 사실을 상담 중에 알아야 한다. 끝난 뒤에 알면 이미
              전문이 비어 있고 AI 요약도 만들어지지 않아 되돌릴 방법이 없다.
            */}
            {captionError && (
              <div className={styles.notesAlert} role="alert">
                <Icon name="warning" size={12} />
                <span>{captionError}</span>
                {/* 마이크를 놓아 준 뒤 상담을 끊지 않고 자막만 되살릴 수 있어야 한다. */}
                <button
                  type="button"
                  className={styles.notesRetry}
                  onClick={() => restartCaptions()}
                >
                  다시 시도
                </button>
              </div>
            )}
            {/*
              사용자 쪽 자막이 죽은 경우. 이쪽에서 손쓸 수 있는 일이 아니라 다시 시도 버튼을
              붙이지 않는다. 대신 사용자가 조용한 것이 아니라는 사실은 알아야 한다 — 모르면
              상담원은 대답을 기다리며 계속 침묵하게 된다.
            */}
            {userCaptionNotice && (
              <div className={styles.notesAlert} role="alert">
                <Icon name="warning" size={12} />
                <span>{userCaptionNotice}</span>
              </div>
            )}
            <div className={styles.liveCaptions} aria-live="polite">
              <div className={[styles.liveCaption, styles.liveCaptionUser].join(' ')}>
                <div className={styles.liveCaptionHeader}>
                  <span className={styles.speakerUser}>사용자</span>
                  <span className={styles.liveCaptionState}>
                    {remoteCaptionFinal ? '확정' : '말하는 중'}
                  </span>
                </div>
                <span className={styles.liveCaptionText}>
                  {userCaptionPrimary ||
                    (captionsSupported
                      ? '사용자가 말하면 자막을 표시합니다.'
                      : '이 브라우저에서는 음성 자막을 지원하지 않습니다. Chrome에서 열어 주세요.')}
                </span>
                {userCaptionSource && (
                  <span
                    className={[styles.sourceLine, !remoteCaptionFinal && styles.sourceLineLive]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {userCaptionSource}
                  </span>
                )}
              </div>
              <div className={[styles.liveCaption, styles.liveCaptionCounselor].join(' ')}>
                <div className={styles.liveCaptionHeader}>
                  <span className={styles.speakerAgent}>상담원</span>
                  <span className={styles.liveCaptionState}>
                    {localCaptionFinal ? '확정' : '말하는 중'}
                  </span>
                </div>
                <span className={styles.liveCaptionText}>
                  {localCaption ||
                    (captionsSupported
                      ? '마이크를 켜고 말하면 자막을 표시합니다.'
                      : '이 브라우저에서는 음성 자막을 지원하지 않습니다. Chrome에서 열어 주세요.')}
                </span>
              </div>
            </div>
            <div className={styles.transcriptHeader}>
              <span className={styles.transcriptTitle}>대화 기록</span>
              <span className={styles.notesCount}>{displayTranscript.length}줄</span>
            </div>
            <div className={styles.notesBody}>
              {displayTranscript.length === 0 ? (
                <div className={styles.transcriptEmpty}>확정된 대화가 여기에 표시됩니다.</div>
              ) : (
                displayTranscript.map((segment) => (
                  <div className={styles.transcriptEntry} key={segment.captionId}>
                    <span
                      className={
                        segment.speaker === 'COUNSELOR' ? styles.speakerAgent : styles.speakerUser
                      }
                    >
                      {segment.speaker === 'COUNSELOR' ? '상담원' : '사용자'}
                    </span>
                    <span className={styles.line}>{segment.content}</span>
                    {segment.translatedContent && segment.translatedContent !== segment.content && (
                      <span className={styles.transcriptTranslation}>
                        {segment.translatedContent}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className={styles.legacyNotesBody}>
              <div>
                <span className={styles.speakerUser}>사용자</span>
                <br />
                {/*
                  사용자가 한국어로 말하지 않을 수 있다. 옮긴 문장을 먼저 두고 원문을 아래
                  작게 붙인다 — 출구 번호나 역 이름은 원문으로 맞춰 봐야 할 때가 있다.
                */}
                <span className={styles.line}>
                  {userCaptionPrimary ||
                    (captionsSupported
                      ? '사용자가 말하면 이 자리에 표시됩니다.'
                      : '이 브라우저에서는 음성 자막을 지원하지 않습니다. Chrome에서 열어 주세요.')}
                </span>
                {/* 사용자가 말하는 중에는 이 줄이 한 마디씩 흘러간다. 위 줄은 말이 끝나야 바뀐다. */}
                {userCaptionSource && (
                  <span
                    className={[styles.sourceLine, !remoteCaptionFinal && styles.sourceLineLive]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {userCaptionSource}
                  </span>
                )}
              </div>
              <div>
                <span className={styles.speakerAgent}>상담원</span>
                <br />
                <span className={styles.line}>
                  {localCaption ||
                    (captionsSupported
                      ? '마이크를 켜고 말하면 이 자리에 표시됩니다.'
                      : '이 브라우저에서는 음성 자막을 지원하지 않습니다. Chrome에서 열어 주세요.')}
                </span>
              </div>
              {/* 발화 시각 순서로 보여 주어 실제 상담 흐름을 따라갈 수 있게 한다. */}
              {displayTranscript.map((segment) => (
                <div key={segment.captionId}>
                  <span
                    className={
                      segment.speaker === 'COUNSELOR' ? styles.speakerAgent : styles.speakerUser
                    }
                  >
                    {segment.speaker === 'COUNSELOR' ? '상담원' : '사용자'}
                  </span>
                  <br />
                  <span className={styles.line}>{segment.content}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.rail}>
          <div className={styles.railHead}>
            <span className={styles.liveChip}>
              <span className={styles.liveDotWrap}>
                <span className={styles.liveDot} />
                <span className={styles.liveRing} />
              </span>
              사용자 카메라
              <span className={styles.liveShine} />
            </span>
            <span className={styles.syncedChip}>
              <span className={styles.syncedDot} aria-hidden />
              <span className={styles.syncedLabel}>{sharing ? '수신 중' : '대기 중'}</span>
            </span>
          </div>

          {/*
            사용자 화면의 거울. **위가 카메라, 아래가 사용자와 공유되는 지도다.** (S15P11A206-89)

            예전에는 이 자리에 수신 영상만 있었고, 사용자가 보는 지도는 왼쪽 넓은 지도에만
            있었다. 그래서 상담자가 그림을 그릴 수 있는 곳은 카메라뿐이었다 — 지도 위에 길을
            그어 주려면 왼쪽 지도에 그려야 하는데 그쪽은 상담자가 자유롭게 확대·이동하는 탐색용
            지도라 사용자 화면과 자리가 맞지 않는다.

            거울은 사용자 화면 전체를 같은 비율로 비춘다. 그래서 이 위에 그은 선은 카메라든
            지도든 사용자 화면의 같은 자리에 찍힌다 — 좌표계를 따로 둘 필요가 없다.
          */}
          <div className={styles.mirrorFit}>
            <div className={styles.mirror} style={mirrorStyle}>
              {/*
                카메라는 **거울 전체**에 깔린다. 사용자 화면에서도 XR 컴포지터가 카메라를 화면
                전체에 합성하고, 아래쪽 지도 영역이 그것을 덮어 가리는 구조다. 카메라를 위쪽
                영역에만 넣으면 같은 장면이 다르게 잘려 보인다.
              */}
              <div className={styles.mirrorCameraCrop}>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={styles.mirrorCamera}
                  aria-label="사용자가 공유 중인 화면"
                />
              </div>

              {/*
                signaling이 붙기 전에 끊기면(1009 등) 원인 코드만 화면에 남아 있었다. 자동으로
                다시 맺는 동안에는 그 문구 대신 로딩 화면을 보여 준다 — 재시도가 곧 이어지므로
                상담자가 새로고침 말고는 손쓸 방법이 없다고 오해하지 않게 한다.
              */}
              {reconnecting && (
                <div className={styles.reconnecting} role="status">
                  <span className={styles.reconnectingSpinner} aria-hidden />
                  <span>연결을 다시 시도하고 있어요</span>
                </div>
              )}

              {/*
                사용자 화면 아래쪽. 배치를 받은 뒤에만 그린다 — 자리를 짐작해 그리면 상담자는
                지도가 저기 있다고 믿고 그 위에 그리는데, 사용자 화면에서는 그 선이 카메라 위에
                찍힌다. 배치가 도착하기 전 몇 백 밀리초는 카메라만 보여 주는 편이 정직하다.
              */}
              {screen && mapSync && (
                <>
                  <div className={styles.mirrorLower} style={rectStyle(screen.lower)} />
                  <div className={styles.mirrorMap} style={rectStyle(screen.map)}>
                    {/*
                      사용자가 보는 것과 같은 시점이 나온다. 추종 배율은 `박스 너비 / 담을
                      캔버스 폭`으로 정해지므로 **박스의 비율이 같으면 크기가 달라도 시점이
                      같다**(`useMapGestures.computeFollowView`). 배치를 사용자가 재서 보내는
                      덕에 이 상자의 비율이 사용자 지도와 정확히 같다.

                      왼쪽 지도와 달리 조작할 것이 없다 — 층 버튼·시설 칩·확대 버튼을 달지
                      않고 포인터도 받지 않는다(CSS). 여기서 시점을 바꾸면 거울이 아니게 된다.
                    */}
                    <IndoorMapView
                      stationId={mapSync.stationId}
                      floorId={mapSync.floorId ?? floorMaps[0]?.floorId}
                      currentLocation={mapSync.current}
                      currentHeadingDeg={mapSync.headingDeg}
                      destination={mapSync.destination}
                      destinationLabel={mapSync.destinationLabel}
                      pathNodes={mapSync.pathNodes}
                      /* 사용자 화면과 같은 값이어야 시점이 같아진다. 회전은 기본값(켬)이다. */
                      connectCurrentToRoute
                      followCamera
                    />
                  </div>
                </>
              )}

              {!sharing && !reconnecting && (
                <p className={styles.streamPlaceholder}>
                  {error ?? tokenError ?? '사용자 화면을 기다리는 중입니다.'}
                </p>
              )}
              <canvas
                ref={canvasRef}
                className={styles.canvas}
                style={{ pointerEvents: drawing ? 'auto' : 'none' }}
              />

              {/* 그리기 도구는 거울 안에 둔다. 캔버스 위에 얹혀야 눌러서 끌 수 있다. */}
              <div className={styles.drawTools}>
                {drawing && (
                  <MapToggle className={styles.drawTool} onClick={clearDraw}>
                    <Icon name="eraser" size={13} />
                    지우기
                  </MapToggle>
                )}
                <MapToggle className={styles.drawTool} on={drawing} onClick={toggleDraw}>
                  <Icon name="pencil" size={13} />
                  그리기
                </MapToggle>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CounselorConsoleShell>
  );
}
