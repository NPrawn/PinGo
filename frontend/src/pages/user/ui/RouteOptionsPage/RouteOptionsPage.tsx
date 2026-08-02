import { useEffect, useState } from 'react';
import { useNavigationStore } from '@/entities/navigation';
import { routeUnavailableText } from '@/entities/route';
import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import { USER_ROUTES } from '@/shared/config';
import type { RouteType } from '@/shared/types';
import { ButtonLink, Icon, SelectRow } from '@/shared/ui';
import type { IconName } from '@/shared/ui';
import { CameraFallbackNotice, CameraFeed, useCameraPreview } from '@/widgets/camera-preview';
import { ViewfinderBack } from '@/widgets/capture-viewfinder';
import { PhoneFrame } from '@/widgets/phone-frame';
import { useExitRoute, type ExitRoute } from './useExitRoute';
import styles from './RouteOptionsPage.module.css';

/**
 * 화면이 정하는 경로 유형별 표기.
 *
 * **이름을 백엔드 `displayName` 대신 여기서 정한다.** 이 화면은 "어느 출입구로 나갈지"를
 * 고르는 자리라(라벨이 `추천 출입구 선택`이다) 카드 이름도 그 어휘를 따른다. 백엔드의
 * `빠른 경로`·`엘리베이터 이용 경로`는 경로 그 자체를 가리키는 말이라 결이 다르다.
 */
const ROUTE_PRESENTATION: Record<RouteType, { icon: IconName; name: string; summary: string }> = {
  fastest: {
    icon: 'bolt',
    name: '최단 경로',
    summary: '목적지에서 가장 가까운 출입구',
  },
  elevator_only: {
    icon: 'elevator',
    name: '엘리베이터 우선',
    summary: '엘리베이터를 이용하는 편안한 경로',
  },
};

/** 목록에 그리는 순서. 최단 경로를 먼저 둔다. */
const ROUTE_ORDER: readonly RouteType[] = ['fastest', 'elevator_only'];

/** 초를 화면 단위로. 예상 시간이 없는 경로가 있으므로 null을 그대로 받는다. */
function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  return `${Math.max(1, Math.round(seconds / 60))}분`;
}

/** 거리를 화면 단위로. 백엔드가 BigDecimal이라 소수가 올 수 있다. */
function formatDistance(meters: number | null): string | null {
  if (meters === null) return null;
  return `${Math.round(meters)}m`;
}

/** Compare exit strategies in a visible list while keeping the rear camera active. */
export function RouteOptionsPage() {
  const station = useStationStore((state) => state.station);
  const stationId = useStationStore((state) => state.stationId);
  const destination = useNavigationStore((state) => state.destination);
  const currentNodeId = useNavigationStore((state) => state.currentNodeId);
  const currentLocationLabel = useNavigationStore((state) => state.currentLocationLabel);
  const destinationLatitude = useNavigationStore((state) => state.destinationLatitude);
  const destinationLongitude = useNavigationStore((state) => state.destinationLongitude);
  const route = useNavigationStore((state) => state.route);
  const setRoute = useNavigationStore((state) => state.setRoute);
  const setTargetNode = useNavigationStore((state) => state.setTargetNode);
  const camera = useCameraPreview();
  const [confirmation, setConfirmation] = useState<{ id: number; message: string } | null>(null);

  const lookup = {
    stationId,
    startNodeId: currentNodeId,
    destinationLatitude,
    destinationLongitude,
  };
  const fastestQuery = useExitRoute('fastest', lookup);
  const elevatorQuery = useExitRoute('elevator_only', lookup);
  const queries: Record<RouteType, ReturnType<typeof useExitRoute>> = {
    fastest: fastestQuery,
    elevator_only: elevatorQuery,
  };

  /**
   * 안내를 시작할 경로.
   *
   * 고른 것이 도달 불가로 바뀔 수 있다(재인식으로 출발지가 바뀌는 경우). 그때는 갈 수 있는
   * 첫 경로로 물러난다. 갈 수 있는 경로가 하나도 없으면 null이고 CTA를 감춘다.
   */
  const selectedType =
    ROUTE_ORDER.find((type) => type === route && isUsable(queries[type].data)) ??
    ROUTE_ORDER.find((type) => isUsable(queries[type].data)) ??
    null;
  const selected = selectedType ? queries[selectedType].data : null;

  /**
   * 고른 경로의 도착 출구를 스토어에 남긴다.
   *
   * **유형마다 도착 노드가 다르므로 여기서 확정해야 한다.** 안내 화면은 스토어의
   * `targetNodeId`로 상세 경로를 조회하는데, 목적지 검색이 넣어 둔 값은 최단 경로 기준이다.
   * 엘리베이터 경로를 고르고도 그 값이 남아 있으면 화면은 3번 출구라고 적힌 채 GFC몰로
   * 안내하게 된다.
   *
   * **의존성에 유형 문자열과 노드 id만 둔다.** 조회 응답 객체를 넣으면 리페치마다 참조가
   * 바뀔 수 있어 불필요하게 다시 실행된다.
   */
  const selectedTargetNodeId = selected?.targetNodeId ?? null;
  const selectedExitLabel = selected?.exitLabel ?? null;
  useEffect(() => {
    if (selectedType && selectedType !== route) setRoute(selectedType);
  }, [selectedType, route, setRoute]);
  useEffect(() => {
    if (selectedTargetNodeId != null) setTargetNode(selectedTargetNodeId, selectedExitLabel);
  }, [selectedTargetNodeId, selectedExitLabel, setTargetNode]);

  useEffect(() => {
    if (!confirmation) return;

    const timer = window.setTimeout(() => setConfirmation(null), 1400);

    return () => window.clearTimeout(timer);
  }, [confirmation]);

  /**
   * 카드를 한 장도 그릴 수 없는 이유와, 그 상태에서 사용자가 할 수 있는 일.
   *
   * **카드 자리를 빈 채로 두지 않는다.** 이 패널은 카드가 채우는 것을 전제로 높이를 잡으므로
   * 문구 한 줄만 넣으면 남는 공간이 그대로 빈 칸이 된다.
   *
   * 순서가 곧 우선순위다. 역 → 현재 위치 → 목적지 순으로 앞의 것이 없으면 뒤는 물어볼 수도
   * 없다.
   */
  const emptyState = ((): {
    icon: IconName;
    title: string;
    body: string;
    action?: { label: string; to: string };
    alert?: boolean;
  } | null => {
    if (stationId === null) {
      return {
        icon: 'pin',
        title: '이 역은 아직 실내 경로가 없어요',
        body: '실내 안내가 준비된 역에서만 경로를 찾을 수 있어요.',
        action: { label: '다른 역 선택하기', to: USER_ROUTES.STATION },
      };
    }
    if (currentNodeId === null) {
      return {
        icon: 'target',
        title: '현재 위치를 확인하지 못했어요',
        body: '어디서 출발하는지 알아야 경로를 계산할 수 있어요.',
        action: { label: '위치 다시 인식하기', to: USER_ROUTES.CAPTURE_PORTRAIT },
        alert: true,
      };
    }
    if (destinationLatitude === null || destinationLongitude === null) {
      return destination
        ? {
            icon: 'flag',
            title: '목적지 위치를 알 수 없어요',
            body: `${destination}의 좌표를 확인할 수 없어 어느 출입구로 나갈지 정하지 못했어요.`,
            action: { label: '목적지 다시 선택하기', to: USER_ROUTES.STATION },
            alert: true,
          }
        : {
            icon: 'flag',
            title: '목적지를 먼저 선택해 주세요',
            body: '어디로 갈지 정하면 나갈 출입구와 경로를 찾아 드려요.',
            action: { label: '목적지 선택하기', to: USER_ROUTES.STATION },
          };
    }
    if (fastestQuery.isError && elevatorQuery.isError) {
      return {
        icon: 'refresh',
        title: '경로를 불러오지 못했어요',
        body: '잠시 후 다시 시도해 주세요.',
        alert: true,
      };
    }
    return null;
  })();

  const loading = fastestQuery.isLoading || elevatorQuery.isLoading;

  return (
    <PhoneFrame layout="flush" dark bodyClassName={styles.body}>
      <>
        <div className={styles.camera}>
          <div className={styles.topBar}>
            <ViewfinderBack to={USER_ROUTES.LOCATE_SUCCESS} />
            <ConsultCta variant="icon" />
          </div>

          <div className={styles.routeHeader}>
            <div className={styles.routePoint}>
              <span className={styles.routeLabel}>
                <span className={styles.pointDot} aria-hidden />
                <small>출발지</small>
              </span>
              {/* 위치 인식이 준 노드 이름이 역 이름보다 구체적이다. */}
              <strong>{currentLocationLabel ?? station}</strong>
            </div>
            <span className={styles.routeArrow} aria-hidden>
              <Icon name="arrow-right" size={16} />
            </span>
            <div className={styles.routePoint}>
              <span className={styles.routeLabel}>
                <span className={`${styles.pointDot} ${styles.pointDotDestination}`} aria-hidden />
                <small>목적지</small>
              </span>
              <strong>{destination ?? '목적지 미선택'}</strong>
            </div>
          </div>

          {/*
            **이 자리는 원래 2D 지도다.** 화면 정의서 U-09의 UI 구성에도, 프로토타입
            `#s-route`에도 카메라가 없다. 프로토타입은 도면 위에 **선택된 경로 하나**를 그리고
            카드를 바꾸면 경로가 따라 바뀐다.

            카메라 배경은 292(`46df503`)에서 들어왔고, 지금은 그 UI 흐름을 그대로 따라 실제
            카메라를 붙여 둔다.

            TODO(U-09): 상단을 지도로 바꾸는 편이 화면 목적(경로를 비교해 고른다)에 맞다.
            카드의 시간·거리만으로는 어디로 어떻게 가는지 알 수 없다. 부품은 이미 있다 —
            `IndoorMapView`가 `pathNodes`를 받고 층별 구간 필터링도 테스트로 고정돼 있다.
            빠진 것은 좌표뿐이라 선택된 옵션으로 `POST /api/routes/indoor`를 한 번 더 부르면
            된다. 층이 여러 개인 경로를 어떻게 보여줄지가 남은 디자인 판단이다.
            바꿀 때 지울 것은 이 화면의 `CameraFeed`·`useCameraPreview`와 `.feed`뿐이다.
          */}
          <CameraFeed camera={camera} className={styles.feed} />

          {/* 카메라를 켤 수 없을 때의 대체 그림. 검은 화면으로 두지 않는다. */}
          {!camera.isLive && (
            <svg
              viewBox="0 0 338 290"
              preserveAspectRatio="none"
              className={styles.scene}
              aria-hidden
            >
              <path d="M0 290 L132 138 H206 L338 290 Z" fill="rgba(60,216,160,0.09)" />
              <path
                d="M0 290 L132 138 M338 290 L206 138 M132 138 H206"
                stroke="rgba(127,239,195,0.24)"
                strokeWidth="1.2"
                fill="none"
              />
              <path
                d="M132 138 V48 H206 V138"
                stroke="rgba(127,239,195,0.16)"
                strokeWidth="1.2"
                fill="none"
              />
            </svg>
          )}

          <CameraFallbackNotice status={camera.status} />

          <div className={styles.cameraHint}>
            <Icon name="camera" size={14} />
            카메라를 정면에 맞춰주세요
          </div>

          {confirmation && (
            <div key={confirmation.id} className={styles.selectionToast} role="status">
              {confirmation.message}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <span className={styles.eyebrow}>추천 출입구 선택</span>
              <h1>어떤 경로로 안내할까요?</h1>
            </div>
          </div>

          {/*
            로딩은 카드 자리를 그대로 둔다. 문구 한 줄로 바꾸면 패널 높이가 접혔다가 응답이
            오는 순간 다시 벌어져 화면이 튄다.
          */}
          {loading ? (
            <div className={styles.optionList} aria-label="경로 선택 목록" aria-busy="true">
              <p className={styles.srOnly} role="status">
                경로를 찾고 있어요
              </p>
              <span className={styles.optionSkeleton} aria-hidden />
              <span className={styles.optionSkeleton} aria-hidden />
            </div>
          ) : emptyState ? (
            <div className={styles.emptyState} role={emptyState.alert ? 'alert' : 'status'}>
              <span className={styles.emptyIcon}>
                <Icon name={emptyState.icon} size={22} />
              </span>
              <b className={styles.emptyTitle}>{emptyState.title}</b>
              <p className={styles.emptyBody}>{emptyState.body}</p>
              {emptyState.action && (
                <ButtonLink to={emptyState.action.to} className={styles.emptyAction}>
                  {emptyState.action.label}
                </ButtonLink>
              )}
            </div>
          ) : (
            <>
              <div className={styles.optionList} aria-label="경로 선택 목록">
                {ROUTE_ORDER.map((type) => (
                  <RouteOptionRow
                    key={type}
                    routeType={type}
                    exitRoute={queries[type].data ?? null}
                    failed={queries[type].isError}
                    destination={destination}
                    selected={selectedType === type}
                    onSelect={() => {
                      setRoute(type);
                      setConfirmation({
                        id: Date.now(),
                        message: `${ROUTE_PRESENTATION[type].name}로 설정했습니다.`,
                      });
                    }}
                  />
                ))}
              </div>

              {selected && (
                <div className={styles.cta}>
                  <ButtonLink to={USER_ROUTES.NAVIGATION}>
                    {selected.exitLabel} 길 안내 시작
                  </ButtonLink>
                </div>
              )}
            </>
          )}
        </div>
      </>
    </PhoneFrame>
  );
}

/** 이 유형으로 실제 안내를 시작할 수 있는지. */
function isUsable(exitRoute: ExitRoute | null | undefined): boolean {
  return exitRoute?.option?.available === true;
}

type RouteOptionRowProps = {
  routeType: RouteType;
  exitRoute: ExitRoute | null;
  /** 출구나 경로 조회가 실패했는지. 도달 불가와 구분해 문구를 다르게 낸다. */
  failed: boolean;
  destination: string | null;
  selected: boolean;
  onSelect: () => void;
};

/**
 * 경로 카드 한 장.
 *
 * 도달할 수 없는 경로도 목록에서 빼지 않는다(명세 8.1). 지워 버리면 사용자는 그런 경로를
 * 검토했다는 사실조차 알 수 없고, 왜 계단으로 안내받는지도 모른다.
 */
function RouteOptionRow({
  routeType,
  exitRoute,
  failed,
  destination,
  selected,
  onSelect,
}: RouteOptionRowProps) {
  const presentation = ROUTE_PRESENTATION[routeType];
  const option = exitRoute?.option ?? null;
  const usable = option?.available === true;
  const duration = formatDuration(option?.estimatedTimeSec ?? null);
  const distance = formatDistance(option?.totalDistanceM ?? null);

  /**
   * 이 경로를 쓸 수 없는 이유.
   *
   * 나갈 출구를 못 찾은 것과 출구는 있는데 길이 없는 것은 다르다. 엘리베이터 우선에서 전자는
   * "계단 없이 나갈 수 있는 출구가 없다"는 뜻이라 사용자가 알아야 할 사실이다.
   */
  const unavailableText = failed
    ? '경로를 불러오지 못했어요.'
    : !exitRoute
      ? routeType === 'elevator_only'
        ? '계단 없이 나갈 수 있는 출입구가 없어요.'
        : '나갈 수 있는 출입구를 찾지 못했어요.'
      : (routeUnavailableText(option?.unavailableReason ?? null) ?? '이 경로는 이용할 수 없어요.');

  return (
    <SelectRow
      className={`${styles.option} ${usable ? '' : styles.optionUnavailable}`}
      selected={selected}
      indicator="none"
      disabled={!usable}
      onClick={usable ? onSelect : undefined}
    >
      <span className={styles.optionIcon}>
        <Icon name={presentation.icon} size={18} />
      </span>
      <span className={styles.optionBody}>
        <span className={styles.optionHead}>
          <b className={styles.optionName}>{presentation.name}</b>
          {usable && (
            <span className={styles.optionMetrics}>
              {/* 거리는 있는데 예상 시간만 없는 경로가 실제로 있다. 그 자리는 비운다. */}
              {duration && <strong>{duration}</strong>}
              {duration && distance && <span aria-hidden>·</span>}
              {distance && <strong>{distance}</strong>}
            </span>
          )}
        </span>

        <span className={styles.optionMeta}>{usable ? presentation.summary : unavailableText}</span>

        {usable && exitRoute && (
          /* 이 경로로 나가면 어디로 나오는지. 유형을 고르는 실제 판단 근거다. */
          <span className={styles.optionRoute}>
            <strong className={styles.optionExit}>{exitRoute.exitLabel}</strong>
            <Icon name="arrow-right" size={13} className={styles.optionArrow} aria-hidden />
            <strong className={styles.optionDestination}>{destination ?? '목적지'}</strong>
          </span>
        )}
      </span>
    </SelectRow>
  );
}
