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

export type InteractionCostKind = "movement" | "action" | "full_turn" | "free";

export interface InteractionCostRule {
  kind: InteractionCostKind;
  movementTilesCost: number;
  actionCost: boolean;
  consumeAllRemainingMovement: boolean;
  description: string;
}

export type TurnEconomyFailureReason = "not_player_phase" | "no_action_available" | "insufficient_movement";

export interface TurnEconomyGateResult {
  allowed: boolean;
  reason?: TurnEconomyFailureReason;
}

/**
 * Authoritative interaction cost table for turn economy.
 *
 * Kinds:
 * - movement: consumes movement tiles only
 * - action: consumes the turn action only
 * - full_turn: consumes action and clears remaining movement
 * - free: does not consume movement or action
 */
export const INTERACTION_COST_RULES: Record<InteractionId, InteractionCostRule> = {
  move_tile: {
    kind: "movement",
    movementTilesCost: 1,
    actionCost: false,
    consumeAllRemainingMovement: false,
    description: "Move one orthogonal tile.",
  },
  attack: {
    kind: "action",
    movementTilesCost: 0,
    actionCost: true,
    consumeAllRemainingMovement: false,
    description: "Melee or ranged attack.",
  },
  loot_pickup: {
    kind: "action",
    movementTilesCost: 0,
    actionCost: true,
    consumeAllRemainingMovement: false,
    description: "Pick up loot from ground tile.",
  },
  open_chest: {
    kind: "action",
    movementTilesCost: 0,
    actionCost: true,
    consumeAllRemainingMovement: false,
    description: "Open chest interactable.",
  },
  open_door: {
    kind: "action",
    movementTilesCost: 0,
    actionCost: true,
    consumeAllRemainingMovement: false,
    description: "Open door interactable.",
  },
  extract: {
    kind: "full_turn",
    movementTilesCost: 0,
    actionCost: true,
    consumeAllRemainingMovement: true,
    description: "Extract from floor and end run.",
  },
  consume_item: {
    kind: "action",
    movementTilesCost: 0,
    actionCost: true,
    consumeAllRemainingMovement: false,
    description: "Consume usable item (for MVP, torch fuel consumables).",
  },
  equip: {
    kind: "free",
    movementTilesCost: 0,
    actionCost: false,
    consumeAllRemainingMovement: false,
    description: "Equip item to a valid slot.",
  },
  unequip: {
    kind: "free",
    movementTilesCost: 0,
    actionCost: false,
    consumeAllRemainingMovement: false,
    description: "Unequip item back to inventory.",
  },
  use_key: {
    kind: "action",
    movementTilesCost: 0,
    actionCost: true,
    consumeAllRemainingMovement: false,
    description: "Use key on locked interactable.",
  },
};

export function canPerformInteraction(
  run: Pick<RunState, "status" | "turnState">,
  interactionId: InteractionId,
): TurnEconomyGateResult {
  if (run.status !== "active" || run.turnState.phase !== "player") {
    return { allowed: false, reason: "not_player_phase" };
  }
  const rule = INTERACTION_COST_RULES[interactionId];
  if (rule.actionCost && !run.turnState.player.actionAvailable) {
    return { allowed: false, reason: "no_action_available" };
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

  return {
    ...run,
    turnState: {
      ...run.turnState,
      player: {
        ...run.turnState.player,
        movementRemainingTiles,
        actionAvailable: rule.actionCost ? false : run.turnState.player.actionAvailable,
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
  if (reason === "no_action_available") {
    return "Action already used this turn.";
  }
  return "Not enough movement remaining.";
}
