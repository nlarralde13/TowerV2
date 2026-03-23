import type { ItemInstance, ItemTemplate, PlayerState, StatBlock } from "../types";

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

export function computeEffectivePlayerStats(
  player: PlayerState,
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>,
): StatBlock {
  const effective: StatBlock = { ...player.stats };

  for (const item of getLoadoutItems(player)) {
    if (!item) {
      continue;
    }
    const template = itemTemplatesById.get(item.itemId);
    if (!template) {
      continue;
    }
    effective.hp += template.stats?.hpBonus ?? 0;
    effective.attack += weaponAttackBonus(template);
    effective.defense += template.stats?.defense ?? 0;
  }

  return {
    ...effective,
    hp: Math.max(1, effective.hp),
    attack: Math.max(0, effective.attack),
    defense: Math.max(0, effective.defense),
    stamina: Math.max(0, effective.stamina),
    speed: Math.max(0, effective.speed),
    carryWeight: Math.max(0.0001, effective.carryWeight),
  };
}

export function clampPlayerVitalsToEffectiveStats(
  player: PlayerState,
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>,
): PlayerState {
  const effective = computeEffectivePlayerStats(player, itemTemplatesById);
  return {
    ...player,
    vitals: {
      ...player.vitals,
      hpCurrent: Math.max(0, Math.min(player.vitals.hpCurrent, effective.hp)),
      staminaCurrent: Math.max(0, Math.min(player.vitals.staminaCurrent, effective.stamina)),
    },
  };
}
