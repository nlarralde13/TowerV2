import type { FloorState, Vec2 } from "../types";
import { getTile } from "../world";

export function canExtractAtPosition(floor: FloorState, position: Vec2): boolean {
  const tile = getTile(floor.tiles, floor.width, position.x, position.y);
  if (!tile) {
    return false;
  }
  return tile.roomType === "extraction" || tile.roomType === "stairs";
}
