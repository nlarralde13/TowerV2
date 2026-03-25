import type { EquipSlot, ID, SeedString, Vec2 } from "./common";
import type { ItemInstance } from "./items";
import type { RunTurnState } from "./run";

export interface ProfileSave {
  profileVersion: number;
  player: {
    level: number;
    xp: number;
    stats: { hp: number; stamina: number; attack: number; defense: number; speed: number; carryWeight: number };
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
  turnState?: RunTurnState;
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
