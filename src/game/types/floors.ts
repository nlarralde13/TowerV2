import type { ID, RoomType, SeedString } from "./common";
import type { EnemyInstance } from "./enemies";
import type { ItemInstance } from "./items";

export interface FloorRule {
  id: ID;
  floorMin: number;
  floorMax: number;
  map: {
    width: number;
    height: number;
    roomCountMin: number;
    roomCountMax: number;
    puzzleChance: number;
    secretChance: number;
    extractionChance: number;
  };
  spawns: {
    enemyPool: ID[];
    eliteChance: number;
    bossChance: number;
  };
  loot: {
    roomLootTableId: ID;
    chestLootTableId: ID;
  };
  gating: {
    recommendedLevel: number;
    requiredLevel: number;
  };
  xpMultiplier: number;
}

export interface TileState {
  x: number;
  y: number;
  walkable: boolean;
  visible: boolean;
  explored: boolean;
  roomType: RoomType;
  occupiedByEnemyId?: ID | null;
  occupiedByLootIds?: ID[];
  interactableId?: ID | null;
}

export interface FloorState {
  floorNumber: number;
  seed: SeedString;
  width: number;
  height: number;
  tiles: TileState[];
  enemies: EnemyInstance[];
  groundLoot: ItemInstance[];
  extractionNodeIds: ID[];
  discoveredRooms: ID[];
  roomTypeCounts: Partial<Record<RoomType, number>>;
}

export interface RoomTemplate {
  id: ID;
  type: RoomType;
  weight: number;
  tags?: string[];
  allowedFloorMin: number;
  allowedFloorMax: number;
}
