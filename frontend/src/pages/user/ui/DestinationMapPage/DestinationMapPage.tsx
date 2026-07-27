import { useNavigationStore } from '@/entities/navigation';
import { USER_ROUTES } from '@/shared/config';
import { ButtonLink, Icon, Kicker, Sub, Title } from '@/shared/ui';
import {
  MapCallout,
  MapScreenHeader,
  MapScreenMap,
  MapScreenPanel,
  MapScreenSvg,
  MeLabel,
} from '@/widgets/map-screen';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './DestinationMapPage.module.css';

/** Screen 13 — confirm the destination pin before routing. */
export function DestinationMapPage() {
  const destination = useNavigationStore((state) => state.destination) ?? '스타벅스 역삼점';

  return (
    <PhoneFrame layout="flush">
      <>
        <MapScreenHeader
          backTo={USER_ROUTES.DESTINATION}
          backLabel="목적지 검색"
          title="목적지 위치 확인"
          lede="지도에서 위치를 확인하고 길찾기를 시작하세요"
        />

        <MapScreenMap me={{ left: '30%', top: '66%' }} dest={{ left: '58%', top: '44%' }}>
          <MapScreenSvg viewBox="0 0 338 520">
            <rect x="0" y="0" width="338" height="520" fill="#eef1f5" />
            <rect
              x="20"
              y="24"
              width="298"
              height="472"
              rx="12"
              fill="#f8fafc"
              stroke="#cdd5df"
              strokeWidth="2"
            />
            <path
              d="M102 344 V228 H196 V120"
              fill="none"
              stroke="#e3e9f1"
              strokeWidth="30"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <rect
              x="40"
              y="44"
              width="66"
              height="56"
              rx="5"
              fill="#eef6f0"
              stroke="#c4dfca"
              strokeWidth="1.5"
            />
            <rect
              x="232"
              y="400"
              width="66"
              height="56"
              rx="5"
              fill="#f7eef2"
              stroke="#e2c7d3"
              strokeWidth="1.5"
            />
            <rect
              x="40"
              y="400"
              width="66"
              height="56"
              rx="5"
              fill="#fef8ec"
              stroke="#e6d7ac"
              strokeWidth="1.5"
            />
            <rect x="190" y="280" width="10" height="10" rx="2" fill="#B08640" />
            <polyline
              points="102,344 196,344 196,120"
              fill="none"
              stroke="#4B6EF5"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity=".2"
            />
          </MapScreenSvg>

          <MapCallout left="58%" top="44%">
            <Icon name="coffee" size={12} />
            {destination}
          </MapCallout>
          <MeLabel left="30%" top="66%" />
        </MapScreenMap>

        <MapScreenPanel>
          <Kicker className={styles.kicker}>
            <Icon name="coffee" size={13} />
            카페 · 목적지
          </Kicker>
          <Title className={styles.title}>{destination}</Title>
          <Sub className={styles.sub}>3번 출구 방면 · 현재 위치에서 도보 약 4분</Sub>
          <ButtonLink to={USER_ROUTES.ROUTE_OPTIONS} className={styles.cta}>
            이 위치로 길찾기
          </ButtonLink>
        </MapScreenPanel>
      </>
    </PhoneFrame>
  );
}
