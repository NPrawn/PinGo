import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import styles from './Field.module.css';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Prototype `.field-big` — taller hero input used by destination search. */
  big?: boolean;
  invalid?: boolean;
};

export function Field({ big, invalid, className, ...props }: FieldProps) {
  return (
    <input
      className={[styles.field, big && styles.big, invalid && styles.invalid, className]
        .filter(Boolean)
        .join(' ')}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

/** Same visual treatment as `Field`, for the admin console's select inputs. */
export function SelectField({ invalid, className, ...props }: SelectFieldProps) {
  return (
    <select
      className={[styles.field, invalid && styles.invalid, className].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}
