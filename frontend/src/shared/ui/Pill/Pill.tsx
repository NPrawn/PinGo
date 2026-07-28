import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import styles from './Pill.module.css';

type PillStyleProps = {
  on?: boolean;
  ghost?: boolean;
  className?: string;
};

function pillClass({ on, ghost, className }: PillStyleProps, clickable: boolean) {
  return [
    styles.pill,
    clickable && styles.clickable,
    on && styles.on,
    ghost && styles.ghost,
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

type PillProps = HTMLAttributes<HTMLSpanElement> & PillStyleProps;

/** Static badge. Use `PillButton` when it toggles something. */
export function Pill({ on, ghost, className, ...props }: PillProps) {
  return <span className={pillClass({ on, ghost, className }, false)} {...props} />;
}

type PillButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & PillStyleProps;

export function PillButton({ on, ghost, className, type = 'button', ...props }: PillButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={on}
      className={pillClass({ on, ghost, className }, true)}
      {...props}
    />
  );
}
