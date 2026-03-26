"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadGameData } from "../game/data";
import { canPerformInteraction, findPath } from "../game/systems";
import type { ItemTemplate, Vec2 } from "../game/types";
import { facingFromDelta } from "../game/utils";
import { getTile } from "../game/world";
import { buildFollowCamera, DEFAULT_CAMERA_CONFIG } from "../render";
import { useRunStore } from "../store";
import type { ActionLogEntry } from "../store/types";
import { EnemyPanel } from "./EnemyPanel";
import { GameCanvas } from "./GameCanvas";
import { LoadoutOverlay } from "./LoadoutOverlay";
import { PlayerPanel } from "./PlayerPanel";

const DEFAULT_SEED = "tower_run_001";
const WORLD_TICK_MS = 1200;
const PLANNED_MOVE_STEP_DELAY_MS = 200;
const POST_MOVE_COOLDOWN_MS = 600;
const VIEWPORT_EVENT_LOG_LIMIT = 8;
const EVENT_LOG_IGNORE_PREFIXES = [
  "Run started",
  "Saved run",
  "Run reset to menu",
  "Torch lit at",
  "Turn ended.",
  "Round ",
];

export function GameLoopScreen() {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clickMoveTarget, setClickMoveTarget] = useState<{ x: number; y: number } | null>(null);
  const [pathPreviewTiles, setPathPreviewTiles] = useState<Vec2[]>([]);
  const [pathReachableThisTurn, setPathReachableThisTurn] = useState(true);
  const [targetedEnemyInstanceId, setTargetedEnemyInstanceId] = useState<string | null>(null);
  const [isExecutingPlannedMove, setIsExecutingPlannedMove] = useState(false);
  const [hoveredConsoleItem, setHoveredConsoleItem] = useState<ItemTemplate | null>(null);
  const [showLoadoutOverlay, setShowLoadoutOverlay] = useState(false);
  const [movementLockedUntilMs, setMovementLockedUntilMs] = useState(0);
  const actionLogListRef = useRef<HTMLDivElement | null>(null);
  const stickLogToBottomRef = useRef(true);

  const run = useRunStore((state) => state.run);
  const profile = useRunStore((state) => state.profile);
  const hasSavedRun = useRunStore((state) => state.hasSavedRun);
  const bootstrapData = useRunStore((state) => state.bootstrapData);
  const setBootstrapData = useRunStore((state) => state.setBootstrapData);
  const startRun = useRunStore((state) => state.startRun);
  const resumeSavedRun = useRunStore((state) => state.resumeSavedRun);
  const clearSavedRun = useRunStore((state) => state.clearSavedRun);
  const movePlayerByDelta = useRunStore((state) => state.movePlayerByDelta);
  const setPlayerFacing = useRunStore((state) => state.setPlayerFacing);
  const playerAttack = useRunStore((state) => state.playerAttack);
  const endTurn = useRunStore((state) => state.endTurn);
  const pickupLoot = useRunStore((state) => state.pickupLoot);
  const pickupLootFromTile = useRunStore((state) => state.pickupLootFromTile);
  const tryExtract = useRunStore((state) => state.tryExtract);
  const actionLog = useRunStore((state) => state.actionLog);
  const restart = useRunStore((state) => state.restart);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const data = await loadGameData();
        if (!active) return;
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
        if (!active) return;
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
    function onKeyDown(event: KeyboardEvent) {
      const activeRun = useRunStore.getState().run;
      if (!activeRun || activeRun.status !== "active") return;
      if (isExecutingPlannedMove) return;
      const key = event.key.toLowerCase();
      // Movement is click-only — no keyboard movement keys
      if (key === " ") {
        if (Date.now() < movementLockedUntilMs) return;
        event.preventDefault();
        void confirmMovementPlan();
      } else if (key === "escape") {
        event.preventDefault();
        if (showLoadoutOverlay) {
          setShowLoadoutOverlay(false);
          return;
        }
        clearMovementPlan();
      } else if (key === "q") {
        event.preventDefault();
        playerAttack();
      } else if (key === "w" || key === "r" || key === "t") {
        event.preventDefault();
      } else if (key === "g") {
        event.preventDefault();
        pickupLoot();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isExecutingPlannedMove, movementLockedUntilMs, movePlayerByDelta, pathPreviewTiles, pickupLoot, playerAttack, showLoadoutOverlay, tryExtract]);

  const currentFloor = run ? run.floors[run.currentFloor] : null;
  const visibleTiles = useMemo(() => currentFloor?.tiles.filter((tile) => tile.visible).length ?? 0, [currentFloor]);

  const enemyTemplatesById = useMemo(
    () => new Map((bootstrapData?.enemyTemplates ?? []).map((t) => [t.id, t])),
    [bootstrapData?.enemyTemplates],
  );

  // Resolve the currently targeted enemy (cleared if dead or run changes)
  const targetedEnemyInstance = useMemo(() => {
    if (!targetedEnemyInstanceId || !currentFloor) return null;
    const enemy = currentFloor.enemies.find(
      (e) => e.instanceId === targetedEnemyInstanceId && e.state !== "dead",
    );
    return enemy ?? null;
  }, [targetedEnemyInstanceId, currentFloor]);
  const visibleEnemies = useMemo(
    () => currentFloor?.enemies.filter((enemy) => enemy.state !== "dead") ?? [],
    [currentFloor],
  );
  const torchLitEnemyIds = useMemo(() => {
    const ids = new Set<string>();
    if (!currentFloor) return ids;
    for (const tile of currentFloor.tiles) {
      if (tile.visible && tile.occupiedByEnemyId) {
        ids.add(tile.occupiedByEnemyId);
      }
    }
    return ids;
  }, [currentFloor]);
  const torchLitEnemies = useMemo(
    () => visibleEnemies.filter((enemy) => torchLitEnemyIds.has(enemy.instanceId)),
    [torchLitEnemyIds, visibleEnemies],
  );
  const viewportEventLog = useMemo(() => {
    return actionLog
      .filter((entry) => {
        if (EVENT_LOG_IGNORE_PREFIXES.some((prefix) => entry.message.startsWith(prefix))) {
          return false;
        }
        return entry.category === "combat" || entry.category === "loot" || entry.category === "inventory" || entry.category === "system";
      })
      .slice(-VIEWPORT_EVENT_LOG_LIMIT);
  }, [actionLog]);

  useEffect(() => {
    const list = actionLogListRef.current;
    if (!list || !stickLogToBottomRef.current) return;
    list.scrollTop = list.scrollHeight;
  }, [viewportEventLog]);

  function formatLogTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function getLootEntryItemMeta(entry: ActionLogEntry): { itemId: string; itemName: string; quantity: number } | null {
    if (entry.category !== "loot" || !entry.payload || typeof entry.payload !== "object") {
      return null;
    }
    const payload = entry.payload as Record<string, unknown>;
    if (typeof payload.itemId !== "string") return null;
    const quantity = typeof payload.quantity === "number" ? payload.quantity : 1;
    const itemName = typeof payload.itemName === "string" ? payload.itemName : payload.itemId;
    return { itemId: payload.itemId, itemName, quantity };
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
    if (lines.length === 0) {
      lines.push("No direct stat modifiers");
    }
    return lines;
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
  const canMoveTile = run?.status === "active" ? canPerformInteraction(run, "move_tile").allowed : false;
  const canUseAttack =
    run?.status === "active"
      ? canPerformInteraction(run, "attack").allowed && run.turnState.player.lastAttackRound !== run.turnState.roundNumber
      : false;
  const canPickupLoot = run?.status === "active" ? canPerformInteraction(run, "loot_pickup").allowed : false;
  const canUseExtract = run?.status === "active" ? canPerformInteraction(run, "extract").allowed : false;
  const isPlayerPhase = run?.status === "active" && run.turnState.phase === "player";
  const hasPlannedMovement = pathPreviewTiles.length > 1;
  const movementStateLabel =
    run?.status === "active"
      ? `${run.turnState.player.movementRemainingTiles}/${run.turnState.player.movementAllowanceTiles}`
      : "N/A";
  const staminaStateLabel =
    run?.status === "active"
      ? `${run.player.vitals.staminaCurrent.toFixed(0)}/${run.player.totalStats.stamina.toFixed(0)}`
      : "N/A";

  function clearMovementPlan(): void {
    setClickMoveTarget((current) => (current === null ? current : null));
    setPathPreviewTiles((current) => (current.length === 0 ? current : []));
    setPathReachableThisTurn((current) => (current ? current : true));
  }

  async function confirmMovementPlan(pathOverride?: Vec2[]): Promise<void> {
    if (isExecutingPlannedMove) return;
    if (Date.now() < movementLockedUntilMs) return;
    const activeRun = useRunStore.getState().run;
    if (!activeRun || activeRun.status !== "active") return;
    const activePath = pathOverride ?? pathPreviewTiles;
    if (activePath.length < 2) return;

    const plannedPath = activePath.slice();
    const stepsToTake = plannedPath.length - 1;
    if (stepsToTake <= 0) return;

    setIsExecutingPlannedMove(true);
    try {
      let cursor = { ...activeRun.player.position };
      let movedAtLeastOnce = false;
      for (let stepIndex = 1; stepIndex <= stepsToTake; stepIndex += 1) {
        const liveRun = useRunStore.getState().run;
        if (!liveRun || liveRun.status !== "active") break;

        const nextStep = plannedPath[stepIndex];
        const dx = nextStep.x - cursor.x;
        const dy = nextStep.y - cursor.y;
        if (Math.abs(dx) + Math.abs(dy) !== 1) break;

        movePlayerByDelta(dx, dy);
        const afterMove = useRunStore.getState().run;
        if (!afterMove || afterMove.status !== "active") break;
        const moved = afterMove.player.position.x === nextStep.x && afterMove.player.position.y === nextStep.y;
        if (!moved) break;

        cursor = { ...afterMove.player.position };
        movedAtLeastOnce = true;
        if (stepIndex < stepsToTake) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, PLANNED_MOVE_STEP_DELAY_MS);
          });
        }
      }
      if (movedAtLeastOnce) {
        setMovementLockedUntilMs(Date.now() + POST_MOVE_COOLDOWN_MS);
      }
    } finally {
      setIsExecutingPlannedMove(false);
      clearMovementPlan();
    }
  }

  useEffect(() => {
    if (isExecutingPlannedMove) return;
    if (!run || run.status !== "active") {
      clearMovementPlan();
      return;
    }
    if (run.turnState.phase !== "player") {
      clearMovementPlan();
      return;
    }
    if (
      pathPreviewTiles.length > 0 &&
      (pathPreviewTiles[0].x !== run.player.position.x || pathPreviewTiles[0].y !== run.player.position.y)
    ) {
      clearMovementPlan();
    }
  }, [isExecutingPlannedMove, pathPreviewTiles, run]);

  useEffect(() => {
    if (!run || run.status !== "active") return;
    const timerId = window.setInterval(() => {
      const activeRun = useRunStore.getState().run;
      if (!activeRun || activeRun.status !== "active") return;
      if (useRunStore.getState().run?.turnState.phase !== "player") return;
      endTurn();
    }, WORLD_TICK_MS);
    return () => {
      window.clearInterval(timerId);
    };
  }, [endTurn, run]);

  return (
    <main className="shell">
      <header className="topbar">
        <h1>The Tower MVP Slice</h1>
        <p>
          Click tiles to move. Click enemies to target and face them. Space confirm move, Q attack, G pick up loot.
        </p>
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
              <div className="hud hud-single-line">
                <div className="hud-item">Status: {run.status}</div>
                <div className="hud-item">Phase: {run.turnState.phase}</div>
                <div className="hud-item">Floor: {run.currentFloor}</div>
                <div className="hud-item">
                  Pos: ({run.player.position.x}, {run.player.position.y})
                </div>
                <div className="hud-item">
                  HP: {run.player.vitals.hpCurrent}/{run.player.totalStats.hp}
                </div>
                <div className="hud-item">ATK: {run.player.totalStats.attack}</div>
                <div className="hud-item">DEF: {run.player.totalStats.defense}</div>
                <div className="hud-item">Kills: {run.defeatedEnemyIds.length}</div>
                <div className="hud-item">Stacks: {run.player.inventory.items.length}</div>
                <div className="hud-item">Visible: {visibleTiles}</div>
                <div className="hud-item">
                  Move: {run.turnState.player.movementRemainingTiles}/{run.turnState.player.movementAllowanceTiles}
                </div>
                <div className="hud-item">Stamina: {staminaStateLabel}</div>
                <div className="hud-item torch-inline">
                  <span>
                    Torch: {run.player.torch.fuelCurrent.toFixed(1)}/{run.player.torch.fuelMax.toFixed(1)}
                  </span>
                  <div className="torch-meter" aria-label="Torch fuel meter">
                    <div
                      className="torch-meter-fill"
                      style={{
                        width: `${Math.max(0, Math.min(100, (run.player.torch.fuelCurrent / run.player.torch.fuelMax) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
                {cameraState && (
                  <div className="hud-item">
                    Cam: ({Math.round(cameraState.x)}, {Math.round(cameraState.y)})
                  </div>
                )}
              </div>
              <div className={`turn-status-strip ${isPlayerPhase ? "is-player" : "is-enemy"}`} role="status" aria-live="polite">
                <div className="turn-status-block">
                  <span className="turn-status-label">Current Phase</span>
                  <strong>{isPlayerPhase ? "Player Turn" : "Enemy Phase"}</strong>
                </div>
                <div className="turn-status-block">
                  <span className="turn-status-label">Movement Left</span>
                  <strong>{movementStateLabel}</strong>
                </div>
                <div className="turn-status-block">
                  <span className="turn-status-label">Stamina</span>
                  <strong>{staminaStateLabel}</strong>
                </div>
                <div className="turn-status-hint">
                  {isPlayerPhase ? "You can move/act now. Enemy phase advances on global tick." : "Wait for enemy phase to resolve."}
                </div>
              </div>
              <div className="combat-main-layout">
                <PlayerPanel
                  player={run.player}
                  turnState={run.turnState}
                  itemTemplates={bootstrapData?.itemTemplates ?? []}
                  xpTable={bootstrapData?.xpTable ?? null}
                />

                <div className="combat-center-column">
                  <div className="game-viewport-section">
                    <GameCanvas
                      run={run}
                      destinationTile={clickMoveTarget}
                      pathPreviewTiles={pathPreviewTiles}
                      destinationReachableThisTurn={pathReachableThisTurn}
                      enemyTemplatesById={enemyTemplatesById}
                      targetedEnemyInstanceId={targetedEnemyInstanceId}
                      onTileClick={(x, y) => {
                        if (!run || run.status !== "active") return;
                        if (isExecutingPlannedMove) return;
                        if (Date.now() < movementLockedUntilMs) return;
                        const floor = run.floors[run.currentFloor];
                        if (!floor) return;
                        const start = run.player.position;
                        const targetTile = getTile(floor.tiles, floor.width, x, y);
                        const distance = Math.abs(start.x - x) + Math.abs(start.y - y);

                        if (targetTile?.occupiedByLootIds && targetTile.occupiedByLootIds.length > 0 && distance <= 1) {
                          pickupLootFromTile(x, y);
                          clearMovementPlan();
                          return;
                        }

                        if (targetTile?.occupiedByEnemyId) {
                          const enemy = floor.enemies.find((e) => e.instanceId === targetTile.occupiedByEnemyId && e.state !== "dead");
                          if (enemy) {
                            const newFacing = facingFromDelta({ x: x - start.x, y: y - start.y }, run.player.facing);
                            setPlayerFacing(newFacing);
                            setTargetedEnemyInstanceId(enemy.instanceId);
                            clearMovementPlan();
                            return;
                          }
                        }

                        setTargetedEnemyInstanceId(null);
                        setClickMoveTarget({ x, y });

                        if (start.x === x && start.y === y) {
                          setPathPreviewTiles([{ x, y }]);
                          setPathReachableThisTurn(true);
                          return;
                        }
                        if (!targetTile || !targetTile.walkable) {
                          setPathPreviewTiles([start, { x, y }]);
                          setPathReachableThisTurn(false);
                          return;
                        }
                        const path = findPath({
                          start,
                          goal: { x, y },
                          width: floor.width,
                          height: floor.height,
                          tiles: floor.tiles,
                        });
                        if (!path || path.length < 2) {
                          setPathPreviewTiles([start, { x, y }]);
                          setPathReachableThisTurn(false);
                          return;
                        }

                        setPathPreviewTiles(path);
                        setPathReachableThisTurn(true);
                        void confirmMovementPlan(path);
                      }}
                    />
                  </div>

                  <div className="controls game-controls-row">
                    <div className="action-group">
                      <button onClick={playerAttack} disabled={!canUseAttack}>
                        Skill 1 (Q): Attack
                      </button>
                      <button disabled title="Skill placeholder">
                        Skill 2 (W): Empty
                      </button>
                      <button disabled title="Skill placeholder">
                        Skill 3 (R): Empty
                      </button>
                      <button disabled title="Skill placeholder">
                        Skill 4 (T): Empty
                      </button>
                      <button onClick={pickupLoot} disabled={!canPickupLoot}>
                        Pick Up Loot
                      </button>
                      <button onClick={tryExtract} disabled={!canUseExtract}>
                        Extract
                      </button>
                      <button onClick={() => setShowLoadoutOverlay(true)} disabled={!bootstrapData}>
                        Loadout
                      </button>
                    </div>
                    <div className="action-group">
                      <button
                        onClick={() => {
                          void confirmMovementPlan();
                        }}
                        disabled={
                          !isPlayerPhase ||
                          !canMoveTile ||
                          !hasPlannedMovement ||
                          !pathReachableThisTurn ||
                          isExecutingPlannedMove ||
                          Date.now() < movementLockedUntilMs
                        }
                      >
                        Confirm Move [Space]
                      </button>
                      <button onClick={clearMovementPlan} disabled={isExecutingPlannedMove || (!hasPlannedMovement && !clickMoveTarget)}>
                        Cancel Move [Esc]
                      </button>
                    </div>
                  </div>

                  <section className="run-events-panel panel" aria-live="polite" aria-label="Run events">
                    <header className="run-events-header">Run Events</header>
                    <div
                      ref={actionLogListRef}
                      className="run-events-list"
                      onScroll={(event) => {
                        const target = event.currentTarget;
                        const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
                        stickLogToBottomRef.current = distanceFromBottom <= 8;
                      }}
                    >
                      {viewportEventLog.length === 0 && <div className="viewport-event-empty">No meaningful events yet.</div>}
                      {viewportEventLog.map((entry, index) => {
                        const lootMeta = getLootEntryItemMeta(entry);
                        const itemTemplate =
                          lootMeta && bootstrapData ? bootstrapData.itemTemplates.find((item) => item.id === lootMeta.itemId) ?? null : null;
                        return (
                          <div key={`${entry.id}-${index}`} className={`viewport-event-item is-${entry.category}`}>
                            <span className="viewport-event-time">{formatLogTimestamp(entry.timestamp)}</span>
                            <span className="viewport-event-message">
                              {lootMeta && itemTemplate ? (
                                <>
                                  Picked up {lootMeta.quantity}x{" "}
                                  <button
                                    type="button"
                                    className="viewport-event-item-link"
                                    onMouseEnter={() => setHoveredConsoleItem(itemTemplate)}
                                    onMouseLeave={() => setHoveredConsoleItem((current) => (current?.id === itemTemplate.id ? null : current))}
                                  >
                                    {itemTemplate.name}
                                  </button>
                                  .
                                </>
                              ) : (
                                entry.message
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {hoveredConsoleItem && (
                      <aside className="viewport-event-tooltip">
                        <div className="viewport-event-tooltip-name">{hoveredConsoleItem.name}</div>
                        {buildTooltipLines(hoveredConsoleItem).map((line) => (
                          <div key={line} className="viewport-event-tooltip-stat">
                            {line}
                          </div>
                        ))}
                        <div className="viewport-event-tooltip-flavor">
                          {hoveredConsoleItem.flavorText ?? "No flavor text."}
                        </div>
                      </aside>
                    )}
                  </section>
                </div>

                <EnemyPanel
                  enemies={torchLitEnemies}
                  enemyTemplatesById={enemyTemplatesById}
                  playerPosition={run.player.position}
                  targetedEnemyInstanceId={targetedEnemyInstance?.instanceId ?? null}
                />
              </div>

              {showLoadoutOverlay && bootstrapData && (
                <LoadoutOverlay
                  player={run.player}
                  itemTemplates={bootstrapData.itemTemplates}
                  onClose={() => setShowLoadoutOverlay(false)}
                />
              )}
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
