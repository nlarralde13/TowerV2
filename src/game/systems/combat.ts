import type { EnemyInstance, EnemyTemplate, ItemTemplate, RunState, Vec2 } from "../types";
import { createSeededRng, getForwardTile } from "../utils";
import { getTile, inBounds } from "../world";

export interface AttackResult {
  run: RunState;
  attacked: boolean;
}

export interface EnemyTurnResult {
  run: RunState;
}

interface EnemyPhaseActorPolicy {
  attackRangeTiles: number;
  aggroRangeTiles: number;
  actionBudgetPerPhase: number;
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

  const playerDamage = run.player.totalStats.attack;
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

function tryEnemyStepTowardsPlayer(
  enemy: EnemyInstance,
  playerPosition: Vec2,
  isWalkable: (x: number, y: number) => boolean,
): Vec2 {
  const dx = playerPosition.x - enemy.position.x;
  const dy = playerPosition.y - enemy.position.y;
  const primaryHorizontal = Math.abs(dx) >= Math.abs(dy);

  const primaryStep: Vec2 = primaryHorizontal
    ? { x: enemy.position.x + sign(dx), y: enemy.position.y }
    : { x: enemy.position.x, y: enemy.position.y + sign(dy) };

  if (isWalkable(primaryStep.x, primaryStep.y)) {
    return primaryStep;
  }

  // Primary axis is blocked — try the secondary axis if the player isn't perfectly aligned
  const secondaryDelta = primaryHorizontal ? dy : dx;
  if (secondaryDelta !== 0) {
    const secondaryStep: Vec2 = primaryHorizontal
      ? { x: enemy.position.x, y: enemy.position.y + sign(dy) }
      : { x: enemy.position.x + sign(dx), y: enemy.position.y };
    if (isWalkable(secondaryStep.x, secondaryStep.y)) {
      return secondaryStep;
    }
  }

  return enemy.position;
}

function chebyshevDistance(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function getEnemyPhaseActorPolicy(template: EnemyTemplate): EnemyPhaseActorPolicy {
  // MVP pacing: one meaningful action per enemy during enemy phase.
  // Keep this centralized so speed/initiative systems can evolve later.
  return {
    attackRangeTiles: Math.max(1, Math.floor(template.stats.attackRange)),
    aggroRangeTiles: Math.max(1, Math.floor(template.stats.aggroRange)),
    actionBudgetPerPhase: 1,
  };
}

function evaluateEnemyAggro(params: {
  enemy: EnemyInstance;
  template: EnemyTemplate;
  playerPosition: Vec2;
  playerId: string;
  policy: EnemyPhaseActorPolicy;
}): { aggroed: boolean; targetId: string | null } {
  const { enemy, template, playerPosition, playerId, policy } = params;
  const distance = manhattan(enemy.position, playerPosition);
  const alreadyAggro = enemy.state === "aggro" || enemy.state === "attacking";
  if (alreadyAggro) {
    return { aggroed: true, targetId: playerId };
  }
  if (template.role === "chaser" && distance <= policy.aggroRangeTiles) {
    return { aggroed: true, targetId: playerId };
  }
  return { aggroed: false, targetId: null };
}

function enemyCanAttackNow(enemy: EnemyInstance, playerPosition: Vec2, policy: EnemyPhaseActorPolicy): boolean {
  return manhattan(enemy.position, playerPosition) <= policy.attackRangeTiles;
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
}): EnemyTurnResult {
  const { run, enemyTemplatesById } = params;
  const floor = run.floors[run.currentFloor];
  if (!floor || run.status !== "active" || run.turnState.phase !== "enemies") {
    return { run };
  }

  let playerHp = run.player.vitals.hpCurrent;
  const occupiedByAliveEnemies = new Set(
    floor.enemies.filter((enemy) => enemy.state !== "dead").map((enemy) => `${enemy.position.x},${enemy.position.y}`),
  );
  const updatedEnemies: EnemyInstance[] = [];

  for (const enemy of floor.enemies) {
    if (enemy.state === "dead") {
      updatedEnemies.push(enemy);
      continue;
    }

    const template = enemyTemplatesById.get(enemy.enemyId);
    if (!template) {
      updatedEnemies.push(enemy);
      continue;
    }

    const policy = getEnemyPhaseActorPolicy(template);
    let nextEnemy = enemy;
    occupiedByAliveEnemies.delete(`${enemy.position.x},${enemy.position.y}`);

    for (let actionIndex = 0; actionIndex < policy.actionBudgetPerPhase; actionIndex += 1) {
      const aggro = evaluateEnemyAggro({
        enemy: nextEnemy,
        template,
        playerPosition: run.player.position,
        playerId: run.player.id,
        policy,
      });
      const isWalkable = (x: number, y: number): boolean => {
        if (!inBounds(x, y, floor.width, floor.height)) return false;
        const tile = getTile(floor.tiles, floor.width, x, y);
        if (!tile?.walkable) return false;
        if (run.player.position.x === x && run.player.position.y === y) return false;
        return !occupiedByAliveEnemies.has(`${x},${y}`);
      };

      if (enemyCanAttackNow(nextEnemy, run.player.position, policy)) {
        const damage = applyDamage(template.stats.damage, run.player.totalStats.defense);
        playerHp = Math.max(0, playerHp - damage);
        nextEnemy = {
          ...nextEnemy,
          state: "attacking" as EnemyState,
          aggroTargetId: run.player.id,
        };
        break;
      }

      if (!aggro.aggroed) {
        const wanderPosition = tryTetheredWander({
          enemy: nextEnemy,
          runSeed: run.seed,
          floorNumber: run.currentFloor,
          occupied: occupiedByAliveEnemies,
          isWalkable,
          playerPosition: run.player.position,
        });
        nextEnemy =
          wanderPosition.x === nextEnemy.position.x && wanderPosition.y === nextEnemy.position.y
            ? { ...nextEnemy, state: "idle" as EnemyState, aggroTargetId: null }
            : { ...nextEnemy, position: wanderPosition, state: "patrol" as EnemyState, aggroTargetId: null };
        break;
      }

      const chasePosition = tryEnemyStepTowardsPlayer(nextEnemy, run.player.position, isWalkable);
      if (chasePosition.x === nextEnemy.position.x && chasePosition.y === nextEnemy.position.y) {
        nextEnemy = {
          ...nextEnemy,
          state: "aggro" as EnemyState,
          aggroTargetId: aggro.targetId,
        };
        break;
      }
      nextEnemy = {
        ...nextEnemy,
        position: chasePosition,
        state: "aggro" as EnemyState,
        aggroTargetId: aggro.targetId,
      };
    };

    if (nextEnemy.state !== "dead") {
      occupiedByAliveEnemies.add(`${nextEnemy.position.x},${nextEnemy.position.y}`);
    }
    updatedEnemies.push(nextEnemy);
  }

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
