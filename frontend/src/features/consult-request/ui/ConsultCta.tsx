import { Link } from 'react-router-dom';
import { USER_ROUTES } from '@/shared/config';
import { ButtonLink, Icon } from '@/shared/ui';
import type { ButtonSize } from '@/shared/ui';
import styles from './ConsultCta.module.css';

/**
 * `chip` — gold pill for toolbars and control rails.
 * `floating` — the same pill pinned to the bottom-right of the phone shell.
 * `button` — full-width action, for screens that already stack their CTAs.
 */
export type ConsultCtaVariant = 'chip' | 'floating' | 'button' | 'icon';

type ConsultCtaProps = {
  variant?: ConsultCtaVariant;
  /** `button` only — matches the surrounding action stack. */
  size?: ButtonSize;
  /** Pulses the chip. Reserved for the navigation screen. */
  attention?: boolean;
  label?: string;
  className?: string;
};

const LABEL = '상담 요청';

/**
 * The single entry point into the consultation flow.
 *
 * 화면 정의서 §31 asks for this action on as many screens as possible, so it
 * lives here rather than being re-implemented per screen — one label, one
 * target, one accent colour.
 */
export function ConsultCta({
  variant = 'button',
  size,
  attention,
  label = LABEL,
  className,
}: ConsultCtaProps) {
  if (variant === 'icon') {
    return (
      <Link
        to={USER_ROUTES.CONSULT_REQUEST}
        className={[styles.help, className].filter(Boolean).join(' ')}
        aria-label="상담원 연결"
        title="상담원 연결"
      >
        <span aria-hidden>?</span>
      </Link>
    );
  }

  if (variant === 'button') {
    return (
      <ButtonLink
        to={USER_ROUTES.CONSULT_REQUEST}
        variant="secondary"
        size={size}
        className={className}
      >
        <Icon name="headset" size={15} />
        {label}
      </ButtonLink>
    );
  }

  return (
    <Link
      to={USER_ROUTES.CONSULT_REQUEST}
      className={[
        styles.chip,
        variant === 'floating' && styles.floating,
        attention && styles.attention,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className={styles.icon}>
        <Icon name="headset" size={14} />
      </span>
      <span className={styles.label}>{label}</span>
    </Link>
  );
}
