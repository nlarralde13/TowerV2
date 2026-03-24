"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadGameData } from "../game/data";
import { findNextPathStep } from "../game/systems";
import { buildFollowCamera, DEFAULT_CAMERA_CONFIG } from "../render";
import { useRunStore } from "../store";
import { GameCanvas } from "./GameCanvas";
import { InventoryPanel } from "./InventoryPanel";
import { PlayerInfoPanel } from "./PlayerInfoPanel";

const DEFAULT_SEED = "tower_run_001";
const MOVEMENT_STEP_MS = 150;

export function GameLoopScreen() {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<"all" | "combat" | "loot" | "inventory" | "system">("all");
  const [clickMoveTarget, setClickMoveTarget] = useState<{ x: number; y: number } | null>(null);
  const actionLogListRef = useRef<HTMLDivElement | null>(null);
  const stickLogToBottomRef = useRef(true);
  const clickMoveStallRef = useRef(0);

  const run = useRunStore((state) => state.run);
  const profile = useRunStore((state) => state.profile);
  const hasSavedRun = useRunStore((state) => state.hasSavedRun);
  const bootstrapData = useRunStore((state) => state.bootstrapData);
  const setBootstrapData = useRunStore((state) => state.setBootstrapData);
  const startRun = useRunStore((state) => state.startRun);
  const resumeSavedRun = useRunStore((state) => state.resumeSavedRun);
  const clearSavedRun = useRunStore((state) => state.clearSavedRun);
  const movePlayerByDelta = useRunStore((state) => state.movePlayerByDelta);
  const playerAttack = useRunStore((state) => state.playerAttack);
  const pickupLoot = useRunStore((state) => state.pickupLoot);
  const pickupLootFromTile = useRunStore((state) => state.pickupLootFromTile);
  const tryExtract = useRunStore((state) => state.tryExtract);
  const actionLog = useRunStore((state) => state.actionLog);
  const clearActionLog = useRunStore((state) => state.clearActionLog);
  const restart = useRunStore((state) => state.restart);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const data = await loadGameData();
        if (!active) {
          return;
        }
        setBootstrapData({
          floorRules: data.floorRules,
          enemyTemplates: data.enemies,
          itemTemplates: data.items,
          lootTables: data.lootTables,
          playerDefaults: data.playerDefaults,
          extractionRules: data.extractionRules,
          xpTable: data.xpTable,
        });
        setLoading(false);
      } catch (error) {
        if (!active) {
          return;
        }
        setLoadError(error instanceof Error ? error.message : "Unknown load error");
        setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [setBootstrapData]);

  useEffect(() => {
    const pressedDirections = new Set<"up" | "down" | "left" | "right">();
    let lastDirection: "up" | "down" | "left" | "right" | null = null;

    function applyDirection(direction: "up" | "down" | "left" | "right"): void {
      if (direction === "up") {
        movePlayerByDelta(0, -1);
      } else if (direction === "down") {
        movePlayerByDelta(0, 1);
      } else if (direction === "left") {
        movePlayerByDelta(-1, 0);
      } else if (direction === "right") {
        movePlayerByDelta(1, 0);
      }
    }

    function directionFromKey(key: string): "up" | "down" | "left" | "right" | null {
      if (key === "arrowup" || key === "w") {
        return "up";
      }
      if (key === "arrowdown" || key === "s") {
        return "down";
      }
      if (key === "arrowleft" || key === "a") {
        return "left";
      }
      if (key === "arrowright" || key === "d") {
        return "right";
      }
      return null;
    }

    function onKeyDown(event: KeyboardEvent) {
      const activeRun = useRunStore.getState().run;
      if (!activeRun || activeRun.status !== "active") {
        return;
      }
      const key = event.key.toLowerCase();
      const direction = directionFromKey(key);
      if (direction) {
        event.preventDefault();
        setClickMoveTarget(null);
        lastDirection = direction;
        if (!pressedDirections.has(direction)) {
          applyDirection(direction);
        }
        pressedDirections.add(direction);
      } else if (key === "e") {
        event.preventDefault();
        tryExtract();
      } else if (key === "f") {
        event.preventDefault();
        playerAttack();
      } else if (key === "g") {
        event.preventDefault();
        pickupLoot();
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const direction = directionFromKey(key);
      if (!direction) {
        return;
      }
      pressedDirections.delete(direction);
    }

    const repeatTimer = window.setInterval(() => {
      const activeRun = useRunStore.getState().run;
      if (!activeRun || activeRun.status !== "active" || pressedDirections.size === 0) {
        return;
      }
      if (lastDirection && pressedDirections.has(lastDirection)) {
        applyDirection(lastDirection);
        return;
      }
      const nextDirection = pressedDirections.values().next().value as "up" | "down" | "left" | "right" | undefined;
      if (!nextDirection) {
        return;
      }
      lastDirection = nextDirection;
      applyDirection(nextDirection);
    }, MOVEMENT_STEP_MS);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.clearInterval(repeatTimer);
    };
  }, [movePlayerByDelta, pickupLoot, playerAttack, tryExtract]);

  const currentFloor = run ? run.floors[run.currentFloor] : null;
  const visibleTiles = useMemo(() => currentFloor?.tiles.filter((tile) => tile.visible).length ?? 0, [currentFloor]);
  const filteredActionLog = useMemo(() => {
    if (logFilter === "all") {
      return actionLog;
    }
    return actionLog.filter((entry) => entry.category === logFilter);
  }, [actionLog, logFilter]);

  useEffect(() => {
    if (!clickMoveTarget) {
      return;
    }
    const timer = window.setInterval(() => {
      const activeRun = useRunStore.getState().run;
      if (!activeRun || activeRun.status !== "active") {
        setClickMoveTarget(null);
        return;
      }
      const floor = activeRun.floors[activeRun.currentFloor];
      if (!floor) {
        setClickMoveTarget(null);
        return;
      }

      const start = activeRun.player.position;
      const goal = clickMoveTarget;
      if (start.x === goal.x && start.y === goal.y) {
        setClickMoveTarget(null);
        pickupLootFromTile(goal.x, goal.y);
        return;
      }

      const nextStep = findNextPathStep({
        start,
        goal,
        width: floor.width,
        height: floor.height,
        tiles: floor.tiles,
      });
      if (!nextStep) {
        setClickMoveTarget(null);
        return;
      }

      const dx = nextStep.x - start.x;
      const dy = nextStep.y - start.y;
      if (dx === 0 && dy === 0) {
        setClickMoveTarget(null);
        return;
      }
      movePlayerByDelta(dx, dy);

      const after = useRunStore.getState().run;
      if (
        after &&
        after.status === "active" &&
        after.player.position.x === start.x &&
        after.player.position.y === start.y
      ) {
        clickMoveStallRef.current += 1;
        if (clickMoveStallRef.current > 4) {
          setClickMoveTarget(null);
        }
      } else {
        clickMoveStallRef.current = 0;
      }
    }, MOVEMENT_STEP_MS);

    return () => {
      window.clearInterval(timer);
      clickMoveStallRef.current = 0;
    };
  }, [clickMoveTarget, movePlayerByDelta, pickupLootFromTile]);

  useEffect(() => {
    const list = actionLogListRef.current;
    if (!list || !stickLogToBottomRef.current) {
      return;
    }
    list.scrollTop = list.scrollHeight;
  }, [filteredActionLog]);

  function formatActionLogEntry(entry: (typeof actionLog)[number]): string {
    const stamp = new Date(entry.timestamp).toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return `[${stamp}][${entry.category}][${entry.level}] ${entry.message}`;
  }
  const cameraState =
    run && currentFloor
      ? buildFollowCamera({
          playerTile: run.player.position,
          mapTileWidth: currentFloor.width,
          mapTileHeight: currentFloor.height,
          config: DEFAULT_CAMERA_CONFIG,
        })
      : null;

  return (
    <main className="shell">
      <header className="topbar">
        <h1>The Tower MVP Slice</h1>
        <p>Move with WASD/arrows or click-to-move. F attack, G pick up loot, E extract on extraction/stairs.</p>
      </header>

      {loading && <p className="message">Loading game data...</p>}
      {loadError && <p className="message error">Failed to load: {loadError}</p>}

      {!loading && !loadError && !run && (
        <section className="panel game-panel">
          {profile && (
            <div className="hud">
              <div>Profile Level: {profile.player.level}</div>
              <div>Profile XP: {profile.player.xp}</div>
            </div>
          )}
          <div className="form-row">
            <label htmlFor="seed">Run Seed</label>
            <input id="seed" value={seed} onChange={(event) => setSeed(event.target.value)} />
          </div>
          <div className="controls">
            <button disabled={!bootstrapData || seed.trim().length === 0} onClick={() => startRun(seed.trim())}>
              Start Run
            </button>
            <button disabled={!hasSavedRun} onClick={resumeSavedRun}>
              Resume Saved Run
            </button>
            <button disabled={!hasSavedRun} onClick={clearSavedRun}>
              Clear Saved Run
            </button>
          </div>
        </section>
      )}

      {run && (
        <section className="panel game-panel">
          {run.status === "active" && (
            <div className="game-workspace">
              <aside className="game-sidebar left-sidebar">
                {bootstrapData && (
                  <>
                    <PlayerInfoPanel player={run.player} itemTemplates={bootstrapData.itemTemplates} xpTable={bootstrapData.xpTable} />
                    <InventoryPanel player={run.player} itemTemplates={bootstrapData.itemTemplates} />
                  </>
                )}
              </aside>

              <div className="game-center">
                <div className="game-viewport-section">
                  <GameCanvas
                    run={run}
                    destinationTile={clickMoveTarget}
                    onTileClick={(x, y) => {
                      if (!run || run.status !== "active") {
                        return;
                      }
                      if (run.player.position.x === x && run.player.position.y === y) {
                        setClickMoveTarget(null);
                        pickupLootFromTile(x, y);
                        return;
                      }
                      clickMoveStallRef.current = 0;
                      setClickMoveTarget({ x, y });
                    }}
                  />
                </div>

                <div className="controls game-controls-row">
                  <button onClick={() => movePlayerByDelta(0, -1)}>Up</button>
                  <button onClick={() => movePlayerByDelta(-1, 0)}>Left</button>
                  <button onClick={() => movePlayerByDelta(1, 0)}>Right</button>
                  <button onClick={() => movePlayerByDelta(0, 1)}>Down</button>
                  <button onClick={playerAttack}>Attack</button>
                  <button onClick={pickupLoot}>Pick Up Loot</button>
                  <button onClick={tryExtract}>Extract</button>
                </div>

                <div className="hud">
                  <div>Status: {run.status}</div>
                  <div>Floor: {run.currentFloor}</div>
                  <div>
                    Player: ({run.player.position.x}, {run.player.position.y})
                  </div>
                  <div>
                    HP: {run.player.vitals.hpCurrent}/{run.player.totalStats.hp}
                  </div>
                  <div>
                    ATK: {run.player.totalStats.attack}
                  </div>
                  <div>
                    DEF: {run.player.totalStats.defense}
                  </div>
                  <div>Enemies Defeated: {run.defeatedEnemyIds.length}</div>
                  <div>Inventory Stacks: {run.player.inventory.items.length}</div>
                  <div>Visible Tiles: {visibleTiles}</div>
                  <div className="torch-meter-row">
                    <span>
                      Torch Fuel: {run.player.torch.fuelCurrent.toFixed(1)}/{run.player.torch.fuelMax.toFixed(1)}
                    </span>
                    <div className="torch-meter" aria-label="Torch fuel meter">
                      <div
                        className="torch-meter-fill"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, (run.player.torch.fuelCurrent / run.player.torch.fuelMax) * 100),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  {cameraState && (
                    <div>
                      Camera: ({Math.round(cameraState.x)}, {Math.round(cameraState.y)}) viewport{" "}
                      {cameraState.viewportWidth}x{cameraState.viewportHeight}
                    </div>
                  )}
                </div>
              </div>

              <aside className="game-sidebar right-sidebar">
                <section className="panel action-log-panel">
                  <div className="action-log-header">
                    <h3>Action Log</h3>
                    <div className="action-log-controls">
                      <button type="button" onClick={clearActionLog}>
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="action-log-filters">
                    {(["all", "combat", "loot", "inventory", "system"] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        className={`log-filter-button${logFilter === filter ? " is-active" : ""}`}
                        onClick={() => setLogFilter(filter)}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                  <div
                    ref={actionLogListRef}
                    className="action-log-list"
                    onScroll={(event) => {
                      const target = event.currentTarget;
                      const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
                      stickLogToBottomRef.current = distanceFromBottom <= 8;
                    }}
                  >
                    {filteredActionLog.length === 0 && <div className="action-log-empty">No log entries for this filter.</div>}
                    {filteredActionLog.map((entry, index) => (
                      <div key={`${entry.id}-${index}`} className="action-log-entry">
                        {formatActionLogEntry(entry)}
                      </div>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          )}

          {run.status !== "active" && (
            <div className="game-end-layout">
              <div className="game-viewport-section">
                <div className="viewport-placeholder">Run ended. See results below.</div>
              </div>
              {run.status === "extracted" && run.summary && (
                <article className="panel summary">
                  <h2>Run Summary</h2>
                  <p>Seed: {run.summary.seed}</p>
                  <p>Floors Reached: {run.summary.floorsReached}</p>
                  <p>Loot Value: {run.summary.lootExtractedValue}</p>
                  <p>XP Earned: {run.summary.xpEarned}</p>
                  <p>Duration: {run.summary.durationSeconds}s</p>
                  <button onClick={restart}>Start New Run</button>
                </article>
              )}
              {run.status === "dead" && run.summary && (
                <article className="panel summary">
                  <h2>You Died</h2>
                  <p>Cause: {run.summary.causeOfDeath ?? "unknown"}</p>
                  <p>Floors Reached: {run.summary.floorsReached}</p>
                  <p>XP Earned (death): {run.summary.xpEarned}</p>
                  <button onClick={restart}>Start New Run</button>
                </article>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
