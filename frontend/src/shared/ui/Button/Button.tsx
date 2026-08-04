import { Link } from 'react-router-dom';
import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'gold' | 'dark';
export type ButtonSize = 'md' | 'sm';

type StyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

const variantClass: Record<ButtonVariant, string | undefined> = {
  primary: undefined,
  secondary: styles.secondary,
  gold: styles.gold,
  dark: styles.dark,
};

function buttonClass({ variant = 'primary', size = 'md', className }: StyleProps) {
  return [styles.button, variantClass[variant], size === 'sm' ? styles.small : undefined, className]
    .filter(Boolean)
    .join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & StyleProps;

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}

type ButtonLinkProps = StyleProps & {
  to: string;
  children: ReactNode;
  replace?: boolean;
  state?: unknown;
  /** 이동과 함께 기록을 남겨야 하는 경우에 쓴다. 이동 자체는 `to` 가 한다. */
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

/** Same visual treatment as `Button`, for navigation targets. */
export function ButtonLink({ to, variant, size, className, ...props }: ButtonLinkProps) {
  return <Link to={to} className={buttonClass({ variant, size, className })} {...props} />;
}
