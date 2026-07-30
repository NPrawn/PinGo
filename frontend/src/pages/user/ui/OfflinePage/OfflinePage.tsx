import { useNavigate } from 'react-router-dom';
import { getHealth } from '@/shared/api';
import { OfflineConnectionModal } from '@/widgets/offline-connection';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './OfflinePage.module.css';

/**
 * Development route for previewing the reusable offline dialog.
 *
 * Production screens can mount `OfflineConnectionModal` directly when their
 * network request or the browser's connectivity event reports a disconnection.
 */
export function OfflinePage() {
  const navigate = useNavigate();
  const retry = async () => {
    try {
      await getHealth();
      void navigate(-1);
    } catch {
      // Keep the connection modal open until the backend is reachable again.
    }
  };

  return (
    <PhoneFrame
      dark
      layout="flush"
      bodyClassName={styles.body}
      overlay={<OfflineConnectionModal onRetry={() => void retry()} />}
    >
      <div className={styles.preview} aria-hidden>
        <div className={styles.previewHeader} />
        <div className={styles.previewCamera} />
        <div className={styles.previewMap} />
      </div>
    </PhoneFrame>
  );
}
