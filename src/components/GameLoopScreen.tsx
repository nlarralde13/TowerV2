"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadGameData } from "../game/data";
import { canPerformInteraction, findPath } from "../game/systems";
import type { ItemTemplate, Vec2 } from "../game/types";
import { getTile } from "../game/world";
import { buildFollowCamera, DEFAULT_CAMERA_CONFIG } from "../render";
import { useRunStore } from "../store";
import type { ActionLogEntry } from "../store/types";
import { GameCanvas } from "./GameCanvas";
import { InventoryPanel } from "./InventoryPanel";
import { PlayerInfoPanel } from "./PlayerInfoPanel";

const DEFAULT_SEED = "tower_run_001";
const LEFT_DRAWER_TABS = [
  { id: "inventory", label: "Inventory", hotkey: "I" },
  { id: "character", label: "Character", hotkey: "C" },
] as const;
const RIGHT_DRAWER_TABS = [
  { id: "journal", label: "Journal", hotkey: "J" },
  { id: "log", label: "Log", hotkey: "L" },
] as const;
type LeftDrawerTabId = (typeof LEFT_DRAWER_TABS)[number]["id"];
type RightDrawerTabId = (typeof RIGHT_DRAWER_TABS)[number]["id"];

const JOURNAL_PLACEHOLDER_ENTRIES = [
  "[Entry] The lower crypts breathe in rhythms not my own.",
  "[Entry] Something in crimson plate watched from the stairwell arch.",
  "[Entry] Torch oil is thinning. Shadows grow teeth near extraction doors.",
  "[Entry] Next run: prioritize ranged weapon and carry more fuel.",
];
const PLANNED_MOVE_STEP_DELAY_MS = 95;
const VIEWPORT_EVENT_LOG_LIMIT = 8;
const EVENT_LOG_IGNORE_PREFIXES = ["Run started", "Saved run", "Run reset to menu", "Torch lit at"];

export function GameLoopScreen() {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<"all" | "combat" | "loot" | "inventory" | "system">("all");
  const [activeLeftTab, setActiveLeftTab] = useState<LeftDrawerTabId | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<RightDrawerTabId | null>(null);
  const [clickMoveTarget, setClickMoveTarget] = useState<{ x: number; y: number } | null>(null);
  const [pathPreviewTiles, setPathPreviewTiles] = useState<Vec2[]>([]);
  const [pathReachableThisTurn, setPathReachableThisTurn] = useState(true);
  const [isExecutingPlannedMove, setIsExecutingPlannedMove] = useState(false);
  const [hoveredConsoleItem, setHoveredConsoleItem] = useState<ItemTemplate | null>(null);
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
  const playerAttack = useRunStore((state) => state.playerAttack);
  const endTurn = useRunStore((state) => state.endTurn);
  const pickupLoot = useRunStore((state) => state.pickupLoot);
  const tryExtract = useRunStore((state) => state.tryExtract);
  const actionLog = useRunStore((state) => state.actionLog);
  const clearActionLog = useRunStore((state) => state.clearActionLog);
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
    function applyDirection(direction: "up" | "down" | "left" | "right"): void {
      if (direction === "up") movePlayerByDelta(0, -1);
      else if (direction === "down") movePlayerByDelta(0, 1);
      else if (direction === "left") movePlayerByDelta(-1, 0);
      else if (direction === "right") movePlayerByDelta(1, 0);
    }

    function directionFromKey(key: string): "up" | "down" | "left" | "right" | null {
      if (key === "arrowup" || key === "w") return "up";
      if (key === "arrowdown" || key === "s") return "down";
      if (key === "arrowleft" || key === "a") return "left";
      if (key === "arrowright" || key === "d") return "right";
      return null;
    }

    function onKeyDown(event: KeyboardEvent) {
      const activeRun = useRunStore.getState().run;
      if (!activeRun || activeRun.status !== "active") return;
      if (isExecutingPlannedMove) return;

      const key = event.key.toLowerCase();
      const direction = directionFromKey(key);
      if (direction) {
        if (event.repeat) return;
        event.preventDefault();
        clearMovementPlan();
        applyDirection(direction);
      } else if (key === "enter") {
        event.preventDefault();
        void confirmMovementPlan();
      } else if (key === "escape") {
        event.preventDefault();
        clearMovementPlan();
      } else if (key === "e") {
        event.preventDefault();
        tryExtract();
      } else if (key === "f") {
        event.preventDefault();
        playerAttack();
      } else if (key === " ") {
        event.preventDefault();
        endTurn();
      } else if (key === "g") {
        event.preventDefault();
        pickupLoot();
      } else if (key === "i") {
        event.preventDefault();
        setActiveLeftTab((current) => (current === "inventory" ? null : "inventory"));
      } else if (key === "c") {
        event.preventDefault();
        setActiveLeftTab((current) => (current === "character" ? null : "character"));
      } else if (key === "l") {
        event.preventDefault();
        setActiveRightTab((current) => (current === "log" ? null : "log"));
      } else if (key === "j") {
        event.preventDefault();
        setActiveRightTab((current) => (current === "journal" ? null : "journal"));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [endTurn, isExecutingPlannedMove, movePlayerByDelta, pathPreviewTiles, pickupLoot, playerAttack, tryExtract]);

  const currentFloor = run ? run.floors[run.currentFloor] : null;
  const visibleTiles = useMemo(() => currentFloor?.tiles.filter((tile) => tile.visible).length ?? 0, [currentFloor]);
  const filteredActionLog = useMemo(() => {
    if (logFilter === "all") return actionLog;
    return actionLog.filter((entry) => entry.category === logFilter);
  }, [actionLog, logFilter]);
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
  }, [filteredActionLog]);

  function formatLogTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function formatActionLogEntry(entry: (typeof actionLog)[number]): string {
    const stamp = formatLogTimestamp(entry.timestamp);
    return `[${stamp}][${entry.category}][${entry.level}] ${entry.message}`;
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
  const canUseTurnAction = run?.status === "active" && run.turnState.phase === "player" && run.turnState.player.actionAvailable;
  const canMoveTile = run?.status === "active" ? canPerformInteraction(run, "move_tile").allowed : false;
  const canUseExtract = run?.status === "active" ? canPerformInteraction(run, "extract").allowed : false;
  const isPlayerPhase = run?.status === "active" && run.turnState.phase === "player";
  const hasPlannedMovement = pathPreviewTiles.length > 1;
  const actionStateLabel =
    run?.status === "active" ? (run.turnState.player.actionAvailable ? "Available" : "Spent") : "N/A";
  const movementStateLabel =
    run?.status === "active"
      ? `${run.turnState.player.movementRemainingTiles}/${run.turnState.player.movementAllowanceTiles}`
      : "N/A";

  function clearMovementPlan(): void {
    setClickMoveTarget((current) => (current === null ? current : null));
    setPathPreviewTiles((current) => (current.length === 0 ? current : []));
    setPathReachableThisTurn((current) => (current ? current : true));
  }

  async function confirmMovementPlan(): Promise<void> {
    if (isExecutingPlannedMove) return;
    const activeRun = useRunStore.getState().run;
    if (!activeRun || activeRun.status !== "active" || activeRun.turnState.phase !== "player") return;
    if (!pathReachableThisTurn) return;
    if (pathPreviewTiles.length < 2) return;

    const plannedPath = pathPreviewTiles.slice();
    const movementBudget = activeRun.turnState.player.movementRemainingTiles;
    const stepsToTake = Math.min(movementBudget, plannedPath.length - 1);
    if (stepsToTake <= 0) return;

    setIsExecutingPlannedMove(true);
    try {
      let cursor = { ...activeRun.player.position };
      for (let stepIndex = 1; stepIndex <= stepsToTake; stepIndex += 1) {
        const liveRun = useRunStore.getState().run;
        if (!liveRun || liveRun.status !== "active" || liveRun.turnState.phase !== "player") break;
        if (liveRun.turnState.player.movementRemainingTiles <= 0) break;

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
        if (stepIndex < stepsToTake) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, PLANNED_MOVE_STEP_DELAY_MS);
          });
        }
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
    if (run.turnState.phase !== "player" || run.turnState.player.movementRemainingTiles <= 0) {
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

  return (
    <main className="shell">
      <header className="topbar">
        <h1>The Tower MVP Slice</h1>
        <p>
          Move with WASD/arrows or click-to-step. F attack, G pick up loot, E extract, Space end turn. Panels: C character, I inventory, J journal, L log.
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
                <div className="hud-item">Round: {run.turnState.roundNumber}</div>
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
                <div className="hud-item">Action: {run.turnState.player.actionAvailable ? "ready" : "spent"}</div>
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
                  <span className="turn-status-label">Action</span>
                  <strong>{actionStateLabel}</strong>
                </div>
                <div className="turn-status-block">
                  <span className="turn-status-label">Round</span>
                  <strong>{run.turnState.roundNumber}</strong>
                </div>
                <div className="turn-status-hint">
                  {isPlayerPhase ? "You can move/act now. End turn with Space or button." : "Wait for enemy phase to resolve."}
                </div>
              </div>

              <div className="game-main-row">
                <div className="drawer-stage">
                  <aside className={`edge-drawer left ${activeLeftTab ? "is-open" : ""}`}>
                    <div className="edge-drawer-inner">
                      {activeLeftTab === "inventory" && bootstrapData && (
                        <section className="panel edge-panel-content">
                          <div className="edge-panel-header">
                            <h3>Inventory</h3>
                            <button type="button" onClick={() => setActiveLeftTab(null)}>
                              Close [I]
                            </button>
                          </div>
                          <div className="edge-panel-scroll">
                            <InventoryPanel player={run.player} itemTemplates={bootstrapData.itemTemplates} />
                          </div>
                        </section>
                      )}
                      {activeLeftTab === "character" && bootstrapData && (
                        <section className="panel edge-panel-content">
                          <div className="edge-panel-header">
                            <h3>Character</h3>
                            <button type="button" onClick={() => setActiveLeftTab(null)}>
                              Close [C]
                            </button>
                          </div>
                          <div className="edge-panel-scroll">
                            <PlayerInfoPanel
                              player={run.player}
                              itemTemplates={bootstrapData.itemTemplates}
                              xpTable={bootstrapData.xpTable}
                            />
                          </div>
                        </section>
                      )}
                    </div>
                  </aside>

                  <div className="edge-tab-rail left">
                    {LEFT_DRAWER_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={`edge-tab${activeLeftTab === tab.id ? " is-active" : ""}`}
                        onClick={() => setActiveLeftTab((current) => (current === tab.id ? null : tab.id))}
                      >
                        {tab.label} [{tab.hotkey}]
                      </button>
                    ))}
                  </div>

                  <div className="game-viewport-section">
                    <GameCanvas
                      run={run}
                      destinationTile={clickMoveTarget}
                      pathPreviewTiles={pathPreviewTiles}
                      destinationReachableThisTurn={pathReachableThisTurn}
                      onTileClick={(x, y) => {
                        if (!run || run.status !== "active") return;
                        if (isExecutingPlannedMove) return;
                        const floor = run.floors[run.currentFloor];
                        if (!floor) return;
                        const start = run.player.position;
                        const targetTile = getTile(floor.tiles, floor.width, x, y);
                        setClickMoveTarget({ x, y });
                        if (start.x === x && start.y === y) {
                          setPathPreviewTiles([{ x, y }]);
                          setPathReachableThisTurn(true);
                          return;
                        }
                        if (!targetTile || !targetTile.walkable || targetTile.occupiedByEnemyId) {
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

                        const movementBudget = run.turnState.player.movementRemainingTiles;
                        const totalSteps = path.length - 1;
                        const reachableThisTurn = totalSteps <= movementBudget;
                        setPathReachableThisTurn(reachableThisTurn);
                      }}
                    />
                    <section className="viewport-event-console" aria-live="polite" aria-label="Recent events">
                      <header className="viewport-event-console-header">Run Events</header>
                      <div className="viewport-event-console-list">
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

                  <div className="edge-tab-rail right">
                    {RIGHT_DRAWER_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={`edge-tab${activeRightTab === tab.id ? " is-active" : ""}`}
                        onClick={() => setActiveRightTab((current) => (current === tab.id ? null : tab.id))}
                      >
                        {tab.label} [{tab.hotkey}]
                      </button>
                    ))}
                  </div>

                  <aside className={`edge-drawer right ${activeRightTab ? "is-open" : ""}`}>
                    <div className="edge-drawer-inner">
                      {activeRightTab === "journal" && (
                        <section className="panel edge-panel-content">
                          <div className="edge-panel-header">
                            <h3>Journal</h3>
                            <button type="button" onClick={() => setActiveRightTab(null)}>
                              Close [J]
                            </button>
                          </div>
                          <div className="edge-panel-scroll">
                            <div className="journal-list">
                              {JOURNAL_PLACEHOLDER_ENTRIES.map((entry) => (
                                <div key={entry} className="journal-entry">
                                  {entry}
                                </div>
                              ))}
                            </div>
                          </div>
                        </section>
                      )}
                      {activeRightTab === "log" && (
                        <section className="panel edge-panel-content action-log-panel">
                          <div className="edge-panel-header">
                            <h3>Action Log</h3>
                            <div className="action-log-controls">
                              <button type="button" onClick={() => setActiveRightTab(null)}>
                                Close [L]
                              </button>
                              <button type="button" onClick={clearActionLog}>
                                Clear
                              </button>
                            </div>
                          </div>
                          <div className="edge-panel-scroll">
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
                              {filteredActionLog.length === 0 && (
                                <div className="action-log-empty">No log entries for this filter.</div>
                              )}
                              {filteredActionLog.map((entry, index) => (
                                <div key={`${entry.id}-${index}`} className="action-log-entry">
                                  {formatActionLogEntry(entry)}
                                </div>
                              ))}
                            </div>
                          </div>
                        </section>
                      )}
                    </div>
                  </aside>
                </div>
              </div>

              <div className="controls game-controls-row">
                <button onClick={() => movePlayerByDelta(0, -1)} disabled={!canMoveTile || isExecutingPlannedMove}>
                  Up
                </button>
                <button onClick={() => movePlayerByDelta(-1, 0)} disabled={!canMoveTile || isExecutingPlannedMove}>
                  Left
                </button>
                <button onClick={() => movePlayerByDelta(1, 0)} disabled={!canMoveTile || isExecutingPlannedMove}>
                  Right
                </button>
                <button onClick={() => movePlayerByDelta(0, 1)} disabled={!canMoveTile || isExecutingPlannedMove}>
                  Down
                </button>
                <button onClick={playerAttack} disabled={!canUseTurnAction}>
                  Attack
                </button>
                <button onClick={pickupLoot} disabled={!canUseTurnAction}>
                  Pick Up Loot
                </button>
                <button onClick={tryExtract} disabled={!canUseExtract}>
                  Extract
                </button>
                <button
                  onClick={() => {
                    void confirmMovementPlan();
                  }}
                  disabled={!isPlayerPhase || !canMoveTile || !hasPlannedMovement || !pathReachableThisTurn || isExecutingPlannedMove}
                >
                  Confirm Move [Enter]
                </button>
                <button onClick={clearMovementPlan} disabled={isExecutingPlannedMove || (!hasPlannedMovement && !clickMoveTarget)}>
                  Cancel Move [Esc]
                </button>
                <button onClick={endTurn} disabled={!isPlayerPhase} title="End your turn and resolve enemy phase">
                  End Turn [Space]
                </button>
              </div>
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
