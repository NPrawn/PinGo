import type { ReactNode } from 'react';
import styles from './LivePill.module.css';

export type LivePillTone = 'live' | 'gps';

type LivePillProps = {
  children: ReactNode;
  /** `live` is the red recording dot; `gps` the green location dot. */
  tone?: LivePillTone;
  className?: string;
  /** Overrides the dot colour for one-off states, e.g. the failure pill. */
  dotClassName?: string;
};

export function LivePill({ children, tone = 'live', className, dotClassName }: LivePillProps) {
  return (
    <span className={[styles.pill, className].filter(Boolean).join(' ')}>
      <span
        className={[styles.dot, tone === 'gps' && styles.dotGps, dotClassName]
          .filter(Boolean)
          .join(' ')}
        aria-hidden
      />
      {children}
    </span>
  );
}
