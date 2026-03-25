import type { StateCreator } from "zustand";
import {
  applyInteractionCost,
  buildRunSummary,
  canPerformInteraction,
  consumeTorchFuel,
  explainTurnEconomyFailure,
  getTorchRevealRadius,
  playerLightAttack,
  processEnemyTurn,
  resolveEnemyDeathLoot,
  revealTilesAroundPosition,
  syncFloorOccupancy,
  tryMoveByDelta,
  withUpdatedTorch,
} from "@game/systems";
import { computeMovementTilesPerTurn, type RunState } from "@game/types";
import { facingFromDelta } from "@game/utils";
import { makeTileKey } from "@game/world";
import { withActionLogs } from "../actionLog";
import type { ActionLogEntryInput, RunBootstrapData, RunStoreState } from "../types";
import { persistRunTransition } from "./persistenceSlice";

export interface CombatSlice {
  movePlayerByDelta: (deltaX: number, deltaY: number) => void;
  playerAttack: () => void;
  endTurn: () => void;
}

export function finishRunAsDead(run: RunState, bootstrapData: RunBootstrapData, causeOfDeath = "killed_in_combat"): RunState {
  const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
  const summary = buildRunSummary({
    run,
    extracted: false,
    extractionMethodId: null,
    causeOfDeath,
    itemTemplatesById,
    xpTable: bootstrapData.xpTable,
  });
  return { ...run, status: "dead", summary };
}

function endPlayerTurn(run: RunState): RunState {
  const floor = run.floors[run.currentFloor];
  const pendingEnemyIds =
    floor?.enemies.filter((enemy) => enemy.state !== "dead").map((enemy) => enemy.instanceId) ?? [];
  return {
    ...run,
    turnState: {
      ...run.turnState,
      phase: "enemies",
      enemies: {
        pendingEnemyIds,
        activeEnemyId: pendingEnemyIds[0] ?? null,
      },
    },
  };
}

function executeEnemyPhase(
  run: RunState,
  bootstrapData: RunBootstrapData,
): { run: RunState; events: ActionLogEntryInput[] } {
  const floor = run.floors[run.currentFloor];
  if (!floor || run.status !== "active" || run.turnState.phase !== "enemies") {
    return { run, events: [] };
  }

  const torchTick = consumeTorchFuel(run.player.torch);
  let turnBaseRun: RunState = { ...run, player: withUpdatedTorch(run.player, torchTick.torch) };

  if (torchTick.extinguished) {
    return {
      run: finishRunAsDead({ ...turnBaseRun, status: "dead" }, bootstrapData, "torch_extinguished"),
      events: [
        { category: "system", level: "warning", eventType: "torch_out", message: "Your torch burned out." },
        { category: "system", level: "error", eventType: "death_darkness", message: "You were lost in the dark." },
      ],
    };
  }

  const torchRadius = getTorchRevealRadius(turnBaseRun.player.torch);
  const torchTiles = revealTilesAroundPosition({
    tiles: floor.tiles,
    width: floor.width,
    height: floor.height,
    center: turnBaseRun.player.position,
    radius: torchRadius,
  });
  const discoveredTileKeys = torchTiles.filter((tile) => tile.explored).map((tile) => makeTileKey(tile.x, tile.y));
  turnBaseRun = {
    ...turnBaseRun,
    discoveredTileKeys,
    floors: { ...turnBaseRun.floors, [turnBaseRun.currentFloor]: { ...floor, tiles: torchTiles } },
  };

  const hpBefore = turnBaseRun.player.vitals.hpCurrent;
  const killsBefore = turnBaseRun.defeatedEnemyIds.length;
  const lootBefore = turnBaseRun.floors[turnBaseRun.currentFloor].groundLoot.length;

  const enemyTemplatesById = new Map(bootstrapData.enemyTemplates.map((enemy) => [enemy.id, enemy]));
  const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
  const lootTablesById = new Map(bootstrapData.lootTables.map((table) => [table.id, table]));

  const enemyTurn = processEnemyTurn({ run: turnBaseRun, enemyTemplatesById }).run;
  const floorAfterTurn = enemyTurn.floors[enemyTurn.currentFloor];
  if (!floorAfterTurn) {
    return { run: enemyTurn, events: [] };
  }
  const withLoot = resolveEnemyDeathLoot({ run: enemyTurn, floor: floorAfterTurn, enemyTemplatesById, lootTablesById });
  const syncedFloor = syncFloorOccupancy(withLoot.floors[withLoot.currentFloor]);
  const syncedRun = { ...withLoot, floors: { ...withLoot.floors, [withLoot.currentFloor]: syncedFloor } };

  if (syncedRun.status === "dead" || syncedRun.player.vitals.hpCurrent <= 0) {
    return {
      run: finishRunAsDead({ ...syncedRun, status: "dead" }, bootstrapData),
      events: [{ category: "combat", message: "You were slain." }],
    };
  }

  const events: ActionLogEntryInput[] = [];
  if (torchTick.burned > 0) {
    events.push({
      category: "system",
      eventType: "torch_tick",
      message: `Torch fuel -${torchTick.burned.toFixed(1)} (${syncedRun.player.torch.fuelCurrent.toFixed(1)}/${syncedRun.player.torch.fuelMax.toFixed(1)}).`,
    });
  }
  const hpLost = hpBefore - syncedRun.player.vitals.hpCurrent;
  if (hpLost > 0) events.push({ category: "combat", message: `Enemies hit you for ${hpLost} total damage.` });
  const killsGained = syncedRun.defeatedEnemyIds.length - killsBefore;
  if (killsGained > 0) events.push({ category: "combat", message: `You defeated ${killsGained} enemy${killsGained === 1 ? "" : "ies"}.` });
  const lootGained = syncedRun.floors[syncedRun.currentFloor].groundLoot.length - lootBefore;
  if (lootGained > 0) events.push({ category: "loot", message: `${lootGained} loot drop${lootGained === 1 ? "" : "s"} appeared.` });

  return { run: syncedRun, events };
}

function advanceRound(run: RunState): RunState {
  return {
    ...run,
    turnState: {
      ...run.turnState,
      roundNumber: run.turnState.roundNumber + 1,
    },
  };
}

function startNextPlayerTurn(run: RunState): RunState {
  const nextMovementAllowanceTiles = computeMovementTilesPerTurn(run.player.totalStats.movementFeet);
  return {
    ...run,
    turnState: {
      ...run.turnState,
      phase: "player",
      player: {
        movementAllowanceTiles: nextMovementAllowanceTiles,
        movementRemainingTiles: nextMovementAllowanceTiles,
        actionAvailable: true,
      },
      enemies: {
        pendingEnemyIds: [],
        activeEnemyId: null,
      },
    },
  };
}

export const createCombatSlice: StateCreator<
  RunStoreState & CombatSlice,
  [],
  [],
  CombatSlice
> = (set, get) => ({
  movePlayerByDelta: (deltaX, deltaY) => {
    const { run, bootstrapData } = get();
    if (!run || !bootstrapData || run.status !== "active") return;
    if (Math.abs(deltaX) + Math.abs(deltaY) !== 1) {
      return;
    }
    const movementGate = canPerformInteraction(run, "move_tile");
    if (!movementGate.allowed) {
      const message =
        movementGate.reason === "insufficient_movement"
          ? "No movement remaining this turn."
          : explainTurnEconomyFailure(movementGate.reason, "You can only move during the player phase.");
      set((state) => ({
        actionLog: withActionLogs(state.actionLog, [{ category: "system", message }]),
      }));
      return;
    }
    const currentFloor = run.floors[run.currentFloor];
    if (!currentFloor) return;

    const nextFacing = facingFromDelta({ x: deltaX, y: deltaY }, run.player.facing);

    const result = tryMoveByDelta({
      position: run.player.position,
      delta: { x: deltaX, y: deltaY },
      tiles: currentFloor.tiles,
      width: currentFloor.width,
      height: currentFloor.height,
    });

    if (!result.moved) {
      if (nextFacing === run.player.facing) return;
      const turnedRun: RunState = {
        ...run,
        player: { ...run.player, facing: nextFacing },
      };
      const persisted = persistRunTransition(turnedRun, get().profile, bootstrapData);
      set((state) => ({
        run: turnedRun,
        hasSavedRun: persisted.hasSavedRun,
        profile: persisted.profile,
        actionLog: withActionLogs(state.actionLog, [{ category: "system", message: `Turned to face ${nextFacing}.` }]),
      }));
      return;
    }

    const revealRadius = getTorchRevealRadius(run.player.torch);
    const revealedTiles = revealTilesAroundPosition({
      tiles: currentFloor.tiles,
      width: currentFloor.width,
      height: currentFloor.height,
      center: result.position,
      radius: revealRadius,
    });
    const discoveredTileKeys = revealedTiles.filter((tile) => tile.explored).map((tile) => makeTileKey(tile.x, tile.y));

    let nextRun: RunState = applyInteractionCost({
      ...run,
      player: { ...run.player, position: result.position, facing: nextFacing },
      discoveredTileKeys,
      floors: { ...run.floors, [run.currentFloor]: { ...currentFloor, tiles: revealedTiles } },
    }, "move_tile");
    nextRun.floors[nextRun.currentFloor] = syncFloorOccupancy(nextRun.floors[nextRun.currentFloor]);

    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [
        {
          category: "system",
          message: `Moved to (${nextRun.player.position.x}, ${nextRun.player.position.y}). Movement ${nextRun.turnState.player.movementRemainingTiles}/${nextRun.turnState.player.movementAllowanceTiles}.`,
        },
      ]),
    }));
  },

  playerAttack: () => {
    const { run, bootstrapData } = get();
    if (!run || !bootstrapData || run.status !== "active") return;
    const actionGate = canPerformInteraction(run, "attack");
    if (!actionGate.allowed) {
      const message = explainTurnEconomyFailure(actionGate.reason, "Cannot attack outside the player phase.");
      set((state) => ({
        actionLog: withActionLogs(state.actionLog, [{ category: "combat", message }]),
      }));
      return;
    }

    const enemyTemplatesById = new Map(bootstrapData.enemyTemplates.map((enemy) => [enemy.id, enemy]));
    const attacked = playerLightAttack({
      run,
      enemyTemplatesById,
      itemTemplatesById: new Map(bootstrapData.itemTemplates.map((item) => [item.id, item])),
    });

    if (!attacked.attacked) {
      set((state) => ({
        actionLog: withActionLogs(state.actionLog, [{ category: "combat", message: "Attack missed. No enemy in front." }]),
      }));
      return;
    }

    let nextRun: RunState = applyInteractionCost(attacked.run, "attack");
    nextRun.floors[nextRun.currentFloor] = syncFloorOccupancy(nextRun.floors[nextRun.currentFloor]);

    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [{ category: "combat", message: "Attack hit. Action spent." }]),
    }));
  },

  endTurn: () => {
    const { run, bootstrapData } = get();
    if (!run || !bootstrapData || run.status !== "active") return;
    if (run.turnState.phase !== "player") {
      set((state) => ({
        actionLog: withActionLogs(state.actionLog, [{ category: "system", message: "End Turn unavailable outside player phase." }]),
      }));
      return;
    }

    const endedPlayerRun = endPlayerTurn(run);
    const enemyPhaseResult = executeEnemyPhase(endedPlayerRun, bootstrapData);
    const advancedRun =
      enemyPhaseResult.run.status === "active" ? advanceRound(enemyPhaseResult.run) : enemyPhaseResult.run;
    const nextRun =
      advancedRun.status === "active" ? startNextPlayerTurn(advancedRun) : advancedRun;

    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [
        { category: "system", message: `Turn ended. Resolving enemy phase for round ${run.turnState.roundNumber}.` },
        ...enemyPhaseResult.events,
        ...(nextRun.status === "active"
          ? [{ category: "system" as const, message: `Round ${nextRun.turnState.roundNumber} started. Player phase active.` }]
          : []),
      ]),
    }));
  },
});
