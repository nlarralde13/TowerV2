import type { ProfileSave, RunState } from "@game/types";
import type { EnemyTemplate, ExtractionRule, FloorRule, ItemTemplate, LootTable, PlayerDefaults, XpTable } from "@game/types";

export interface RunBootstrapData {
  floorRules: FloorRule[];
  enemyTemplates: EnemyTemplate[];
  itemTemplates: ItemTemplate[];
  lootTables: LootTable[];
  playerDefaults: PlayerDefaults;
  extractionRules: ExtractionRule[];
  xpTable: XpTable;
}

export type ActionLogCategory = "combat" | "loot" | "inventory" | "system";
export type ActionLogLevel = "info" | "warning" | "error";

export interface ActionLogEntry {
  id: string;
  timestamp: number;
  category: ActionLogCategory;
  level: ActionLogLevel;
  eventType: string;
  message: string;
  payload?: Record<string, unknown>;
}

export interface ActionLogEntryInput {
  category: ActionLogCategory;
  level?: ActionLogLevel;
  eventType?: string;
  message: string;
  payload?: Record<string, unknown>;
}

export interface RunStoreState {
  run: RunState | null;
  profile: ProfileSave | null;
  hasSavedRun: boolean;
  actionLog: ActionLogEntry[];
  bootstrapData: RunBootstrapData | null;
}

export interface TurnUiStateSnapshot {
  roundNumber: number;
  phase: RunState["turnState"]["phase"];
  movementRemainingTiles: number;
  movementAllowanceTiles: number;
  staminaCurrent: number;
  staminaMax: number;
}
