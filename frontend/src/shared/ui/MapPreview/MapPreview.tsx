import type { CSSProperties, ReactNode } from 'react';
import styles from './MapPreview.module.css';

type Position = { left?: string; top?: string; right?: string; bottom?: string };

type MapPreviewProps = {
  /** Marker for the user's own position. */
  me?: Position;
  /** Marker for the destination. */
  dest?: Position;
  /** Extra overlays — route lines, facility pins, floor buttons. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * Schematic indoor-map placeholder.
 *
 * TODO: Replace with the real indoor map renderer once the map data format and
 * the WebGL/canvas decision are settled. The prototype drew a CSS grid.
 */
export function MapPreview({ me, dest, children, className, style }: MapPreviewProps) {
  return (
    <div className={[styles.map, className].filter(Boolean).join(' ')} style={style}>
      {me && <span className={styles.me} style={me} />}
      {dest && <span className={styles.dest} style={dest} />}
      {children}
    </div>
  );
}
