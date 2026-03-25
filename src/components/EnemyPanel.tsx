"use client";

import type { EnemyInstance, EnemyTemplate, Vec2 } from "../game/types";

interface EnemyPanelProps {
  enemies: EnemyInstance[];
  enemyTemplatesById: ReadonlyMap<string, EnemyTemplate>;
  playerPosition: Vec2;
  targetedEnemyInstanceId?: string | null;
}

function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function EnemyPanel({ enemies, enemyTemplatesById, playerPosition, targetedEnemyInstanceId }: EnemyPanelProps) {
  if (enemies.length === 0) {
    return (
      <section className="combat-side-panel enemy-panel">
        <h3>Enemies</h3>
        <div className="enemy-panel-empty">No enemies in sight.</div>
      </section>
    );
  }

  return (
    <section className="combat-side-panel enemy-panel">
      <h3>Enemies</h3>
      <div className="enemy-stack">
        {enemies.map((enemy) => {
          const template = enemyTemplatesById.get(enemy.enemyId);
          if (!template) return null;
          const hpMax = Math.max(1, template.stats.hp);
          const hpPct = Math.max(0, Math.min(100, (enemy.hpCurrent / hpMax) * 100));
          const isTargeted = enemy.instanceId === targetedEnemyInstanceId;
          return (
            <article key={enemy.instanceId} className={`enemy-card${isTargeted ? " is-targeted" : ""}`}>
              <div className="enemy-card-row">
                <strong>{template.name}</strong>
                <span>{enemy.state}</span>
              </div>
              <div className="combat-hp-label">HP {enemy.hpCurrent}/{hpMax}</div>
              <div className="combat-hp-meter enemy-meter">
                <div className="enemy-hp-meter-fill" style={{ width: `${hpPct}%` }} />
              </div>
              <div className="enemy-card-row enemy-card-meta">
                <span>{template.tier}</span>
                <span>{template.role}</span>
                <span>Dist {manhattan(enemy.position, playerPosition)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
