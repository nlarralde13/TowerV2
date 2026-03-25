import type { StateCreator } from "zustand";
import {
  applyInteractionCost,
  addItemToInventory,
  assignInventoryItemToBelt,
  canPerformInteraction,
  clampPlayerVitalsToEffectiveStats,
  explainTurnEconomyFailure,
  equipInventoryItem,
  syncFloorOccupancy,
} from "@game/systems";
import type { RunState } from "@game/types";
import { withActionLogs } from "../actionLog";
import type { RunBootstrapData, RunStoreState } from "../types";
import { persistRunTransition } from "./persistenceSlice";

export interface LootSlice {
  pickupLoot: () => void;
  pickupLootFromTile: (x: number, y: number) => void;
}

interface PickedLootEntry {
  itemId: string;
  itemName: string;
  quantity: number;
}

function pickupLootAtPosition(params: {
  run: RunState;
  bootstrapData: RunBootstrapData;
  x: number;
  y: number;
}): { run: RunState; pickedUpAny: boolean; pickedItems: PickedLootEntry[] } {
  const { run, bootstrapData, x, y } = params;
  const floor = run.floors[run.currentFloor];
  if (!floor) return { run, pickedUpAny: false, pickedItems: [] };

  const groundItemsHere = floor.groundLoot.filter(
    (loot) => loot.position.container === "ground" && loot.position.x === x && loot.position.y === y,
  );
  if (groundItemsHere.length === 0) return { run, pickedUpAny: false, pickedItems: [] };

  const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
  let player = run.player;
  let remainingGroundLoot = floor.groundLoot;
  let pickedUpAny = false;
  let pickedUpCount = 0;
  const pickedItems: PickedLootEntry[] = [];

  function autoSlotNewlyPickedItems(currentPlayer: RunState["player"], newInstanceIds: string[]): RunState["player"] {
    let nextPlayer = currentPlayer;
    for (const instanceId of newInstanceIds) {
      const instance = nextPlayer.inventory.items.find(
        (entry) => entry.instanceId === instanceId && entry.position.container === "inventory",
      );
      if (!instance) continue;
      const template = itemTemplatesById.get(instance.itemId);
      if (!template) continue;

      if (template.equipSlot && nextPlayer.equipment[template.equipSlot] === null) {
        const equipped = equipInventoryItem({ player: nextPlayer, instanceId, slot: template.equipSlot, itemTemplatesById });
        if (equipped.moved) {
          nextPlayer = equipped.player;
          continue;
        }
      }

      if (template.type === "trinket") {
        const emptyBeltIndex = nextPlayer.belt.slots.findIndex((slot) => slot === null);
        if (emptyBeltIndex >= 0) {
          const assigned = assignInventoryItemToBelt({ player: nextPlayer, instanceId, beltIndex: emptyBeltIndex, itemTemplatesById });
          if (assigned.moved) nextPlayer = assigned.player;
        }
      }
    }
    return nextPlayer;
  }

  for (const groundItem of groundItemsHere) {
    const template = itemTemplatesById.get(groundItem.itemId);
    if (!template) continue;

    const beforeInventoryIds = new Set(player.inventory.items.map((item) => item.instanceId));
    const added = addItemToInventory({ player, item: groundItem, template, itemTemplatesById });
    player = added.player;

    const newInstanceIds = player.inventory.items
      .filter((item) => item.position.container === "inventory" && !beforeInventoryIds.has(item.instanceId))
      .map((item) => item.instanceId);
    player = autoSlotNewlyPickedItems(player, newInstanceIds);
    player = clampPlayerVitalsToEffectiveStats(player, itemTemplatesById);
    if (!added.added) continue;

    pickedUpAny = true;
    const pickedQuantity = Math.max(0, groundItem.quantity - added.remainingQuantity);
    pickedUpCount += pickedQuantity;
    if (pickedQuantity > 0) {
      pickedItems.push({
        itemId: groundItem.itemId,
        itemName: template.name,
        quantity: pickedQuantity,
      });
    }

    if (added.remainingQuantity <= 0) {
      remainingGroundLoot = remainingGroundLoot.filter((entry) => entry.instanceId !== groundItem.instanceId);
    } else {
      remainingGroundLoot = remainingGroundLoot.map((entry) =>
        entry.instanceId === groundItem.instanceId ? { ...entry, quantity: added.remainingQuantity } : entry,
      );
    }
  }

  if (!pickedUpAny) return { run, pickedUpAny: false, pickedItems: [] };

  const nextRun: RunState = {
    ...run,
    player: clampPlayerVitalsToEffectiveStats(player, itemTemplatesById),
    floors: { ...run.floors, [run.currentFloor]: { ...floor, groundLoot: remainingGroundLoot } },
  };
  return { run: nextRun, pickedUpAny: pickedUpCount > 0, pickedItems };
}

export const createLootSlice: StateCreator<RunStoreState & LootSlice, [], [], LootSlice> = (set, get) => ({
  pickupLoot: () => {
    const { run, bootstrapData } = get();
    if (!run || !bootstrapData || run.status !== "active") return;
    const actionGate = canPerformInteraction(run, "loot_pickup");
    if (!actionGate.allowed) {
      const message = explainTurnEconomyFailure(actionGate.reason, "You can only pick up loot during the player phase.");
      set((state) => ({
        actionLog: withActionLogs(state.actionLog, [{ category: "loot", message }]),
      }));
      return;
    }

    const pickedUp = pickupLootAtPosition({ run, bootstrapData, x: run.player.position.x, y: run.player.position.y });
    if (!pickedUp.pickedUpAny) {
      set((state) => ({ actionLog: withActionLogs(state.actionLog, [{ category: "loot", message: "No loot to pick up here." }]) }));
      return;
    }

    let nextRun = applyInteractionCost(pickedUp.run, "loot_pickup");
    nextRun.floors[nextRun.currentFloor] = syncFloorOccupancy(nextRun.floors[nextRun.currentFloor]);

    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(
        state.actionLog,
        pickedUp.pickedItems.length > 0
          ? pickedUp.pickedItems.map((entry) => ({
              category: "loot" as const,
              eventType: "loot_pickup_item",
              message: `Picked up ${entry.quantity}x ${entry.itemName}.`,
              payload: {
                itemId: entry.itemId,
                itemName: entry.itemName,
                quantity: entry.quantity,
              },
            }))
          : [{ category: "loot", message: "Picked up loot." }],
      ),
    }));
  },

  pickupLootFromTile: (x, y) => {
    const { run, bootstrapData } = get();
    if (!run || !bootstrapData || run.status !== "active") return;
    const actionGate = canPerformInteraction(run, "loot_pickup");
    if (!actionGate.allowed) {
      const message = explainTurnEconomyFailure(actionGate.reason, "You can only pick up loot during the player phase.");
      set((state) => ({
        actionLog: withActionLogs(state.actionLog, [{ category: "loot", message }]),
      }));
      return;
    }

    const pickedUp = pickupLootAtPosition({ run, bootstrapData, x, y });
    if (!pickedUp.pickedUpAny) return;

    let nextRun: RunState = {
      ...applyInteractionCost(pickedUp.run, "loot_pickup"),
      floors: {
        ...pickedUp.run.floors,
        [pickedUp.run.currentFloor]: syncFloorOccupancy(pickedUp.run.floors[pickedUp.run.currentFloor]),
      },
    };
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(
        state.actionLog,
        pickedUp.pickedItems.length > 0
          ? pickedUp.pickedItems.map((entry) => ({
              category: "loot" as const,
              eventType: "loot_pickup_item",
              message: `Picked up ${entry.quantity}x ${entry.itemName} from (${x}, ${y}).`,
              payload: {
                itemId: entry.itemId,
                itemName: entry.itemName,
                quantity: entry.quantity,
              },
            }))
          : [{ category: "loot", message: `Picked up loot from (${x}, ${y}).` }],
      ),
    }));
  },
});
