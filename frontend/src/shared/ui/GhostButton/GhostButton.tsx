import { Link } from 'react-router-dom';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './GhostButton.module.css';

type GhostButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function GhostButton({ className, type = 'button', ...props }: GhostButtonProps) {
  return (
    <button
      type={type}
      className={[styles.ghost, className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}

type GhostLinkProps = {
  to: string;
  children: ReactNode;
  className?: string;
};

export function GhostLink({ to, className, children }: GhostLinkProps) {
  return (
    <Link to={to} className={[styles.ghost, className].filter(Boolean).join(' ')}>
      {children}
    </Link>
  );
}
