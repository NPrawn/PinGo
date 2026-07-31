import { useState, type InputHTMLAttributes } from 'react';
import { Field } from '../Field';
import { Icon } from '../Icon';
import styles from './PasswordField.module.css';

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  invalid?: boolean;
};

/**
 * Password input with an eye button pinned inside its right edge that toggles
 * the value between masked and plain text.
 *
 * `className` lands on the wrapper, so callers keep controlling outer spacing.
 */
export function PasswordField({ className, invalid, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const actionLabel = visible ? '비밀번호 숨기기' : '비밀번호 표시';

  return (
    <div className={[styles.row, className].filter(Boolean).join(' ')}>
      <Field
        {...props}
        type={visible ? 'text' : 'password'}
        className={styles.input}
        invalid={invalid}
      />
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setVisible((current) => !current)}
        aria-controls={props.id}
        aria-pressed={visible}
        aria-label={actionLabel}
        title={actionLabel}
      >
        <Icon name={visible ? 'eye-off' : 'eye'} size={19} />
      </button>
    </div>
  );
}
