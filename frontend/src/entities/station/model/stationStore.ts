import { create } from 'zustand';
import { DEFAULT_STATION, DEFAULT_STATION_ID } from './stations';
import type { FloorId } from '@/shared/types';

type StationStore = {
  /** Station the user confirmed they are in. */
  station: string;
  stationId: number;
  /** Floor currently shown on maps and navigation. */
  floor: FloorId;
  setStation: (station: string, stationId?: number) => void;
  setFloor: (floor: FloorId) => void;
};

/** Selected station and floor — read by the map, navigation and consult screens. */
export const useStationStore = create<StationStore>((set) => ({
  station: DEFAULT_STATION,
  stationId: DEFAULT_STATION_ID,
  floor: '1F',
  setStation: (station, stationId) =>
    set((state) => ({ station, stationId: stationId ?? state.stationId })),
  setFloor: (floor) => set({ floor }),
}));
