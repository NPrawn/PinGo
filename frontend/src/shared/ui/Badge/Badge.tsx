import type { HTMLAttributes } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral';

const toneClass: Record<BadgeTone, string | undefined> = {
  success: undefined,
  warning: styles.warning,
  danger: styles.danger,
  neutral: styles.neutral,
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  /** Fully rounded variant — the prototype's `.conf` confidence chip. */
  pill?: boolean;
};

export function Badge({ tone = 'success', pill, className, ...props }: BadgeProps) {
  return (
    <span
      className={[styles.badge, toneClass[tone], pill && styles.pill, className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}
