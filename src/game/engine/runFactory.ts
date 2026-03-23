import type { EnemyTemplate, FloorRule, PlayerDefaults, RunState, SeedString } from "../types";
import { generateFloorState, selectFloorRuleForFloor, spawnEnemiesForFloor } from "../systems";

function buildPlayerDefaultsState(playerDefaults: PlayerDefaults): RunState["player"] {
  return {
    id: "player_1",
    name: "Tower Runner",
    level: playerDefaults.baseStats.level,
    xp: playerDefaults.baseStats.xp,
    unspentStatPoints: 0,
    unspentSkillPoints: 0,
    stats: {
      hp: playerDefaults.baseStats.hp,
      stamina: playerDefaults.baseStats.stamina,
      attack: playerDefaults.baseStats.attack,
      defense: playerDefaults.baseStats.defense,
      speed: playerDefaults.baseStats.speed,
      carryWeight: playerDefaults.baseStats.carryWeight,
    },
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
