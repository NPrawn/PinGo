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
  return (
    <Sheet placement="center" label="인터넷 연결 중">
      <div className={styles.status}>
        <span className={styles.statusDot} aria-hidden />
        인터넷 연결 확인 중
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

      <h2 className={styles.heading}>인터넷에 다시 연결하고 있어요</h2>
      <p className={styles.lede}>
        연결 상태를 확인하고 있어요.
        <br />
        잠시만 기다려 주세요.
      </p>

      <div className={styles.notice}>
        <span className={styles.noticeSpinner} aria-hidden />
        <span>인터넷이 연결되면 현재 화면에서 자동으로 계속할게요.</span>
      </div>

      <div className={styles.actions}>
        <Button className={styles.action} onClick={onRetry}>
          <Icon name="refresh" size={15} />
          다시 연결
        </Button>
      </div>
    </Sheet>
  );
}
