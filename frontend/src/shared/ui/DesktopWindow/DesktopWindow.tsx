import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './DesktopWindow.module.css';

type DesktopWindowProps = {
  children: ReactNode;
  /** Address shown in the fake omnibox, e.g. `console.pingo.kr`. */
  url: string;
  /** Renders a padlock before the URL, as the login screens did. */
  secure?: boolean;
  /** Fixed pixel width. The prototype used 560 for auth, 1120 for consoles. */
  width?: number;
  /** Trailing content in the title bar, e.g. the admin console's logout link. */
  barExtra?: ReactNode;
  className?: string;
};

/**
 * Browser-chrome shell for the counselor and admin screens.
 *
 * Replaces the prototype's `.win` / `.winbar` markup, which was duplicated on
 * every desktop screen.
 */
export function DesktopWindow({
  children,
  url,
  secure,
  width = 1120,
  barExtra,
  className,
}: DesktopWindowProps) {
  return (
    <div className={styles.stage}>
      <div className={[styles.window, className].filter(Boolean).join(' ')} style={{ width }}>
        <div className={styles.bar}>
          <span className={styles.light} style={{ background: '#ff5f57' }} />
          <span className={styles.light} style={{ background: '#febc2e' }} />
          <span className={styles.light} style={{ background: '#28c840' }} />
          <span
            className={styles.url}
            style={secure ? { display: 'inline-flex', alignItems: 'center', gap: 5 } : undefined}
          >
            {secure && <Icon name="lock" size={12} />}
            {url}
          </span>
          {barExtra}
        </div>
        {children}
      </div>
    </div>
  );
}
