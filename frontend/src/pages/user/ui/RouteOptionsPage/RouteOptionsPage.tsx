import { useEffect, useRef, useState } from 'react';
import { findRouteOption, useNavigationStore } from '@/entities/navigation';
import type { RouteOptionId } from '@/entities/navigation';
import { USER_ROUTES } from '@/shared/config';
import { ButtonLink, Icon, SelectRow, Sub } from '@/shared/ui';
import type { IconName } from '@/shared/ui';
import {
  MapCallout,
  MapScreenHeader,
  MapScreenMap,
  MapScreenSvg,
  MeLabel,
} from '@/widgets/map-screen';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './RouteOptionsPage.module.css';

/** The two options the prototype offered on this screen. */
const OPTIONS: readonly {
  id: RouteOptionId;
  icon: IconName;
  name: string;
  time: string;
  meta: string;
}[] = [
  { id: 'fast', icon: 'bolt', name: '빠른 경로', time: '4분', meta: '180m · 계단 2곳 포함' },
  {
    id: 'elev',
    icon: 'elevator',
    name: '엘리베이터 중심',
    time: '6분',
    meta: '240m · 계단 없음 · 캐리어 추천',
  },
];

/** Screen 14 (FR-U-009) — compare and choose a route. */
export function RouteOptionsPage() {
  const route = useNavigationStore((state) => state.route);
  const setRoute = useNavigationStore((state) => state.setRoute);
  const isElevator = route === 'elev';
  const [visibleRoute, setVisibleRoute] = useState<RouteOptionId>(isElevator ? 'elev' : 'fast');
  const isViewingElevator = visibleRoute === 'elev';
  const carouselRef = useRef<HTMLDivElement>(null);

  const selectRoute = (nextRoute: RouteOptionId) => {
    setVisibleRoute(nextRoute);
    setRoute(nextRoute);
  };

  useEffect(() => {
    const carousel = carouselRef.current;
    const option = carousel?.children.item(isViewingElevator ? 1 : 0);

    if (!carousel || !(option instanceof HTMLElement)) {
      return;
    }

    carousel.scrollTo({
      left: option.offsetLeft - 20,
      behavior: 'smooth',
    });
  }, [isViewingElevator]);

  return (
    <PhoneFrame layout="flush" bodyClassName={styles.body}>
      <>
        <MapScreenHeader
          backTo={USER_ROUTES.DESTINATION_MAP}
          backLabel="목적지 위치 확인"
          title="어떤 경로로 안내할까요?"
          lede="두 경로를 비교하고 하나를 선택하세요"
        />

        <MapScreenMap
          className={styles.map}
          me={{ left: '30%', top: '68%' }}
          dest={isElevator ? { left: '74%', top: '21%' } : { left: '61%', top: '45%' }}
        >
          <MapScreenSvg viewBox="0 0 338 500" preserveAspectRatio="none">
            <rect x="0" y="0" width="338" height="500" fill="#eef1f5" />
            <rect
              x="20"
              y="22"
              width="298"
              height="456"
              rx="14"
              fill="#f8fafc"
              stroke="#cdd5df"
              strokeWidth="2"
            />
            <path
              d="M101 340 V210 H206 V104"
              fill="none"
              stroke="#e6ebf2"
              strokeWidth="34"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d="M62 340 V186"
              fill="none"
              stroke="#e6ebf2"
              strokeWidth="34"
              strokeLinecap="round"
            />
            <rect
              x="42"
              y="42"
              width="74"
              height="60"
              rx="6"
              fill="#eef6f0"
              stroke="#c4dfca"
              strokeWidth="1.5"
            />
            <rect
              x="236"
              y="384"
              width="70"
              height="60"
              rx="6"
              fill="#f7eef2"
              stroke="#e2c7d3"
              strokeWidth="1.5"
            />
            <rect x="192" y="232" width="11" height="11" rx="2" fill="#B08640" />
            {isElevator ? (
              <polyline
                points="101,340 62,340 62,168 250,168 250,104"
                fill="none"
                stroke="#3EB489"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <polyline
                points="101,340 101,210 206,210 206,224"
                fill="none"
                stroke="#3EB489"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="2 13"
              />
            )}
          </MapScreenSvg>

          {isElevator ? (
            <>
              <MapCallout left="74%" top="21%">
                <Icon name="elevator" size={12} />
                2번 출구 · 엘리베이터 연결
              </MapCallout>
              <div className={styles.elevatorPin}>
                <Icon name="elevator" size={16} />
              </div>
            </>
          ) : (
            <MapCallout left="61%" top="45%">
              <Icon name="door" size={12} />
              3번 출구 · 최단
            </MapCallout>
          )}
          <MeLabel left="30%" top="68%" />
        </MapScreenMap>

        <div className={styles.panel}>
          <div className={styles.caption}>
            <Sub className={styles.captionText}>{findRouteOption(route).caption}</Sub>
            <span className={styles.swipeHint}>
              <span className={styles.swipeHintText}>옵션 2개 · 옆으로 넘기기</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0EA36F"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.nudge}
                aria-hidden
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </div>

          <div className={styles.carouselWrap}>
            <div ref={carouselRef} className={styles.carousel}>
              {OPTIONS.map((option) => (
                <SelectRow
                  key={option.id}
                  className={styles.option}
                  selected={route === option.id}
                  indicator="none"
                  onClick={() => selectRoute(option.id)}
                >
                  <div className={styles.optionHead}>
                    <span className={styles.optionIcon}>
                      <Icon name={option.icon} size={18} />
                    </span>
                    <b className={styles.optionName}>{option.name}</b>
                    <span className={styles.optionTime}>{option.time}</span>
                  </div>
                  <span className={styles.optionMeta}>{option.meta}</span>
                </SelectRow>
              ))}
            </div>
            <div
              className={[styles.fade, isViewingElevator ? styles.fadeLeft : styles.fadeRight].join(
                ' ',
              )}
            >
              <button
                type="button"
                className={styles.fadeButton}
                onClick={() => setVisibleRoute(isViewingElevator ? 'fast' : 'elev')}
                aria-label={isViewingElevator ? '이전 경로 보기' : '다음 경로 보기'}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0EA36F"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={isViewingElevator ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
                </svg>
              </button>
            </div>
          </div>

          <div className={styles.cta}>
            <ButtonLink to={USER_ROUTES.NAVIGATION}>이 경로로 안내 시작</ButtonLink>
          </div>
        </div>
      </>
    </PhoneFrame>
  );
}
