import { useEffect, useRef } from 'react';
import { LoginForm } from './LoginForm';
import styles from './ConsoleLoginModal.module.css';

type ConsoleLoginModalProps = {
  onClose: () => void;
  /** Announced as the dialog name, e.g. the console the user picked. */
  label: string;
};

/**
 * Console sign-in shown over the page that opened it.
 *
 * `LoginForm` navigates to the console the credentials belong to, so the modal
 * only has to handle dismissal.
 */
export function ConsoleLoginModal({ onClose, label }: ConsoleLoginModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // The page behind must not scroll while the dialog is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={styles.panel}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <LoginForm />
      </div>
    </div>
  );
}
