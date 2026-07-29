import type { ButtonHTMLAttributes } from 'react';
import styles from './Toggle.module.css';

type ToggleProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label: string;
};

/**
 * Prototype `.sw` switch. The prototype rendered a bare `<div>`; this exposes
 * it as a real `switch` control so it is keyboard reachable.
 */
export function Toggle({
  checked,
  onCheckedChange,
  label,
  className,
  onClick,
  type = 'button',
  ...props
}: ToggleProps) {
  return (
    <button
      type={type}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={[styles.toggle, checked && styles.on, className].filter(Boolean).join(' ')}
      onClick={(event) => {
        onClick?.(event);
        onCheckedChange?.(!checked);
      }}
      {...props}
    >
      <span className={styles.knob} />
    </button>
  );
}
