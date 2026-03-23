import type { FloorState } from "../types";

export function syncFloorOccupancy(floor: FloorState): FloorState {
  const enemyByTile = new Map<string, string>();
  for (const enemy of floor.enemies) {
    if (enemy.state === "dead") {
      continue;
    }
    enemyByTile.set(`${enemy.position.x},${enemy.position.y}`, enemy.instanceId);
  }

  const lootByTile = new Map<string, string[]>();
  for (const loot of floor.groundLoot) {
    if (loot.position.container !== "ground") {
      continue;
    }
    const x = loot.position.x;
    const y = loot.position.y;
    if (typeof x !== "number" || typeof y !== "number") {
      continue;
    }
    const key = `${x},${y}`;
    const existing = lootByTile.get(key) ?? [];
    existing.push(loot.instanceId);
    lootByTile.set(key, existing);
  }

  return {
    ...floor,
    tiles: floor.tiles.map((tile) => {
      const key = `${tile.x},${tile.y}`;
      return {
        ...tile,
        occupiedByEnemyId: enemyByTile.get(key) ?? null,
        occupiedByLootIds: lootByTile.get(key) ?? [],
      };
    }),
  };
}
