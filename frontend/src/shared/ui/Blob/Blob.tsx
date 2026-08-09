import type { CSSProperties, ReactNode } from 'react';
import styles from './Blob.module.css';

export type BlobTone = 'mint' | 'coral' | 'lilac' | 'sky';

/**
 * Position within a `BlobHero` cluster. Mirrors the prototype's
 * `b-main` / `b-a` / `b-b` / `b-c` helper classes, each with its own float
 * animation. Screens override size and offset with `style` where they differ.
 */
export type BlobSlot = 'main' | 'a' | 'b' | 'c';

const toneClass: Record<BlobTone, string | undefined> = {
  mint: undefined,
  coral: styles.coral,
  lilac: styles.lilac,
  sky: styles.sky,
};

const slotClass: Record<BlobSlot, string> = {
  main: styles.main,
  a: styles.satelliteA,
  b: styles.satelliteB,
  c: styles.satelliteC,
};

type BlobProps = {
  tone?: BlobTone;
  slot?: BlobSlot;
  className?: string;
  style?: CSSProperties;
};

/** A single decorative 3D sphere. */
export function Blob({ tone = 'mint', slot, className, style }: BlobProps) {
  return (
    <span
      aria-hidden
      className={[styles.blob, toneClass[tone], slot && slotClass[slot], className]
        .filter(Boolean)
        .join(' ')}
      style={style}
    />
  );
}

type BlobPinProps = {
  children: ReactNode;
};

/** Glass badge floated at the centre of a cluster — prototype `.b-pin`. */
export function BlobPin({ children }: BlobPinProps) {
  return <span className={styles.pin}>{children}</span>;
}

type BlobHeroProps = {
  /** Cluster contents. Defaults to the standard main blob plus three satellites. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/** Blob cluster used as a hero illustration — prototype `.blob-hero`. */
export function BlobHero({ children, className, style }: BlobHeroProps) {
  return (
    <div className={[styles.hero, className].filter(Boolean).join(' ')} style={style}>
      {children ?? (
        <>
          <Blob slot="main" />
          <Blob tone="coral" slot="a" />
          <Blob tone="lilac" slot="b" />
          <Blob tone="sky" slot="c" />
        </>
      )}
    </div>
  );
}
