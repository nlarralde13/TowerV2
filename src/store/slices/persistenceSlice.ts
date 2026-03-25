import type { StateCreator } from "zustand";
import { applyRunSummaryToProfile, clearRunState, saveProfile, saveRunState } from "@game/data";
import type { ProfileSave, RunState } from "@game/types";
import { withActionLogs } from "../actionLog";
import type { ActionLogEntryInput, RunBootstrapData, RunStoreState } from "../types";

export interface PersistenceSlice {
  clearSavedRun: () => void;
}

export type FullStoreState = RunStoreState & PersistenceSlice;

/**
 * Pure helper — persists run state after any action that advances the turn.
 * Does not touch the Zustand store; callers set() the returned values.
 */
export function persistRunTransition(
  nextRun: RunState,
  profile: ProfileSave | null,
  bootstrapData: RunBootstrapData | null,
): { hasSavedRun: boolean; profile: ProfileSave | null } {
  if (nextRun.status === "active") {
    saveRunState(nextRun);
    return { hasSavedRun: true, profile };
  }

  clearRunState();
  if (!profile || !bootstrapData || !nextRun.summary) {
    return { hasSavedRun: false, profile };
  }
  const updatedProfile = applyRunSummaryToProfile({ profile, run: nextRun });
  saveProfile(updatedProfile);
  return { hasSavedRun: false, profile: updatedProfile };
}

export const createPersistenceSlice: StateCreator<
  RunStoreState & PersistenceSlice,
  [],
  [],
  PersistenceSlice
> = (set) => ({
  clearSavedRun: () => {
    clearRunState();
    set((state) => ({
      hasSavedRun: false,
      actionLog: withActionLogs(state.actionLog, [
        { category: "system", message: "Saved run cleared." } satisfies ActionLogEntryInput,
      ]),
    }));
  },
});
