import { initializeRunTurnState, type EnemyTemplate, type FloorRule, type PlayerDefaults, type RunState, type SeedString } from "../types";
import { generateFloorState, selectFloorRuleForFloor, spawnEnemiesForFloor } from "../systems";

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
    critChance: 0,
    dodgeChance: 0,
    hpRegen: 0,
    staminaRegen: 0,
    movementFeet: 0,
    magicFind: 0,
    armor: 0,
    carryWeight: 0,
  };
}

function buildPlayerDefaultsState(playerDefaults: PlayerDefaults): RunState["player"] {
  const baseStats: RunState["player"]["baseStats"] = {
    ...createEmptyStatSet(),
    // Keep existing default balance values as source of truth for MVP.
    hp: playerDefaults.baseStats.hp,
    stamina: playerDefaults.baseStats.stamina,
    attack: playerDefaults.baseStats.attack,
    defense: playerDefaults.baseStats.defense,
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
    equipment: {
      mainHand: null,
      offHand: null,
      helmet: null,
      chest: null,
      legs: null,
      feet: null,
    },
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
  playerDefaults: PlayerDefaults;
}): RunState {
  const { runId, seed, floorRules, enemyTemplates, playerDefaults } = params;
  const player = buildPlayerDefaultsState(playerDefaults);
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
