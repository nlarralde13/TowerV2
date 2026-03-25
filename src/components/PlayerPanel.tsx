"use client";

import { useMemo, useState } from "react";
import { computeWeightState } from "../game/systems";
import { computeMovementTilesPerTurn } from "../game/types";
import type { ItemInstance, ItemTemplate, PlayerState, RunTurnState, XpTable } from "../game/types";
import { useRunStore } from "../store";

interface PlayerPanelProps {
  player: PlayerState;
  turnState: RunTurnState;
  itemTemplates: ItemTemplate[];
  xpTable: XpTable | null;
}

function nextXpThreshold(level: number, xpTable: XpTable | null): number {
  if (!xpTable) return 0;
  const row = xpTable.levels.find((entry) => entry.level === level);
  return row?.xpToNext ?? 0;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function PlayerPanel({ player, turnState, itemTemplates, xpTable }: PlayerPanelProps) {
  const consumeInventoryStack = useRunStore((state) => state.consumeInventoryStack);
  const dropInventoryStack = useRunStore((state) => state.dropInventoryStack);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [hoveredInstanceId, setHoveredInstanceId] = useState<string | null>(null);
  const itemTemplatesById = useMemo(() => new Map(itemTemplates.map((item) => [item.id, item])), [itemTemplates]);
  const weight = useMemo(() => computeWeightState(player, itemTemplatesById), [itemTemplatesById, player]);
  const inventoryItems = useMemo(
    () =>
      player.inventory.items
        .filter((item) => item.position.container === "inventory")
        .sort((a, b) => {
          const an = itemTemplatesById.get(a.itemId)?.name ?? a.itemId;
          const bn = itemTemplatesById.get(b.itemId)?.name ?? b.itemId;
          return an.localeCompare(bn);
        }),
    [itemTemplatesById, player.inventory.items],
  );
  const hpMax = Math.max(1, player.totalStats.hp);
  const hpPct = Math.max(0, Math.min(100, (player.vitals.hpCurrent / hpMax) * 100));
  const staminaMax = Math.max(1, player.totalStats.stamina);
  const staminaPct = Math.max(0, Math.min(100, (player.vitals.staminaCurrent / staminaMax) * 100));
  const nextLevelXp = nextXpThreshold(player.level, xpTable);
  const xpPct = nextLevelXp > 0 ? Math.max(0, Math.min(100, (player.xp / nextLevelXp) * 100)) : 100;
  const moveTiles = computeMovementTilesPerTurn(player.totalStats.movementFeet);
  const activeInstanceId = hoveredInstanceId ?? selectedInstanceId;
  const activeInventoryItem = activeInstanceId
    ? inventoryItems.find((item) => item.instanceId === activeInstanceId) ?? null
    : null;
  const activeInventoryTemplate = activeInventoryItem ? itemTemplatesById.get(activeInventoryItem.itemId) ?? null : null;

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
    if (typeof template.stats?.hpBonus === "number" && template.stats.hpBonus !== 0) {
      lines.push(`${template.stats.hpBonus > 0 ? "+" : ""}${template.stats.hpBonus} HP`);
    }
    if (typeof template.stats?.speedBonus === "number" && template.stats.speedBonus !== 0) {
      lines.push(`${template.stats.speedBonus > 0 ? "+" : ""}${template.stats.speedBonus} Speed`);
    }
    if (typeof template.stats?.carryWeightBonus === "number" && template.stats.carryWeightBonus !== 0) {
      lines.push(`${template.stats.carryWeightBonus > 0 ? "+" : ""}${template.stats.carryWeightBonus} Carry`);
    }
    if (typeof template.stats?.torchFuelRestore === "number" && template.stats.torchFuelRestore > 0) {
      lines.push(`+${template.stats.torchFuelRestore} Torch Fuel`);
    }
    if (typeof template.stats?.hpRestore === "number" && template.stats.hpRestore > 0) {
      lines.push(`+${template.stats.hpRestore} HP`);
    }
    lines.push(`Weight ${template.weight.toFixed(1)} each`);
    if (lines.length === 1) {
      lines.push("No direct stat modifiers");
    }
    return lines;
  }

  function canUseItem(entry: ItemInstance | null, template: ItemTemplate | null): boolean {
    if (!entry || !template) return false;
    return template.type === "consumable" && (template.stats?.torchFuelRestore ?? 0) > 0;
  }

  return (
    <section className="combat-side-panel player-panel">
      <div className="player-panel-header">
        <h3>{player.name}</h3>
        <div className="player-panel-title">{player.title}</div>
      </div>
      <div className="player-panel-meta">
        <span>Level {player.level}</span>
        <span>Gold {player.gold}</span>
        <span>Armor {player.totalStats.armor}</span>
      </div>
      <div className="combat-hp-block">
        <div className="combat-hp-label">XP {player.xp}/{nextLevelXp > 0 ? nextLevelXp : "MAX"}</div>
        <div className="combat-xp-meter">
          <div className="combat-xp-meter-fill" style={{ width: `${xpPct}%` }} />
        </div>
      </div>
      <div className="combat-hp-block">
        <div className="combat-hp-label">HP {player.vitals.hpCurrent}/{hpMax}</div>
        <div className="combat-hp-meter">
          <div className="combat-hp-meter-fill" style={{ width: `${hpPct}%` }} />
        </div>
      </div>
      <div className="combat-hp-block">
        <div className="combat-hp-label">Stamina {player.vitals.staminaCurrent}/{staminaMax}</div>
        <div className="combat-sp-meter">
          <div className="combat-sp-meter-fill" style={{ width: `${staminaPct}%` }} />
        </div>
      </div>
      <div className="combat-panel-stats">
        <div>ATK: {player.totalStats.attack}</div>
        <div>DEF: {player.totalStats.defense}</div>
        <div>STR: {player.totalStats.str}</div>
        <div>DEX: {player.totalStats.dex}</div>
        <div>VIT: {player.totalStats.vit}</div>
        <div>INT: {player.totalStats.int}</div>
        <div>LCK: {player.totalStats.lck}</div>
        <div>Hit: {percent(player.totalStats.hitChance)}</div>
        <div>Crit: {percent(player.totalStats.critChance)}</div>
        <div>Dodge: {percent(player.totalStats.dodgeChance)}</div>
        <div>HP Regen: {player.totalStats.hpRegen.toFixed(2)}</div>
        <div>Stam Regen: {player.totalStats.staminaRegen.toFixed(2)}</div>
        <div>Movement: {player.totalStats.movementFeet.toFixed(0)} ft ({moveTiles} tiles)</div>
        <div>Carry: {weight.currentWeight.toFixed(1)}/{weight.maxWeight.toFixed(1)}</div>
        <div>Torch: {player.torch.fuelCurrent.toFixed(1)}/{player.torch.fuelMax.toFixed(1)}</div>
        <div>Move: {turnState.player.movementRemainingTiles}/{turnState.player.movementAllowanceTiles}</div>
        <div>Action: {turnState.player.actionAvailable ? "Ready" : "Spent"}</div>
        <div>Bonus: {turnState.player.bonusActionAvailable ? "Ready" : "Spent"}</div>
      </div>
      <div className="combat-panel-future-slot">
        Buffs / Debuffs / Equipment indicators
      </div>
      <section className="player-inventory-section">
        <div className="player-inventory-header">
          <h4>Inventory</h4>
          <span>{inventoryItems.length} stack{inventoryItems.length === 1 ? "" : "s"}</span>
        </div>
        <div className="player-inventory-list" role="listbox" aria-label="Inventory list">
          {inventoryItems.length === 0 && <div className="player-inventory-empty">No items carried.</div>}
          {inventoryItems.map((entry) => {
            const template = itemTemplatesById.get(entry.itemId);
            if (!template) return null;
            const isSelected = selectedInstanceId === entry.instanceId;
            return (
              <button
                key={entry.instanceId}
                type="button"
                className={`player-inventory-item${isSelected ? " is-selected" : ""}`}
                onMouseEnter={() => setHoveredInstanceId(entry.instanceId)}
                onMouseLeave={() => setHoveredInstanceId((current) => (current === entry.instanceId ? null : current))}
                onClick={() => setSelectedInstanceId((current) => (current === entry.instanceId ? null : entry.instanceId))}
              >
                <span className="player-inventory-item-name">
                  [{template.name}{entry.quantity > 1 ? ` x${entry.quantity}` : ""}]
                </span>
              </button>
            );
          })}
        </div>
        <div className="player-inventory-actions">
          <button
            type="button"
            disabled={!canUseItem(activeInventoryItem, activeInventoryTemplate)}
            onClick={() => {
              if (!activeInventoryItem || !canUseItem(activeInventoryItem, activeInventoryTemplate)) return;
              consumeInventoryStack(activeInventoryItem.instanceId);
              setSelectedInstanceId((current) => (current === activeInventoryItem.instanceId ? null : current));
              setHoveredInstanceId((current) => (current === activeInventoryItem.instanceId ? null : current));
            }}
          >
            Use
          </button>
          <button
            type="button"
            disabled={!activeInventoryItem}
            onClick={() => {
              if (!activeInventoryItem) return;
              dropInventoryStack(activeInventoryItem.instanceId);
              setSelectedInstanceId((current) => (current === activeInventoryItem.instanceId ? null : current));
              setHoveredInstanceId((current) => (current === activeInventoryItem.instanceId ? null : current));
            }}
          >
            Drop
          </button>
        </div>
        <aside className={`player-inventory-tooltip${activeInventoryTemplate ? " is-visible" : ""}`}>
          <div className="player-inventory-tooltip-name">{activeInventoryTemplate?.name ?? "Hover or select an item"}</div>
          {activeInventoryTemplate ? (
            buildTooltipLines(activeInventoryTemplate).map((line) => (
              <div key={line} className="player-inventory-tooltip-stat">
                {line}
              </div>
            ))
          ) : (
            <div className="player-inventory-tooltip-stat">Item details appear here.</div>
          )}
          <div className="player-inventory-tooltip-flavor">{activeInventoryTemplate?.flavorText ?? "Flavor text appears here."}</div>
        </aside>
      </section>
    </section>
  );
}
