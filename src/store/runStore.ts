import { create } from "zustand";
import {
  applyRunSummaryToProfile,
  clearRunState,
  loadProfile,
  loadRunState,
  saveProfile,
  saveRunState,
} from "../game/data";
import { createInitialRunState } from "../game/engine";
import {
  addItemToInventory,
  buildRunSummary,
  canExtractAtPosition,
  playerLightAttack,
  processEnemyTurn,
  resolveEnemyDeathLoot,
  revealTilesAroundPosition,
  syncFloorOccupancy,
  tryMoveByDelta,
  dropInventoryItemToGround,
  moveInventoryItemInGrid,
  equipInventoryItem,
  unequipToInventory,
  assignInventoryItemToBelt,
  removeBeltItemToInventory,
  clampPlayerVitalsToEffectiveStats,
  recomputePlayerStats,
  consumeInventoryItemStack,
  consumeTorchFuel,
  getTorchRevealRadius,
  restoreTorchFuel,
  withUpdatedTorch,
} from "../game/systems";
import { facingFromDelta } from "../game/utils";
import type {
  EquipSlot,
  EnemyTemplate,
  ExtractionRule,
  FloorRule,
  ItemTemplate,
  LootTable,
  PlayerDefaults,
  ProfileSave,
  RunState,
  XpTable,
} from "../game/types";
import { makeTileKey } from "../game/world";

interface RunBootstrapData {
  floorRules: FloorRule[];
  enemyTemplates: EnemyTemplate[];
  itemTemplates: ItemTemplate[];
  lootTables: LootTable[];
  playerDefaults: PlayerDefaults;
  extractionRules: ExtractionRule[];
  xpTable: XpTable;
}

interface RunStoreState {
  run: RunState | null;
  profile: ProfileSave | null;
  hasSavedRun: boolean;
  actionLog: ActionLogEntry[];
  bootstrapData: RunBootstrapData | null;
  setBootstrapData: (data: RunBootstrapData) => void;
  startRun: (seed: string) => void;
  resumeSavedRun: () => void;
  clearSavedRun: () => void;
  movePlayerByDelta: (deltaX: number, deltaY: number) => void;
  playerAttack: () => void;
  pickupLoot: () => void;
  pickupLootFromTile: (x: number, y: number) => void;
  tryExtract: () => void;
  moveInventoryStack: (instanceId: string, toX: number, toY: number) => void;
  dropInventoryStack: (instanceId: string) => void;
  equipInventoryStack: (instanceId: string, slot: EquipSlot) => void;
  unequipSlot: (slot: EquipSlot) => void;
  assignTrinketToBelt: (instanceId: string, beltIndex: number) => void;
  removeTrinketFromBelt: (beltIndex: number) => void;
  consumeInventoryStack: (instanceId: string) => void;
  clearActionLog: () => void;
  restart: () => void;
}

const MAX_ACTION_LOG_ENTRIES = 200;
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
interface ActionLogEntryInput {
  category: ActionLogCategory;
  level?: ActionLogLevel;
  eventType?: string;
  message: string;
  payload?: Record<string, unknown>;
}
let actionLogCounter = 0;

function nextActionLogId(): string {
  actionLogCounter += 1;
  return `log_${Date.now()}_${actionLogCounter}`;
}

function withActionLogs(existing: ActionLogEntry[], messages: ActionLogEntryInput[]): ActionLogEntry[] {
  if (messages.length === 0) {
    return existing;
  }
  const now = Date.now();
  const next = [...existing, ...messages.map((entry, index) => ({
    id: nextActionLogId(),
    timestamp: now + index,
    category: entry.category,
    level: entry.level ?? "info",
    eventType: entry.eventType ?? "message",
    message: entry.message,
    payload: entry.payload,
  }))];
  return next.slice(Math.max(0, next.length - MAX_ACTION_LOG_ENTRIES));
}

function buildStatDeltaMessages(params: {
  beforeRun: RunState;
  afterRun: RunState;
  bootstrapData: RunBootstrapData;
}): string[] {
  const { beforeRun, afterRun, bootstrapData } = params;
  const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
  const before = recomputePlayerStats(beforeRun.player, itemTemplatesById).totalStats;
  const after = recomputePlayerStats(afterRun.player, itemTemplatesById).totalStats;
  const lines: string[] = [];
  if (after.hp !== before.hp) {
    lines.push(`Max HP ${before.hp} -> ${after.hp}`);
  }
  if (after.attack !== before.attack) {
    lines.push(`ATK ${before.attack} -> ${after.attack}`);
  }
  if (after.defense !== before.defense) {
    lines.push(`DEF ${before.defense} -> ${after.defense}`);
  }
  if (after.moveSpeed !== before.moveSpeed) {
    lines.push(`Speed ${before.moveSpeed.toFixed(2)} -> ${after.moveSpeed.toFixed(2)}`);
  }
  if (after.carryWeight !== before.carryWeight) {
    lines.push(`Carry ${before.carryWeight.toFixed(1)} -> ${after.carryWeight.toFixed(1)}`);
  }
  return lines;
}

function finishRunAsDead(run: RunState, bootstrapData: RunBootstrapData, causeOfDeath: string = "killed_in_combat"): RunState {
  const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
  const summary = buildRunSummary({
    run,
    extracted: false,
    extractionMethodId: null,
    causeOfDeath,
    itemTemplatesById,
    xpTable: bootstrapData.xpTable,
  });
  return {
    ...run,
    status: "dead",
    summary,
  };
}

function updateTurnState(
  run: RunState,
  bootstrapData: RunBootstrapData,
): { run: RunState; events: ActionLogEntryInput[] } {
  const floor = run.floors[run.currentFloor];
  if (!floor || run.status !== "active") {
    return { run, events: [] };
  }
  const torchTick = consumeTorchFuel(run.player.torch);
  let turnBaseRun: RunState = {
    ...run,
    player: withUpdatedTorch(run.player, torchTick.torch),
  };
  if (torchTick.extinguished) {
    return {
      run: finishRunAsDead(
        {
          ...turnBaseRun,
          status: "dead",
        },
        bootstrapData,
        "torch_extinguished",
      ),
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
    floors: {
      ...turnBaseRun.floors,
      [turnBaseRun.currentFloor]: {
        ...floor,
        tiles: torchTiles,
      },
    },
  };

  const hpBefore = turnBaseRun.player.vitals.hpCurrent;
  const killsBefore = turnBaseRun.defeatedEnemyIds.length;
  const lootBefore = turnBaseRun.floors[turnBaseRun.currentFloor].groundLoot.length;

  const enemyTemplatesById = new Map(bootstrapData.enemyTemplates.map((enemy) => [enemy.id, enemy]));
  const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
  const lootTablesById = new Map(bootstrapData.lootTables.map((table) => [table.id, table]));

  const enemyTurn = processEnemyTurn({
    run: turnBaseRun,
    enemyTemplatesById,
    itemTemplatesById,
  }).run;
  const floorAfterTurn = enemyTurn.floors[enemyTurn.currentFloor];
  if (!floorAfterTurn) {
    return { run: enemyTurn, events: [] };
  }
  const withLoot = resolveEnemyDeathLoot({
    run: enemyTurn,
    floor: floorAfterTurn,
    enemyTemplatesById,
    lootTablesById,
  });
  const syncedFloor = syncFloorOccupancy(withLoot.floors[withLoot.currentFloor]);
  const syncedRun = {
    ...withLoot,
    floors: {
      ...withLoot.floors,
      [withLoot.currentFloor]: syncedFloor,
    },
  };

  if (syncedRun.status === "dead" || syncedRun.player.vitals.hpCurrent <= 0) {
    return {
      run: finishRunAsDead(
      {
        ...syncedRun,
        status: "dead",
      },
      bootstrapData,
    ),
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
  if (hpLost > 0) {
    events.push({ category: "combat", message: `Enemies hit you for ${hpLost} total damage.` });
  }
  const killsGained = syncedRun.defeatedEnemyIds.length - killsBefore;
  if (killsGained > 0) {
    events.push({ category: "combat", message: `You defeated ${killsGained} enemy${killsGained === 1 ? "" : "ies"}.` });
  }
  const lootGained = syncedRun.floors[syncedRun.currentFloor].groundLoot.length - lootBefore;
  if (lootGained > 0) {
    events.push({ category: "loot", message: `${lootGained} loot drop${lootGained === 1 ? "" : "s"} appeared.` });
  }
  return { run: syncedRun, events };
}

function persistRunTransition(
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
  const updatedProfile = applyRunSummaryToProfile({
    profile,
    run: nextRun,
  });
  saveProfile(updatedProfile);
  return { hasSavedRun: false, profile: updatedProfile };
}

function pickupLootAtPosition(params: {
  run: RunState;
  bootstrapData: RunBootstrapData;
  x: number;
  y: number;
}): { run: RunState; pickedUpAny: boolean } {
  const { run, bootstrapData, x, y } = params;
  const floor = run.floors[run.currentFloor];
  if (!floor) {
    return { run, pickedUpAny: false };
  }

  const groundItemsHere = floor.groundLoot.filter(
    (loot) => loot.position.container === "ground" && loot.position.x === x && loot.position.y === y,
  );
  if (groundItemsHere.length === 0) {
    return { run, pickedUpAny: false };
  }

  const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
  let player = run.player;
  let remainingGroundLoot = floor.groundLoot;
  let pickedUpAny = false;
  let pickedUpCount = 0;

  function autoSlotNewlyPickedItems(currentPlayer: RunState["player"], newInstanceIds: string[]): RunState["player"] {
    let nextPlayer = currentPlayer;
    for (const instanceId of newInstanceIds) {
      const instance = nextPlayer.inventory.items.find(
        (entry) => entry.instanceId === instanceId && entry.position.container === "inventory",
      );
      if (!instance) {
        continue;
      }
      const template = itemTemplatesById.get(instance.itemId);
      if (!template) {
        continue;
      }

      if (template.equipSlot && nextPlayer.equipment[template.equipSlot] === null) {
        const equipped = equipInventoryItem({
          player: nextPlayer,
          instanceId,
          slot: template.equipSlot,
          itemTemplatesById,
        });
        if (equipped.moved) {
          nextPlayer = equipped.player;
          continue;
        }
      }

      if (template.type === "trinket") {
        const emptyBeltIndex = nextPlayer.belt.slots.findIndex((slot) => slot === null);
        if (emptyBeltIndex >= 0) {
          const assigned = assignInventoryItemToBelt({
            player: nextPlayer,
            instanceId,
            beltIndex: emptyBeltIndex,
            itemTemplatesById,
          });
          if (assigned.moved) {
            nextPlayer = assigned.player;
          }
        }
      }
    }
    return nextPlayer;
  }

  for (const groundItem of groundItemsHere) {
    const template = itemTemplatesById.get(groundItem.itemId);
    if (!template) {
      continue;
    }
    const beforeInventoryIds = new Set(player.inventory.items.map((item) => item.instanceId));
    const added = addItemToInventory({
      player,
      item: groundItem,
      template,
      itemTemplatesById,
    });
    player = added.player;
    const newInstanceIds = player.inventory.items
      .filter((item) => item.position.container === "inventory" && !beforeInventoryIds.has(item.instanceId))
      .map((item) => item.instanceId);
    player = autoSlotNewlyPickedItems(player, newInstanceIds);
    player = clampPlayerVitalsToEffectiveStats(player, itemTemplatesById);
    if (!added.added) {
      continue;
    }
    pickedUpAny = true;
    pickedUpCount += Math.max(0, groundItem.quantity - added.remainingQuantity);

    if (added.remainingQuantity <= 0) {
      remainingGroundLoot = remainingGroundLoot.filter((entry) => entry.instanceId !== groundItem.instanceId);
    } else {
      remainingGroundLoot = remainingGroundLoot.map((entry) =>
        entry.instanceId === groundItem.instanceId ? { ...entry, quantity: added.remainingQuantity } : entry,
      );
    }
  }

  if (!pickedUpAny) {
    return { run, pickedUpAny: false };
  }

  const nextRun: RunState = {
    ...run,
    player: clampPlayerVitalsToEffectiveStats(player, itemTemplatesById),
    floors: {
      ...run.floors,
      [run.currentFloor]: {
        ...floor,
        groundLoot: remainingGroundLoot,
      },
    },
  };
  return { run: nextRun, pickedUpAny: pickedUpCount > 0 };
}

export const useRunStore = create<RunStoreState>((set, get) => ({
  run: null,
  profile: null,
  hasSavedRun: false,
  actionLog: [],
  bootstrapData: null,
  setBootstrapData: (data) => {
    const profile = loadProfile(data.playerDefaults);
    const savedRun = loadRunState();
    const hasSavedRun = Boolean(savedRun && savedRun.status === "active");
    set({
      bootstrapData: data,
      profile,
      hasSavedRun,
    });
  },
  startRun: (seed) => {
    const bootstrapData = get().bootstrapData;
    if (!bootstrapData) {
      throw new Error("Cannot start run before bootstrapData has been set.");
    }
    const run = createInitialRunState({
      runId: `run_${Date.now()}`,
      seed,
      floorRules: bootstrapData.floorRules,
      enemyTemplates: bootstrapData.enemyTemplates,
      playerDefaults: bootstrapData.playerDefaults,
    });

    const currentFloor = run.floors[run.currentFloor];
    const revealRadius = getTorchRevealRadius(run.player.torch);
    const revealedTiles = revealTilesAroundPosition({
      tiles: currentFloor.tiles,
      width: currentFloor.width,
      height: currentFloor.height,
      center: run.player.position,
      radius: revealRadius,
    });
    currentFloor.tiles = revealedTiles;
    run.discoveredTileKeys = revealedTiles.filter((tile) => tile.explored).map((tile) => makeTileKey(tile.x, tile.y));
    run.floors[run.currentFloor] = syncFloorOccupancy(currentFloor);

    saveRunState(run);
    set((state) => ({
      run,
      hasSavedRun: true,
      actionLog: withActionLogs(state.actionLog, [
        { category: "system", message: `Run started (seed: ${seed}).` },
        {
          category: "system",
          eventType: "torch_start",
          message: `Torch lit at ${run.player.torch.fuelCurrent.toFixed(1)} fuel (radius ${revealRadius}).`,
        },
      ]),
    }));
  },
  resumeSavedRun: () => {
    const savedRun = loadRunState();
    const bootstrapData = get().bootstrapData;
    if (!savedRun || savedRun.status !== "active") {
      set({ hasSavedRun: false });
      return;
    }
    if (bootstrapData) {
      savedRun.player = clampPlayerVitalsToEffectiveStats(
        savedRun.player,
        new Map(bootstrapData.itemTemplates.map((item) => [item.id, item])),
      );
    }
    const currentFloor = savedRun.floors[savedRun.currentFloor];
    if (currentFloor) {
      const resumeRadius = getTorchRevealRadius(savedRun.player.torch);
      const resumedTiles = revealTilesAroundPosition({
        tiles: currentFloor.tiles,
        width: currentFloor.width,
        height: currentFloor.height,
        center: savedRun.player.position,
        radius: resumeRadius,
      });
      savedRun.discoveredTileKeys = resumedTiles.filter((tile) => tile.explored).map((tile) => makeTileKey(tile.x, tile.y));
      savedRun.floors[savedRun.currentFloor] = syncFloorOccupancy({
        ...currentFloor,
        tiles: resumedTiles,
      });
    }
    set({
      run: savedRun,
      hasSavedRun: true,
      actionLog: withActionLogs(get().actionLog, [{ category: "system", message: "Saved run resumed." }]),
    });
  },
  clearSavedRun: () => {
    clearRunState();
    set((state) => ({
      hasSavedRun: false,
      actionLog: withActionLogs(state.actionLog, [{ category: "system", message: "Saved run cleared." }]),
    }));
  },
  movePlayerByDelta: (deltaX, deltaY) => {
    const run = get().run;
    const bootstrapData = get().bootstrapData;
    if (!run || !bootstrapData || run.status !== "active") {
      return;
    }
    const currentFloor = run.floors[run.currentFloor];
    if (!currentFloor) {
      return;
    }

    const nextFacing = facingFromDelta({ x: deltaX, y: deltaY }, run.player.facing);
    const result = tryMoveByDelta({
      position: run.player.position,
      delta: { x: deltaX, y: deltaY },
      tiles: currentFloor.tiles,
      width: currentFloor.width,
      height: currentFloor.height,
    });
    if (!result.moved) {
      if (nextFacing === run.player.facing) {
        return;
      }
      const turnedRun: RunState = {
        ...run,
        player: {
          ...run.player,
          facing: nextFacing,
        },
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
    const discoveredTileKeys = revealedTiles
      .filter((tile) => tile.explored)
      .map((tile) => makeTileKey(tile.x, tile.y));

    let nextRun: RunState = {
      ...run,
      player: {
        ...run.player,
        position: result.position,
        facing: nextFacing,
      },
      discoveredTileKeys,
      floors: {
        ...run.floors,
        [run.currentFloor]: {
          ...currentFloor,
          tiles: revealedTiles,
        },
      },
    };
    nextRun.floors[nextRun.currentFloor] = syncFloorOccupancy(nextRun.floors[nextRun.currentFloor]);
    const turnResult = updateTurnState(nextRun, bootstrapData);
    nextRun = turnResult.run;

    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [
        { category: "system", message: `Moved to (${nextRun.player.position.x}, ${nextRun.player.position.y}).` },
        ...turnResult.events,
      ]),
    }));
  },
  playerAttack: () => {
    const run = get().run;
    const bootstrapData = get().bootstrapData;
    if (!run || !bootstrapData || run.status !== "active") {
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
    let nextRun = attacked.run;
    nextRun.floors[nextRun.currentFloor] = syncFloorOccupancy(nextRun.floors[nextRun.currentFloor]);
    const turnResult = updateTurnState(nextRun, bootstrapData);
    nextRun = turnResult.run;

    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [{ category: "combat", message: "Attack hit." }, ...turnResult.events]),
    }));
  },
  pickupLoot: () => {
    const run = get().run;
    const bootstrapData = get().bootstrapData;
    if (!run || !bootstrapData || run.status !== "active") {
      return;
    }
    const pickedUp = pickupLootAtPosition({
      run,
      bootstrapData,
      x: run.player.position.x,
      y: run.player.position.y,
    });
    if (!pickedUp.pickedUpAny) {
      set((state) => ({ actionLog: withActionLogs(state.actionLog, [{ category: "loot", message: "No loot to pick up here." }]) }));
      return;
    }

    let nextRun: RunState = pickedUp.run;
    nextRun.floors[nextRun.currentFloor] = syncFloorOccupancy(nextRun.floors[nextRun.currentFloor]);
    const turnResult = updateTurnState(nextRun, bootstrapData);
    nextRun = turnResult.run;

    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [{ category: "loot", message: "Picked up loot." }, ...turnResult.events]),
    }));
  },
  pickupLootFromTile: (x, y) => {
    const run = get().run;
    const bootstrapData = get().bootstrapData;
    if (!run || !bootstrapData || run.status !== "active") {
      return;
    }

    const pickedUp = pickupLootAtPosition({
      run,
      bootstrapData,
      x,
      y,
    });
    if (!pickedUp.pickedUpAny) {
      return;
    }

    let nextRun: RunState = {
      ...pickedUp.run,
      floors: {
        ...pickedUp.run.floors,
        [pickedUp.run.currentFloor]: syncFloorOccupancy(pickedUp.run.floors[pickedUp.run.currentFloor]),
      },
    };
    const turnResult = updateTurnState(nextRun, bootstrapData);
    nextRun = turnResult.run;
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [
        { category: "loot", message: `Picked up loot from (${x}, ${y}).` },
        ...turnResult.events,
      ]),
    }));
  },
  tryExtract: () => {
    const run = get().run;
    const bootstrapData = get().bootstrapData;
    if (!run || !bootstrapData) {
      return;
    }
    const floor = run.floors[run.currentFloor];
    if (!floor) {
      return;
    }
    if (!canExtractAtPosition(floor, run.player.position)) {
      set((state) => ({
        actionLog: withActionLogs(state.actionLog, [{ category: "system", message: "Extraction failed: not on extraction tile." }]),
      }));
      return;
    }

    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
    const methodId =
      floor.tiles.find((tile) => tile.x === run.player.position.x && tile.y === run.player.position.y)?.roomType ===
      "extraction"
        ? "extract_rope_window"
        : "extract_stairwell";

    const summary = buildRunSummary({
      run,
      extracted: true,
      extractionMethodId: methodId,
      itemTemplatesById,
      xpTable: bootstrapData.xpTable,
    });

    const nextRun: RunState = {
      ...run,
      status: "extracted",
      summary,
    };

    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [{ category: "system", message: "Extraction successful." }]),
    }));
  },
  moveInventoryStack: (instanceId, toX, toY) => {
    const run = get().run;
    const bootstrapData = get().bootstrapData;
    if (!run || !bootstrapData || run.status !== "active") {
      return;
    }
    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
    const moved = moveInventoryItemInGrid({
      player: run.player,
      instanceId,
      toX,
      toY,
      itemTemplatesById,
    });
    if (!moved.moved) {
      return;
    }

    const nextRun: RunState = {
      ...run,
      player: clampPlayerVitalsToEffectiveStats(
        moved.player,
        new Map(bootstrapData.itemTemplates.map((item) => [item.id, item])),
      ),
    };
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [{ category: "inventory", message: "Moved inventory stack." }]),
    }));
  },
  dropInventoryStack: (instanceId) => {
    const run = get().run;
    const bootstrapData = get().bootstrapData;
    if (!run || !bootstrapData || run.status !== "active") {
      return;
    }
    const result = dropInventoryItemToGround({
      run,
      instanceId,
    });
    if (!result.dropped) {
      return;
    }
    const nextRun = {
      ...result.run,
      player: clampPlayerVitalsToEffectiveStats(
        result.run.player,
        new Map(bootstrapData.itemTemplates.map((item) => [item.id, item])),
      ),
      floors: {
        ...result.run.floors,
        [result.run.currentFloor]: syncFloorOccupancy(result.run.floors[result.run.currentFloor]),
      },
    };
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [{ category: "inventory", message: "Dropped item to ground." }]),
    }));
  },
  equipInventoryStack: (instanceId, slot) => {
    const run = get().run;
    const bootstrapData = get().bootstrapData;
    if (!run || !bootstrapData || run.status !== "active") {
      return;
    }
    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
    const moved = equipInventoryItem({
      player: run.player,
      instanceId,
      slot,
      itemTemplatesById,
    });
    if (!moved.moved) {
      return;
    }
    const nextRun: RunState = {
      ...run,
      player: clampPlayerVitalsToEffectiveStats(
        moved.player,
        new Map(bootstrapData.itemTemplates.map((item) => [item.id, item])),
      ),
    };
    const equippedItem = nextRun.player.equipment[slot];
    const equippedName =
      equippedItem ? itemTemplatesById.get(equippedItem.itemId)?.name ?? equippedItem.itemId : "item";
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(
        state.actionLog,
        [
          { category: "inventory", message: `Equipped ${equippedName} to ${slot}.` },
          ...buildStatDeltaMessages({ beforeRun: run, afterRun: nextRun, bootstrapData }).map((message) => ({
            category: "inventory" as const,
            message,
          })),
        ],
      ),
    }));
  },
  unequipSlot: (slot) => {
    const run = get().run;
    const bootstrapData = get().bootstrapData;
    if (!run || !bootstrapData || run.status !== "active") {
      return;
    }
    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
    const priorEquipped = run.player.equipment[slot];
    const priorName = priorEquipped ? itemTemplatesById.get(priorEquipped.itemId)?.name ?? priorEquipped.itemId : "item";
    const moved = unequipToInventory({
      player: run.player,
      slot,
      itemTemplatesById,
    });
    if (!moved.moved) {
      return;
    }
    const nextRun: RunState = {
      ...run,
      player: clampPlayerVitalsToEffectiveStats(
        moved.player,
        new Map(bootstrapData.itemTemplates.map((item) => [item.id, item])),
      ),
    };
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(
        state.actionLog,
        [
          { category: "inventory", message: `Unequipped ${priorName} from ${slot}.` },
          ...buildStatDeltaMessages({ beforeRun: run, afterRun: nextRun, bootstrapData }).map((message) => ({
            category: "inventory" as const,
            message,
          })),
        ],
      ),
    }));
  },
  assignTrinketToBelt: (instanceId, beltIndex) => {
    const run = get().run;
    const bootstrapData = get().bootstrapData;
    if (!run || !bootstrapData || run.status !== "active") {
      return;
    }
    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
    const moved = assignInventoryItemToBelt({
      player: run.player,
      instanceId,
      beltIndex,
      itemTemplatesById,
    });
    if (!moved.moved) {
      return;
    }
    const nextRun: RunState = {
      ...run,
      player: clampPlayerVitalsToEffectiveStats(
        moved.player,
        new Map(bootstrapData.itemTemplates.map((item) => [item.id, item])),
      ),
    };
    const trinket = nextRun.player.belt.slots[beltIndex];
    const trinketName = trinket ? itemTemplatesById.get(trinket.itemId)?.name ?? trinket.itemId : "trinket";
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(
        state.actionLog,
        [
          { category: "inventory", message: `Assigned ${trinketName} to belt slot ${beltIndex + 1}.` },
          ...buildStatDeltaMessages({ beforeRun: run, afterRun: nextRun, bootstrapData }).map((message) => ({
            category: "inventory" as const,
            message,
          })),
        ],
      ),
    }));
  },
  removeTrinketFromBelt: (beltIndex) => {
    const run = get().run;
    const bootstrapData = get().bootstrapData;
    if (!run || !bootstrapData || run.status !== "active") {
      return;
    }
    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
    const priorTrinket = run.player.belt.slots[beltIndex];
    const priorTrinketName = priorTrinket
      ? itemTemplatesById.get(priorTrinket.itemId)?.name ?? priorTrinket.itemId
      : "trinket";
    const moved = removeBeltItemToInventory({
      player: run.player,
      beltIndex,
      itemTemplatesById,
    });
    if (!moved.moved) {
      return;
    }
    const nextRun: RunState = {
      ...run,
      player: clampPlayerVitalsToEffectiveStats(
        moved.player,
        new Map(bootstrapData.itemTemplates.map((item) => [item.id, item])),
      ),
    };
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(
        state.actionLog,
        [
          { category: "inventory", message: `Removed ${priorTrinketName} from belt slot ${beltIndex + 1}.` },
          ...buildStatDeltaMessages({ beforeRun: run, afterRun: nextRun, bootstrapData }).map((message) => ({
            category: "inventory" as const,
            message,
          })),
        ],
      ),
    }));
  },
  consumeInventoryStack: (instanceId) => {
    const run = get().run;
    const bootstrapData = get().bootstrapData;
    if (!run || !bootstrapData || run.status !== "active") {
      return;
    }
    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
    const stack = run.player.inventory.items.find(
      (entry) => entry.instanceId === instanceId && entry.position.container === "inventory",
    );
    if (!stack) {
      return;
    }
    const template = itemTemplatesById.get(stack.itemId);
    const restoreAmount = template?.stats?.torchFuelRestore ?? 0;
    if (!template || template.type !== "consumable" || restoreAmount <= 0) {
      return;
    }

    const consumed = consumeInventoryItemStack({
      player: run.player,
      instanceId,
    });
    if (!consumed.consumed) {
      return;
    }

    const restoredTorch = restoreTorchFuel(consumed.player.torch, restoreAmount);
    let nextRun: RunState = {
      ...run,
      player: withUpdatedTorch(consumed.player, restoredTorch),
    };
    const turnResult = updateTurnState(nextRun, bootstrapData);
    nextRun = turnResult.run;

    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [
        {
          category: "inventory",
          eventType: "consume_torch_fuel",
          message: `Used ${template.name}. Torch +${restoreAmount.toFixed(1)} fuel.`,
        },
        ...turnResult.events,
      ]),
    }));
  },
  clearActionLog: () => {
    set({ actionLog: [] });
  },
  restart: () => {
    clearRunState();
    set((state) => ({
      run: null,
      hasSavedRun: false,
      actionLog: withActionLogs(state.actionLog, [{ category: "system", message: "Run reset to menu." }]),
    }));
  },
}));
