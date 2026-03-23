import { create } from "zustand";

interface UiStoreState {
  inventoryOpen: boolean;
  mapOpen: boolean;
  paused: boolean;
  debugOverlay: boolean;
  setInventoryOpen: (value: boolean) => void;
  setMapOpen: (value: boolean) => void;
  setPaused: (value: boolean) => void;
  setDebugOverlay: (value: boolean) => void;
}

export const useUiStore = create<UiStoreState>((set) => ({
  inventoryOpen: false,
  mapOpen: false,
  paused: false,
  debugOverlay: false,
  setInventoryOpen: (value) => set({ inventoryOpen: value }),
  setMapOpen: (value) => set({ mapOpen: value }),
  setPaused: (value) => set({ paused: value }),
  setDebugOverlay: (value) => set({ debugOverlay: value }),
}));
