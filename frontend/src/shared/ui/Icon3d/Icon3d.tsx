import type { HTMLAttributes } from 'react';
import { Icon } from '../Icon';
import type { IconName } from '../Icon';
import styles from './Icon3d.module.css';

export type Icon3dTone = 'mint' | 'coral' | 'lilac' | 'sky' | 'gold';

const toneClass: Record<Icon3dTone, string | undefined> = {
  mint: undefined,
  coral: styles.coral,
  lilac: styles.lilac,
  sky: styles.sky,
  gold: styles.gold,
};

type Icon3dProps = HTMLAttributes<HTMLSpanElement> & {
  name: IconName;
  tone?: Icon3dTone;
  /** Chip size in px. The corner radius scales with it. */
  size?: number;
  iconSize?: number;
};

export function Icon3d({
  name,
  tone = 'mint',
  size,
  iconSize = 22,
  className,
  style,
  ...props
}: Icon3dProps) {
  return (
    <span
      className={[styles.chip, toneClass[tone], className].filter(Boolean).join(' ')}
      style={size ? { width: size, height: size, borderRadius: size * 0.32, ...style } : style}
      {...props}
    >
      <Icon name={name} size={iconSize} />
    </span>
  );
}
