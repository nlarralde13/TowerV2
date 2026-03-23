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
  restart: () => void;
}

function finishRunAsDead(run: RunState, bootstrapData: RunBootstrapData): RunState {
  const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
  const summary = buildRunSummary({
    run,
    extracted: false,
    extractionMethodId: null,
    causeOfDeath: "killed_in_combat",
    itemTemplatesById,
    xpTable: bootstrapData.xpTable,
  });
  return {
    ...run,
    status: "dead",
    summary,
  };
}

function updateTurnState(run: RunState, bootstrapData: RunBootstrapData): RunState {
  const floor = run.floors[run.currentFloor];
  if (!floor || run.status !== "active") {
    return run;
  }

  const enemyTemplatesById = new Map(bootstrapData.enemyTemplates.map((enemy) => [enemy.id, enemy]));
  const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
  const lootTablesById = new Map(bootstrapData.lootTables.map((table) => [table.id, table]));

  const enemyTurn = processEnemyTurn({
    run,
    enemyTemplatesById,
    itemTemplatesById,
  }).run;
  const floorAfterTurn = enemyTurn.floors[enemyTurn.currentFloor];
  if (!floorAfterTurn) {
    return enemyTurn;
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
    return finishRunAsDead(
      {
        ...syncedRun,
        status: "dead",
      },
      bootstrapData,
    );
  }

  return syncedRun;
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
  return { run: nextRun, pickedUpAny: true };
}

export const useRunStore = create<RunStoreState>((set, get) => ({
  run: null,
  profile: null,
  hasSavedRun: false,
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
    const revealedTiles = revealTilesAroundPosition({
      tiles: currentFloor.tiles,
      width: currentFloor.width,
      height: currentFloor.height,
      center: run.player.position,
      radius: 5,
    });
    currentFloor.tiles = revealedTiles;
    run.discoveredTileKeys = revealedTiles.filter((tile) => tile.explored).map((tile) => makeTileKey(tile.x, tile.y));
    run.floors[run.currentFloor] = syncFloorOccupancy(currentFloor);

    saveRunState(run);
    set({ run, hasSavedRun: true });
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
      savedRun.floors[savedRun.currentFloor] = syncFloorOccupancy(currentFloor);
    }
    set({
      run: savedRun,
      hasSavedRun: true,
    });
  },
  clearSavedRun: () => {
    clearRunState();
    set({ hasSavedRun: false });
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
      set({ run: turnedRun, hasSavedRun: persisted.hasSavedRun, profile: persisted.profile });
      return;
    }

    const revealedTiles = revealTilesAroundPosition({
      tiles: currentFloor.tiles,
      width: currentFloor.width,
      height: currentFloor.height,
      center: result.position,
      radius: 5,
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
    nextRun = updateTurnState(nextRun, bootstrapData);

    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set({ run: nextRun, hasSavedRun: persisted.hasSavedRun, profile: persisted.profile });
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
      return;
    }
    let nextRun = attacked.run;
    nextRun.floors[nextRun.currentFloor] = syncFloorOccupancy(nextRun.floors[nextRun.currentFloor]);
    nextRun = updateTurnState(nextRun, bootstrapData);

    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set({ run: nextRun, hasSavedRun: persisted.hasSavedRun, profile: persisted.profile });
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
      return;
    }

    let nextRun: RunState = pickedUp.run;
    nextRun.floors[nextRun.currentFloor] = syncFloorOccupancy(nextRun.floors[nextRun.currentFloor]);
    nextRun = updateTurnState(nextRun, bootstrapData);

    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set({ run: nextRun, hasSavedRun: persisted.hasSavedRun, profile: persisted.profile });
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
    nextRun = updateTurnState(nextRun, bootstrapData);
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set({ run: nextRun, hasSavedRun: persisted.hasSavedRun, profile: persisted.profile });
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
    set({ run: nextRun, hasSavedRun: persisted.hasSavedRun, profile: persisted.profile });
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
    set({ run: nextRun, hasSavedRun: persisted.hasSavedRun, profile: persisted.profile });
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
    set({ run: nextRun, hasSavedRun: persisted.hasSavedRun, profile: persisted.profile });
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
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set({ run: nextRun, hasSavedRun: persisted.hasSavedRun, profile: persisted.profile });
  },
  unequipSlot: (slot) => {
    const run = get().run;
    const bootstrapData = get().bootstrapData;
    if (!run || !bootstrapData || run.status !== "active") {
      return;
    }
    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
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
    set({ run: nextRun, hasSavedRun: persisted.hasSavedRun, profile: persisted.profile });
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
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set({ run: nextRun, hasSavedRun: persisted.hasSavedRun, profile: persisted.profile });
  },
  removeTrinketFromBelt: (beltIndex) => {
    const run = get().run;
    const bootstrapData = get().bootstrapData;
    if (!run || !bootstrapData || run.status !== "active") {
      return;
    }
    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
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
    set({ run: nextRun, hasSavedRun: persisted.hasSavedRun, profile: persisted.profile });
  },
  restart: () => {
    clearRunState();
    set({ run: null, hasSavedRun: false });
  },
}));
