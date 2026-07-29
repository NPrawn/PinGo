import { Icon } from '../Icon';
import styles from './Checkbox.module.css';

type CheckboxProps = {
  checked: boolean;
};

/**
 * Prototype `.chk` — a presentational check square. The clickable wrapper owns
 * the semantics, so this is hidden from assistive tech.
 */
export function Checkbox({ checked }: CheckboxProps) {
  return (
    <span className={[styles.box, checked && styles.on].filter(Boolean).join(' ')} aria-hidden>
      {checked && <Icon name="check" size={12} />}
    </span>
  );
}
