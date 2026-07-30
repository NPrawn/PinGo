import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigationStore, type RouteOptionId } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import { getIndoorRouteOptions, type RouteOptionResponse } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import { ButtonLink, Icon, SelectRow, type IconName } from '@/shared/ui';
import { ViewfinderBack } from '@/widgets/capture-viewfinder';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './RouteOptionsPage.module.css';

type DisplayOption = {
  id: RouteOptionId;
  routeType: string;
  icon: IconName;
  name: string;
  time: string;
  distance: string;
  summary: string;
  available: boolean;
  exit: string;
};

const FALLBACK_OPTIONS: readonly DisplayOption[] = [
  {
    id: 'fast',
    routeType: 'fastest',
    icon: 'bolt',
    name: '최단 경로',
    time: '4분',
    distance: '180m',
    summary: '목적지에서 가장 가까운 출입구까지 안내합니다.',
    available: true,
    exit: '7번 출입구',
  },
  {
    id: 'elev',
    routeType: 'elevator_only',
    icon: 'elevator',
    name: '엘리베이터 우선',
    time: '6분',
    distance: '240m',
    summary: '계단과 에스컬레이터를 제외한 경로입니다.',
    available: true,
    exit: '2번 출입구',
  },
] as const;

function routeId(routeType?: string): RouteOptionId {
  return routeType === 'elevator_only' ? 'elev' : 'fast';
}

function formatTime(seconds?: number) {
  if (seconds == null) return '-';
  return `${Math.max(1, Math.ceil(seconds / 60))}분`;
}

function formatDistance(distance?: number) {
  if (distance == null) return '-';
  return `${Math.round(distance)}m`;
}

function toDisplayOption(option: RouteOptionResponse): DisplayOption {
  const id = routeId(option.routeType);
  return {
    id,
    routeType: option.routeType ?? (id === 'elev' ? 'elevator_only' : 'fastest'),
    icon: id === 'elev' ? 'elevator' : 'bolt',
    name: option.displayName ?? (id === 'elev' ? '엘리베이터 우선' : '최단 경로'),
    time: formatTime(option.estimatedTimeSec),
    distance: formatDistance(option.totalDistanceM),
    summary: option.available
      ? id === 'elev'
        ? '계단 없이 이동할 수 있는 경로입니다.'
        : '거리 기준으로 가장 빠른 경로입니다.'
      : `이용할 수 없는 경로입니다${option.unavailableReason ? ` (${option.unavailableReason})` : ''}.`,
    available: option.available === true,
    exit: id === 'elev' ? '엘리베이터 경로' : '최단 경로',
  };
}

/** 백엔드가 계산한 실내 경로 옵션을 비교하고 하나를 선택한다. */
export function RouteOptionsPage() {
  const station = useStationStore((state) => state.station);
  const stationId = useStationStore((state) => state.stationId);
  const destination = useNavigationStore((state) => state.destination) ?? '목적지';
  const currentNodeId = useNavigationStore((state) => state.currentNodeId);
  const targetNodeId = useNavigationStore((state) => state.targetNodeId);
  const currentLocationLabel = useNavigationStore((state) => state.currentLocationLabel);
  const route = useNavigationStore((state) => state.route);
  const setRoute = useNavigationStore((state) => state.setRoute);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const canCalculate = currentNodeId != null && targetNodeId != null;
  const optionsQuery = useQuery({
    queryKey: ['indoor-route-options', stationId, currentNodeId, targetNodeId],
    queryFn: () =>
      getIndoorRouteOptions({
        stationId,
        startNodeId: currentNodeId!,
        targetNodeId: targetNodeId!,
      }),
    enabled: canCalculate,
    retry: false,
  });

  const options = useMemo(
    () => (optionsQuery.data ? optionsQuery.data.map(toDisplayOption) : [...FALLBACK_OPTIONS]),
    [optionsQuery.data],
  );
  const selectedOption = options.find((option) => option.id === route && option.available);
  const firstAvailable = options.find((option) => option.available);

  useEffect(() => {
    if (!selectedOption && firstAvailable) setRoute(firstAvailable.id);
  }, [firstAvailable, selectedOption, setRoute]);

  useEffect(() => {
    if (!confirmation) return;
    const timer = window.setTimeout(() => setConfirmation(null), 1400);
    return () => window.clearTimeout(timer);
  }, [confirmation]);

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
              <strong>{destination}</strong>
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
          </svg>
          <div className={styles.cameraHint}>
            <Icon name="camera" size={14} />
            카메라를 정면에 맞춰주세요
          </div>

          {confirmation && (
            <div className={styles.selectionToast} role="status">
              {confirmation}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <span className={styles.eyebrow}>실내 경로 선택</span>
              <h1>어떤 경로로 안내할까요?</h1>
            </div>
          </div>

          {!canCalculate && (
            <p role="alert">
              현재 위치 또는 목적지의 경로 노드가 없습니다. 위치를 다시 지정해 주세요.
            </p>
          )}
          {optionsQuery.isError && <p role="alert">경로 옵션을 불러오지 못했습니다.</p>}

          <div className={styles.optionList} aria-label="경로 선택 목록">
            {options.map((option) => {
              const selected = route === option.id && option.available;
              return (
                <SelectRow
                  key={option.id}
                  className={styles.option}
                  selected={selected}
                  indicator="none"
                  onClick={() => {
                    if (!option.available) return;
                    setRoute(option.id);
                    setConfirmation(`${option.name} 경로로 설정했습니다.`);
                  }}
                >
                  <span className={styles.optionIcon}>
                    <Icon name={option.icon} size={18} />
                  </span>
                  <span className={styles.optionBody}>
                    <span className={styles.optionHead}>
                      <b className={styles.optionName}>{option.name}</b>
                      <span className={styles.optionMetrics}>
                        <strong>{option.time}</strong>
                        <span aria-hidden>·</span>
                        <strong>{option.distance}</strong>
                      </span>
                    </span>
                    <span className={styles.optionMeta}>{option.summary}</span>
                    <span className={styles.optionRoute}>
                      <strong className={styles.optionExit}>{option.exit}</strong>
                      <Icon name="arrow-right" size={14} className={styles.optionArrow} />
                      <strong className={styles.optionDestination}>{destination}</strong>
                    </span>
                  </span>
                </SelectRow>
              );
            })}
          </div>

          <div className={styles.cta}>
            {selectedOption ? (
              <ButtonLink to={USER_ROUTES.NAVIGATION}>
                {selectedOption.exit} 길 안내 시작
              </ButtonLink>
            ) : (
              <ButtonLink to={USER_ROUTES.LOCATE_MANUAL}>현재 위치 다시 선택</ButtonLink>
            )}
          </div>
        </div>
      </>
    </PhoneFrame>
  );
}
