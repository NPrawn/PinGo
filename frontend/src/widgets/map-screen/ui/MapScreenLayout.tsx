import type { CSSProperties, ReactNode } from 'react';
import { ConsultCta } from '@/features/consult-request';
import { BackLink, MapPreview } from '@/shared/ui';
import styles from './MapScreenLayout.module.css';

type Position = { left?: string; top?: string; right?: string; bottom?: string };

type MapScreenMapProps = {
  me?: Position;
  dest?: Position;
  children?: ReactNode;
  className?: string;
};

/** Full-bleed map that fills the space between the header and the panel. */
export function MapScreenMap({ me, dest, children, className }: MapScreenMapProps) {
  return (
    <MapPreview className={[styles.map, className].filter(Boolean).join(' ')} me={me} dest={dest}>
      {children}
    </MapPreview>
  );
}

type MapScreenSvgProps = {
  viewBox: string;
  preserveAspectRatio?: string;
  children: ReactNode;
  style?: CSSProperties;
};

/** Floor-plan drawing layer sized to the map. */
export function MapScreenSvg({
  viewBox,
  preserveAspectRatio = 'xMidYMid slice',
  children,
  style,
}: MapScreenSvgProps) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio={preserveAspectRatio}
      className={styles.mapSvg}
      style={style}
      aria-hidden
    >
      {children}
    </svg>
  );
}

type MapScreenHeaderProps = {
  backTo: string;
  backLabel: string;
  title: string;
  lede: string;
};

/** Fixed header above a full-bleed map. */
export function MapScreenHeader({ backTo, backLabel, title, lede }: MapScreenHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.headerBar}>
        <BackLink to={backTo}>{backLabel}</BackLink>
        <ConsultCta variant="icon" />
      </div>
      <div className={styles.headerText}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lede}>{lede}</p>
      </div>
    </div>
  );
}

type MapScreenPanelProps = {
  children: ReactNode;
  /** Lets long panels scroll, as the exit-recommendation screen does. */
  scroll?: boolean;
};

/** Bottom panel below a full-bleed map. */
export function MapScreenPanel({ children, scroll }: MapScreenPanelProps) {
  return (
    <div className={[styles.panel, scroll && styles.panelScroll].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

type MapCalloutProps = {
  left: string;
  top: string;
  tone?: 'default' | 'danger';
  children: ReactNode;
};

/** Chip label tethered above a map marker. */
export function MapCallout({ left, top, tone = 'default', children }: MapCalloutProps) {
  return (
    <div className={styles.callout} style={{ left, top }}>
      <span
        className={[styles.calloutChip, tone === 'danger' && styles.calloutDanger]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </span>
    </div>
  );
}

type MeLabelProps = {
  left: string;
  top: string;
};

/** "현재 위치" caption above the user's dot. */
export function MeLabel({ left, top }: MeLabelProps) {
  return (
    <div className={styles.meLabel} style={{ left, top }}>
      현재 위치
    </div>
  );
}
