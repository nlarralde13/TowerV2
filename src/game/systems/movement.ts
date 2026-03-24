import type { ItemInstance, ItemTemplate, PlayerState, TileState, Vec2 } from "../types";
import { getTile, inBounds } from "../world";

export interface WeightState {
  currentWeight: number;
  maxWeight: number;
  ratio: number;
  speedMultiplier: number;
}

export interface MoveResult {
  moved: boolean;
  reason?: "out_of_bounds" | "blocked";
  position: Vec2;
}

function sumItemWeight(items: Array<ItemInstance | null>, itemTemplatesById: ReadonlyMap<string, ItemTemplate>): number {
  return items.reduce((total, instance) => {
    if (!instance) {
      return total;
    }
    const template = itemTemplatesById.get(instance.itemId);
    if (!template) {
      return total;
    }
    return total + template.weight * instance.quantity;
  }, 0);
}

function equipmentToList(player: PlayerState): Array<ItemInstance | null> {
  return [
    player.equipment.mainHand,
    player.equipment.offHand,
    player.equipment.helmet,
    player.equipment.chest,
    player.equipment.legs,
    player.equipment.feet,
  ];
}

export function computeWeightState(
  player: PlayerState,
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>,
): WeightState {
  const inventoryItems = player.inventory.items;
  const equippedItems = equipmentToList(player);
  const beltItems = player.belt.slots;

  const currentWeight =
    sumItemWeight(inventoryItems, itemTemplatesById) +
    sumItemWeight(equippedItems, itemTemplatesById) +
    sumItemWeight(beltItems, itemTemplatesById);

  const maxWeight = Math.max(0.0001, player.totalStats.carryWeight);
  const ratio = currentWeight / maxWeight;

  let speedMultiplier = 1;
  if (ratio > 1) {
    speedMultiplier = 0.5;
  } else if (ratio > 0.9) {
    speedMultiplier = 0.8;
  } else if (ratio > 0.75) {
    speedMultiplier = 0.9;
  } else if (ratio > 0.5) {
    speedMultiplier = 0.95;
  }

  return { currentWeight, maxWeight, ratio, speedMultiplier };
}

export function tryMoveByDelta(params: {
  position: Vec2;
  delta: Vec2;
  tiles: TileState[];
  width: number;
  height: number;
}): MoveResult {
  const { position, delta, tiles, width, height } = params;
  const nextX = position.x + delta.x;
  const nextY = position.y + delta.y;
  if (!inBounds(nextX, nextY, width, height)) {
    return { moved: false, reason: "out_of_bounds", position };
  }

  const tile = getTile(tiles, width, nextX, nextY);
  if (!tile || !tile.walkable || tile.occupiedByEnemyId) {
    return { moved: false, reason: "blocked", position };
  }

  return {
    moved: true,
    position: { x: nextX, y: nextY },
  };
}
