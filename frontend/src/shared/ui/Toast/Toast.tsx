import type { ReactNode } from 'react';
import styles from './Toast.module.css';

type ToastProps = {
  children: ReactNode;
  /** Bottom-right placement used by the admin console flash messages. */
  floating?: boolean;
};

export function Toast({ children, floating }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={[styles.toast, floating && styles.floating].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
