import type { ID, SeedString } from "./common";
import type { FloorState } from "./floors";
import type { PlayerState } from "./player";

export interface RunSummary {
  runId: ID;
  seed: SeedString;
  floorsReached: number;
  enemiesKilled: number;
  bossesKilled: number;
  roomsDiscovered: number;
  puzzlesSolved: number;
  lootExtractedValue: number;
  extracted: boolean;
  extractionMethodId?: ID | null;
  causeOfDeath?: string | null;
  xpEarned: number;
  levelUpsGained: number;
  durationSeconds: number;
}

export interface RunState {
  runId: ID;
  seed: SeedString;
  startedAt: number;
  status: "active" | "extracted" | "dead" | "complete";
  currentFloor: number;
  player: PlayerState;
  floors: Record<number, FloorState>;
  discoveredTileKeys: string[];
  defeatedEnemyIds: ID[];
  extractedItemIds: ID[];
  availableExtractionNodeIds: ID[];
  summary?: RunSummary;
}
