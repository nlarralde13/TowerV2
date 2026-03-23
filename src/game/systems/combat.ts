import type { EnemyInstance, EnemyTemplate, ItemTemplate, RunState, Vec2 } from "../types";
import { createSeededRng, getForwardTile } from "../utils";
import { computeEffectivePlayerStats } from "./playerStats";

export interface AttackResult {
  run: RunState;
  attacked: boolean;
}

export interface EnemyTurnResult {
  run: RunState;
}

function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function sign(value: number): number {
  if (value === 0) {
    return 0;
  }
  return value > 0 ? 1 : -1;
}

function applyDamage(rawDamage: number, defense: number): number {
  return Math.max(1, Math.floor(rawDamage - defense));
}

type EnemyState = EnemyInstance["state"];

function enemyAtPosition(position: Vec2, enemies: EnemyInstance[]): EnemyInstance | undefined {
  return enemies.find(
    (enemy) => enemy.state !== "dead" && enemy.position.x === position.x && enemy.position.y === position.y,
  );
}

export function playerLightAttack(params: {
  run: RunState;
  enemyTemplatesById: ReadonlyMap<string, EnemyTemplate>;
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>;
}): AttackResult {
  const { run, enemyTemplatesById, itemTemplatesById } = params;
  const floor = run.floors[run.currentFloor];
  if (!floor) {
    return { run, attacked: false };
  }

  // Attack targeting stays in world-space: one tile directly in front of current facing.
  const attackTile = getForwardTile(run.player.position, run.player.facing);
  const target = enemyAtPosition(attackTile, floor.enemies);
  if (!target) {
    return { run, attacked: false };
  }

  const enemyTemplate = enemyTemplatesById.get(target.enemyId);
  if (!enemyTemplate) {
    return { run, attacked: false };
  }

  const effectivePlayerStats = computeEffectivePlayerStats(run.player, itemTemplatesById);
  const playerDamage = effectivePlayerStats.attack;
  const enemyDefense = enemyTemplate.tier === "elite" || enemyTemplate.tier === "boss" ? 3 : 1;
  const finalDamage = applyDamage(playerDamage, enemyDefense);

  const updatedEnemies = floor.enemies.map((enemy) => {
    if (enemy.instanceId !== target.instanceId) {
      return enemy;
    }
    const hpCurrent = Math.max(0, enemy.hpCurrent - finalDamage);
    const nextState: EnemyState = hpCurrent <= 0 ? "dead" : "aggro";
    return {
      ...enemy,
      hpCurrent,
      state: nextState,
    };
  });

  const defeatedEnemyIds = updatedEnemies
    .filter((enemy) => enemy.state === "dead")
    .map((enemy) => enemy.instanceId)
    .filter((id) => !run.defeatedEnemyIds.includes(id));

  return {
    attacked: true,
    run: {
      ...run,
      defeatedEnemyIds: [...run.defeatedEnemyIds, ...defeatedEnemyIds],
      floors: {
        ...run.floors,
        [run.currentFloor]: {
          ...floor,
          enemies: updatedEnemies,
        },
      },
    },
  };
}

function tryEnemyStepTowardsPlayer(enemy: EnemyInstance, playerPosition: Vec2): Vec2 {
  const dx = playerPosition.x - enemy.position.x;
  const dy = playerPosition.y - enemy.position.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: enemy.position.x + sign(dx), y: enemy.position.y };
  }
  return { x: enemy.position.x, y: enemy.position.y + sign(dy) };
}

function chebyshevDistance(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function tryTetheredWander(params: {
  enemy: EnemyInstance;
  runSeed: string;
  floorNumber: number;
  occupied: ReadonlySet<string>;
  isWalkable: (x: number, y: number) => boolean;
  playerPosition: Vec2;
}): Vec2 {
  const { enemy, runSeed, floorNumber, occupied, isWalkable, playerPosition } = params;
  const rng = createSeededRng(`${runSeed}:${floorNumber}:${enemy.instanceId}:${playerPosition.x},${playerPosition.y}`);
  const neighbors: Vec2[] = [
    { x: enemy.position.x + 1, y: enemy.position.y },
    { x: enemy.position.x - 1, y: enemy.position.y },
    { x: enemy.position.x, y: enemy.position.y + 1 },
    { x: enemy.position.x, y: enemy.position.y - 1 },
    { x: enemy.position.x, y: enemy.position.y },
  ];

  const candidates = neighbors.filter((candidate) => {
    if (chebyshevDistance(candidate, enemy.spawnAnchor) > 1) {
      return false;
    }
    if (!isWalkable(candidate.x, candidate.y)) {
      return false;
    }
    if (candidate.x === playerPosition.x && candidate.y === playerPosition.y) {
      return false;
    }
    return !occupied.has(`${candidate.x},${candidate.y}`);
  });

  if (candidates.length === 0) {
    return enemy.position;
  }
  return rng.pick(candidates);
}

export function processEnemyTurn(params: {
  run: RunState;
  enemyTemplatesById: ReadonlyMap<string, EnemyTemplate>;
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>;
}): EnemyTurnResult {
  const { run, enemyTemplatesById, itemTemplatesById } = params;
  const floor = run.floors[run.currentFloor];
  if (!floor) {
    return { run };
  }

  const effectivePlayerStats = computeEffectivePlayerStats(run.player, itemTemplatesById);
  let playerHp = run.player.vitals.hpCurrent;

  const updatedEnemies = floor.enemies.map((enemy) => {
    if (enemy.state === "dead") {
      return enemy;
    }

    const template = enemyTemplatesById.get(enemy.enemyId);
    if (!template) {
      return enemy;
    }

    const occupiedByOtherEnemies = new Set(
      floor.enemies
        .filter((other) => other.instanceId !== enemy.instanceId && other.state !== "dead")
        .map((other) => `${other.position.x},${other.position.y}`),
    );
    const isWalkable = (x: number, y: number): boolean => {
      const tile = floor.tiles.find((entry) => entry.x === x && entry.y === y);
      return Boolean(tile?.walkable);
    };

    const distance = manhattan(enemy.position, run.player.position);
    if (distance <= 1) {
      const damage = applyDamage(template.stats.damage, effectivePlayerStats.defense);
      playerHp = Math.max(0, playerHp - damage);
      return {
        ...enemy,
        state: "attacking" as EnemyState,
        aggroTargetId: run.player.id,
      };
    }

    const shouldChase = template.role === "chaser";
    const canPursueAsTethered = distance <= 2;
    let nextPosition =
      shouldChase || canPursueAsTethered
        ? tryEnemyStepTowardsPlayer(enemy, run.player.position)
        : tryTetheredWander({
            enemy,
            runSeed: run.seed,
            floorNumber: run.currentFloor,
            occupied: occupiedByOtherEnemies,
            isWalkable,
            playerPosition: run.player.position,
          });
    if (!shouldChase && chebyshevDistance(nextPosition, enemy.spawnAnchor) > 1) {
      nextPosition = enemy.position;
    }
    const blockedByOtherEnemy = floor.enemies.some(
      (other) =>
        other.instanceId !== enemy.instanceId &&
        other.state !== "dead" &&
        other.position.x === nextPosition.x &&
        other.position.y === nextPosition.y,
    );
    const blockedByPlayer = run.player.position.x === nextPosition.x && run.player.position.y === nextPosition.y;

    if (blockedByOtherEnemy || blockedByPlayer) {
      return {
        ...enemy,
        state: "aggro" as EnemyState,
        aggroTargetId: run.player.id,
      };
    }

    const tile = floor.tiles.find((entry) => entry.x === nextPosition.x && entry.y === nextPosition.y);
    if (!tile || !tile.walkable) {
      return {
        ...enemy,
        state: "aggro" as EnemyState,
        aggroTargetId: run.player.id,
      };
    }

    return {
      ...enemy,
      position: nextPosition,
      state: "aggro" as EnemyState,
      aggroTargetId: run.player.id,
    };
  });

  const playerDead = playerHp <= 0;
  return {
    run: {
      ...run,
      status: playerDead ? "dead" : run.status,
      player: {
        ...run.player,
        vitals: {
          ...run.player.vitals,
          hpCurrent: playerHp,
        },
      },
      floors: {
        ...run.floors,
        [run.currentFloor]: {
          ...floor,
          enemies: updatedEnemies,
        },
      },
    },
  };
}
