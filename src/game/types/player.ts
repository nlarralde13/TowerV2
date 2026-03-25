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
  // --- Combat resolution stats ---
  hitChance: number;      // Probability to land an attack (0.0–1.0). Base 0.75.
  critChance: number;     // Probability a hit becomes a crit (0.0–1.0). Base 0 + weapon bonus.
  critMultiplier: number; // Damage multiplier on a crit (e.g. 1.5 = 150%). Base 1.5.
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
    hitChance: number;      // Base hit probability (0.0–1.0)
    critMultiplier: number; // Base crit damage multiplier (e.g. 1.5)
    movementFeet: number;
    carryWeight: number;
  };
  equipment: Record<EquipSlot, ID | null>;
  inventory: {
    backpack: Size2D;
    beltSlots: number;
    startingItems?: Array<{
      itemId: ID;
      quantity: number;
    }>;
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
