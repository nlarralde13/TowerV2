import { create } from "zustand";
import { createCombatSlice, type CombatSlice } from "./slices/combatSlice";
import { createInventorySlice, type InventorySlice } from "./slices/inventorySlice";
import { createLootSlice, type LootSlice } from "./slices/lootSlice";
import { createPersistenceSlice, type PersistenceSlice } from "./slices/persistenceSlice";
import { createRunLifecycleSlice, type RunLifecycleSlice } from "./slices/runLifecycleSlice";
import { createSystemSlice, type SystemSlice } from "./slices/systemSlice";
import type { RunStoreState } from "./types";

export type { ActionLogCategory, ActionLogEntry, ActionLogLevel } from "./types";

type FullStore = RunStoreState &
  CombatSlice &
  InventorySlice &
  LootSlice &
  PersistenceSlice &
  RunLifecycleSlice &
  SystemSlice;

export const useRunStore = create<FullStore>()((...args) => ({
  // Base state
  run: null,
  profile: null,
  hasSavedRun: false,
  actionLog: [],
  bootstrapData: null,
  // Domain slices
  ...createRunLifecycleSlice(...args),
  ...createCombatSlice(...args),
  ...createLootSlice(...args),
  ...createInventorySlice(...args),
  ...createPersistenceSlice(...args),
  ...createSystemSlice(...args),
}));
