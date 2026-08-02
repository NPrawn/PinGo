import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigationStore } from '@/entities/navigation';
import { routeUnavailableText, useIndoorRouteOptions } from '@/entities/route';
import type { RouteOption } from '@/entities/route';
import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import { findNearestExit } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import type { RouteType } from '@/shared/types';
import { ButtonLink, Icon, SelectRow } from '@/shared/ui';
import type { IconName } from '@/shared/ui';
import { ViewfinderBack } from '@/widgets/capture-viewfinder';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './RouteOptionsPage.module.css';

/** 경로 유형별 아이콘. 응답에 아이콘 정보가 없어 화면이 정한다. */
const ROUTE_ICON: Record<RouteType, IconName> = {
  fastest: 'bolt',
  elevator_only: 'elevator',
};

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

/**
 * 출구 번호를 화면 문구로 바꾼다.
 *
 * `exitNumber`는 "7"처럼 번호만 오거나 연결 통로처럼 이름이 올 수 있다.
 */
function formatExitLabel(exitNumber?: string): string | undefined {
  const trimmed = exitNumber?.trim();
  if (!trimmed) return undefined;
  return /^\d+$/.test(trimmed) ? `${trimmed}번 출입구` : trimmed;
}

/** Compare exit strategies in a visible list while keeping the rear camera active. */
export function RouteOptionsPage() {
  const station = useStationStore((state) => state.station);
  const stationId = useStationStore((state) => state.stationId);
  const destination = useNavigationStore((state) => state.destination);
  /**
   * 출발·도착 실내 노드.
   *
   * 출발은 위치 인식(FR-U-004)이 앵커링해 준 `startNodeId`, 도착은 목적지 검색(FR-U-007)이
   * 넘겨준 노드다. 둘 중 하나라도 없으면 조회 훅이 요청을 걸지 않는다.
   */
  const currentNodeId = useNavigationStore((state) => state.currentNodeId);
  const targetNodeId = useNavigationStore((state) => state.targetNodeId);
  const currentLocationLabel = useNavigationStore((state) => state.currentLocationLabel);
  const destinationLatitude = useNavigationStore((state) => state.destinationLatitude);
  const destinationLongitude = useNavigationStore((state) => state.destinationLongitude);
  const route = useNavigationStore((state) => state.route);
  const setRoute = useNavigationStore((state) => state.setRoute);
  const [confirmation, setConfirmation] = useState<{
    id: number;
    message: string;
  } | null>(null);

  const optionsQuery = useIndoorRouteOptions({
    stationId: stationId ?? undefined,
    startNodeId: currentNodeId ?? undefined,
    targetNodeId: targetNodeId ?? undefined,
  });
  const options = optionsQuery.data ?? [];

  /**
   * 최단 경로가 안내할 출입구.
   *
   * 목적지가 역 밖에 있으면 어느 출구로 나가는지가 실제 판단 근거다. 좌표를 모르면 묻지 않고
   * 표시도 하지 않는다 — 틀린 출구를 적는 것보다 비워 두는 편이 낫다.
   */
  const canFindNearestExit =
    stationId != null && destinationLatitude != null && destinationLongitude != null;
  const nearestExitQuery = useQuery({
    queryKey: ['nearest-exit', stationId, destinationLatitude, destinationLongitude],
    queryFn: () =>
      findNearestExit({
        stationId: stationId!,
        destinationLatitude: destinationLatitude!,
        destinationLongitude: destinationLongitude!,
      }),
    enabled: canFindNearestExit,
    retry: false,
  });
  const nearestExitLabel = formatExitLabel(nearestExitQuery.data?.exitNumber);

  /**
   * 안내를 시작할 경로.
   *
   * 고른 것이 도달 불가로 바뀔 수 있다(재인식으로 출발지가 바뀌는 경우). 그때는 갈 수 있는
   * 첫 경로로 물러난다. 갈 수 있는 경로가 하나도 없으면 null이고 CTA를 감춘다.
   */
  const selected =
    options.find((option) => option.routeType === route && option.available) ??
    options.find((option) => option.available) ??
    null;

  /**
   * 물러난 결과를 스토어에도 남긴다.
   *
   * `selected`만 옮기면 화면은 갈 수 있는 경로를 가리키는데 스토어에는 갈 수 없는 경로가 남는다.
   * 안내·도착 화면은 스토어를 읽으므로, CTA에 "빠른 경로"라고 적힌 채 엘리베이터 경로의 출구로
   * 안내하게 된다.
   *
   * **의존성에 객체가 아니라 유형 문자열을 둔다.** `selected`는 조회 응답 배열의 원소이고
   * TanStack Query가 structural sharing으로 참조를 지켜 주므로 지금은 객체를 넣어도 리페치마다
   * 실행되지 않는다. 다만 그것은 라이브러리 동작에 기대는 것이라, `structuralSharing`을 끄거나
   * `select`로 배열을 가공하는 순간 조용히 매번 실행되기 시작한다. 원시값을 두면 "선택된 경로
   * 유형이 바뀔 때만"이라는 조건이 그 자체로 성립한다.
   */
  const selectedRouteType = selected?.routeType;
  useEffect(() => {
    if (selectedRouteType && selectedRouteType !== route) setRoute(selectedRouteType);
  }, [selectedRouteType, route, setRoute]);

  useEffect(() => {
    if (!confirmation) return;

    const timer = window.setTimeout(() => setConfirmation(null), 1400);

    return () => window.clearTimeout(timer);
  }, [confirmation]);

  /**
   * 경로 카드를 못 그리는 이유와, 그 상태에서 사용자가 할 수 있는 일.
   *
   * **카드 자리를 빈 채로 두지 않는다.** 이 패널은 카드가 채우는 것을 전제로 높이를 잡으므로
   * 문구 한 줄만 넣으면 남는 공간이 그대로 빈 칸이 된다. 이유를 설명하고 다음 행동을 주는
   * 블록으로 그 자리를 채운다.
   *
   * 순서가 곧 우선순위다. 역 → 목적지 → 현재 위치 순으로 앞의 것이 없으면 뒤는 물어볼 수도
   * 없다. 조회 상태(로딩·실패·빈 결과)는 그 셋이 모두 갖춰진 뒤에만 의미가 있다.
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
    if (targetNodeId === null) {
      return destination
        ? {
            icon: 'flag',
            title: '목적지까지 가는 실내 경로를 찾지 못했어요',
            body: `${destination}으로 이어지는 역 내부 통로를 확인할 수 없어요. 다른 목적지를 골라 보세요.`,
            action: { label: '목적지 다시 선택하기', to: USER_ROUTES.STATION },
            alert: true,
          }
        : {
            icon: 'flag',
            title: '목적지를 먼저 선택해 주세요',
            body: '어디로 갈지 정하면 경로를 찾아 드려요.',
            action: { label: '목적지 선택하기', to: USER_ROUTES.STATION },
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
    if (optionsQuery.isError) {
      return {
        icon: 'refresh',
        title: '경로를 불러오지 못했어요',
        body: '잠시 후 다시 시도해 주세요.',
        alert: true,
      };
    }
    if (optionsQuery.isSuccess && options.length === 0) {
      return {
        icon: 'flag',
        title: '안내할 수 있는 경로가 없어요',
        body: '출발지와 목적지 사이에 이어진 통로가 없어요.',
        action: { label: '목적지 다시 선택하기', to: USER_ROUTES.STATION },
      };
    }
    return null;
  })();

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
              <span className={styles.eyebrow}>이동 방법 선택</span>
              <h1>어떤 경로로 안내할까요?</h1>
            </div>
          </div>

          {/*
            로딩은 카드 자리를 그대로 둔다.

            문구 한 줄로 바꾸면 패널 높이가 접혔다가 응답이 오는 순간 다시 벌어져 화면이
            튄다. 같은 크기의 자리 표시자를 두면 조회가 끝나도 배치가 그대로다.

            조회를 걸 수 없는 상태와 구분해야 한다 — `stationId`가 없으면 훅이 조회를 끄는데
            꺼진 쿼리는 `isPending`에 머무르므로, 그것을 로딩으로 읽으면 영구히 멈춘다.
            실제로 불러오는 중인지는 `isLoading`(= pending이면서 fetching)이 답한다.
          */}
          {optionsQuery.isLoading ? (
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
                {options.map((option) => (
                  <RouteOptionRow
                    key={option.routeType}
                    option={option}
                    selected={selected?.routeType === option.routeType}
                    exitLabel={option.routeType === 'fastest' ? nearestExitLabel : undefined}
                    onSelect={() => {
                      setRoute(option.routeType);
                      setConfirmation({
                        id: Date.now(),
                        message: `${option.displayName}로 설정했습니다.`,
                      });
                    }}
                  />
                ))}
              </div>

              {selected && (
                <div className={styles.cta}>
                  <ButtonLink to={USER_ROUTES.NAVIGATION}>
                    {selected.displayName} 안내 시작
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

type RouteOptionRowProps = {
  option: RouteOption;
  selected: boolean;
  /** 이 경로가 나가게 될 출입구. 최단 경로에만, 목적지 좌표를 아는 경우에만 붙는다. */
  exitLabel?: string;
  onSelect: () => void;
};

/**
 * 경로 카드 한 장.
 *
 * 도달할 수 없는 경로도 목록에서 빼지 않는다(명세 8.1). 지워 버리면 사용자는 그런 경로를
 * 검토했다는 사실조차 알 수 없고, 왜 계단으로 안내받는지도 모른다.
 */
function RouteOptionRow({ option, selected, exitLabel, onSelect }: RouteOptionRowProps) {
  const duration = formatDuration(option.estimatedTimeSec);
  const distance = formatDistance(option.totalDistanceM);
  const reason = routeUnavailableText(option.unavailableReason);

  return (
    <SelectRow
      className={`${styles.option} ${option.available ? '' : styles.optionUnavailable}`}
      selected={selected}
      indicator="none"
      disabled={!option.available}
      onClick={option.available ? onSelect : undefined}
    >
      <span className={styles.optionIcon}>
        <Icon name={ROUTE_ICON[option.routeType]} size={18} />
      </span>
      <span className={styles.optionBody}>
        <span className={styles.optionHead}>
          <b className={styles.optionName}>{option.displayName}</b>
          {option.available && (
            <span className={styles.optionMetrics}>
              {/* 거리는 있는데 예상 시간만 없는 경로가 실제로 있다. 그 자리는 비운다. */}
              {duration && <strong>{duration}</strong>}
              {duration && distance && <span aria-hidden>·</span>}
              {distance && <strong>{distance}</strong>}
            </span>
          )}
        </span>

        {option.available ? (
          /* FR-U-009 "경로별 예상 시간, 거리, 계단 포함 여부를 표시해야 한다" */
          <span className={styles.optionMeta}>
            {option.hasStairsOrEscalator ? (
              <>
                <Icon name="stairs" size={13} aria-hidden />
                계단·에스컬레이터를 지나요
              </>
            ) : (
              <>
                <Icon name="elevator" size={13} aria-hidden />
                계단·에스컬레이터 없이 갈 수 있어요
              </>
            )}
          </span>
        ) : (
          <span className={styles.optionReason}>{reason ?? '이 경로는 이용할 수 없어요.'}</span>
        )}

        {option.available && exitLabel && (
          <span className={styles.optionExit}>
            <Icon name="door" size={13} aria-hidden />
            {exitLabel}로 나가요
          </span>
        )}
      </span>
    </SelectRow>
  );
}
