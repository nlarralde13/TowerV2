"use client";

import { useMemo, useState } from "react";
import type { EquipSlot, ItemInstance, ItemTemplate, PlayerState } from "../game/types";
import { useRunStore } from "../store";

const INVENTORY_TILE_SIZE = 42;
const LEFT_EQUIPMENT_SLOTS: Array<keyof PlayerState["equipment"]> = ["mainHand", "offHand", "helmet"];
const RIGHT_EQUIPMENT_SLOTS: Array<keyof PlayerState["equipment"]> = ["chest", "legs", "feet"];

function labelForSlot(slot: keyof PlayerState["equipment"]): string {
  switch (slot) {
    case "mainHand":
      return "Main Hand";
    case "offHand":
      return "Off Hand";
    case "helmet":
      return "Helmet";
    case "chest":
      return "Chest";
    case "legs":
      return "Legs";
    case "feet":
      return "Feet";
    default:
      return slot;
  }
}

interface InventoryPanelProps {
  player: PlayerState;
  itemTemplates: ItemTemplate[];
}

function getInventoryItems(player: PlayerState): ItemInstance[] {
  return player.inventory.items.filter((item) => item.position.container === "inventory");
}

export function InventoryPanel({ player, itemTemplates }: InventoryPanelProps) {
  const moveInventoryStack = useRunStore((state) => state.moveInventoryStack);
  const dropInventoryStack = useRunStore((state) => state.dropInventoryStack);
  const equipInventoryStack = useRunStore((state) => state.equipInventoryStack);
  const unequipSlot = useRunStore((state) => state.unequipSlot);
  const assignTrinketToBelt = useRunStore((state) => state.assignTrinketToBelt);
  const removeTrinketFromBelt = useRunStore((state) => state.removeTrinketFromBelt);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [draggingInstanceId, setDraggingInstanceId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const templatesById = useMemo(() => new Map(itemTemplates.map((item) => [item.id, item])), [itemTemplates]);
  const inventoryItems = useMemo(() => getInventoryItems(player), [player]);

  function resolveItemAtCell(x: number, y: number): ItemInstance | null {
    for (const item of inventoryItems) {
      const template = templatesById.get(item.itemId);
      const itemX = item.position.x;
      const itemY = item.position.y;
      if (!template || typeof itemX !== "number" || typeof itemY !== "number") {
        continue;
      }
      const withinX = x >= itemX && x < itemX + template.gridSize.w;
      const withinY = y >= itemY && y < itemY + template.gridSize.h;
      if (withinX && withinY) {
        return item;
      }
    }
    return null;
  }

  function placeInstance(instanceId: string, x: number, y: number): void {
    const before = player.inventory.items
      .find((item) => item.instanceId === instanceId && item.position.container === "inventory");
    const beforeX = before?.position.x;
    const beforeY = before?.position.y;
    moveInventoryStack(instanceId, x, y);

    const after = useRunStore
      .getState()
      .run
      ?.player.inventory.items.find((item) => item.instanceId === instanceId && item.position.container === "inventory");
    const moved = Boolean(after && (after.position.x !== beforeX || after.position.y !== beforeY));
    setMessage(moved ? null : "Cannot place item there.");
  }

  function onCellClick(x: number, y: number): void {
    setMessage(null);
    const clickedItem = resolveItemAtCell(x, y);
    if (!selectedInstanceId) {
      if (clickedItem) {
        setSelectedInstanceId(clickedItem.instanceId);
      }
      return;
    }
    placeInstance(selectedInstanceId, x, y);
    setSelectedInstanceId(null);
  }

  function applyAndVerifyMove(instanceId: string, expectedContainer: ItemInstance["position"]["container"]): boolean {
    const after = useRunStore.getState().run?.player;
    if (!after) {
      return false;
    }
    if (expectedContainer === "inventory") {
      return after.inventory.items.some((item) => item.instanceId === instanceId && item.position.container === "inventory");
    }
    if (expectedContainer === "equipment") {
      return Object.values(after.equipment).some((item) => item?.instanceId === instanceId);
    }
    if (expectedContainer === "belt") {
      return after.belt.slots.some((item) => item?.instanceId === instanceId);
    }
    return false;
  }

  function onEquipmentSlotInteract(slot: EquipSlot, forcedInstanceId?: string): void {
    setMessage(null);
    const activeInstanceId = forcedInstanceId ?? selectedInstanceId;
    const activeItem = activeInstanceId
      ? inventoryItems.find((item) => item.instanceId === activeInstanceId) ?? null
      : null;
    const activeTemplate = activeItem ? templatesById.get(activeItem.itemId) ?? null : null;

    if (activeInstanceId && activeTemplate?.equipSlot === slot) {
      equipInventoryStack(activeInstanceId, slot);
      const moved = applyAndVerifyMove(activeInstanceId, "equipment");
      setMessage(moved ? null : "Cannot equip to that slot.");
      if (moved) {
        setSelectedInstanceId(null);
      }
      return;
    }
    if (activeInstanceId) {
      setMessage("Selected item does not match that equipment slot.");
      return;
    }
    const before = player.equipment[slot]?.instanceId;
    if (!before) {
      return;
    }
    unequipSlot(slot);
    const moved = applyAndVerifyMove(before, "inventory");
    setMessage(moved ? null : "No room to unequip item.");
  }

  function onBeltSlotInteract(index: number, forcedInstanceId?: string): void {
    setMessage(null);
    const activeInstanceId = forcedInstanceId ?? selectedInstanceId;
    const activeItem = activeInstanceId
      ? inventoryItems.find((item) => item.instanceId === activeInstanceId) ?? null
      : null;
    const activeTemplate = activeItem ? templatesById.get(activeItem.itemId) ?? null : null;

    if (activeInstanceId && activeTemplate?.type === "trinket") {
      assignTrinketToBelt(activeInstanceId, index);
      const moved = applyAndVerifyMove(activeInstanceId, "belt");
      setMessage(moved ? null : "Cannot place trinket in belt slot.");
      if (moved) {
        setSelectedInstanceId(null);
      }
      return;
    }
    if (activeInstanceId) {
      setMessage("Only trinkets can be placed in belt slots.");
      return;
    }
    const before = player.belt.slots[index]?.instanceId;
    if (!before) {
      return;
    }
    removeTrinketFromBelt(index);
    const moved = applyAndVerifyMove(before, "inventory");
    setMessage(moved ? null : "No room to remove trinket.");
  }

  return (
    <section className="inventory-panel panel">
      <div className="inventory-panel-header">
        <h3>Inventory</h3>
        <p>
          Click item then destination tile, or drag and drop. Grid: {player.inventory.width}x{player.inventory.height}
        </p>
      </div>

      <div className="inventory-actions">
        <button
          type="button"
          disabled={!selectedInstanceId}
          onClick={() => {
            if (!selectedInstanceId) {
              return;
            }
            dropInventoryStack(selectedInstanceId);
            setSelectedInstanceId(null);
            setMessage(null);
          }}
        >
          Drop Selected
        </button>
      </div>

      {message && <p className="inventory-message">{message}</p>}

      <div className="equipment-layout">
        <div className="equipment-column">
          {LEFT_EQUIPMENT_SLOTS.map((slot) => {
            const equipped = player.equipment[slot];
            const template = equipped ? templatesById.get(equipped.itemId) : null;
            return (
              <div
                key={slot}
                className="equipment-slot-card"
                title={template?.flavorText ?? ""}
                onClick={() => onEquipmentSlotInteract(slot)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const instanceId = event.dataTransfer.getData("text/plain");
                  if (!instanceId) {
                    return;
                  }
                  const item = inventoryItems.find((entry) => entry.instanceId === instanceId);
                  const itemTemplate = item ? templatesById.get(item.itemId) : null;
                  if (!itemTemplate || itemTemplate.equipSlot !== slot) {
                    setMessage("Dragged item does not match that equipment slot.");
                    return;
                  }
                  onEquipmentSlotInteract(slot, instanceId);
                }}
              >
                <div className="equipment-slot-label">{labelForSlot(slot)}</div>
                <div className="equipment-slot-item">{template?.name ?? "Empty"}</div>
              </div>
            );
          })}
        </div>

        <div className="belt-column">
          <div className="belt-title">Trinket Belt</div>
          <div className="belt-slots">
            {player.belt.slots.map((item, index) => {
              const template = item ? templatesById.get(item.itemId) : null;
              return (
                <div
                  key={index}
                  className="belt-slot-card"
                  title={template?.flavorText ?? ""}
                  onClick={() => onBeltSlotInteract(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const instanceId = event.dataTransfer.getData("text/plain");
                    if (!instanceId) {
                      return;
                    }
                    const inventoryItem = inventoryItems.find((entry) => entry.instanceId === instanceId);
                    const inventoryTemplate = inventoryItem ? templatesById.get(inventoryItem.itemId) : null;
                    if (!inventoryTemplate || inventoryTemplate.type !== "trinket") {
                      setMessage("Only trinkets can be placed in belt slots.");
                      return;
                    }
                    onBeltSlotInteract(index, instanceId);
                  }}
                >
                  <div className="equipment-slot-label">T{index + 1}</div>
                  <div className="equipment-slot-item">{template?.name ?? "Empty"}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="equipment-column">
          {RIGHT_EQUIPMENT_SLOTS.map((slot) => {
            const equipped = player.equipment[slot];
            const template = equipped ? templatesById.get(equipped.itemId) : null;
            return (
              <div
                key={slot}
                className="equipment-slot-card"
                title={template?.flavorText ?? ""}
                onClick={() => onEquipmentSlotInteract(slot)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const instanceId = event.dataTransfer.getData("text/plain");
                  if (!instanceId) {
                    return;
                  }
                  const item = inventoryItems.find((entry) => entry.instanceId === instanceId);
                  const itemTemplate = item ? templatesById.get(item.itemId) : null;
                  if (!itemTemplate || itemTemplate.equipSlot !== slot) {
                    setMessage("Dragged item does not match that equipment slot.");
                    return;
                  }
                  onEquipmentSlotInteract(slot, instanceId);
                }}
              >
                <div className="equipment-slot-label">{labelForSlot(slot)}</div>
                <div className="equipment-slot-item">{template?.name ?? "Empty"}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="inventory-grid"
        style={{
          gridTemplateColumns: `repeat(${player.inventory.width}, ${INVENTORY_TILE_SIZE}px)`,
          gridTemplateRows: `repeat(${player.inventory.height}, ${INVENTORY_TILE_SIZE}px)`,
          width: `${player.inventory.width * INVENTORY_TILE_SIZE}px`,
          height: `${player.inventory.height * INVENTORY_TILE_SIZE}px`,
        }}
      >
        {Array.from({ length: player.inventory.width * player.inventory.height }, (_, i) => {
          const x = i % player.inventory.width;
          const y = Math.floor(i / player.inventory.width);
          return (
            <button
              key={`${x},${y}`}
              type="button"
              className="inventory-cell"
              onClick={() => onCellClick(x, y)}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const instanceId = event.dataTransfer.getData("text/plain");
                if (!instanceId) {
                  return;
                }
                placeInstance(instanceId, x, y);
                setDraggingInstanceId(null);
                setSelectedInstanceId(null);
              }}
              aria-label={`Inventory cell ${x},${y}`}
            />
          );
        })}

        {inventoryItems.map((item) => {
          const template = templatesById.get(item.itemId);
          const itemX = item.position.x;
          const itemY = item.position.y;
          if (!template || typeof itemX !== "number" || typeof itemY !== "number") {
            return null;
          }
          const selected = selectedInstanceId === item.instanceId;
          const dragging = draggingInstanceId === item.instanceId;
          return (
            <div
              key={item.instanceId}
              className={`inventory-item${selected ? " is-selected" : ""}${dragging ? " is-dragging" : ""}`}
              title={template.flavorText ?? ""}
              style={{
                left: `${itemX * INVENTORY_TILE_SIZE}px`,
                top: `${itemY * INVENTORY_TILE_SIZE}px`,
                width: `${template.gridSize.w * INVENTORY_TILE_SIZE}px`,
                height: `${template.gridSize.h * INVENTORY_TILE_SIZE}px`,
              }}
              draggable
              onDragStart={(event) => {
                setMessage(null);
                setDraggingInstanceId(item.instanceId);
                event.dataTransfer.setData("text/plain", item.instanceId);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDraggingInstanceId(null)}
              onClick={(event) => {
                event.stopPropagation();
                setMessage(null);
                setSelectedInstanceId((current) => (current === item.instanceId ? null : item.instanceId));
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedInstanceId((current) => (current === item.instanceId ? null : item.instanceId));
                }
              }}
            >
              <span className="inventory-item-name">{template.name}</span>
              <span className="inventory-item-qty">x{item.quantity}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
