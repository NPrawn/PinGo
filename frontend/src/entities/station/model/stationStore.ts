import { create } from 'zustand';
import { DEFAULT_STATION, DEFAULT_STATION_ID } from './stations';
import type { FloorId } from '@/shared/types';

type StationStore = {
  /** Station the user confirmed they are in. */
  station: string;
  /**
   * 확정된 역의 백엔드 id. 지도·시설·경로 API 요청에 쓴다.
   *
   * 이름과 따로 둔다. 화면에 보여줄 것은 이름이고 서버에 보낼 것은 id인데, 이름으로 id를
   * 되찾을 방법이 없다. 등록되지 않은 역을 고르면 null이며, 그때 호출부는 조회를 건다.
   */
  stationId: number | null;
  /** Floor currently shown on maps and navigation. */
  floor: FloorId;
  setStation: (station: string, stationId: number | null) => void;
  setFloor: (floor: FloorId) => void;
};

/** Selected station and floor — read by the map, navigation and consult screens. */
export const useStationStore = create<StationStore>((set) => ({
  station: DEFAULT_STATION,
  stationId: DEFAULT_STATION_ID,
  floor: '1F',
  setStation: (station, stationId) => set({ station, stationId }),
  setFloor: (floor) => set({ floor }),
}));
