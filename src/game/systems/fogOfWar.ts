import type { TileState, Vec2 } from "../types";
import { getTile, inBounds, setTile } from "../world";

export function clearVisibleTiles(tiles: TileState[]): TileState[] {
  return tiles.map((tile) => ({
    ...tile,
    visible: false,
  }));
}

export function revealTilesAroundPosition(params: {
  tiles: TileState[];
  width: number;
  height: number;
  center: Vec2;
  radius: number;
}): TileState[] {
  const { tiles, width, height, center, radius } = params;
  const updatedTiles = clearVisibleTiles(tiles);
  const radiusSquared = radius * radius;

  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      if (!inBounds(x, y, width, height)) {
        continue;
      }
      const dx = x - center.x;
      const dy = y - center.y;
      if (dx * dx + dy * dy > radiusSquared) {
        continue;
      }
      const tile = getTile(updatedTiles, width, x, y);
      if (!tile) {
        continue;
      }
      setTile(updatedTiles, width, {
        ...tile,
        visible: true,
        explored: true,
      });
    }
  }

  return updatedTiles;
}
