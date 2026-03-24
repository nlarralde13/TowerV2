import type { EquipSlot, ID, SeedString, StatBlock, Vec2 } from "./common";
import type { ItemInstance } from "./items";

export interface ProfileSave {
  profileVersion: number;
  player: {
    level: number;
    xp: number;
    stats: StatBlock;
  };
  unlocks: {
    skills: ID[];
    recipes: ID[];
  };
}

export interface RunSave {
  runVersion: number;
  seed: SeedString;
  floor: number;
  player: {
    hp: number;
    stamina: number;
    torchFuel: number;
    position: Vec2;
  };
  inventory: ItemInstance[];
  equipped: Partial<Record<EquipSlot, ItemInstance | null>>;
  exploredTiles: string[];
  groundLoot: ItemInstance[];
  defeatedEnemies: ID[];
  extractionState: {
    availableNodeIds: ID[];
  };
}
