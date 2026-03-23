"use client";

import { useEffect, useMemo, useState } from "react";
import { loadGameData } from "../game/data";
import { computeEffectivePlayerStats } from "../game/systems";
import { buildFollowCamera, DEFAULT_CAMERA_CONFIG } from "../render";
import { useRunStore } from "../store";
import { GameCanvas } from "./GameCanvas";
import { InventoryPanel } from "./InventoryPanel";

const DEFAULT_SEED = "tower_run_001";

export function GameLoopScreen() {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    function onKeyDown(event: KeyboardEvent) {
      if (!run || run.status !== "active") {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "arrowup" || key === "w") {
        event.preventDefault();
        movePlayerByDelta(0, -1);
      } else if (key === "arrowdown" || key === "s") {
        event.preventDefault();
        movePlayerByDelta(0, 1);
      } else if (key === "arrowleft" || key === "a") {
        event.preventDefault();
        movePlayerByDelta(-1, 0);
      } else if (key === "arrowright" || key === "d") {
        event.preventDefault();
        movePlayerByDelta(1, 0);
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

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [movePlayerByDelta, pickupLoot, playerAttack, run, tryExtract]);

  const currentFloor = run ? run.floors[run.currentFloor] : null;
  const visibleTiles = useMemo(() => currentFloor?.tiles.filter((tile) => tile.visible).length ?? 0, [currentFloor]);
  const effectiveStats = useMemo(() => {
    if (!run || !bootstrapData) {
      return null;
    }
    return computeEffectivePlayerStats(run.player, new Map(bootstrapData.itemTemplates.map((item) => [item.id, item])));
  }, [run, bootstrapData]);
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
        <p>Move with WASD/arrows. F attack, G pick up loot, click loot, E extract on extraction/stairs.</p>
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
          <div className="game-viewport-section">
            {run.status === "active" && (
              <GameCanvas
                run={run}
                onTileClick={(x, y) => {
                  pickupLootFromTile(x, y);
                }}
              />
            )}
            {run.status !== "active" && <div className="viewport-placeholder">Run ended. See results below.</div>}
          </div>

          {run.status === "active" && (
            <div className="controls game-controls-row">
              <button onClick={() => movePlayerByDelta(0, -1)}>Up</button>
              <button onClick={() => movePlayerByDelta(-1, 0)}>Left</button>
              <button onClick={() => movePlayerByDelta(1, 0)}>Right</button>
              <button onClick={() => movePlayerByDelta(0, 1)}>Down</button>
              <button onClick={playerAttack}>Attack</button>
              <button onClick={pickupLoot}>Pick Up Loot</button>
              <button onClick={tryExtract}>Extract</button>
            </div>
          )}

          <div className="game-lower-section">
            <div className="hud">
              <div>Status: {run.status}</div>
              <div>Floor: {run.currentFloor}</div>
              <div>
                Player: ({run.player.position.x}, {run.player.position.y})
              </div>
              <div>
                HP: {run.player.vitals.hpCurrent}/{effectiveStats?.hp ?? run.player.stats.hp}
              </div>
              <div>ATK: {effectiveStats?.attack ?? run.player.stats.attack}</div>
              <div>DEF: {effectiveStats?.defense ?? run.player.stats.defense}</div>
              <div>Enemies Defeated: {run.defeatedEnemyIds.length}</div>
              <div>Inventory Stacks: {run.player.inventory.items.length}</div>
              <div>Visible Tiles: {visibleTiles}</div>
              {cameraState && (
                <div>
                  Camera: ({Math.round(cameraState.x)}, {Math.round(cameraState.y)}) viewport{" "}
                  {cameraState.viewportWidth}x{cameraState.viewportHeight}
                </div>
              )}
            </div>

            {run.status === "active" && bootstrapData && (
              <InventoryPanel player={run.player} itemTemplates={bootstrapData.itemTemplates} />
            )}

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
        </section>
      )}
    </main>
  );
}
