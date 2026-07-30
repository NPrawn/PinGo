import { useNavigate } from 'react-router-dom';
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

  return (
    <PhoneFrame
      dark
      layout="flush"
      bodyClassName={styles.body}
      overlay={<OfflineConnectionModal onRetry={() => void navigate(-1)} />}
    >
      <div className={styles.preview} aria-hidden>
        <div className={styles.previewHeader} />
        <div className={styles.previewCamera} />
        <div className={styles.previewMap} />
      </div>
    </PhoneFrame>
  );
}
