import type { TileState } from "../types";

export function tileIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

export function inBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}

export function getTile(tiles: TileState[], width: number, x: number, y: number): TileState | undefined {
  return tiles[tileIndex(x, y, width)];
}

export function setTile(tiles: TileState[], width: number, tile: TileState): void {
  tiles[tileIndex(tile.x, tile.y, width)] = tile;
}

export function makeTileKey(x: number, y: number): string {
  return `${x},${y}`;
}
