import { useEffect, useState } from 'react';
import { useNavigationStore } from '@/entities/navigation';
import { routeUnavailableText, useIndoorRouteOptions } from '@/entities/route';
import type { RouteOption } from '@/entities/route';
import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import { USER_ROUTES } from '@/shared/config';
import type { RouteType } from '@/shared/types';
import { ButtonLink, Icon, SelectRow } from '@/shared/ui';
import type { IconName } from '@/shared/ui';
import { ViewfinderBack } from '@/widgets/capture-viewfinder';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './RouteOptionsPage.module.css';

/**
 * 임시 출발 노드. B3 승강장 복도, 엘리베이터 A 옆이다. (V8 시드 205 `B3_R005`)
 *
 * VPS 맵이 아직 구축되지 않아 위치 인식이 좌표를 주지 못한다. 경로 조회는 좌표가 아니라 **등록된
 * 노드 id**를 요구하므로, 그래프에 실재하는 노드 하나를 골라 고정한다. 임의의 좌표로는 요청을
 * 만들 수 없다.
 *
 * TODO: 위치 인식(FR-U-004)이 붙으면 `candidates[0].nodeId`로 바꾸고 이 상수를 지운다.
 */
const PROVISIONAL_START_NODE_ID = 205;

/**
 * 임시 도착 노드. 7번 출구다. (V8 시드 325 `B1_F010`)
 *
 * 목적지 검색(FR-U-007)이 노드 id를 넘겨주기 전까지 쓴다. B1 출구를 고른 이유가 있다 — 역삼역은
 * B1↔B2에 엘리베이터가 없어 `elevator_only`가 실제로 `NO_ACCESSIBLE_ROUTE`를 돌려준다. 도달 불가
 * 표시를 가짜 없이 확인할 수 있는 조합이다.
 *
 * TODO: 목적지 검색이 붙으면 제거한다.
 */
const PROVISIONAL_TARGET_NODE_ID = 325;

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

/** Compare exit strategies in a visible list while keeping the rear camera active. */
export function RouteOptionsPage() {
  const station = useStationStore((state) => state.station);
  const stationId = useStationStore((state) => state.stationId);
  const destination = useNavigationStore((state) => state.destination) ?? '강남파이낸스센터';
  const route = useNavigationStore((state) => state.route);
  const setRoute = useNavigationStore((state) => state.setRoute);
  const [confirmation, setConfirmation] = useState<{
    id: number;
    message: string;
  } | null>(null);

  const optionsQuery = useIndoorRouteOptions({
    stationId: stationId ?? undefined,
    startNodeId: PROVISIONAL_START_NODE_ID,
    targetNodeId: PROVISIONAL_TARGET_NODE_ID,
  });
  const options = optionsQuery.data ?? [];
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
              <strong>{station}</strong>
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

          <div className={styles.optionList} aria-label="경로 선택 목록">
            {optionsQuery.isPending && (
              <p className={styles.notice} role="status">
                경로를 찾고 있어요…
              </p>
            )}

            {optionsQuery.isError && (
              <p className={styles.notice} role="alert">
                경로를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
              </p>
            )}

            {optionsQuery.isSuccess && options.length === 0 && (
              <p className={styles.notice} role="status">
                안내할 수 있는 경로가 없어요.
              </p>
            )}

            {options.map((option) => (
              <RouteOptionRow
                key={option.routeType}
                option={option}
                selected={selected?.routeType === option.routeType}
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
              <ButtonLink to={USER_ROUTES.NAVIGATION}>{selected.displayName} 안내 시작</ButtonLink>
            </div>
          )}
        </div>
      </>
    </PhoneFrame>
  );
}

type RouteOptionRowProps = {
  option: RouteOption;
  selected: boolean;
  onSelect: () => void;
};

/**
 * 경로 카드 한 장.
 *
 * 도달할 수 없는 경로도 목록에서 빼지 않는다(명세 8.1). 지워 버리면 사용자는 그런 경로를
 * 검토했다는 사실조차 알 수 없고, 왜 계단으로 안내받는지도 모른다.
 */
function RouteOptionRow({ option, selected, onSelect }: RouteOptionRowProps) {
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
      </span>
    </SelectRow>
  );
}
