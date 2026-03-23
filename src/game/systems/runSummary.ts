import type { ItemTemplate, RunState, RunSummary, XpTable } from "../types";

function totalExtractedLootValue(run: RunState, itemTemplatesById: ReadonlyMap<string, ItemTemplate>): number {
  const floor = run.floors[run.currentFloor];
  if (!floor) {
    return 0;
  }

  const allItems = [
    ...run.player.inventory.items,
    ...run.player.belt.slots.filter(Boolean),
    run.player.equipment.mainHand,
    run.player.equipment.offHand,
    run.player.equipment.helmet,
    run.player.equipment.chest,
    run.player.equipment.legs,
    run.player.equipment.feet,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return allItems.reduce((sum, item) => {
    const template = itemTemplatesById.get(item.itemId);
    if (!template) {
      return sum;
    }
    return sum + template.value * item.quantity;
  }, 0);
}

export function buildRunSummary(params: {
  run: RunState;
  extracted: boolean;
  extractionMethodId: string | null;
  causeOfDeath?: string | null;
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>;
  xpTable: XpTable;
}): RunSummary {
  const { run, extracted, extractionMethodId, causeOfDeath, itemTemplatesById, xpTable } = params;
  const lootExtractedValue = totalExtractedLootValue(run, itemTemplatesById);
  const floorsReached = run.currentFloor;
  const enemiesKilled = run.defeatedEnemyIds.length;
  const roomsDiscovered = run.discoveredTileKeys.length;
  const durationSeconds = Math.floor((Date.now() - run.startedAt) / 1000);

  const baseXp =
    lootExtractedValue * xpTable.runSources.lootValueMultiplier +
    floorsReached * xpTable.runSources.floorReachedFlat +
    enemiesKilled * xpTable.runSources.enemyKillFlat +
    roomsDiscovered * xpTable.runSources.roomDiscoveredFlat;

  const xpEarned = Math.floor(
    extracted ? baseXp * xpTable.runSources.extractMultiplier : baseXp * xpTable.runSources.deathMultiplier,
  );

  return {
    runId: run.runId,
    seed: run.seed,
    floorsReached,
    enemiesKilled,
    bossesKilled: 0,
    roomsDiscovered,
    puzzlesSolved: 0,
    lootExtractedValue,
    extracted,
    extractionMethodId,
    causeOfDeath: causeOfDeath ?? null,
    xpEarned,
    levelUpsGained: 0,
    durationSeconds,
  };
}
