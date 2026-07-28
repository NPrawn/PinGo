/**
 * Floors PinGo serves inside a station.
 *
 * Lives in `shared` because several entities (station, poi) and the map widgets
 * all key data by floor; keeping it here avoids entity-to-entity imports.
 */
export type FloorId = '1F' | 'B1' | 'B2' | 'B3';
