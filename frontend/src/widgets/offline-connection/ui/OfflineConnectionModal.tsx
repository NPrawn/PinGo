import { useTranslation } from 'react-i18next';
import { Blob, BlobHero, Button, Icon, Sheet } from '@/shared/ui';
import styles from './OfflineConnectionModal.module.css';

type OfflineConnectionModalProps = {
  onRetry: () => void;
};

/**
 * Reusable network-reconnection dialog.
 *
 * Keep this independent from a route so any user flow can render it over the
 * screen where connectivity was lost.
 */
export function OfflineConnectionModal({ onRetry }: OfflineConnectionModalProps) {
  const { t } = useTranslation();
  return (
    <Sheet placement="center" label={t('user.offline.label')}>
      <div className={styles.status}>
        <span className={styles.statusDot} aria-hidden />
        {t('user.offline.checking')}
      </div>

      <BlobHero className={styles.hero}>
        <Blob tone="mint" slot="main" style={{ width: 76, height: 76 }} />
        <Blob tone="lilac" slot="a" style={{ top: '5%', right: '27%', width: 25, height: 25 }} />
        <Blob tone="sky" slot="c" style={{ bottom: '9%', left: '27%', width: 20, height: 20 }} />
        <span className={styles.heroIcon}>
          <span className={styles.loadingRing} aria-hidden />
          <Icon name="globe" size={29} />
        </span>
      </BlobHero>

      <h2 className={styles.heading}>{t('user.offline.title')}</h2>
      <p className={styles.lede}>{t('user.offline.description')}</p>

      <div className={styles.notice}>
        <span className={styles.noticeSpinner} aria-hidden />
        <span>{t('user.offline.autoResume')}</span>
      </div>

      <div className={styles.actions}>
        <Button className={styles.action} onClick={onRetry}>
          <Icon name="refresh" size={15} />
          {t('user.offline.retry')}
        </Button>
      </div>
    </Sheet>
  );
}
