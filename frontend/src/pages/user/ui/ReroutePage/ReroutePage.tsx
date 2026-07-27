import { Link } from 'react-router-dom';
import { USER_ROUTES } from '@/shared/config';
import { Blob, BlobHero, ButtonLink, HeadingMarker, Icon, MapPreview } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './ReroutePage.module.css';

const FLOORS = ['1F', 'B1', 'B2'];

/**
 * Screen 16 — the user has drifted off the route.
 *
 * The prototype layered this dialog over a dimmed copy of the navigation
 * screen; that framing is kept so the context stays visible.
 */
export function ReroutePage() {
  return (
    <PhoneFrame
      dark
      layout="flush"
      bodyClassName={styles.body}
      statusBarClassName={styles.statusBar}
    >
      <>
        <div className={styles.backdrop} aria-hidden>
          <div className={styles.cam}>
            <div className={styles.arrow}>↑</div>
          </div>
          <div className={styles.mapWrap}>
            <MapPreview className={styles.map} dest={{ left: '74%', top: '22%' }}>
              <div className={styles.floorButtons}>
                {FLOORS.map((floor, index) => (
                  <span
                    key={floor}
                    className={[styles.floorButton, index === 0 && styles.floorButtonOn]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {floor}
                  </span>
                ))}
              </div>
              <HeadingMarker style={{ left: '40%', top: '70%' }} />
            </MapPreview>
          </div>
        </div>

        <div className={styles.scrim}>
          <div className={styles.dialog} role="alertdialog" aria-label="경로를 이탈했어요">
            <Link to={USER_ROUTES.NAVIGATION} className={styles.dismiss}>
              <span className={styles.dismissLabel}>무시하고 계속</span>
              <span className={styles.dismissIcon} aria-hidden>
                ✕
              </span>
            </Link>

            <BlobHero className={styles.hero}>
              <Blob tone="coral" slot="main" style={{ width: 76, height: 76 }} />
              <Blob
                tone="lilac"
                slot="a"
                style={{ top: '6%', right: '26%', width: 26, height: 26 }}
              />
              <Blob
                tone="sky"
                slot="c"
                style={{ bottom: '10%', left: '26%', width: 20, height: 20 }}
              />
              <div className={styles.heroIcon}>
                <Icon name="warning" size={30} />
              </div>
            </BlobHero>

            <h2 className={styles.heading}>경로를 이탈했어요</h2>
            <p className={styles.lede}>주변 환경 때문에 위치를 다시 잡기 어려워요.</p>

            <div className={styles.actions}>
              <ButtonLink
                to={USER_ROUTES.CAPTURE_GUIDE}
                variant="secondary"
                className={styles.action}
              >
                <Icon name="refresh" size={15} />
                위치 재인식
              </ButtonLink>
              <ButtonLink to={USER_ROUTES.CONSULT_REQUEST} className={styles.action}>
                <Icon name="headset" size={15} />
                상담 요청
              </ButtonLink>
            </div>
          </div>
        </div>
      </>
    </PhoneFrame>
  );
}
