import type { StateCreator } from "zustand";
import type { RunStoreState } from "../types";

export interface SystemSlice {
  clearActionLog: () => void;
}

export const createSystemSlice: StateCreator<RunStoreState & SystemSlice, [], [], SystemSlice> = (set) => ({
  clearActionLog: () => {
    set({ actionLog: [] });
  },
});
