import type { Direction, EquipSlot, ID, RuntimeVitals, Size2D, Vec2 } from "./common";
import type { ItemInstance } from "./items";

export interface PlayerStatSet {
  str: number;
  dex: number;
  vit: number;
  int: number;
  lck: number;
  hp: number;
  stamina: number;
  attack: number;
  defense: number;
  critChance: number;
  dodgeChance: number;
  hpRegen: number;
  staminaRegen: number;
  movementFeet: number;
  magicFind: number;
  armor: number;
  carryWeight: number;
}

export interface PlayerDefaults {
  baseStats: {
    level: number;
    xp: number;
    hp: number;
    stamina: number;
    attack: number;
    defense: number;
    movementFeet: number;
    carryWeight: number;
  };
  equipment: Record<EquipSlot, ID | null>;
  inventory: {
    backpack: Size2D;
    beltSlots: number;
  };
  torch: TorchConfig;
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

export interface TorchConfig {
  fuelMax: number;
  fuelDrainPerTurn: number;
  highFuelThreshold: number;
  lowFuelThreshold: number;
  revealRadiusHigh: number;
  revealRadiusMedium: number;
  revealRadiusLow: number;
}

export interface TorchState extends TorchConfig {
  fuelCurrent: number;
}

export interface PlayerState {
  id: ID;
  name: string;
  title: string;
  level: number;
  xp: number;
  gold: number;
  unspentStatPoints: number;
  unspentSkillPoints: number;
  baseStats: PlayerStatSet;
  equipmentStats: PlayerStatSet;
  buffStats: PlayerStatSet;
  totalStats: PlayerStatSet;
  vitals: RuntimeVitals;
  position: Vec2;
  facing: Direction;
  inventory: InventoryGrid;
  equipment: EquipmentState;
  belt: BeltState;
  torch: TorchState;
  unlockedSkillIds: ID[];
  activeSkillIds: ID[];
  statusEffects: string[];
}
