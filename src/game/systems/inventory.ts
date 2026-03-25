import type { EquipSlot, ItemInstance, ItemTemplate, PlayerState, RunState } from "../types";


function canPlaceAtPosition(params: {
  inventoryItems: ItemInstance[];
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>;
  template: ItemTemplate;
  x: number;
  y: number;
  width: number;
  height: number;
}): boolean {
  const { inventoryItems, itemTemplatesById, template, x, y, width, height } = params;
  if (x + template.gridSize.w > width || y + template.gridSize.h > height) {
    return false;
  }

  const occupied = new Set<string>();
  for (const instance of inventoryItems) {
    if (instance.position.container !== "inventory") {
      continue;
    }
    const px = instance.position.x;
    const py = instance.position.y;
    if (typeof px !== "number" || typeof py !== "number") {
      continue;
    }
    const occupiedTemplate = itemTemplatesById.get(instance.itemId);
    if (!occupiedTemplate) {
      continue;
    }
    for (let ix = 0; ix < occupiedTemplate.gridSize.w; ix += 1) {
      for (let iy = 0; iy < occupiedTemplate.gridSize.h; iy += 1) {
        occupied.add(`${px + ix},${py + iy}`);
      }
    }
  }

  for (let iy = 0; iy < template.gridSize.h; iy += 1) {
    for (let ix = 0; ix < template.gridSize.w; ix += 1) {
      if (occupied.has(`${x + ix},${y + iy}`)) {
        return false;
      }
    }
  }

  return true;
}

function findOpenSlot(
  inventoryItems: ItemInstance[],
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>,
  template: ItemTemplate,
  width: number,
  height: number,
): { x: number; y: number } | null {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (
        canPlaceAtPosition({
          inventoryItems,
          itemTemplatesById,
          template,
          x,
          y,
          width,
          height,
        })
      ) {
        return { x, y };
      }
    }
  }
  return null;
}

function cloneInventoryItemWithPosition(
  item: ItemInstance,
  position: ItemInstance["position"],
): ItemInstance {
  return {
    ...item,
    position,
  };
}

function putItemIntoInventory(params: {
  inventoryItems: ItemInstance[];
  item: ItemInstance;
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>;
  inventoryWidth: number;
  inventoryHeight: number;
}): { inventoryItems: ItemInstance[]; placed: boolean } {
  const { inventoryItems, item, itemTemplatesById, inventoryWidth, inventoryHeight } = params;
  const template = itemTemplatesById.get(item.itemId);
  if (!template) {
    return { inventoryItems, placed: false };
  }
  const openSlot = findOpenSlot(inventoryItems, itemTemplatesById, template, inventoryWidth, inventoryHeight);
  if (!openSlot) {
    return { inventoryItems, placed: false };
  }

  return {
    placed: true,
    inventoryItems: [
      ...inventoryItems,
      cloneInventoryItemWithPosition(item, { container: "inventory", x: openSlot.x, y: openSlot.y }),
    ],
  };
}

function getItemTemplate(instance: ItemInstance, itemTemplatesById: ReadonlyMap<string, ItemTemplate>): ItemTemplate | null {
  return itemTemplatesById.get(instance.itemId) ?? null;
}

function getOccupiedCellsForInstance(
  instance: ItemInstance,
  template: ItemTemplate,
): Array<{ x: number; y: number }> {
  if (instance.position.container !== "inventory") {
    return [];
  }
  const baseX = instance.position.x;
  const baseY = instance.position.y;
  if (typeof baseX !== "number" || typeof baseY !== "number") {
    return [];
  }
  const cells: Array<{ x: number; y: number }> = [];
  for (let dy = 0; dy < template.gridSize.h; dy += 1) {
    for (let dx = 0; dx < template.gridSize.w; dx += 1) {
      cells.push({ x: baseX + dx, y: baseY + dy });
    }
  }
  return cells;
}

function getTargetCells(x: number, y: number, template: ItemTemplate): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  for (let dy = 0; dy < template.gridSize.h; dy += 1) {
    for (let dx = 0; dx < template.gridSize.w; dx += 1) {
      cells.push({ x: x + dx, y: y + dy });
    }
  }
  return cells;
}

export function moveInventoryItemInGrid(params: {
  player: PlayerState;
  instanceId: string;
  toX: number;
  toY: number;
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>;
}): { player: PlayerState; moved: boolean; reason?: "not_found" | "invalid_target" | "blocked" } {
  const { player, instanceId, toX, toY, itemTemplatesById } = params;
  const inventoryItems = [...player.inventory.items];
  const movingIndex = inventoryItems.findIndex(
    (entry) => entry.instanceId === instanceId && entry.position.container === "inventory",
  );
  if (movingIndex < 0) {
    return { player, moved: false, reason: "not_found" };
  }

  const movingItem = inventoryItems[movingIndex];
  const movingTemplate = getItemTemplate(movingItem, itemTemplatesById);
  if (!movingTemplate) {
    return { player, moved: false, reason: "invalid_target" };
  }

  if (
    toX < 0 ||
    toY < 0 ||
    toX + movingTemplate.gridSize.w > player.inventory.width ||
    toY + movingTemplate.gridSize.h > player.inventory.height
  ) {
    return { player, moved: false, reason: "invalid_target" };
  }

  const originalX = movingItem.position.x;
  const originalY = movingItem.position.y;
  if (typeof originalX !== "number" || typeof originalY !== "number") {
    return { player, moved: false, reason: "invalid_target" };
  }
  if (originalX === toX && originalY === toY) {
    return { player, moved: false, reason: "invalid_target" };
  }

  const targetCells = getTargetCells(toX, toY, movingTemplate);
  const overlappingIds = new Set<string>();
  for (const item of inventoryItems) {
    if (item.instanceId === movingItem.instanceId || item.position.container !== "inventory") {
      continue;
    }
    const template = getItemTemplate(item, itemTemplatesById);
    if (!template) {
      continue;
    }
    const occupied = getOccupiedCellsForInstance(item, template);
    if (occupied.some((cell) => targetCells.some((targetCell) => targetCell.x === cell.x && targetCell.y === cell.y))) {
      overlappingIds.add(item.instanceId);
    }
  }

  if (overlappingIds.size === 0) {
    inventoryItems[movingIndex] = {
      ...movingItem,
      position: {
        container: "inventory",
        x: toX,
        y: toY,
      },
    };
    return {
      moved: true,
      player: {
        ...player,
        inventory: {
          ...player.inventory,
          items: inventoryItems,
        },
      },
    };
  }

  if (overlappingIds.size !== 1) {
    return { player, moved: false, reason: "blocked" };
  }

  const swapId = Array.from(overlappingIds)[0];
  const swapIndex = inventoryItems.findIndex((entry) => entry.instanceId === swapId);
  if (swapIndex < 0) {
    return { player, moved: false, reason: "blocked" };
  }
  const swapItem = inventoryItems[swapIndex];
  const swapTemplate = getItemTemplate(swapItem, itemTemplatesById);
  const swapX = swapItem.position.x;
  const swapY = swapItem.position.y;
  if (!swapTemplate || typeof swapX !== "number" || typeof swapY !== "number") {
    return { player, moved: false, reason: "blocked" };
  }

  if (
    originalX + swapTemplate.gridSize.w > player.inventory.width ||
    originalY + swapTemplate.gridSize.h > player.inventory.height
  ) {
    return { player, moved: false, reason: "blocked" };
  }

  const swapTargetCells = getTargetCells(originalX, originalY, swapTemplate);
  const swapBlocked = inventoryItems.some((entry) => {
    if (
      entry.instanceId === movingItem.instanceId ||
      entry.instanceId === swapItem.instanceId ||
      entry.position.container !== "inventory"
    ) {
      return false;
    }
    const template = getItemTemplate(entry, itemTemplatesById);
    if (!template) {
      return false;
    }
    const occupied = getOccupiedCellsForInstance(entry, template);
    return occupied.some((cell) =>
      swapTargetCells.some((targetCell) => targetCell.x === cell.x && targetCell.y === cell.y),
    );
  });
  if (swapBlocked) {
    return { player, moved: false, reason: "blocked" };
  }

  inventoryItems[movingIndex] = {
    ...movingItem,
    position: {
      container: "inventory",
      x: toX,
      y: toY,
    },
  };
  inventoryItems[swapIndex] = {
    ...swapItem,
    position: {
      container: "inventory",
      x: originalX,
      y: originalY,
    },
  };

  return {
    moved: true,
    player: {
      ...player,
      inventory: {
        ...player.inventory,
        items: inventoryItems,
      },
    },
  };
}

export function equipInventoryItem(params: {
  player: PlayerState;
  instanceId: string;
  slot: EquipSlot;
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>;
}): { player: PlayerState; moved: boolean; reason?: "not_found" | "invalid_item" | "wrong_slot" | "inventory_full" } {
  const { player, instanceId, slot, itemTemplatesById } = params;
  const inventoryItems = [...player.inventory.items];
  const movingIndex = inventoryItems.findIndex(
    (entry) => entry.instanceId === instanceId && entry.position.container === "inventory",
  );
  if (movingIndex < 0) {
    return { player, moved: false, reason: "not_found" };
  }

  const movingItem = inventoryItems[movingIndex];
  const movingTemplate = itemTemplatesById.get(movingItem.itemId);
  if (!movingTemplate || !movingTemplate.equipSlot) {
    return { player, moved: false, reason: "invalid_item" };
  }
  if (movingTemplate.equipSlot !== slot) {
    return { player, moved: false, reason: "wrong_slot" };
  }

  inventoryItems.splice(movingIndex, 1);
  const currentlyEquipped = player.equipment[slot];
  if (currentlyEquipped) {
    const returned = putItemIntoInventory({
      inventoryItems,
      item: currentlyEquipped,
      itemTemplatesById,
      inventoryWidth: player.inventory.width,
      inventoryHeight: player.inventory.height,
    });
    if (!returned.placed) {
      return { player, moved: false, reason: "inventory_full" };
    }
    inventoryItems.splice(0, inventoryItems.length, ...returned.inventoryItems);
  }

  return {
    moved: true,
    player: {
      ...player,
      inventory: {
        ...player.inventory,
        items: inventoryItems,
      },
      equipment: {
        ...player.equipment,
        [slot]: cloneInventoryItemWithPosition(movingItem, { container: "equipment", slot }),
      },
    },
  };
}

export function unequipToInventory(params: {
  player: PlayerState;
  slot: EquipSlot;
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>;
}): { player: PlayerState; moved: boolean; reason?: "empty_slot" | "inventory_full" } {
  const { player, slot, itemTemplatesById } = params;
  const equipped = player.equipment[slot];
  if (!equipped) {
    return { player, moved: false, reason: "empty_slot" };
  }

  const returned = putItemIntoInventory({
    inventoryItems: [...player.inventory.items],
    item: equipped,
    itemTemplatesById,
    inventoryWidth: player.inventory.width,
    inventoryHeight: player.inventory.height,
  });
  if (!returned.placed) {
    return { player, moved: false, reason: "inventory_full" };
  }

  return {
    moved: true,
    player: {
      ...player,
      inventory: {
        ...player.inventory,
        items: returned.inventoryItems,
      },
      equipment: {
        ...player.equipment,
        [slot]: null,
      },
    },
  };
}

export function assignInventoryItemToBelt(params: {
  player: PlayerState;
  instanceId: string;
  beltIndex: number;
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>;
}): { player: PlayerState; moved: boolean; reason?: "not_found" | "invalid_item" | "invalid_slot" | "inventory_full" } {
  const { player, instanceId, beltIndex, itemTemplatesById } = params;
  if (beltIndex < 0 || beltIndex >= player.belt.slots.length) {
    return { player, moved: false, reason: "invalid_slot" };
  }
  const inventoryItems = [...player.inventory.items];
  const movingIndex = inventoryItems.findIndex(
    (entry) => entry.instanceId === instanceId && entry.position.container === "inventory",
  );
  if (movingIndex < 0) {
    return { player, moved: false, reason: "not_found" };
  }

  const movingItem = inventoryItems[movingIndex];
  const movingTemplate = itemTemplatesById.get(movingItem.itemId);
  if (!movingTemplate || movingTemplate.type !== "trinket") {
    return { player, moved: false, reason: "invalid_item" };
  }

  inventoryItems.splice(movingIndex, 1);
  const beltSlots = [...player.belt.slots];
  const existing = beltSlots[beltIndex];
  if (existing) {
    const returned = putItemIntoInventory({
      inventoryItems,
      item: existing,
      itemTemplatesById,
      inventoryWidth: player.inventory.width,
      inventoryHeight: player.inventory.height,
    });
    if (!returned.placed) {
      return { player, moved: false, reason: "inventory_full" };
    }
    inventoryItems.splice(0, inventoryItems.length, ...returned.inventoryItems);
  }

  beltSlots[beltIndex] = cloneInventoryItemWithPosition(movingItem, { container: "belt", slot: beltIndex });
  return {
    moved: true,
    player: {
      ...player,
      inventory: {
        ...player.inventory,
        items: inventoryItems,
      },
      belt: {
        ...player.belt,
        slots: beltSlots,
      },
    },
  };
}

export function removeBeltItemToInventory(params: {
  player: PlayerState;
  beltIndex: number;
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>;
}): { player: PlayerState; moved: boolean; reason?: "invalid_slot" | "empty_slot" | "inventory_full" } {
  const { player, beltIndex, itemTemplatesById } = params;
  if (beltIndex < 0 || beltIndex >= player.belt.slots.length) {
    return { player, moved: false, reason: "invalid_slot" };
  }
  const beltSlots = [...player.belt.slots];
  const item = beltSlots[beltIndex];
  if (!item) {
    return { player, moved: false, reason: "empty_slot" };
  }

  const returned = putItemIntoInventory({
    inventoryItems: [...player.inventory.items],
    item,
    itemTemplatesById,
    inventoryWidth: player.inventory.width,
    inventoryHeight: player.inventory.height,
  });
  if (!returned.placed) {
    return { player, moved: false, reason: "inventory_full" };
  }

  beltSlots[beltIndex] = null;
  return {
    moved: true,
    player: {
      ...player,
      inventory: {
        ...player.inventory,
        items: returned.inventoryItems,
      },
      belt: {
        ...player.belt,
        slots: beltSlots,
      },
    },
  };
}

export function dropInventoryItemToGround(params: {
  run: RunState;
  instanceId: string;
}): { run: RunState; dropped: boolean; reason?: "not_found" | "missing_floor" } {
  const { run, instanceId } = params;
  const floor = run.floors[run.currentFloor];
  if (!floor) {
    return { run, dropped: false, reason: "missing_floor" };
  }

  const inventoryItems = [...run.player.inventory.items];
  const itemIndex = inventoryItems.findIndex(
    (entry) => entry.instanceId === instanceId && entry.position.container === "inventory",
  );
  if (itemIndex < 0) {
    return { run, dropped: false, reason: "not_found" };
  }

  const [item] = inventoryItems.splice(itemIndex, 1);
  const droppedItem: ItemInstance = {
    ...item,
    position: {
      container: "ground",
      x: run.player.position.x,
      y: run.player.position.y,
    },
  };

  return {
    dropped: true,
    run: {
      ...run,
      player: {
        ...run.player,
        inventory: {
          ...run.player.inventory,
          items: inventoryItems,
        },
      },
      floors: {
        ...run.floors,
        [run.currentFloor]: {
          ...floor,
          groundLoot: [...floor.groundLoot, droppedItem],
        },
      },
    },
  };
}

export function addItemToInventory(params: {
  player: PlayerState;
  item: ItemInstance;
  template: ItemTemplate;
  itemTemplatesById: ReadonlyMap<string, ItemTemplate>;
}): { player: PlayerState; added: boolean; remainingQuantity: number } {
  const { player, item, template, itemTemplatesById } = params;
  const inventoryItems = [...player.inventory.items];
  let remaining = item.quantity;

  const stackTargetIndex = inventoryItems.findIndex(
    (entry) =>
      entry.itemId === item.itemId &&
      entry.position.container === "inventory" &&
      (entry.quantity ?? 0) < template.stackSize,
  );
  if (stackTargetIndex >= 0 && template.stackSize > 1) {
    const stackTarget = inventoryItems[stackTargetIndex];
    const free = template.stackSize - stackTarget.quantity;
    const toTransfer = Math.min(free, remaining);
    inventoryItems[stackTargetIndex] = { ...stackTarget, quantity: stackTarget.quantity + toTransfer };
    remaining -= toTransfer;
  }

  while (remaining > 0) {
    const slot = findOpenSlot(
      inventoryItems,
      itemTemplatesById,
      template,
      player.inventory.width,
      player.inventory.height,
    );
    if (!slot) {
      break;
    }
    const toTransfer = Math.min(template.stackSize, remaining);
    inventoryItems.push({
      ...item,
      instanceId: remaining === item.quantity ? item.instanceId : `${item.instanceId}_${remaining}`,
      quantity: toTransfer,
      position: {
        container: "inventory",
        x: slot.x,
        y: slot.y,
      },
    });
    remaining -= toTransfer;
  }

  return {
    added: remaining < item.quantity,
    remainingQuantity: remaining,
    player: {
      ...player,
      inventory: {
        ...player.inventory,
        items: inventoryItems,
      },
    },
  };
}

export function consumeInventoryItemStack(params: {
  player: PlayerState;
  instanceId: string;
}): { player: PlayerState; consumed: boolean; consumedQuantity: number } {
  const { player, instanceId } = params;
  const inventoryItems = [...player.inventory.items];
  const index = inventoryItems.findIndex(
    (entry) => entry.instanceId === instanceId && entry.position.container === "inventory",
  );
  if (index < 0) {
    return { player, consumed: false, consumedQuantity: 0 };
  }

  const target = inventoryItems[index];
  const nextQuantity = target.quantity - 1;
  if (nextQuantity <= 0) {
    inventoryItems.splice(index, 1);
  } else {
    inventoryItems[index] = {
      ...target,
      quantity: nextQuantity,
    };
  }

  return {
    consumed: true,
    consumedQuantity: 1,
    player: {
      ...player,
      inventory: {
        ...player.inventory,
        items: inventoryItems,
      },
    },
  };
}
