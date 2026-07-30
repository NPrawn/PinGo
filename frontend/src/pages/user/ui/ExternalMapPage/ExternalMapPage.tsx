import { useQuery } from '@tanstack/react-query';
import { useNavigationStore } from '@/entities/navigation';
import { createExternalDirection } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import { GhostLink, Icon } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './ExternalMapPage.module.css';

/** 실내 도착 출구에서 외부 목적지까지 카카오 도보 길찾기 링크를 생성한다. */
export function ExternalMapPage() {
  const destination = useNavigationStore((state) => state.destination) ?? '목적지';
  const destinationId = useNavigationStore((state) => state.destinationId);
  const destinationLatitude = useNavigationStore((state) => state.destinationLatitude);
  const destinationLongitude = useNavigationStore((state) => state.destinationLongitude);
  const destinationAddress = useNavigationStore((state) => state.destinationAddress);
  const originName = useNavigationStore((state) => state.externalOriginName) ?? '도착 출구';
  const originLatitude = useNavigationStore((state) => state.externalOriginLatitude);
  const originLongitude = useNavigationStore((state) => state.externalOriginLongitude);

  const canCreateDirection =
    originLatitude != null &&
    originLongitude != null &&
    destinationLatitude != null &&
    destinationLongitude != null;
  const directionQuery = useQuery({
    queryKey: [
      'external-direction',
      originLatitude,
      originLongitude,
      destinationLatitude,
      destinationLongitude,
    ],
    queryFn: () =>
      createExternalDirection({
        provider: 'kakao',
        mode: 'foot',
        origin: { latitude: originLatitude!, longitude: originLongitude! },
        destination: {
          placeId: destinationId ?? undefined,
          name: destination,
          latitude: destinationLatitude!,
          longitude: destinationLongitude!,
          address: destinationAddress ?? undefined,
        },
      }),
    enabled: canCreateDirection,
    retry: false,
  });

  return (
    <PhoneFrame layout="flush">
      <>
        <div className={styles.route}>
          <div className={styles.routeRow}>
            <span className={styles.dotStart} aria-hidden />
            <span className={styles.routeText}>
              <b>출발</b> · {originName}
            </span>
          </div>
          <div className={`${styles.routeRow} ${styles.routeRowDest}`}>
            <span className={styles.dotEnd} aria-hidden />
            <span className={styles.routeText}>
              <b>도착</b> · {destination}
            </span>
          </div>
        </div>

        <div className={styles.map}>
          <div className={styles.grid} aria-hidden />
          <div className={styles.road} aria-hidden />
          <svg viewBox="0 0 320 400" className={styles.path} preserveAspectRatio="none" aria-hidden>
            <polyline
              points="96,196 208,150 244,300 168,332"
              fill="none"
              stroke="#4B6EF5"
              strokeWidth="7"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          <div className={styles.startPin}>
            <span className={styles.startDot}>
              <Icon name="person" size={16} />
            </span>
            <span className={styles.startLabel}>출발</span>
          </div>
          <div className={styles.endPin}>
            <span className={styles.endLabel}>도착</span>
            <span className={styles.endTail} aria-hidden />
          </div>
        </div>

        <div className={styles.panel}>
          <b className={styles.placeName}>{destination}</b>
          <br />
          <span className={styles.placeMeta}>{destinationAddress ?? '외부 도보 경로'}</span>
          {!canCreateDirection && <p role="alert">외부 길찾기에 필요한 위치 정보가 없습니다.</p>}
          {directionQuery.isError && <p role="alert">카카오 길찾기 링크를 만들지 못했습니다.</p>}
          {directionQuery.data?.appUrl && (
            <a href={directionQuery.data.appUrl} className={styles.kakao}>
              <Icon name="map" size={16} />
              카카오맵 앱으로 길찾기
            </a>
          )}
          {directionQuery.data?.webUrl && (
            <a href={directionQuery.data.webUrl}>웹 카카오맵으로 열기</a>
          )}
          <GhostLink to={USER_ROUTES.STATION}>새로운 길 안내 시작</GhostLink>
        </div>
      </>
    </PhoneFrame>
  );
}
