import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import styles from './Sheet.module.css';

type SheetProps = {
  /** `bottom` matches the prototype's `.sheet`; `center` its modal dialogs. */
  placement?: 'bottom' | 'center';
  onDismiss?: () => void;
  label: string;
  children: ReactNode;
};

/**
 * Prototype `.ov` + `.sheet`. The prototype relied on click-outside only; this
 * also closes on Escape and moves focus into the sheet when it opens.
 */
export function Sheet({ placement = 'bottom', onDismiss, label, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!onDismiss) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  return (
    <div
      className={[styles.overlay, placement === 'center' && styles.centered]
        .filter(Boolean)
        .join(' ')}
      onClick={onDismiss}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={placement === 'center' ? styles.dialog : styles.sheet}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
