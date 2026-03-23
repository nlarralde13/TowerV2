import type { EnemyTemplate, FloorState, ItemInstance, LootTable, RunState } from "../types";
import { createSeededRng } from "../utils";

interface LootEntryPick {
  itemId: string;
  weight: number;
  minQty: number;
  maxQty: number;
}

function rollLootEntry(entries: LootEntryPick[], seed: string): LootEntryPick | null {
  if (entries.length === 0) {
    return null;
  }
  const rng = createSeededRng(seed);
  return rng.weightedPick(entries);
}

function makeGroundItem(params: {
  enemyInstanceId: string;
  itemId: string;
  quantity: number;
  x: number;
  y: number;
  index: number;
}): ItemInstance {
  const { enemyInstanceId, itemId, quantity, x, y, index } = params;
  return {
    instanceId: `loot_${enemyInstanceId}_${index}`,
    itemId,
    quantity,
    position: {
      container: "ground",
      x,
      y,
    },
  };
}

export function resolveEnemyDeathLoot(params: {
  run: RunState;
  floor: FloorState;
  enemyTemplatesById: ReadonlyMap<string, EnemyTemplate>;
  lootTablesById: ReadonlyMap<string, LootTable>;
}): RunState {
  const { run, floor, enemyTemplatesById, lootTablesById } = params;

  const addedLoot: ItemInstance[] = [];
  const updatedEnemies = floor.enemies.map((enemy) => {
    if (enemy.state !== "dead" || enemy.lootResolved) {
      return enemy;
    }

    const template = enemyTemplatesById.get(enemy.enemyId);
    if (!template) {
      return {
        ...enemy,
        lootResolved: true,
      };
    }
    const table = lootTablesById.get(template.drops.lootTableId);
    if (!table) {
      return {
        ...enemy,
        lootResolved: true,
      };
    }

    for (let roll = 0; roll < table.rolls; roll += 1) {
      const entry = rollLootEntry(table.entries, `${run.seed}:${enemy.instanceId}:loot:${roll}`);
      if (!entry) {
        continue;
      }
      const rng = createSeededRng(`${run.seed}:${enemy.instanceId}:qty:${roll}`);
      const quantity = rng.nextInt(entry.minQty, entry.maxQty);
      addedLoot.push(
        makeGroundItem({
          enemyInstanceId: enemy.instanceId,
          itemId: entry.itemId,
          quantity,
          x: enemy.position.x,
          y: enemy.position.y,
          index: roll,
        }),
      );
    }

    return {
      ...enemy,
      lootResolved: true,
    };
  });

  if (addedLoot.length === 0) {
    return {
      ...run,
      floors: {
        ...run.floors,
        [run.currentFloor]: {
          ...floor,
          enemies: updatedEnemies,
        },
      },
    };
  }

  return {
    ...run,
    floors: {
      ...run.floors,
      [run.currentFloor]: {
        ...floor,
        enemies: updatedEnemies,
        groundLoot: [...floor.groundLoot, ...addedLoot],
      },
    },
  };
}
