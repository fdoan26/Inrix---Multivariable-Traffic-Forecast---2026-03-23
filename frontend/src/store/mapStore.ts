import { create } from 'zustand';

interface MapState {
  selectedCorridorId: string | null;
  incidentsVisible: boolean;
  lastUpdated: Date | null;
  selectCorridor: (id: string | null) => void;
  toggleIncidents: () => void;
  setLastUpdated: (date: Date) => void;
}

export const useMapStore = create<MapState>((set) => ({
  selectedCorridorId: null,
  incidentsVisible: true,
  lastUpdated: null,
  selectCorridor: (id) => set({ selectedCorridorId: id }),
  toggleIncidents: () => set((s) => ({ incidentsVisible: !s.incidentsVisible })),
  setLastUpdated: (date) => set({ lastUpdated: date }),
}));
