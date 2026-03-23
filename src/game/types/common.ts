export type ID = string;
export type SeedString = string;

export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "relic";

export type ItemType =
  | "weapon"
  | "armor"
  | "trinket"
  | "material"
  | "consumable"
  | "tool"
  | "quest"
  | "relic";

export type EquipSlot =
  | "mainHand"
  | "offHand"
  | "helmet"
  | "chest"
  | "legs"
  | "feet";

export type EnemyRole =
  | "chaser"
  | "tank"
  | "ranged"
  | "support"
  | "summoner"
  | "ambusher"
  | "exploder"
  | "controller"
  | "boss";

export type EnemyTier =
  | "normal"
  | "veteran"
  | "elite"
  | "champion"
  | "boss";

export type RoomType =
  | "entry"
  | "combat"
  | "loot"
  | "puzzle"
  | "special"
  | "extraction"
  | "boss"
  | "stairs"
  | "empty"
  | "blocked";

export type SkillTree = "strength" | "dexterity" | "intelligence" | "survival";

export type SkillKind = "active" | "passive";

export type Direction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "up_left"
  | "up_right"
  | "down_left"
  | "down_right";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Size2D {
  w: number;
  h: number;
}

export interface StatBlock {
  hp: number;
  stamina: number;
  attack: number;
  defense: number;
  speed: number;
  carryWeight: number;
}

export interface RuntimeVitals {
  hpCurrent: number;
  staminaCurrent: number;
}

export interface RangeBand {
  min: number;
  max: number;
}

export const EQUIP_SLOTS: EquipSlot[] = [
  "mainHand",
  "offHand",
  "helmet",
  "chest",
  "legs",
  "feet",
];
