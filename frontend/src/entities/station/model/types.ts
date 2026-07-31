export type Station = {
  id?: number;
  name: string;
  line: string;
  /** Human-readable distance, or a GPS note for the detected station. */
  dist: string;
  /** True for the station detected from GPS. */
  here?: boolean;
  /**
   * False for stations that only exist in the external search provider, so we have
   * no indoor map or route graph for them. Those rows are shown but not selectable.
   */
  serviceReady?: boolean;
};
