"use client";

import { useState } from "react";
import type { ItemInstance, ItemTemplate, PlayerState } from "../game/types";

interface LoadoutOverlayProps {
  player: PlayerState;
  itemTemplates: ItemTemplate[];
  onClose: () => void;
}

const EQUIPMENT_SLOTS: Array<keyof PlayerState["equipment"]> = ["mainHand", "offHand", "helmet", "chest", "legs", "feet"];

function slotLabel(slot: keyof PlayerState["equipment"]): string {
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

function itemName(instance: ItemInstance | null, templatesById: ReadonlyMap<string, ItemTemplate>): string {
  if (!instance) return "Empty";
  return templatesById.get(instance.itemId)?.name ?? instance.itemId;
}

export function LoadoutOverlay({ player, itemTemplates, onClose }: LoadoutOverlayProps) {
  const [hoveredTemplate, setHoveredTemplate] = useState<ItemTemplate | null>(null);
  const templatesById = new Map(itemTemplates.map((item) => [item.id, item]));

  function setHoveredTemplateByItemId(itemId: string | null): void {
    const next = itemId ? templatesById.get(itemId) ?? null : null;
    setHoveredTemplate((current) => (current?.id === next?.id ? current : next));
  }

  function buildTooltipLines(template: ItemTemplate): string[] {
    const lines: string[] = [];
    const minDamage = template.stats?.damageMin;
    const maxDamage = template.stats?.damageMax;
    if (typeof minDamage === "number" || typeof maxDamage === "number") {
      lines.push(`${(minDamage ?? 0).toFixed(1)}-${(maxDamage ?? 0).toFixed(1)} Damage`);
    }
    if (typeof template.stats?.attackBonus === "number" && template.stats.attackBonus !== 0) {
      lines.push(`${template.stats.attackBonus > 0 ? "+" : ""}${template.stats.attackBonus} ATK`);
    }
    if (typeof template.stats?.defenseBonus === "number" && template.stats.defenseBonus !== 0) {
      lines.push(`${template.stats.defenseBonus > 0 ? "+" : ""}${template.stats.defenseBonus} DEF`);
    }
    if (typeof template.stats?.defense === "number" && template.stats.defense !== 0) {
      lines.push(`${template.stats.defense > 0 ? "+" : ""}${template.stats.defense} DEF`);
    }
    if (typeof template.stats?.hpBonus === "number" && template.stats.hpBonus !== 0) {
      lines.push(`${template.stats.hpBonus > 0 ? "+" : ""}${template.stats.hpBonus} HP`);
    }
    if (typeof template.stats?.torchFuelRestore === "number" && template.stats.torchFuelRestore > 0) {
      lines.push(`+${template.stats.torchFuelRestore} Torch Fuel`);
    }
    if (typeof template.stats?.hpRestore === "number" && template.stats.hpRestore > 0) {
      lines.push(`+${template.stats.hpRestore} HP`);
    }
    lines.push(`Weight ${template.weight.toFixed(1)}`);
    if (lines.length === 1) {
      lines.push("No direct stat modifiers");
    }
    return lines;
  }

  return (
    <div className="loadout-overlay-backdrop" role="dialog" aria-modal="true" aria-label="Current loadout">
      <div className="loadout-overlay">
        <div className="loadout-overlay-header">
          <h3>Current Loadout</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="loadout-overlay-grid">
          {EQUIPMENT_SLOTS.map((slot) => (
            <div
              key={slot}
              className="loadout-slot"
              onMouseEnter={() => {
                const equipped = player.equipment[slot];
                if (!equipped) return;
                setHoveredTemplateByItemId(equipped.itemId);
              }}
            >
              <div className="loadout-slot-label">{slotLabel(slot)}</div>
              <div className="loadout-slot-item">{itemName(player.equipment[slot], templatesById)}</div>
            </div>
          ))}
        </div>
        <div className="loadout-belt">
          <h4>Trinket Belt</h4>
          <div className="loadout-belt-list">
            {player.belt.slots.map((slot, index) => (
              <div
                key={index}
                className="loadout-slot"
                onMouseEnter={() => {
                  if (!slot) return;
                  setHoveredTemplateByItemId(slot.itemId);
                }}
              >
                <div className="loadout-slot-label">T{index + 1}</div>
                <div className="loadout-slot-item">{itemName(slot, templatesById)}</div>
              </div>
            ))}
          </div>
        </div>
        <aside className={`loadout-tooltip${hoveredTemplate ? " is-visible" : ""}`}>
          <div className="loadout-tooltip-name">{hoveredTemplate?.name ?? "Hover a loadout item"}</div>
          {hoveredTemplate ? (
            buildTooltipLines(hoveredTemplate).map((line) => (
              <div key={line} className="loadout-tooltip-stat">
                {line}
              </div>
            ))
          ) : (
            <div className="loadout-tooltip-stat">Item details appear here.</div>
          )}
          <div className="loadout-tooltip-flavor">{hoveredTemplate?.flavorText ?? "Flavor text appears here."}</div>
        </aside>
      </div>
    </div>
  );
}
