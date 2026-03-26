import type { RunState } from "../types";

export type InteractionId =
  | "move_tile"
  | "attack"
  | "loot_pickup"
  | "open_chest"
  | "open_door"
  | "extract"
  | "consume_item"
  | "equip"
  | "unequip"
  | "use_key";

export const BASE_ATTACK_STAMINA_COST = 5;

export interface InteractionCostRule {
  staminaCost: number;
  movementTilesCost: number;
  consumeAllRemainingMovement: boolean;
  description: string;
}

export type TurnEconomyFailureReason =
  | "not_player_phase"
  | "insufficient_stamina"
  | "insufficient_movement";

export interface TurnEconomyGateResult {
  allowed: boolean;
  reason?: TurnEconomyFailureReason;
}

/**
 * Authoritative interaction cost table for hybrid stamina economy.
 */
export const INTERACTION_COST_RULES: Record<InteractionId, InteractionCostRule> = {
  move_tile: {
    staminaCost: 0,
    movementTilesCost: 0,
    consumeAllRemainingMovement: false,
    description: "Move one orthogonal tile (hybrid mode: no movement cap).",
  },
  attack: {
    staminaCost: BASE_ATTACK_STAMINA_COST,
    movementTilesCost: 0,
    consumeAllRemainingMovement: false,
    description: "Melee or ranged attack.",
  },
  loot_pickup: {
    staminaCost: 0,
    movementTilesCost: 0,
    consumeAllRemainingMovement: false,
    description: "Pick up loot from ground tile.",
  },
  open_chest: {
    staminaCost: 0,
    movementTilesCost: 0,
    consumeAllRemainingMovement: false,
    description: "Open chest interactable.",
  },
  open_door: {
    staminaCost: 0,
    movementTilesCost: 0,
    consumeAllRemainingMovement: false,
    description: "Open door interactable.",
  },
  extract: {
    staminaCost: 0,
    movementTilesCost: 0,
    consumeAllRemainingMovement: false,
    description: "Extract from floor and end run.",
  },
  consume_item: {
    staminaCost: 0,
    movementTilesCost: 0,
    consumeAllRemainingMovement: false,
    description: "Consume usable item.",
  },
  equip: {
    staminaCost: 0,
    movementTilesCost: 0,
    consumeAllRemainingMovement: false,
    description: "Equip item to a valid slot.",
  },
  unequip: {
    staminaCost: 0,
    movementTilesCost: 0,
    consumeAllRemainingMovement: false,
    description: "Unequip item back to inventory.",
  },
  use_key: {
    staminaCost: 0,
    movementTilesCost: 0,
    consumeAllRemainingMovement: false,
    description: "Use key on locked interactable.",
  },
};

export function canPerformInteraction(
  run: Pick<RunState, "status" | "turnState" | "player">,
  interactionId: InteractionId,
): TurnEconomyGateResult {
  if (run.status !== "active" || run.turnState.phase !== "player") {
    return { allowed: false, reason: "not_player_phase" };
  }
  const rule = INTERACTION_COST_RULES[interactionId];
  if (rule.staminaCost > run.player.vitals.staminaCurrent) {
    return { allowed: false, reason: "insufficient_stamina" };
  }
  if (rule.movementTilesCost > run.turnState.player.movementRemainingTiles) {
    return { allowed: false, reason: "insufficient_movement" };
  }
  return { allowed: true };
}

export function applyInteractionCost(run: RunState, interactionId: InteractionId): RunState {
  const rule = INTERACTION_COST_RULES[interactionId];
  const movementRemainingTiles = rule.consumeAllRemainingMovement
    ? 0
    : Math.max(0, run.turnState.player.movementRemainingTiles - rule.movementTilesCost);
  const staminaCurrent = Math.max(0, run.player.vitals.staminaCurrent - rule.staminaCost);

  return {
    ...run,
    player: {
      ...run.player,
      vitals: {
        ...run.player.vitals,
        staminaCurrent,
      },
    },
    turnState: {
      ...run.turnState,
      player: {
        ...run.turnState.player,
        movementRemainingTiles,
      },
    },
  };
}

export function explainTurnEconomyFailure(
  reason: TurnEconomyFailureReason | undefined,
  fallbackOutsidePlayerPhase: string,
): string {
  if (reason === "not_player_phase") {
    return fallbackOutsidePlayerPhase;
  }
  if (reason === "insufficient_stamina") {
    return "Not enough stamina.";
  }
  return "Not enough movement remaining.";
}
