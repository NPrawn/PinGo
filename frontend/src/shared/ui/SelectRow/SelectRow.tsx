import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './SelectRow.module.css';

type SelectRowProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  selected?: boolean;
  /**
   * Trailing indicator. `check` shows a filled badge when selected and an empty
   * circle otherwise; `ring` draws the accent outline instead; `none` leaves the
   * caller in charge.
   */
  indicator?: 'check' | 'ring' | 'none';
  children: ReactNode;
};

export function SelectRow({
  selected = false,
  indicator = 'check',
  className,
  children,
  type = 'button',
  ...props
}: SelectRowProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={[styles.row, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
      {indicator === 'check' &&
        (selected ? (
          <span className={styles.check}>
            <Icon name="check" size={13} />
          </span>
        ) : (
          <span className={styles.unchecked} />
        ))}
      {indicator === 'ring' && selected && <span className={styles.ring} />}
    </button>
  );
}
