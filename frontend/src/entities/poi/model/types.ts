import type { IconName } from '@/shared/ui';

/** A point of interest the user can navigate to. */
export type Poi = {
  id?: number;
  name: string;
  icon: IconName;
  /** Floor and walking-time note shown under the name. */
  meta: string;
  /** Highlighted as a popular destination. */
  star?: boolean;
  kind: PoiKind;
  destinationType?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
};

export type PoiKind = 'facility' | 'place';

/** A facility pin drawn on the indoor map. */
export type FacilityPin = {
  key: string;
  icon: IconName;
  label: string;
  /** Position on the map preview. */
  x: string;
  y: string;
};
