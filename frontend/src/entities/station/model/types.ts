export type Station = {
  id?: number;
  name: string;
  line: string;
  /** Human-readable distance, or a GPS note for the detected station. */
  dist: string;
  /** True for the station detected from GPS. */
  here?: boolean;
};
