import type { FloorRule, FloorState, RoomType, SeedString, TileState } from "../types";
import { createSeededRng } from "../utils";
import { tileIndex } from "../world";

function createBaseTiles(width: number, height: number): TileState[] {
  const tiles: TileState[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const boundary = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const roomType: RoomType = boundary ? "blocked" : "combat";
      tiles.push({
        x,
        y,
        walkable: !boundary,
        visible: false,
        explored: false,
        roomType,
      });
    }
  }
  return tiles;
}

function markTile(tiles: TileState[], width: number, x: number, y: number, roomType: RoomType, walkable = true): void {
  const index = tileIndex(x, y, width);
  tiles[index] = {
    ...tiles[index],
    roomType,
    walkable,
  };
}

function randomInteriorCoordinate(width: number, height: number, seed: string): { x: number; y: number } {
  const rng = createSeededRng(seed);
  return {
    x: rng.nextInt(1, width - 2),
    y: rng.nextInt(1, height - 2),
  };
}

export function selectFloorRuleForFloor(floorNumber: number, floorRules: FloorRule[]): FloorRule {
  const floorRule = floorRules.find((rule) => floorNumber >= rule.floorMin && floorNumber <= rule.floorMax);
  if (!floorRule) {
    throw new Error(`No floor rule found for floor ${floorNumber}`);
  }
  return floorRule;
}

export function generateFloorState(params: {
  floorNumber: number;
  runSeed: SeedString;
  floorRule: FloorRule;
}): FloorState {
  const { floorNumber, runSeed, floorRule } = params;
  const seed = `${runSeed}:floor:${floorNumber}`;
  const rng = createSeededRng(seed);
  const { width, height } = floorRule.map;
  const tiles = createBaseTiles(width, height);

  markTile(tiles, width, 1, 1, "entry");
  markTile(tiles, width, width - 2, height - 2, "stairs");

  if (rng.chance(floorRule.map.extractionChance)) {
    const extraction = randomInteriorCoordinate(width, height, `${seed}:extraction`);
    markTile(tiles, width, extraction.x, extraction.y, "extraction");
  }

  // Lightweight MVP variation: add random non-walkable blockers inside rooms.
  const blockerCount = Math.max(1, Math.floor((width * height) * 0.03));
  for (let i = 0; i < blockerCount; i += 1) {
    const x = rng.nextInt(1, width - 2);
    const y = rng.nextInt(1, height - 2);
    const existing = tiles[tileIndex(x, y, width)];
    if (existing.roomType === "entry" || existing.roomType === "stairs" || existing.roomType === "extraction") {
      continue;
    }
    markTile(tiles, width, x, y, "blocked", false);
  }

  const extractionNodeIds: string[] = [];
  for (const tile of tiles) {
    if (tile.roomType === "extraction") {
      extractionNodeIds.push(`extract_${tile.x}_${tile.y}`);
      tile.interactableId = `extract_${tile.x}_${tile.y}`;
    }
  }

  return {
    floorNumber,
    seed,
    width,
    height,
    tiles,
    enemies: [],
    groundLoot: [],
    extractionNodeIds,
    discoveredRooms: [],
    roomTypeCounts: countRoomTypes(tiles),
  };
}

function countRoomTypes(tiles: TileState[]): Partial<Record<RoomType, number>> {
  return tiles.reduce<Partial<Record<RoomType, number>>>((acc, tile) => {
    const current = acc[tile.roomType] ?? 0;
    acc[tile.roomType] = current + 1;
    return acc;
  }, {});
}
