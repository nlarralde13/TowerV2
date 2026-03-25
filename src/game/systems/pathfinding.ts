import type { TileState, Vec2 } from "../types";
import { getTile, inBounds } from "../world";

function keyFor(x: number, y: number): string {
  return `${x},${y}`;
}

function parseKey(key: string): Vec2 {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function findNextPathStep(params: {
  start: Vec2;
  goal: Vec2;
  width: number;
  height: number;
  tiles: TileState[];
}): Vec2 | null {
  const { start, goal, width, height, tiles } = params;
  if (start.x === goal.x && start.y === goal.y) {
    return start;
  }
  if (!inBounds(goal.x, goal.y, width, height)) {
    return null;
  }

  const queue: Vec2[] = [start];
  const visited = new Set<string>([keyFor(start.x, start.y)]);
  const parents = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    if (current.x === goal.x && current.y === goal.y) {
      break;
    }

    const neighbors: Vec2[] = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    for (const next of neighbors) {
      if (!inBounds(next.x, next.y, width, height)) {
        continue;
      }
      const nextKey = keyFor(next.x, next.y);
      if (visited.has(nextKey)) {
        continue;
      }
      const tile = getTile(tiles, width, next.x, next.y);
      if (!tile || !tile.walkable) {
        continue;
      }
      if (tile.occupiedByEnemyId) {
        continue;
      }

      visited.add(nextKey);
      parents.set(nextKey, keyFor(current.x, current.y));
      queue.push(next);
    }
  }

  const goalKey = keyFor(goal.x, goal.y);
  if (!visited.has(goalKey)) {
    return null;
  }

  let cursor = goalKey;
  let parent = parents.get(cursor);
  while (parent && parent !== keyFor(start.x, start.y)) {
    cursor = parent;
    parent = parents.get(cursor);
  }

  return parseKey(cursor);
}

export function findPath(params: {
  start: Vec2;
  goal: Vec2;
  width: number;
  height: number;
  tiles: TileState[];
}): Vec2[] | null {
  const { start, goal, width, height, tiles } = params;
  if (start.x === goal.x && start.y === goal.y) {
    return [start];
  }
  if (!inBounds(goal.x, goal.y, width, height)) {
    return null;
  }

  const queue: Vec2[] = [start];
  const visited = new Set<string>([keyFor(start.x, start.y)]);
  const parents = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    if (current.x === goal.x && current.y === goal.y) {
      break;
    }

    const neighbors: Vec2[] = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    for (const next of neighbors) {
      if (!inBounds(next.x, next.y, width, height)) {
        continue;
      }
      const nextKey = keyFor(next.x, next.y);
      if (visited.has(nextKey)) {
        continue;
      }
      const tile = getTile(tiles, width, next.x, next.y);
      if (!tile || !tile.walkable) {
        continue;
      }
      if (tile.occupiedByEnemyId) {
        continue;
      }
      visited.add(nextKey);
      parents.set(nextKey, keyFor(current.x, current.y));
      queue.push(next);
    }
  }

  const goalKey = keyFor(goal.x, goal.y);
  if (!visited.has(goalKey)) {
    return null;
  }

  const path: Vec2[] = [];
  let cursor: string | undefined = goalKey;
  while (cursor) {
    path.push(parseKey(cursor));
    cursor = parents.get(cursor);
  }
  path.reverse();
  return path;
}
