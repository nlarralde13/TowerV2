import type { StateCreator } from "zustand";
import {
  applyInteractionCost,
  assignInventoryItemToBelt,
  canPerformInteraction,
  clampPlayerVitalsToEffectiveStats,
  consumeInventoryItemStack,
  dropInventoryItemToGround,
  equipInventoryItem,
  explainTurnEconomyFailure,
  isConsumableUseAction,
  moveInventoryItemInGrid,
  recomputePlayerStats,
  removeBeltItemToInventory,
  restoreTorchFuel,
  syncFloorOccupancy,
  unequipToInventory,
  withUpdatedTorch,
} from "@game/systems";
import type { EquipSlot, RunState } from "@game/types";
import { withActionLogs } from "../actionLog";
import type { RunBootstrapData, RunStoreState } from "../types";
import { persistRunTransition } from "./persistenceSlice";

export interface InventorySlice {
  moveInventoryStack: (instanceId: string, toX: number, toY: number) => void;
  dropInventoryStack: (instanceId: string) => void;
  equipInventoryStack: (instanceId: string, slot: EquipSlot) => void;
  unequipSlot: (slot: EquipSlot) => void;
  assignTrinketToBelt: (instanceId: string, beltIndex: number) => void;
  removeTrinketFromBelt: (beltIndex: number) => void;
  consumeInventoryStack: (instanceId: string) => void;
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
  if (after.hp !== before.hp) lines.push(`Max HP ${before.hp} -> ${after.hp}`);
  if (after.attack !== before.attack) lines.push(`ATK ${before.attack} -> ${after.attack}`);
  if (after.defense !== before.defense) lines.push(`DEF ${before.defense} -> ${after.defense}`);
  if (after.movementFeet !== before.movementFeet) lines.push(`Movement ${before.movementFeet.toFixed(0)}ft -> ${after.movementFeet.toFixed(0)}ft`);
  if (after.carryWeight !== before.carryWeight) lines.push(`Carry ${before.carryWeight.toFixed(1)} -> ${after.carryWeight.toFixed(1)}`);
  return lines;
}

function statDeltaEntries(beforeRun: RunState, afterRun: RunState, bootstrapData: RunBootstrapData) {
  return buildStatDeltaMessages({ beforeRun, afterRun, bootstrapData }).map((message) => ({
    category: "inventory" as const,
    message,
  }));
}

export const createInventorySlice: StateCreator<RunStoreState & InventorySlice, [], [], InventorySlice> = (set, get) => ({
  moveInventoryStack: (instanceId, toX, toY) => {
    const { run, bootstrapData } = get();
    if (!run || !bootstrapData || run.status !== "active") return;

    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
    const moved = moveInventoryItemInGrid({ player: run.player, instanceId, toX, toY, itemTemplatesById });
    if (!moved.moved) return;

    const nextRun: RunState = { ...run, player: clampPlayerVitalsToEffectiveStats(moved.player, itemTemplatesById) };
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [{ category: "inventory", message: "Moved inventory stack." }]),
    }));
  },

  dropInventoryStack: (instanceId) => {
    const { run, bootstrapData } = get();
    if (!run || !bootstrapData || run.status !== "active") return;

    const result = dropInventoryItemToGround({ run, instanceId });
    if (!result.dropped) return;

    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
    const nextRun = {
      ...result.run,
      player: clampPlayerVitalsToEffectiveStats(result.run.player, itemTemplatesById),
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
    const { run, bootstrapData } = get();
    if (!run || !bootstrapData || run.status !== "active") return;
    const gate = canPerformInteraction(run, "equip");
    if (!gate.allowed) {
      const message = explainTurnEconomyFailure(gate.reason, "You can only equip during the player phase.");
      set((state) => ({
        actionLog: withActionLogs(state.actionLog, [{ category: "inventory", message }]),
      }));
      return;
    }

    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
    const moved = equipInventoryItem({ player: run.player, instanceId, slot, itemTemplatesById });
    if (!moved.moved) return;

    const nextRun: RunState = { ...run, player: clampPlayerVitalsToEffectiveStats(moved.player, itemTemplatesById) };
    const equippedItem = nextRun.player.equipment[slot];
    const equippedName = equippedItem ? itemTemplatesById.get(equippedItem.itemId)?.name ?? equippedItem.itemId : "item";
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [
        { category: "inventory", message: `Equipped ${equippedName} to ${slot}.` },
        ...statDeltaEntries(run, nextRun, bootstrapData),
      ]),
    }));
  },

  unequipSlot: (slot) => {
    const { run, bootstrapData } = get();
    if (!run || !bootstrapData || run.status !== "active") return;
    const gate = canPerformInteraction(run, "unequip");
    if (!gate.allowed) {
      const message = explainTurnEconomyFailure(gate.reason, "You can only unequip during the player phase.");
      set((state) => ({
        actionLog: withActionLogs(state.actionLog, [{ category: "inventory", message }]),
      }));
      return;
    }

    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
    const priorEquipped = run.player.equipment[slot];
    const priorName = priorEquipped ? itemTemplatesById.get(priorEquipped.itemId)?.name ?? priorEquipped.itemId : "item";
    const moved = unequipToInventory({ player: run.player, slot, itemTemplatesById });
    if (!moved.moved) return;

    const nextRun: RunState = { ...run, player: clampPlayerVitalsToEffectiveStats(moved.player, itemTemplatesById) };
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [
        { category: "inventory", message: `Unequipped ${priorName} from ${slot}.` },
        ...statDeltaEntries(run, nextRun, bootstrapData),
      ]),
    }));
  },

  assignTrinketToBelt: (instanceId, beltIndex) => {
    const { run, bootstrapData } = get();
    if (!run || !bootstrapData || run.status !== "active") return;

    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
    const moved = assignInventoryItemToBelt({ player: run.player, instanceId, beltIndex, itemTemplatesById });
    if (!moved.moved) return;

    const nextRun: RunState = { ...run, player: clampPlayerVitalsToEffectiveStats(moved.player, itemTemplatesById) };
    const trinket = nextRun.player.belt.slots[beltIndex];
    const trinketName = trinket ? itemTemplatesById.get(trinket.itemId)?.name ?? trinket.itemId : "trinket";
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [
        { category: "inventory", message: `Assigned ${trinketName} to belt slot ${beltIndex + 1}.` },
        ...statDeltaEntries(run, nextRun, bootstrapData),
      ]),
    }));
  },

  removeTrinketFromBelt: (beltIndex) => {
    const { run, bootstrapData } = get();
    if (!run || !bootstrapData || run.status !== "active") return;

    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
    const priorTrinket = run.player.belt.slots[beltIndex];
    const priorTrinketName = priorTrinket ? itemTemplatesById.get(priorTrinket.itemId)?.name ?? priorTrinket.itemId : "trinket";
    const moved = removeBeltItemToInventory({ player: run.player, beltIndex, itemTemplatesById });
    if (!moved.moved) return;

    const nextRun: RunState = { ...run, player: clampPlayerVitalsToEffectiveStats(moved.player, itemTemplatesById) };
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [
        { category: "inventory", message: `Removed ${priorTrinketName} from belt slot ${beltIndex + 1}.` },
        ...statDeltaEntries(run, nextRun, bootstrapData),
      ]),
    }));
  },

  consumeInventoryStack: (instanceId) => {
    const { run, bootstrapData } = get();
    if (!run || !bootstrapData || run.status !== "active") return;
    const actionGate = canPerformInteraction(run, "consume_item");
    if (!actionGate.allowed) {
      const message = explainTurnEconomyFailure(actionGate.reason, "You can only use consumables during the player phase.");
      set((state) => ({
        actionLog: withActionLogs(state.actionLog, [{ category: "inventory", message }]),
      }));
      return;
    }

    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
    const stack = run.player.inventory.items.find(
      (entry) => entry.instanceId === instanceId && entry.position.container === "inventory",
    );
    if (!stack) return;

    const template = itemTemplatesById.get(stack.itemId);
    if (!template || !isConsumableUseAction(template)) return;
    const torchRestoreAmount = template.stats?.torchFuelRestore ?? 0;
    const hpRestoreAmount = template.stats?.hpRestore ?? 0;
    const hpMissing = Math.max(0, run.player.totalStats.hp - run.player.vitals.hpCurrent);
    const hpRecovered = Math.min(hpMissing, hpRestoreAmount);
    if (torchRestoreAmount <= 0 && hpRecovered <= 0) {
      set((state) => ({
        actionLog: withActionLogs(state.actionLog, [
          { category: "inventory", message: `${template.name} has no effect right now.` },
        ]),
      }));
      return;
    }

    const consumed = consumeInventoryItemStack({ player: run.player, instanceId });
    if (!consumed.consumed) return;

    const restoredTorch = restoreTorchFuel(consumed.player.torch, torchRestoreAmount);
    const nextRun: RunState = applyInteractionCost({
      ...run,
      player: {
        ...withUpdatedTorch(consumed.player, restoredTorch),
        vitals: {
          ...consumed.player.vitals,
          hpCurrent: Math.min(consumed.player.totalStats.hp, consumed.player.vitals.hpCurrent + hpRecovered),
        },
      },
    }, "consume_item");

    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    const effects: string[] = [];
    if (hpRecovered > 0) effects.push(`HP +${hpRecovered.toFixed(0)}`);
    if (torchRestoreAmount > 0) effects.push(`Torch +${torchRestoreAmount.toFixed(1)} fuel`);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [
        { category: "inventory", eventType: "consume_item", message: `Used ${template.name}. ${effects.join(" / ")}.` },
      ]),
    }));
  },
});
