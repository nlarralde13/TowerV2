"use client";

import { useMemo } from "react";
import { computeWeightState } from "../game/systems";
import { computeMovementTilesPerTurn } from "../game/types";
import type { ItemTemplate, PlayerState, XpTable } from "../game/types";

interface PlayerInfoPanelProps {
  player: PlayerState;
  itemTemplates: ItemTemplate[];
  xpTable: XpTable;
}

function nextXpThreshold(level: number, xpTable: XpTable): number {
  const row = xpTable.levels.find((entry) => entry.level === level);
  if (!row) {
    return 0;
  }
  return row.xpToNext;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function PlayerInfoPanel({ player, itemTemplates, xpTable }: PlayerInfoPanelProps) {
  const itemTemplatesById = useMemo(() => new Map(itemTemplates.map((item) => [item.id, item])), [itemTemplates]);
  const weight = useMemo(() => computeWeightState(player, itemTemplatesById), [itemTemplatesById, player]);
  const nextLevelXp = nextXpThreshold(player.level, xpTable);
  const total = player.totalStats;

  return (
    <section className="panel player-info-panel">
      <div className="player-info-header">
        <h3>{player.name}</h3>
        <p>{player.title}</p>
      </div>

      <div className="player-info-grid">
        <div>Level: {player.level}</div>
        <div>
          XP: {player.xp}/{nextLevelXp}
        </div>
        <div>
          HP: {player.vitals.hpCurrent}/{total.hp}
        </div>
        <div>
          Stamina: {player.vitals.staminaCurrent}/{total.stamina}
        </div>
        <div>Armor: {total.armor}</div>
        <div>
          Carry: {weight.currentWeight.toFixed(1)}/{weight.maxWeight.toFixed(1)}
        </div>
        <div>Gold: {player.gold}</div>
      </div>

      <div className="player-stats-block">
        <h4>Primary Stats</h4>
        <div className="player-stats-grid">
          <div>STR: {total.str}</div>
          <div>DEX: {total.dex}</div>
          <div>VIT: {total.vit}</div>
          <div>INT: {total.int}</div>
          <div>LCK: {total.lck}</div>
        </div>
      </div>

      <div className="player-stats-block">
        <h4>Derived Stats</h4>
        <div className="player-stats-grid">
          <div>Attack: {total.attack}</div>
          <div>Defense: {total.defense}</div>
          <div>Crit %: {percent(total.critChance)}</div>
          <div>Dodge %: {percent(total.dodgeChance)}</div>
          <div>HP Regen: {total.hpRegen.toFixed(2)}</div>
          <div>Stamina Regen: {total.staminaRegen.toFixed(2)}</div>
          <div>Movement: {total.movementFeet.toFixed(0)} ft ({computeMovementTilesPerTurn(total.movementFeet)} tiles/turn)</div>
          <div>Magic Find: {percent(total.magicFind)}</div>
        </div>
      </div>

      <div className="player-stats-block">
        <h4>Status Effects</h4>
        {player.statusEffects.length === 0 ? (
          <p className="status-empty">No active effects.</p>
        ) : (
          <div className="player-stats-grid">
            {player.statusEffects.map((effect) => (
              <div key={effect}>{effect}</div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
