import type { Direction, Vec2 } from "../types";

const DELTA_TO_DIRECTION = new Map<string, Direction>([
  ["0,-1", "up"],
  ["0,1", "down"],
  ["-1,0", "left"],
  ["1,0", "right"],
  ["-1,-1", "up_left"],
  ["1,-1", "up_right"],
  ["-1,1", "down_left"],
  ["1,1", "down_right"],
]);

const DIRECTION_TO_DELTA: Record<Direction, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up_left: { x: -1, y: -1 },
  up_right: { x: 1, y: -1 },
  down_left: { x: -1, y: 1 },
  down_right: { x: 1, y: 1 },
};

export function facingFromDelta(delta: Vec2, fallback: Direction): Direction {
  const key = `${Math.sign(delta.x)},${Math.sign(delta.y)}`;
  return DELTA_TO_DIRECTION.get(key) ?? fallback;
}

export function directionToUnitVector(facing: Direction): Vec2 {
  return DIRECTION_TO_DELTA[facing];
}

export function getForwardTile(position: Vec2, facing: Direction): Vec2 {
  const forward = directionToUnitVector(facing);
  return {
    x: position.x + forward.x,
    y: position.y + forward.y,
  };
}
