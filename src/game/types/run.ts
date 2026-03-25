import { FEET_PER_TILE, type ID, type SeedString } from "./common";
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

export type TurnPhase = "player" | "enemies";

export interface PlayerTurnState {
  movementAllowanceTiles: number;
  movementRemainingTiles: number;
  actionAvailable: boolean;
  bonusActionAvailable: boolean;
}

export interface EnemyTurnState {
  pendingEnemyIds: ID[];
  activeEnemyId: ID | null;
}

export interface TurnActorBudgetState {
  movementTilesRemaining: number;
  actionPointsRemaining: number;
  speed: number;
}

export interface TurnFutureState {
  initiativeOrder: ID[];
  currentActorId: ID | null;
  actorBudgets: Record<ID, TurnActorBudgetState>;
  terrainCostProfileId: ID | null;
  activeStatusEffectIds: ID[];
}

export interface RunTurnState {
  roundNumber: number;
  phase: TurnPhase;
  player: PlayerTurnState;
  enemies: EnemyTurnState;
  future: TurnFutureState;
}

export function computeMovementTilesPerTurn(movementFeet: number): number {
  return Math.max(1, Math.floor(Math.max(0, movementFeet) / FEET_PER_TILE));
}

export function initializeRunTurnState(player: PlayerState): RunTurnState {
  const movementAllowanceTiles = computeMovementTilesPerTurn(player.totalStats.movementFeet);
  return {
    roundNumber: 1,
    phase: "player",
    player: {
      movementAllowanceTiles,
      movementRemainingTiles: movementAllowanceTiles,
      actionAvailable: true,
      bonusActionAvailable: true,
    },
    enemies: {
      pendingEnemyIds: [],
      activeEnemyId: null,
    },
    future: {
      initiativeOrder: [],
      currentActorId: null,
      actorBudgets: {},
      terrainCostProfileId: null,
      activeStatusEffectIds: [],
    },
  };
}

export interface RunState {
  runId: ID;
  seed: SeedString;
  startedAt: number;
  status: "active" | "extracted" | "dead" | "complete";
  currentFloor: number;
  turnState: RunTurnState;
  player: PlayerState;
  floors: Record<number, FloorState>;
  discoveredTileKeys: string[];
  defeatedEnemyIds: ID[];
  extractedItemIds: ID[];
  availableExtractionNodeIds: ID[];
  summary?: RunSummary;
}
