import type { ItemInstance, ItemTemplate, PlayerStatSet, PlayerState } from "../types";

function emptyStatSet(): PlayerStatSet {
  return {
    str: 0,
    dex: 0,
    vit: 0,
    int: 0,
    lck: 0,
    hp: 0,
    stamina: 0,
    attack: 0,
    defense: 0,
    critChance: 0,
    dodgeChance: 0,
    hpRegen: 0,
    staminaRegen: 0,
    moveSpeed: 0,
    magicFind: 0,
    armor: 0,
    carryWeight: 0,
  };
}

function addStatSets(a: PlayerStatSet, b: PlayerStatSet): PlayerStatSet {
  return {
    str: a.str + b.str,
    dex: a.dex + b.dex,
    vit: a.vit + b.vit,
    int: a.int + b.int,
    lck: a.lck + b.lck,
    hp: a.hp + b.hp,
    stamina: a.stamina + b.stamina,
    attack: a.attack + b.attack,
    defense: a.defense + b.defense,
    critChance: a.critChance + b.critChance,
    dodgeChance: a.dodgeChance + b.dodgeChance,
    hpRegen: a.hpRegen + b.hpRegen,
    staminaRegen: a.staminaRegen + b.staminaRegen,
    moveSpeed: a.moveSpeed + b.moveSpeed,
    magicFind: a.magicFind + b.magicFind,
    armor: a.armor + b.armor,
    carryWeight: a.carryWeight + b.carryWeight,
  };
}

function clampTotalStats(stats: PlayerStatSet): PlayerStatSet {
  return {
    ...stats,
    hp: Math.max(1, stats.hp),
    stamina: Math.max(0, stats.stamina),
    attack: Math.max(0, stats.attack),
    defense: Math.max(0, stats.defense),
    critChance: Math.max(0, stats.critChance),
    dodgeChance: Math.max(0, stats.dodgeChance),
    hpRegen: Math.max(0, stats.hpRegen),
    staminaRegen: Math.max(0, stats.staminaRegen),
    moveSpeed: Math.max(0, stats.moveSpeed),
    magicFind: Math.max(0, stats.magicFind),
    armor: Math.max(0, stats.armor),
    carryWeight: Math.max(0.0001, stats.carryWeight),
  };
}

function toLegacyStatBlock(totalStats: PlayerStatSet): PlayerState["stats"] {
  return {
    hp: totalStats.hp,
    stamina: totalStats.stamina,
    attack: totalStats.attack,
    defense: totalStats.defense,
    speed: totalStats.moveSpeed,
    carryWeight: totalStats.carryWeight,
  };
}

function getLoadoutItems(player: PlayerState): Array<ItemInstance | null> {
  return [
    player.equipment.mainHand,
    player.equipment.offHand,
    player.equipment.helmet,
    player.equipment.chest,
    player.equipment.legs,
    player.equipment.feet,
    ...player.belt.slots,
  ];
}

function weaponAttackBonus(template: ItemTemplate): number {
  const min = template.stats?.damageMin ?? 0;
  const max = template.stats?.damageMax ?? 0;
  if (min <= 0 && max <= 0) {
    return 0;
  }
  return Math.max(0, Math.floor((min + max) / 2));
}

function itemToStatSet(template: ItemTemplate): PlayerStatSet {
  return {
    ...emptyStatSet(),
    hp: template.stats?.hpBonus ?? 0,
    attack: (template.stats?.attackBonus ?? 0) + weaponAttackBonus(template),
    defense: (template.stats?.defenseBonus ?? 0) + (template.stats?.defense ?? 0),
    critChance: template.stats?.critChance ?? 0,
    moveSpeed: template.stats?.speedBonus ?? 0,
    armor: template.stats?.defense ?? 0,
    carryWeight: template.stats?.carryWeightBonus ?? 0,
  };
}

export function buildEquipmentStats(
  player: PlayerState,
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>,
): PlayerStatSet {
  return getLoadoutItems(player).reduce<PlayerStatSet>((total, item) => {
    if (!item) {
      return total;
    }
    const template = itemTemplatesById.get(item.itemId);
    if (!template) {
      return total;
    }
    return addStatSets(total, itemToStatSet(template));
  }, emptyStatSet());
}

export function computeTotalStats(player: PlayerState, equipmentStats: PlayerStatSet): PlayerStatSet {
  return clampTotalStats(addStatSets(addStatSets(player.baseStats, equipmentStats), player.buffStats));
}

export function recomputePlayerStats(
  player: PlayerState,
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>,
): PlayerState {
  const equipmentStats = buildEquipmentStats(player, itemTemplatesById);
  const totalStats = computeTotalStats(player, equipmentStats);
  return {
    ...player,
    equipmentStats,
    totalStats,
    stats: toLegacyStatBlock(totalStats),
  };
}

export function clampPlayerVitalsToEffectiveStats(
  player: PlayerState,
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>,
): PlayerState {
  const withStats = recomputePlayerStats(player, itemTemplatesById);
  return {
    ...withStats,
    vitals: {
      ...withStats.vitals,
      hpCurrent: Math.max(0, Math.min(withStats.vitals.hpCurrent, withStats.totalStats.hp)),
      staminaCurrent: Math.max(0, Math.min(withStats.vitals.staminaCurrent, withStats.totalStats.stamina)),
    },
  };
}
