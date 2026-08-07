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
        <Sub style={{ whiteSpace: 'pre-line' }}>{t('user.captureGuide.description')}</Sub>
      </div>

      <div className={styles.focusPreview} aria-hidden>
        <div className={styles.focusGlow} />
        <div className={styles.focusFrame}>
          <span className={`${styles.focusCorner} ${styles.focusCornerTl}`} />
          <span className={`${styles.focusCorner} ${styles.focusCornerTr}`} />
          <span className={`${styles.focusCorner} ${styles.focusCornerBl}`} />
          <span className={`${styles.focusCorner} ${styles.focusCornerBr}`} />
          <span className={styles.focusTarget}>
            <span />
          </span>
        </div>
        <strong className={styles.focusLabel}>{t('user.captureGuide.focusLabel')}</strong>
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
