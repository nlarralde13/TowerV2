import type {
  EnemyTemplate,
  ExtractionRule,
  FloorRule,
  ItemTemplate,
  LootTable,
  PlayerDefaults,
  RoomTemplate,
  SkillTemplate,
  XpTable,
} from "../types";
import { EQUIP_SLOTS } from "../types";
import { DataValidationError } from "./errors";
import {
  assertReferenceExists,
  assertUniqueIds,
  expectArray,
  expectBoolean,
  expectNumber,
  expectOptionalString,
  expectRecord,
  expectString,
  expectStringArray,
} from "./validation";

type EnumSet = ReadonlySet<string>;

const RARITIES: EnumSet = new Set(["common", "uncommon", "rare", "epic", "legendary", "relic"]);
const ITEM_TYPES: EnumSet = new Set(["weapon", "armor", "trinket", "material", "consumable", "tool", "quest", "relic"]);
const ENEMY_ROLES: EnumSet = new Set([
  "chaser",
  "tank",
  "ranged",
  "support",
  "summoner",
  "ambusher",
  "exploder",
  "controller",
  "boss",
]);
const ENEMY_TIERS: EnumSet = new Set(["normal", "veteran", "elite", "champion", "boss"]);
const ROOM_TYPES: EnumSet = new Set([
  "entry",
  "combat",
  "loot",
  "puzzle",
  "special",
  "extraction",
  "boss",
  "stairs",
  "empty",
  "blocked",
]);
const SKILL_TREES: EnumSet = new Set(["strength", "dexterity", "intelligence", "survival"]);
const SKILL_KINDS: EnumSet = new Set(["active", "passive"]);
const SKILL_EFFECTS: EnumSet = new Set(["damage", "heal", "stun", "dash", "buff"]);
const SKILL_SHAPES: EnumSet = new Set(["self", "line", "cone", "area"]);

function expectEnum(value: unknown, path: string, allowed: EnumSet): string {
  const parsed = expectString(value, path);
  if (!allowed.has(parsed)) {
    throw new DataValidationError(`Invalid value "${parsed}" at ${path}`);
  }
  return parsed;
}

export interface GameDataTemplates {
  enemies: EnemyTemplate[];
  items: ItemTemplate[];
  lootTables: LootTable[];
  floorRules: FloorRule[];
  xpTable: XpTable;
  extractionRules: ExtractionRule[];
  skills: SkillTemplate[];
  playerDefaults: PlayerDefaults;
  rooms?: RoomTemplate[];
}

export function validateEnemiesJson(input: unknown): EnemyTemplate[] {
  const rows = expectArray(input, "enemies");
  const parsed = rows.map((entry, index) => {
    const row = expectRecord(entry, `enemies[${index}]`);
    const stats = expectRecord(row.stats, `enemies[${index}].stats`);
    const behavior = expectRecord(row.behavior, `enemies[${index}].behavior`);
    const drops = expectRecord(row.drops, `enemies[${index}].drops`);
    const xp = expectRecord(row.xp, `enemies[${index}].xp`);
    const render = expectRecord(row.render, `enemies[${index}].render`);

    return {
      id: expectString(row.id, `enemies[${index}].id`),
      name: expectString(row.name, `enemies[${index}].name`),
      role: expectEnum(row.role, `enemies[${index}].role`, ENEMY_ROLES) as EnemyTemplate["role"],
      tier: expectEnum(row.tier, `enemies[${index}].tier`, ENEMY_TIERS) as EnemyTemplate["tier"],
      floorMin: expectNumber(row.floorMin, `enemies[${index}].floorMin`, { integer: true, min: 1 }),
      floorMax: expectNumber(row.floorMax, `enemies[${index}].floorMax`, { integer: true, min: 1 }),
      stats: {
        hp: expectNumber(stats.hp, `enemies[${index}].stats.hp`, { min: 1 }),
        damage: expectNumber(stats.damage, `enemies[${index}].stats.damage`, { min: 0 }),
        speed: expectNumber(stats.speed, `enemies[${index}].stats.speed`, { min: 0 }),
        attackSpeed: expectNumber(stats.attackSpeed, `enemies[${index}].stats.attackSpeed`, { min: 0 }),
        attackRange: expectNumber(stats.attackRange, `enemies[${index}].stats.attackRange`, { min: 0 }),
        aggroRange: expectNumber(stats.aggroRange, `enemies[${index}].stats.aggroRange`, { min: 0 }),
        poise: expectNumber(stats.poise, `enemies[${index}].stats.poise`, { min: 0 }),
      },
      behavior: {
        aiType: expectString(behavior.aiType, `enemies[${index}].behavior.aiType`),
        canRetreat: expectBoolean(behavior.canRetreat, `enemies[${index}].behavior.canRetreat`),
        canStrafe: expectBoolean(behavior.canStrafe, `enemies[${index}].behavior.canStrafe`),
      },
      drops: {
        lootTableId: expectString(drops.lootTableId, `enemies[${index}].drops.lootTableId`),
      },
      xp: {
        kill: expectNumber(xp.kill, `enemies[${index}].xp.kill`, { integer: true, min: 0 }),
      },
      render: {
        sprite: expectString(render.sprite, `enemies[${index}].render.sprite`),
        scale: expectNumber(render.scale, `enemies[${index}].render.scale`, { min: 0 }),
      },
    } satisfies EnemyTemplate;
  });

  for (const enemy of parsed) {
    if (enemy.floorMin > enemy.floorMax) {
      throw new DataValidationError(`Enemy "${enemy.id}" has floorMin > floorMax`);
    }
  }

  assertUniqueIds(parsed, "enemies");
  return parsed;
}

export function validateItemsJson(input: unknown): ItemTemplate[] {
  const rows = expectArray(input, "items");
  const parsed = rows.map((entry, index) => {
    const row = expectRecord(entry, `items[${index}]`);
    const gridSize = expectRecord(row.gridSize, `items[${index}].gridSize`);
    const stats = typeof row.stats === "undefined" ? undefined : expectRecord(row.stats, `items[${index}].stats`);
    const requirements =
      typeof row.requirements === "undefined"
        ? undefined
        : expectRecord(row.requirements, `items[${index}].requirements`);
    const render = expectRecord(row.render, `items[${index}].render`);

    const item: ItemTemplate = {
      id: expectString(row.id, `items[${index}].id`),
      name: expectString(row.name, `items[${index}].name`),
      type: expectEnum(row.type, `items[${index}].type`, ITEM_TYPES) as ItemTemplate["type"],
      subtype: expectOptionalString(row.subtype, `items[${index}].subtype`),
      rarity: expectEnum(row.rarity, `items[${index}].rarity`, RARITIES) as ItemTemplate["rarity"],
      value: expectNumber(row.value, `items[${index}].value`, { min: 0 }),
      weight: expectNumber(row.weight, `items[${index}].weight`, { min: 0 }),
      gridSize: {
        w: expectNumber(gridSize.w, `items[${index}].gridSize.w`, { integer: true, min: 1 }),
        h: expectNumber(gridSize.h, `items[${index}].gridSize.h`, { integer: true, min: 1 }),
      },
      stackSize: expectNumber(row.stackSize, `items[${index}].stackSize`, { integer: true, min: 1 }),
      flavorText: expectOptionalString(row.flavorText, `items[${index}].flavorText`),
      render: {
        icon: expectString(render.icon, `items[${index}].render.icon`),
      },
    };

    if (typeof row.equipSlot !== "undefined") {
      const equipSlot = expectString(row.equipSlot, `items[${index}].equipSlot`);
      if (!EQUIP_SLOTS.includes(equipSlot as (typeof EQUIP_SLOTS)[number])) {
        throw new DataValidationError(`Invalid equipSlot "${equipSlot}" at items[${index}].equipSlot`);
      }
      item.equipSlot = equipSlot as ItemTemplate["equipSlot"];
    }

    if (stats) {
      item.stats = {
        hpBonus:
          typeof stats.hpBonus === "undefined"
            ? undefined
            : expectNumber(stats.hpBonus, `items[${index}].stats.hpBonus`),
        attackBonus:
          typeof stats.attackBonus === "undefined"
            ? undefined
            : expectNumber(stats.attackBonus, `items[${index}].stats.attackBonus`),
        defenseBonus:
          typeof stats.defenseBonus === "undefined"
            ? undefined
            : expectNumber(stats.defenseBonus, `items[${index}].stats.defenseBonus`),
        speedBonus:
          typeof stats.speedBonus === "undefined"
            ? undefined
            : expectNumber(stats.speedBonus, `items[${index}].stats.speedBonus`),
        carryWeightBonus:
          typeof stats.carryWeightBonus === "undefined"
            ? undefined
            : expectNumber(stats.carryWeightBonus, `items[${index}].stats.carryWeightBonus`),
        damageMin:
          typeof stats.damageMin === "undefined"
            ? undefined
            : expectNumber(stats.damageMin, `items[${index}].stats.damageMin`),
        damageMax:
          typeof stats.damageMax === "undefined"
            ? undefined
            : expectNumber(stats.damageMax, `items[${index}].stats.damageMax`),
        attackSpeed:
          typeof stats.attackSpeed === "undefined"
            ? undefined
            : expectNumber(stats.attackSpeed, `items[${index}].stats.attackSpeed`),
        critChance:
          typeof stats.critChance === "undefined"
            ? undefined
            : expectNumber(stats.critChance, `items[${index}].stats.critChance`),
        defense:
          typeof stats.defense === "undefined"
            ? undefined
            : expectNumber(stats.defense, `items[${index}].stats.defense`),
        resistance:
          typeof stats.resistance === "undefined"
            ? undefined
            : expectNumber(stats.resistance, `items[${index}].stats.resistance`),
        torchFuelRestore:
          typeof stats.torchFuelRestore === "undefined"
            ? undefined
            : expectNumber(stats.torchFuelRestore, `items[${index}].stats.torchFuelRestore`, { min: 0 }),
      };
    }

    if (requirements) {
      item.requirements = {
        level:
          typeof requirements.level === "undefined"
            ? undefined
            : expectNumber(requirements.level, `items[${index}].requirements.level`, { integer: true, min: 1 }),
      };
    }

    if (typeof row.tags !== "undefined") {
      item.tags = expectStringArray(row.tags, `items[${index}].tags`);
    }

    return item;
  });

  assertUniqueIds(parsed, "items");
  return parsed;
}

export function validateLootTablesJson(input: unknown): LootTable[] {
  const rows = expectArray(input, "lootTables");
  const parsed = rows.map((entry, index) => {
    const row = expectRecord(entry, `lootTables[${index}]`);
    const entries = expectArray(row.entries, `lootTables[${index}].entries`).map((item, entryIndex) => {
      const parsedEntry = expectRecord(item, `lootTables[${index}].entries[${entryIndex}]`);
      const minQty = expectNumber(
        parsedEntry.minQty,
        `lootTables[${index}].entries[${entryIndex}].minQty`,
        { integer: true, min: 1 },
      );
      const maxQty = expectNumber(
        parsedEntry.maxQty,
        `lootTables[${index}].entries[${entryIndex}].maxQty`,
        { integer: true, min: 1 },
      );
      if (minQty > maxQty) {
        throw new DataValidationError(
          `lootTables[${index}].entries[${entryIndex}] has minQty > maxQty`,
        );
      }

      return {
        itemId: expectString(parsedEntry.itemId, `lootTables[${index}].entries[${entryIndex}].itemId`),
        weight: expectNumber(parsedEntry.weight, `lootTables[${index}].entries[${entryIndex}].weight`, {
          min: 0.000001,
        }),
        minQty,
        maxQty,
      };
    });

    return {
      id: expectString(row.id, `lootTables[${index}].id`),
      rolls: expectNumber(row.rolls, `lootTables[${index}].rolls`, { integer: true, min: 1 }),
      entries,
    } satisfies LootTable;
  });

  assertUniqueIds(parsed, "lootTables");
  return parsed;
}

export function validateFloorRulesJson(input: unknown): FloorRule[] {
  const rows = expectArray(input, "floorRules");
  const parsed = rows.map((entry, index) => {
    const row = expectRecord(entry, `floorRules[${index}]`);
    const map = expectRecord(row.map, `floorRules[${index}].map`);
    const spawns = expectRecord(row.spawns, `floorRules[${index}].spawns`);
    const loot = expectRecord(row.loot, `floorRules[${index}].loot`);
    const gating = expectRecord(row.gating, `floorRules[${index}].gating`);

    return {
      id: expectString(row.id, `floorRules[${index}].id`),
      floorMin: expectNumber(row.floorMin, `floorRules[${index}].floorMin`, { integer: true, min: 1 }),
      floorMax: expectNumber(row.floorMax, `floorRules[${index}].floorMax`, { integer: true, min: 1 }),
      map: {
        width: expectNumber(map.width, `floorRules[${index}].map.width`, { integer: true, min: 1 }),
        height: expectNumber(map.height, `floorRules[${index}].map.height`, { integer: true, min: 1 }),
        roomCountMin: expectNumber(map.roomCountMin, `floorRules[${index}].map.roomCountMin`, {
          integer: true,
          min: 1,
        }),
        roomCountMax: expectNumber(map.roomCountMax, `floorRules[${index}].map.roomCountMax`, {
          integer: true,
          min: 1,
        }),
        puzzleChance: expectNumber(map.puzzleChance, `floorRules[${index}].map.puzzleChance`, {
          min: 0,
          max: 1,
        }),
        secretChance: expectNumber(map.secretChance, `floorRules[${index}].map.secretChance`, {
          min: 0,
          max: 1,
        }),
        extractionChance: expectNumber(map.extractionChance, `floorRules[${index}].map.extractionChance`, {
          min: 0,
          max: 1,
        }),
      },
      spawns: {
        enemyPool: expectStringArray(spawns.enemyPool, `floorRules[${index}].spawns.enemyPool`),
        eliteChance: expectNumber(spawns.eliteChance, `floorRules[${index}].spawns.eliteChance`, {
          min: 0,
          max: 1,
        }),
        bossChance: expectNumber(spawns.bossChance, `floorRules[${index}].spawns.bossChance`, {
          min: 0,
          max: 1,
        }),
      },
      loot: {
        roomLootTableId: expectString(loot.roomLootTableId, `floorRules[${index}].loot.roomLootTableId`),
        chestLootTableId: expectString(loot.chestLootTableId, `floorRules[${index}].loot.chestLootTableId`),
      },
      gating: {
        recommendedLevel: expectNumber(gating.recommendedLevel, `floorRules[${index}].gating.recommendedLevel`, {
          integer: true,
          min: 1,
        }),
        requiredLevel: expectNumber(gating.requiredLevel, `floorRules[${index}].gating.requiredLevel`, {
          integer: true,
          min: 1,
        }),
      },
      xpMultiplier: expectNumber(row.xpMultiplier, `floorRules[${index}].xpMultiplier`, { min: 0 }),
    } satisfies FloorRule;
  });

  assertUniqueIds(parsed, "floorRules");

  for (const floorRule of parsed) {
    if (floorRule.floorMin > floorRule.floorMax) {
      throw new DataValidationError(`Floor rule "${floorRule.id}" has floorMin > floorMax`);
    }
    if (floorRule.map.roomCountMin > floorRule.map.roomCountMax) {
      throw new DataValidationError(`Floor rule "${floorRule.id}" has roomCountMin > roomCountMax`);
    }
    if (floorRule.gating.requiredLevel > floorRule.gating.recommendedLevel) {
      throw new DataValidationError(
        `Floor rule "${floorRule.id}" has requiredLevel > recommendedLevel`,
      );
    }
  }

  const sorted = [...parsed].sort((a, b) => a.floorMin - b.floorMin);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].floorMin <= sorted[i - 1].floorMax) {
      throw new DataValidationError(
        `Overlapping floor rules "${sorted[i - 1].id}" and "${sorted[i].id}"`,
      );
    }
  }

  return parsed;
}

export function validateXpTableJson(input: unknown): XpTable {
  const row = expectRecord(input, "xpTable");
  const levels = expectArray(row.levels, "xpTable.levels").map((entry, index) => {
    const levelRow = expectRecord(entry, `xpTable.levels[${index}]`);
    return {
      level: expectNumber(levelRow.level, `xpTable.levels[${index}].level`, { integer: true, min: 1 }),
      xpToNext: expectNumber(levelRow.xpToNext, `xpTable.levels[${index}].xpToNext`, {
        integer: true,
        min: 0,
      }),
    };
  });
  const runSources = expectRecord(row.runSources, "xpTable.runSources");

  const parsed: XpTable = {
    maxLevel: expectNumber(row.maxLevel, "xpTable.maxLevel", { integer: true, min: 1 }),
    levels,
    runSources: {
      lootValueMultiplier: expectNumber(runSources.lootValueMultiplier, "xpTable.runSources.lootValueMultiplier"),
      floorReachedFlat: expectNumber(runSources.floorReachedFlat, "xpTable.runSources.floorReachedFlat"),
      bossKillFlat: expectNumber(runSources.bossKillFlat, "xpTable.runSources.bossKillFlat"),
      roomDiscoveredFlat: expectNumber(runSources.roomDiscoveredFlat, "xpTable.runSources.roomDiscoveredFlat"),
      puzzleSolvedFlat: expectNumber(runSources.puzzleSolvedFlat, "xpTable.runSources.puzzleSolvedFlat"),
      enemyKillFlat: expectNumber(runSources.enemyKillFlat, "xpTable.runSources.enemyKillFlat"),
      extractMultiplier: expectNumber(runSources.extractMultiplier, "xpTable.runSources.extractMultiplier"),
      deathMultiplier: expectNumber(runSources.deathMultiplier, "xpTable.runSources.deathMultiplier"),
    },
  };

  for (let i = 1; i < parsed.levels.length; i += 1) {
    if (parsed.levels[i].level <= parsed.levels[i - 1].level) {
      throw new DataValidationError("xpTable.levels must be strictly increasing by level");
    }
  }
  if (parsed.levels.length === 0) {
    throw new DataValidationError("xpTable.levels cannot be empty");
  }
  if (parsed.levels[parsed.levels.length - 1].level > parsed.maxLevel) {
    throw new DataValidationError("xpTable.levels contains level above maxLevel");
  }

  return parsed;
}

export function validateExtractionRulesJson(input: unknown): ExtractionRule[] {
  const rows = expectArray(input, "extractionRules");
  const parsed = rows.map((entry, index) => {
    const row = expectRecord(entry, `extractionRules[${index}]`);
    const floors = expectRecord(row.floors, `extractionRules[${index}].floors`);
    const requirements = expectRecord(row.requirements, `extractionRules[${index}].requirements`);
    const results = expectRecord(row.results, `extractionRules[${index}].results`);
    const ui = expectRecord(row.ui, `extractionRules[${index}].ui`);

    const success = expectString(results.success, `extractionRules[${index}].results.success`);
    if (success !== "extract") {
      throw new DataValidationError(`extractionRules[${index}] has invalid results.success "${success}"`);
    }

    return {
      id: expectString(row.id, `extractionRules[${index}].id`),
      name: expectString(row.name, `extractionRules[${index}].name`),
      floors: {
        min: expectNumber(floors.min, `extractionRules[${index}].floors.min`, { integer: true, min: 1 }),
        max: expectNumber(floors.max, `extractionRules[${index}].floors.max`, { integer: true, min: 1 }),
      },
      requirements: {
        itemsAny: expectStringArray(requirements.itemsAny, `extractionRules[${index}].requirements.itemsAny`),
        itemsAll: expectStringArray(requirements.itemsAll, `extractionRules[${index}].requirements.itemsAll`),
        minLevel: expectNumber(requirements.minLevel, `extractionRules[${index}].requirements.minLevel`, {
          integer: true,
          min: 1,
        }),
      },
      results: {
        success: "extract",
        consumeItems: expectStringArray(results.consumeItems, `extractionRules[${index}].results.consumeItems`),
      },
      ui: {
        label: expectString(ui.label, `extractionRules[${index}].ui.label`),
      },
    } satisfies ExtractionRule;
  });

  assertUniqueIds(parsed, "extractionRules");
  for (const rule of parsed) {
    if (rule.floors.min > rule.floors.max) {
      throw new DataValidationError(`Extraction rule "${rule.id}" has floors.min > floors.max`);
    }
  }
  return parsed;
}

export function validateSkillsJson(input: unknown): SkillTemplate[] {
  const rows = expectArray(input, "skills");
  const parsed = rows.map((entry, index) => {
    const row = expectRecord(entry, `skills[${index}]`);
    const cost = expectRecord(row.cost, `skills[${index}].cost`);
    const effects = expectArray(row.effects, `skills[${index}].effects`).map((effect, effectIndex) => {
      const effectRow = expectRecord(effect, `skills[${index}].effects[${effectIndex}]`);
      return {
        type: expectEnum(
          effectRow.type,
          `skills[${index}].effects[${effectIndex}].type`,
          SKILL_EFFECTS,
        ) as SkillTemplate["effects"][number]["type"],
        value:
          typeof effectRow.value === "undefined"
            ? undefined
            : expectNumber(effectRow.value, `skills[${index}].effects[${effectIndex}].value`),
        duration:
          typeof effectRow.duration === "undefined"
            ? undefined
            : expectNumber(effectRow.duration, `skills[${index}].effects[${effectIndex}].duration`),
      };
    });

    const parsedSkill: SkillTemplate = {
      id: expectString(row.id, `skills[${index}].id`),
      name: expectString(row.name, `skills[${index}].name`),
      tree: expectEnum(row.tree, `skills[${index}].tree`, SKILL_TREES) as SkillTemplate["tree"],
      kind: expectEnum(row.kind, `skills[${index}].kind`, SKILL_KINDS) as SkillTemplate["kind"],
      unlockLevel: expectNumber(row.unlockLevel, `skills[${index}].unlockLevel`, { integer: true, min: 1 }),
      cost: {
        stamina: expectNumber(cost.stamina, `skills[${index}].cost.stamina`, { min: 0 }),
        mana: expectNumber(cost.mana, `skills[${index}].cost.mana`, { min: 0 }),
      },
      cooldown:
        typeof row.cooldown === "undefined" ? undefined : expectNumber(row.cooldown, `skills[${index}].cooldown`, { min: 0 }),
      effects,
    };

    if (typeof row.targeting !== "undefined") {
      const targeting = expectRecord(row.targeting, `skills[${index}].targeting`);
      parsedSkill.targeting = {
        shape: expectEnum(
          targeting.shape,
          `skills[${index}].targeting.shape`,
          SKILL_SHAPES,
        ) as "self" | "line" | "cone" | "area",
        range: expectNumber(targeting.range, `skills[${index}].targeting.range`, { min: 0 }),
      };
    }

    return parsedSkill;
  });

  assertUniqueIds(parsed, "skills");
  return parsed;
}

export function validatePlayerDefaultsJson(input: unknown): PlayerDefaults {
  const row = expectRecord(input, "playerDefaults");
  const baseStats = expectRecord(row.baseStats, "playerDefaults.baseStats");
  const equipment = expectRecord(row.equipment, "playerDefaults.equipment");
  const inventory = expectRecord(row.inventory, "playerDefaults.inventory");
  const backpack = expectRecord(inventory.backpack, "playerDefaults.inventory.backpack");
  const torch = expectRecord(row.torch, "playerDefaults.torch");

  const equipmentRecord = {} as Record<(typeof EQUIP_SLOTS)[number], string | null>;
  for (const slot of EQUIP_SLOTS) {
    const slotValue = equipment[slot];
    if (slotValue === null) {
      equipmentRecord[slot] = null;
      continue;
    }
    equipmentRecord[slot] = expectString(slotValue, `playerDefaults.equipment.${slot}`);
  }

  const parsed: PlayerDefaults = {
    baseStats: {
      level: expectNumber(baseStats.level, "playerDefaults.baseStats.level", { integer: true, min: 1 }),
      xp: expectNumber(baseStats.xp, "playerDefaults.baseStats.xp", { integer: true, min: 0 }),
      hp: expectNumber(baseStats.hp, "playerDefaults.baseStats.hp", { min: 1 }),
      stamina: expectNumber(baseStats.stamina, "playerDefaults.baseStats.stamina", { min: 0 }),
      attack: expectNumber(baseStats.attack, "playerDefaults.baseStats.attack"),
      defense: expectNumber(baseStats.defense, "playerDefaults.baseStats.defense"),
      speed: expectNumber(baseStats.speed, "playerDefaults.baseStats.speed", { min: 0 }),
      carryWeight: expectNumber(baseStats.carryWeight, "playerDefaults.baseStats.carryWeight", { min: 0 }),
    },
    equipment: equipmentRecord,
    inventory: {
      backpack: {
        w: expectNumber(backpack.w, "playerDefaults.inventory.backpack.w", { integer: true, min: 1 }),
        h: expectNumber(backpack.h, "playerDefaults.inventory.backpack.h", { integer: true, min: 1 }),
      },
      beltSlots: expectNumber(inventory.beltSlots, "playerDefaults.inventory.beltSlots", {
        integer: true,
        min: 3,
        max: 3,
      }),
    },
    torch: {
      fuelMax: expectNumber(torch.fuelMax, "playerDefaults.torch.fuelMax", { min: 1 }),
      fuelDrainPerTurn: expectNumber(torch.fuelDrainPerTurn, "playerDefaults.torch.fuelDrainPerTurn", { min: 0.01 }),
      highFuelThreshold: expectNumber(torch.highFuelThreshold, "playerDefaults.torch.highFuelThreshold", {
        min: 0,
        max: 1,
      }),
      lowFuelThreshold: expectNumber(torch.lowFuelThreshold, "playerDefaults.torch.lowFuelThreshold", {
        min: 0,
        max: 1,
      }),
      revealRadiusHigh: expectNumber(torch.revealRadiusHigh, "playerDefaults.torch.revealRadiusHigh", {
        integer: true,
        min: 1,
      }),
      revealRadiusMedium: expectNumber(torch.revealRadiusMedium, "playerDefaults.torch.revealRadiusMedium", {
        integer: true,
        min: 1,
      }),
      revealRadiusLow: expectNumber(torch.revealRadiusLow, "playerDefaults.torch.revealRadiusLow", {
        integer: true,
        min: 1,
      }),
    },
    unlockedSkills: expectStringArray(row.unlockedSkills, "playerDefaults.unlockedSkills"),
    unlockedRecipes: expectStringArray(row.unlockedRecipes, "playerDefaults.unlockedRecipes"),
  };

  if (parsed.torch.lowFuelThreshold > parsed.torch.highFuelThreshold) {
    throw new DataValidationError("playerDefaults.torch.lowFuelThreshold cannot exceed highFuelThreshold");
  }
  if (
    parsed.torch.revealRadiusLow > parsed.torch.revealRadiusMedium ||
    parsed.torch.revealRadiusMedium > parsed.torch.revealRadiusHigh
  ) {
    throw new DataValidationError("playerDefaults.torch reveal radii must be ordered low <= medium <= high");
  }

  return parsed;
}

export function validateRoomsJson(input: unknown): RoomTemplate[] {
  const rows = expectArray(input, "rooms");
  const parsed = rows.map((entry, index) => {
    const row = expectRecord(entry, `rooms[${index}]`);
    const room: RoomTemplate = {
      id: expectString(row.id, `rooms[${index}].id`),
      type: expectEnum(row.type, `rooms[${index}].type`, ROOM_TYPES) as RoomTemplate["type"],
      weight: expectNumber(row.weight, `rooms[${index}].weight`, { min: 0 }),
      allowedFloorMin: expectNumber(row.allowedFloorMin, `rooms[${index}].allowedFloorMin`, {
        integer: true,
        min: 1,
      }),
      allowedFloorMax: expectNumber(row.allowedFloorMax, `rooms[${index}].allowedFloorMax`, {
        integer: true,
        min: 1,
      }),
    };

    if (typeof row.tags !== "undefined") {
      room.tags = expectStringArray(row.tags, `rooms[${index}].tags`);
    }
    return room;
  });

  assertUniqueIds(parsed, "rooms");
  for (const room of parsed) {
    if (room.allowedFloorMin > room.allowedFloorMax) {
      throw new DataValidationError(`Room "${room.id}" has allowedFloorMin > allowedFloorMax`);
    }
  }
  return parsed;
}

export function validateCrossReferences(data: GameDataTemplates): GameDataTemplates {
  const itemIds = new Set(data.items.map((item) => item.id));
  const lootTableIds = new Set(data.lootTables.map((table) => table.id));
  const enemyIds = new Set(data.enemies.map((enemy) => enemy.id));
  const skillIds = new Set(data.skills.map((skill) => skill.id));

  for (const lootTable of data.lootTables) {
    for (const entry of lootTable.entries) {
      assertReferenceExists(itemIds, entry.itemId, `lootTable:${lootTable.id}`, "item");
    }
  }

  for (const enemy of data.enemies) {
    assertReferenceExists(lootTableIds, enemy.drops.lootTableId, `enemy:${enemy.id}`, "loot table");
  }

  for (const floorRule of data.floorRules) {
    assertReferenceExists(lootTableIds, floorRule.loot.roomLootTableId, `floorRule:${floorRule.id}`, "loot table");
    assertReferenceExists(lootTableIds, floorRule.loot.chestLootTableId, `floorRule:${floorRule.id}`, "loot table");
    for (const enemyId of floorRule.spawns.enemyPool) {
      assertReferenceExists(enemyIds, enemyId, `floorRule:${floorRule.id}`, "enemy");
    }
  }

  for (const extractionRule of data.extractionRules) {
    for (const itemId of extractionRule.requirements.itemsAny) {
      assertReferenceExists(itemIds, itemId, `extractionRule:${extractionRule.id}`, "item");
    }
    for (const itemId of extractionRule.requirements.itemsAll) {
      assertReferenceExists(itemIds, itemId, `extractionRule:${extractionRule.id}`, "item");
    }
    for (const itemId of extractionRule.results.consumeItems) {
      assertReferenceExists(itemIds, itemId, `extractionRule:${extractionRule.id}`, "item");
    }
  }

  for (const skillId of data.playerDefaults.unlockedSkills) {
    assertReferenceExists(skillIds, skillId, "playerDefaults.unlockedSkills", "skill");
  }

  for (const slot of EQUIP_SLOTS) {
    const equippedItemId = data.playerDefaults.equipment[slot];
    if (equippedItemId !== null) {
      assertReferenceExists(itemIds, equippedItemId, `playerDefaults.equipment.${slot}`, "item");
    }
  }

  return data;
}
