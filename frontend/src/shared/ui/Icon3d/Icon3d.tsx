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
  iconSize?: number;
};

export function Icon3d({ name, tone = 'mint', iconSize = 22, className, ...props }: Icon3dProps) {
  return (
    <span
      className={[styles.chip, toneClass[tone], className].filter(Boolean).join(' ')}
      {...props}
    >
      <Icon name={name} size={iconSize} />
    </span>
  );
}
