import type { EnemyInstance, EnemyTemplate, FloorRule, TileState } from "../types";
import { createSeededRng } from "../utils";
import { tileIndex } from "../world";

function buildSpawnableTileIndexes(tiles: TileState[], width: number): number[] {
  const indexes: number[] = [];
  for (const tile of tiles) {
    if (!tile.walkable) {
      continue;
    }
    if (tile.roomType === "entry" || tile.roomType === "stairs" || tile.roomType === "extraction") {
      continue;
    }
    indexes.push(tileIndex(tile.x, tile.y, width));
  }
  return indexes;
}

export function spawnEnemiesForFloor(params: {
  runSeed: string;
  floorNumber: number;
  floorRule: FloorRule;
  floorWidth: number;
  tiles: TileState[];
  enemyTemplatesById: ReadonlyMap<string, EnemyTemplate>;
}): EnemyInstance[] {
  const { runSeed, floorNumber, floorRule, floorWidth, tiles, enemyTemplatesById } = params;
  const rng = createSeededRng(`${runSeed}:floor:${floorNumber}:spawns`);
  const candidates = buildSpawnableTileIndexes(tiles, floorWidth);
  const spawnMin = Math.max(2, Math.floor(floorRule.map.roomCountMin * 0.5));
  const spawnMax = Math.max(spawnMin, floorRule.map.roomCountMin);
  const spawnCount = Math.min(candidates.length, rng.nextInt(spawnMin, spawnMax));

  const enemies: EnemyInstance[] = [];
  const availableIndexes = [...candidates];

  for (let i = 0; i < spawnCount; i += 1) {
    if (availableIndexes.length === 0) {
      break;
    }
    const templateId = rng.pick(floorRule.spawns.enemyPool);
    const template = enemyTemplatesById.get(templateId);
    if (!template) {
      continue;
    }

    const pickedListIndex = rng.nextInt(0, availableIndexes.length - 1);
    const pickedTileIndex = availableIndexes[pickedListIndex];
    availableIndexes.splice(pickedListIndex, 1);

    const spawnTile = tiles[pickedTileIndex];
    enemies.push({
      instanceId: `enemy_${floorNumber}_${i}_${template.id}`,
      enemyId: template.id,
      floor: floorNumber,
      position: { x: spawnTile.x, y: spawnTile.y },
      spawnAnchor: { x: spawnTile.x, y: spawnTile.y },
      hpCurrent: template.stats.hp,
      state: "idle",
      aggroTargetId: null,
      modifiers: [],
      lootResolved: false,
    });
  }

  return enemies;
}
