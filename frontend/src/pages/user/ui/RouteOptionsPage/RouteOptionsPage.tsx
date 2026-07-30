import { useEffect, useState } from 'react';
import { useNavigationStore } from '@/entities/navigation';
import type { RouteOptionId } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import { USER_ROUTES } from '@/shared/config';
import { ButtonLink, Icon, SelectRow } from '@/shared/ui';
import type { IconName } from '@/shared/ui';
import { ViewfinderBack } from '@/widgets/capture-viewfinder';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './RouteOptionsPage.module.css';

const OPTIONS: readonly {
  id: RouteOptionId;
  icon: IconName;
  name: string;
  exit: string;
  time: string;
  distance: string;
  summary: string;
}[] = [
  {
    id: 'fast',
    icon: 'bolt',
    name: '최단 경로',
    exit: '7번 출입구',
    time: '4분',
    distance: '180m',
    summary: '목적지에서 가장 가까운 출입구',
  },
  {
    id: 'elev',
    icon: 'elevator',
    name: '엘리베이터 우선',
    exit: '2번 출입구',
    time: '6분',
    distance: '240m',
    summary: '엘리베이터를 이용하는 편안한 경로',
  },
];

/** Compare exit strategies in a visible list while keeping the rear camera active. */
export function RouteOptionsPage() {
  const station = useStationStore((state) => state.station);
  const destination = useNavigationStore((state) => state.destination) ?? '강남파이낸스센터';
  const route = useNavigationStore((state) => state.route);
  const setRoute = useNavigationStore((state) => state.setRoute);
  const [confirmation, setConfirmation] = useState<{
    id: number;
    message: string;
  } | null>(null);
  const selectedOption = OPTIONS.find((option) => option.id === route) ?? OPTIONS[0];

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
              <strong>{station} B1</strong>
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
              <span className={styles.eyebrow}>추천 출입구 선택</span>
              <h1>어떤 경로로 안내할까요?</h1>
            </div>
          </div>

          <div className={styles.optionList} aria-label="경로 선택 목록">
            {OPTIONS.map((option) => {
              const selected = route === option.id;

              return (
                <SelectRow
                  key={option.id}
                  className={styles.option}
                  selected={selected}
                  indicator="none"
                  onClick={() => {
                    setRoute(option.id);
                    setConfirmation({
                      id: Date.now(),
                      message:
                        option.id === 'fast'
                          ? '최단 경로로 설정했습니다.'
                          : '엘리베이터 우선 경로로 설정했습니다.',
                    });
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
            <ButtonLink to={USER_ROUTES.NAVIGATION}>{selectedOption.exit} 길 안내 시작</ButtonLink>
          </div>
        </div>
      </>
    </PhoneFrame>
  );
}
