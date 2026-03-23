import type { Direction, EquipSlot, ID, RuntimeVitals, Size2D, StatBlock, Vec2 } from "./common";
import type { ItemInstance } from "./items";

export interface PlayerDefaults {
  baseStats: {
    level: number;
    xp: number;
    hp: number;
    stamina: number;
    attack: number;
    defense: number;
    speed: number;
    carryWeight: number;
  };
  equipment: Record<EquipSlot, ID | null>;
  inventory: {
    backpack: Size2D;
    beltSlots: number;
  };
  unlockedSkills: ID[];
  unlockedRecipes: ID[];
}

export interface InventoryGrid {
  width: number;
  height: number;
  items: ItemInstance[];
}

export interface EquipmentState {
  mainHand: ItemInstance | null;
  offHand: ItemInstance | null;
  helmet: ItemInstance | null;
  chest: ItemInstance | null;
  legs: ItemInstance | null;
  feet: ItemInstance | null;
}

export interface BeltState {
  slots: Array<ItemInstance | null>;
}

export interface PlayerState {
  id: ID;
  name: string;
  level: number;
  xp: number;
  unspentStatPoints: number;
  unspentSkillPoints: number;
  stats: StatBlock;
  vitals: RuntimeVitals;
  position: Vec2;
  facing: Direction;
  inventory: InventoryGrid;
  equipment: EquipmentState;
  belt: BeltState;
  unlockedSkillIds: ID[];
  activeSkillIds: ID[];
  statusEffects: string[];
}
