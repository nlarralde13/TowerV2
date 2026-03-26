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
  const questEntries = [
    { title: "Ash and Oath", detail: "Complete one full descent and extract alive." },
    { title: "Bones in the Dark", detail: "Defeat 3 skeletal enemies in a single run." },
    { title: "Collector's Due", detail: "Extract with at least 5 total loot stacks." },
  ];

  return (
    <section className="combat-side-panel enemy-panel">
      <div className="enemy-panel-sections">
        <section className="enemy-panel-section">
          <h3>Enemies</h3>
          {enemies.length === 0 ? (
            <div className="enemy-panel-empty">No enemies in sight.</div>
          ) : (
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
          )}
        </section>

        <section className="enemy-panel-section journal-section">
          <h3>Journal</h3>
          <div className="journal-list">
            {questEntries.map((quest) => (
              <article key={quest.title} className="journal-entry">
                <strong>{quest.title}</strong>
                <p>{quest.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
