import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
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
  label,
  className,
}: ConsultCtaProps) {
  const { t } = useTranslation();
  const visibleLabel = label ?? t('user.consultRequest.cta');
  const { pathname } = useLocation();
  const setEntryRoute = useConsultStore((state) => state.setEntryRoute);
  /**
   * 상담을 어디서 시작했는지 남긴다. (S15P11A206-89)
   *
   * 상담이 끝나면 이 자리로 돌아간다. 경로 안내 중에 상담을 받은 사용자를 역 선택 화면으로
   * 보내면, 걷던 사람이 역 고르기부터 목적지 고르기까지 다시 밟아야 한다.
   *
   * **CTA 가 눌린 자리를 담는 것이 요점이다.** 상담 화면에서 `location` 을 읽으면 이미
   * `/user/consult/session` 이라 어디서 왔는지 알 수 없다.
   */
  const rememberEntry = () => setEntryRoute(pathname);

  if (variant === 'icon') {
    return (
      <Link
        to={USER_ROUTES.CONSULT_REQUEST}
        onClick={rememberEntry}
        className={[styles.help, className].filter(Boolean).join(' ')}
        aria-label={t('user.consultRequest.connect')}
        title={t('user.consultRequest.connect')}
      >
        <span aria-hidden>?</span>
      </Link>
    );
  }

  if (variant === 'button') {
    return (
      <ButtonLink
        to={USER_ROUTES.CONSULT_REQUEST}
        onClick={rememberEntry}
        variant="secondary"
        size={size}
        className={className}
      >
        <Icon name="headset" size={15} />
        {visibleLabel}
      </ButtonLink>
    );
  }

  return (
    <Link
      to={USER_ROUTES.CONSULT_REQUEST}
      onClick={rememberEntry}
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
      <span className={styles.label}>{visibleLabel}</span>
    </Link>
  );
}
