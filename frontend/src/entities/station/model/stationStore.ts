import { create } from 'zustand';
import { DEFAULT_STATION } from './stations';
import type { FloorId } from '@/shared/types';

type StationStore = {
  /** Station the user confirmed they are in. */
  station: string;
  /** Floor currently shown on maps and navigation. */
  floor: FloorId;
  setStation: (station: string) => void;
  setFloor: (floor: FloorId) => void;
};

/** Selected station and floor — read by the map, navigation and consult screens. */
export const useStationStore = create<StationStore>((set) => ({
  station: DEFAULT_STATION,
  floor: '1F',
  setStation: (station) => set({ station }),
  setFloor: (floor) => set({ floor }),
}));
