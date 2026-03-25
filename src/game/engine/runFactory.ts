import {
  initializeRunTurnState,
  type EnemyTemplate,
  type FloorRule,
  type ItemTemplate,
  type PlayerDefaults,
  type RunState,
  type SeedString,
} from "../types";
import {
  addItemToInventory,
  clampPlayerVitalsToEffectiveStats,
  generateFloorState,
  selectFloorRuleForFloor,
  spawnEnemiesForFloor,
} from "../systems";

function createEmptyStatSet(): RunState["player"]["baseStats"] {
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
    hitChance: 0,
    critChance: 0,
    critMultiplier: 0,
    dodgeChance: 0,
    hpRegen: 0,
    staminaRegen: 0,
    movementFeet: 0,
    magicFind: 0,
    armor: 0,
    carryWeight: 0,
  };
}

function buildStarterEquipment(
  playerDefaults: PlayerDefaults,
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>,
): RunState["player"]["equipment"] {
  const equipment: RunState["player"]["equipment"] = {
    mainHand: null,
    offHand: null,
    helmet: null,
    chest: null,
    legs: null,
    feet: null,
  };

  for (const slot of Object.keys(equipment) as Array<keyof RunState["player"]["equipment"]>) {
    const defaultItemId = playerDefaults.equipment[slot];
    if (!defaultItemId) continue;
    const template = itemTemplatesById.get(defaultItemId);
    if (!template || template.equipSlot !== slot) continue;
    equipment[slot] = {
      instanceId: `starter_${slot}_${defaultItemId}`,
      itemId: defaultItemId,
      quantity: 1,
      position: {
        container: "equipment",
        slot,
      },
    };
  }

  return equipment;
}

function buildStarterInventoryItems(params: {
  player: RunState["player"];
  playerDefaults: PlayerDefaults;
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>;
}): RunState["player"] {
  const { player, playerDefaults, itemTemplatesById } = params;
  let nextPlayer = player;
  const starterItems = playerDefaults.inventory.startingItems ?? [];
  for (const entry of starterItems) {
    const template = itemTemplatesById.get(entry.itemId);
    if (!template) continue;
    const added = addItemToInventory({
      player: nextPlayer,
      item: {
        instanceId: `starter_inventory_${entry.itemId}`,
        itemId: entry.itemId,
        quantity: entry.quantity,
        position: { container: "inventory" },
      },
      template,
      itemTemplatesById,
    });
    nextPlayer = added.player;
  }
  return nextPlayer;
}

function buildPlayerDefaultsState(
  playerDefaults: PlayerDefaults,
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>,
): RunState["player"] {
  const baseStats: RunState["player"]["baseStats"] = {
    ...createEmptyStatSet(),
    // Combat balance baseline — see playerDefaults.json for tuning values.
    // Weapon/armor equipment stats are layered on top during recomputePlayerStats.
    hp: playerDefaults.baseStats.hp,
    stamina: playerDefaults.baseStats.stamina,
    attack: playerDefaults.baseStats.attack,
    defense: playerDefaults.baseStats.defense,
    hitChance: playerDefaults.baseStats.hitChance,
    critMultiplier: playerDefaults.baseStats.critMultiplier,
    movementFeet: playerDefaults.baseStats.movementFeet,
    carryWeight: playerDefaults.baseStats.carryWeight,
  };
  const equipmentStats = createEmptyStatSet();
  const buffStats = createEmptyStatSet();
  const totalStats = {
    ...baseStats,
  };

  return {
    id: "player_1",
    name: "Tower Runner",
    title: "The Climber",
    level: playerDefaults.baseStats.level,
    xp: playerDefaults.baseStats.xp,
    gold: 0,
    unspentStatPoints: 0,
    unspentSkillPoints: 0,
    baseStats,
    equipmentStats,
    buffStats,
    totalStats,
    vitals: {
      hpCurrent: playerDefaults.baseStats.hp,
      staminaCurrent: playerDefaults.baseStats.stamina,
    },
    position: { x: 1, y: 1 },
    facing: "down",
    inventory: {
      width: playerDefaults.inventory.backpack.w,
      height: playerDefaults.inventory.backpack.h,
      items: [],
    },
    equipment: buildStarterEquipment(playerDefaults, itemTemplatesById),
    belt: {
      slots: Array.from({ length: playerDefaults.inventory.beltSlots }, () => null),
    },
    torch: {
      fuelCurrent: playerDefaults.torch.fuelMax,
      fuelMax: playerDefaults.torch.fuelMax,
      fuelDrainPerTurn: playerDefaults.torch.fuelDrainPerTurn,
      highFuelThreshold: playerDefaults.torch.highFuelThreshold,
      lowFuelThreshold: playerDefaults.torch.lowFuelThreshold,
      revealRadiusHigh: playerDefaults.torch.revealRadiusHigh,
      revealRadiusMedium: playerDefaults.torch.revealRadiusMedium,
      revealRadiusLow: playerDefaults.torch.revealRadiusLow,
    },
    unlockedSkillIds: [...playerDefaults.unlockedSkills],
    activeSkillIds: [],
    statusEffects: [],
  };
}

export function createInitialRunState(params: {
  runId: string;
  seed: SeedString;
  floorRules: FloorRule[];
  enemyTemplates: EnemyTemplate[];
  itemTemplates: ItemTemplate[];
  playerDefaults: PlayerDefaults;
}): RunState {
  const { runId, seed, floorRules, enemyTemplates, itemTemplates, playerDefaults } = params;
  const itemTemplatesById = new Map(itemTemplates.map((item) => [item.id, item]));
  const player = clampPlayerVitalsToEffectiveStats(
    buildStarterInventoryItems({
      player: buildPlayerDefaultsState(playerDefaults, itemTemplatesById),
      playerDefaults,
      itemTemplatesById,
    }),
    itemTemplatesById,
  );
  const initialFloorNumber = 1;
  const floorRule = selectFloorRuleForFloor(initialFloorNumber, floorRules);
  const initialFloor = generateFloorState({
    floorNumber: initialFloorNumber,
    runSeed: seed,
    floorRule,
  });

  const enemyTemplatesById = new Map(enemyTemplates.map((enemy) => [enemy.id, enemy]));
  initialFloor.enemies = spawnEnemiesForFloor({
    runSeed: seed,
    floorNumber: initialFloorNumber,
    floorRule,
    floorWidth: initialFloor.width,
    tiles: initialFloor.tiles,
    enemyTemplatesById,
  });

  return {
    runId,
    seed,
    startedAt: Date.now(),
    status: "active",
    currentFloor: initialFloorNumber,
    turnState: initializeRunTurnState(player),
    player,
    floors: {
      [initialFloorNumber]: initialFloor,
    },
    discoveredTileKeys: [],
    defeatedEnemyIds: [],
    extractedItemIds: [],
    availableExtractionNodeIds: [...initialFloor.extractionNodeIds],
  };
}
