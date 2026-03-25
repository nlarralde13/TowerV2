import type { EquipSlot, ID, ItemType, Rarity, Size2D } from "./common";

export interface ItemTemplate {
  id: ID;
  name: string;
  type: ItemType;
  subtype?: string;
  rarity: Rarity;
  value: number;
  weight: number;
  gridSize: Size2D;
  stackSize: number;
  equipSlot?: EquipSlot;
  flavorText?: string;
  stats?: {
    hpRestore?: number;
    hpBonus?: number;
    attackBonus?: number;
    defenseBonus?: number;
    speedBonus?: number;
    carryWeightBonus?: number;
    damageMin?: number;
    damageMax?: number;
    attackSpeed?: number;
    critChance?: number;
    defense?: number;
    resistance?: number;
    torchFuelRestore?: number;
  };
  requirements?: {
    level?: number;
  };
  tags?: string[];
  render: {
    icon: string;
  };
}

export interface LootTableEntry {
  itemId: ID;
  weight: number;
  minQty: number;
  maxQty: number;
}

export interface LootTable {
  id: ID;
  rolls: number;
  entries: LootTableEntry[];
}

export interface ItemInstance {
  instanceId: ID;
  itemId: ID;
  quantity: number;
  durability?: number;
  rarityOverride?: Rarity | null;
  position: {
    container: "inventory" | "belt" | "equipment" | "ground";
    x?: number;
    y?: number;
    slot?: EquipSlot | number;
  };
}
