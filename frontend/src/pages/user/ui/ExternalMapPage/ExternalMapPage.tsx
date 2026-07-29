import { USER_ROUTES } from '@/shared/config';
import { ButtonLink, GhostLink, Icon } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './ExternalMapPage.module.css';

/**
 * Screen 22 (FR-U-012) — continue outdoors in an external map app.
 *
 * TODO: Wire the CTA to the Kakao Map deep link / web fallback once the
 * app-scheme and API key handling are agreed. Both buttons are placeholders.
 */
export function ExternalMapPage() {
  return (
    <PhoneFrame layout="flush">
      <>
        <div className={styles.route}>
          <div className={styles.routeRow}>
            <span className={styles.dotStart} aria-hidden />
            <span className={styles.routeText}>
              <b>출발</b> · 역삼역 3번 출구{' '}
              <span className={styles.routeNote}>(실내 길찾기 도착 지점 자동 입력)</span>
            </span>
            <span className={styles.swap} aria-hidden>
              ⇅
            </span>
          </div>
          <div className={`${styles.routeRow} ${styles.routeRowDest}`}>
            <span className={styles.dotEnd} aria-hidden />
            <span className={styles.routeText}>
              <b>도착</b> · 스타벅스 역삼점
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

          <div className={styles.mapTools} aria-hidden>
            <div className={styles.mapIcon}>
              <Icon name="compass" size={16} />
            </div>
            <div className={styles.mapIcon}>
              <Icon name="pin" size={16} />
            </div>
          </div>
        </div>

        <div className={styles.panel}>
          <b className={styles.placeName}>스타벅스 역삼점</b>
          <br />
          <span className={styles.placeMeta}>도보 3분 · 210m · 실외 경로</span>
          <ButtonLink to={USER_ROUTES.ARRIVAL} className={styles.kakao}>
            <Icon name="map" size={16} />
            카카오지도로 길찾기
          </ButtonLink>
          <GhostLink to={USER_ROUTES.ARRIVAL}>웹 지도 링크로 열기</GhostLink>
        </div>
      </>
    </PhoneFrame>
  );
}
