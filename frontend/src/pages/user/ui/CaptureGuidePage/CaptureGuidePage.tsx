import { useTranslation } from 'react-i18next';
import { ConsultCta } from '@/features/consult-request';
import { USER_ROUTES } from '@/shared/config';
import { BackLink, ButtonLink, Card, Spring, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './CaptureGuidePage.module.css';

const TIPS = [
  { title: 'tip1Title', body: 'tip1Body' },
  { title: 'tip2Title', body: 'tip2Body' },
  { title: 'tip3Title', body: 'tip3Body' },
];

/** Screen 05 (FR-U-004) — how to capture the surroundings. */
export function CaptureGuidePage() {
  const { t } = useTranslation();
  return (
    <PhoneFrame>
      <div className={styles.guideLead}>
        <div className={styles.topSpacer} />
        <div className={styles.headerBar}>
          <BackLink to={USER_ROUTES.STATION}>{t('user.captureGuide.back')}</BackLink>
          <ConsultCta variant="icon" />
        </div>
        <Title className={styles.title} style={{ whiteSpace: 'pre-line' }}>
          {t('user.captureGuide.title')}
        </Title>
        <Sub style={{ whiteSpace: 'pre-line' }}>
          {t('user.captureGuide.description')}
        </Sub>
      </div>

      <div className={styles.radar} aria-hidden>
        <div className={styles.ringOuter} />
        <div className={styles.ringInner} />
        <div className={styles.sweep} />
        <div className={styles.mask} />
        <div className={styles.deviceWrap}>
          <svg width="26" height="42" viewBox="0 0 26 42" className={styles.device}>
            <rect
              x="1"
              y="1"
              width="24"
              height="40"
              rx="5"
              fill="rgba(127,239,195,.16)"
              stroke="#7FEFC3"
              strokeWidth="1.6"
            />
            <circle cx="13" cy="10" r="3" fill="#7FEFC3" />
          </svg>
        </div>
        <span className={`${styles.compass} ${styles.compassTop}`}>{t('user.captureGuide.front')}</span>
        <span className={`${styles.compass} ${styles.compassBottom}`}>{t('user.captureGuide.stay')}</span>
        <span className={`${styles.compass} ${styles.compassLeft}`}>{t('user.captureGuide.left')}</span>
        <span className={`${styles.compass} ${styles.compassRight}`}>{t('user.captureGuide.right')}</span>
      </div>

      <Card className={styles.tips}>
        {TIPS.map((tip, index) => (
          <div key={tip.title} className={styles.tip}>
            <span className={styles.tipNumber}>{index + 1}</span>
            <div>
              <div className={styles.tipTitle}>{t(`user.captureGuide.${tip.title}`)}</div>
              <div className={styles.tipBody}>{t(`user.captureGuide.${tip.body}`)}</div>
            </div>
          </div>
        ))}
      </Card>

      <Spring />
      <ButtonLink to={USER_ROUTES.CAPTURE_PORTRAIT} className={styles.captureButton}>
        {t('user.captureGuide.start')}
      </ButtonLink>
    </PhoneFrame>
  );
}
