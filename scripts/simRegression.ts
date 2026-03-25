import { readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import {
  loadGameData,
  loadProfile,
  loadRunState,
  mapRunStateToRunSave,
  mapRunStateToSnapshot,
  saveRunState,
  type JsonFetcher,
} from "../src/game/data";
import { createInitialRunState } from "../src/game/engine";
import { playerLightAttack, resolveEnemyDeathLoot, spawnEnemiesForFloor, tryMoveByDelta } from "../src/game/systems";
import { consumeTorchFuel, getTorchRevealRadius, restoreTorchFuel } from "../src/game/systems/torch";
import { computeMovementTilesPerTurn, type EnemyInstance, type FloorState, type RunState } from "../src/game/types";
import { useRunStore } from "../src/store";

class MemoryStorage implements Storage {
  private readonly rows = new Map<string, string>();

  public get length(): number {
    return this.rows.size;
  }

  public clear(): void {
    this.rows.clear();
  }

  public getItem(key: string): string | null {
    return this.rows.get(key) ?? null;
  }

  public key(index: number): string | null {
    return Array.from(this.rows.keys())[index] ?? null;
  }

  public removeItem(key: string): void {
    this.rows.delete(key);
  }

  public setItem(key: string, value: string): void {
    this.rows.set(key, value);
  }
}

function createDataFetcher(): JsonFetcher {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const requestPath = String(input);
    const fileName = path.basename(requestPath);
    const filePath = path.join(process.cwd(), "public", "data", fileName);
    try {
      const body = await readFile(filePath, "utf8");
      return new Response(body, { status: 200 });
    } catch {
      return new Response("Not Found", { status: 404, statusText: "Not Found" });
    }
  };
}

function deterministicRunSlice(run: ReturnType<typeof createInitialRunState>) {
  const floor = run.floors[run.currentFloor];
  return {
    currentFloor: run.currentFloor,
    playerStart: run.player.position,
    tileFingerprint: floor.tiles.map((tile) => `${tile.x},${tile.y}:${tile.roomType}:${tile.walkable ? 1 : 0}`),
    enemyFingerprint: floor.enemies
      .map((enemy) => `${enemy.enemyId}@${enemy.position.x},${enemy.position.y}`)
      .sort(),
    extractionNodeIds: [...floor.extractionNodeIds].sort(),
  };
}

function findOpenMovementDelta(run: RunState): { x: number; y: number } | null {
  const floor = run.floors[run.currentFloor];
  if (!floor) {
    return null;
  }
  const deltas = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  for (const delta of deltas) {
    const moved = tryMoveByDelta({
      position: run.player.position,
      delta,
      tiles: floor.tiles,
      width: floor.width,
      height: floor.height,
    });
    if (moved.moved) {
      return delta;
    }
  }
  return null;
}

async function runRegressionSuite(): Promise<void> {
  const templates = await loadGameData({ fetcher: createDataFetcher() });
  const enemyTemplatesById = new Map(templates.enemies.map((entry) => [entry.id, entry]));
  const itemTemplatesById = new Map(templates.items.map((entry) => [entry.id, entry]));
  const lootTablesById = new Map(templates.lootTables.map((entry) => [entry.id, entry]));

  const runA = createInitialRunState({
    runId: "sim_run",
    seed: "sim_seed_alpha",
    floorRules: templates.floorRules,
    enemyTemplates: templates.enemies,
    itemTemplates: templates.items,
    playerDefaults: templates.playerDefaults,
  });
  const runB = createInitialRunState({
    runId: "sim_run",
    seed: "sim_seed_alpha",
    floorRules: templates.floorRules,
    enemyTemplates: templates.enemies,
    itemTemplates: templates.items,
    playerDefaults: templates.playerDefaults,
  });

  assert.deepEqual(
    deterministicRunSlice(runA),
    deterministicRunSlice(runB),
    "Run generation should be deterministic for same seed + inputs.",
  );

  const floorRule = templates.floorRules[0];
  const floor = runA.floors[runA.currentFloor];
  const spawnsA = spawnEnemiesForFloor({
    runSeed: runA.seed,
    floorNumber: runA.currentFloor,
    floorRule,
    floorWidth: floor.width,
    tiles: floor.tiles,
    enemyTemplatesById,
  });
  const spawnsB = spawnEnemiesForFloor({
    runSeed: runA.seed,
    floorNumber: runA.currentFloor,
    floorRule,
    floorWidth: floor.width,
    tiles: floor.tiles,
    enemyTemplatesById,
  });
  assert.deepEqual(spawnsA, spawnsB, "Enemy spawn selection should be deterministic for same seed.");

  const blockedMove = tryMoveByDelta({
    position: { x: 1, y: 1 },
    delta: { x: -1, y: 0 },
    tiles: floor.tiles,
    width: floor.width,
    height: floor.height,
  });
  assert.equal(blockedMove.moved, false, "Boundary wall should block movement.");
  assert.equal(blockedMove.reason, "blocked", "Movement into a wall should return blocked reason.");

  const torchBefore = runA.player.torch;
  const torchTick = consumeTorchFuel(torchBefore);
  assert.equal(
    torchTick.torch.fuelCurrent,
    torchBefore.fuelCurrent - torchBefore.fuelDrainPerTurn,
    "Torch fuel should drain by configured amount each active turn.",
  );
  assert.equal(
    getTorchRevealRadius({ ...torchBefore, fuelCurrent: torchBefore.fuelMax }),
    torchBefore.revealRadiusHigh,
    "High fuel should map to high reveal radius.",
  );
  assert.equal(
    getTorchRevealRadius({ ...torchBefore, fuelCurrent: torchBefore.fuelMax * 0.2 }),
    torchBefore.revealRadiusLow,
    "Low fuel should map to low reveal radius.",
  );
  const restoredTorch = restoreTorchFuel({ ...torchBefore, fuelCurrent: 1 }, 999);
  assert.equal(restoredTorch.fuelCurrent, torchBefore.fuelMax, "Torch fuel restore should clamp to max fuel.");

  const baseEnemy = floor.enemies[0];
  assert.ok(baseEnemy, "Initial floor should include at least one enemy for regression checks.");
  const adjacentEnemy: EnemyInstance = {
    ...baseEnemy,
    position: { x: runA.player.position.x + 1, y: runA.player.position.y },
    state: "idle",
    hpCurrent: enemyTemplatesById.get(baseEnemy.enemyId)?.stats.hp ?? 1,
  };

  const combatFloor: FloorState = {
    ...floor,
    enemies: [adjacentEnemy],
  };

  const combatBaseRun: RunState = {
    ...runA,
    player: { ...runA.player },
    floors: {
      ...runA.floors,
      [runA.currentFloor]: combatFloor,
    },
  };

  const facingHitRun = {
    ...combatBaseRun,
    player: { ...combatBaseRun.player, facing: "right" as const },
  };
  const facingMissRun = {
    ...combatBaseRun,
    player: { ...combatBaseRun.player, facing: "left" as const },
  };

  const hitResult = playerLightAttack({
    run: facingHitRun,
    enemyTemplatesById,
    itemTemplatesById,
  });
  const missResult = playerLightAttack({
    run: facingMissRun,
    enemyTemplatesById,
    itemTemplatesById,
  });

  assert.equal(hitResult.attacked, true, "Forward-facing melee attack should hit target in front.");
  assert.equal(missResult.attacked, false, "Melee attack should miss when target is not in forward tile.");

  const deadEnemyRun: RunState = {
    ...combatBaseRun,
    floors: {
      ...combatBaseRun.floors,
      [combatBaseRun.currentFloor]: {
        ...combatBaseRun.floors[combatBaseRun.currentFloor],
        enemies: [{ ...adjacentEnemy, state: "dead", lootResolved: false, hpCurrent: 0 } as EnemyInstance],
        groundLoot: [],
      },
    },
  };
  const lootA = resolveEnemyDeathLoot({
    run: structuredClone(deadEnemyRun),
    floor: structuredClone(deadEnemyRun.floors[deadEnemyRun.currentFloor]),
    enemyTemplatesById,
    lootTablesById,
  });
  const lootB = resolveEnemyDeathLoot({
    run: structuredClone(deadEnemyRun),
    floor: structuredClone(deadEnemyRun.floors[deadEnemyRun.currentFloor]),
    enemyTemplatesById,
    lootTablesById,
  });

  assert.deepEqual(
    lootA.floors[lootA.currentFloor].groundLoot,
    lootB.floors[lootB.currentFloor].groundLoot,
    "Enemy loot resolution should be deterministic for same seed + state.",
  );

  const memoryStorage = new MemoryStorage();
  (globalThis as { window?: { localStorage: Storage } }).window = {
    localStorage: memoryStorage,
  };

  saveRunState(runA);
  const restored = loadRunState();
  assert.ok(restored, "Current run save should restore.");
  assert.equal(restored?.seed, runA.seed, "Restored run should preserve seed.");

  memoryStorage.setItem(
    "tower.mvp.runSave.v3",
    JSON.stringify({ version: 99, savedAt: Date.now(), runSave: {}, snapshot: {} }),
  );
  const unsupportedFutureLoad = loadRunState();
  assert.equal(unsupportedFutureLoad, null, "Unsupported future run save version should not be loaded.");
  assert.equal(memoryStorage.getItem("tower.mvp.runSave.v3"), null, "Unsupported save should be removed.");

  memoryStorage.setItem(
    "tower.mvp.profileSave.v1",
    JSON.stringify({ profileVersion: 999, player: {}, unlocks: {} }),
  );
  const migratedProfile = loadProfile(templates.playerDefaults);
  assert.equal(migratedProfile.profileVersion, 1, "Invalid profile version should be reset to current profile schema.");
  assert.equal(migratedProfile.player.level, templates.playerDefaults.baseStats.level);

  // TURN FLOW REGRESSION COVERAGE (TURN-014)
  useRunStore.setState({
    run: null,
    profile: null,
    hasSavedRun: false,
    bootstrapData: null,
    actionLog: [],
  });
  const store = useRunStore.getState();
  store.setBootstrapData({
    floorRules: templates.floorRules,
    enemyTemplates: templates.enemies,
    itemTemplates: templates.items,
    lootTables: templates.lootTables,
    playerDefaults: templates.playerDefaults,
    extractionRules: templates.extractionRules,
    xpTable: templates.xpTable,
  });
  useRunStore.getState().startRun("turn_regression_seed");
  const startedRun = useRunStore.getState().run;
  assert.ok(startedRun && startedRun.status === "active", "Store should create an active run for turn-flow regression.");

  const expectedTilesPerTurn = computeMovementTilesPerTurn(startedRun.player.totalStats.movementFeet);
  assert.equal(
    startedRun.turnState.player.movementAllowanceTiles,
    expectedTilesPerTurn,
    "Movement allowance should derive from movementFeet with shared tile rule.",
  );
  assert.equal(
    startedRun.turnState.player.movementRemainingTiles,
    expectedTilesPerTurn,
    "Movement remaining should start equal to allowance at turn start.",
  );

  const stepDelta = findOpenMovementDelta(startedRun);
  assert.ok(stepDelta, "Regression run must have at least one movable adjacent tile.");
  for (let i = 0; i < expectedTilesPerTurn; i += 1) {
    const before = useRunStore.getState().run;
    assert.ok(before && before.status === "active");
    useRunStore.getState().movePlayerByDelta(stepDelta.x, stepDelta.y);
    const after = useRunStore.getState().run;
    assert.ok(after && after.status === "active");
    const expectedRemaining = Math.max(0, before.turnState.player.movementRemainingTiles - 1);
    assert.equal(
      after.turnState.player.movementRemainingTiles,
      expectedRemaining,
      "Each successful movement step should spend exactly one movement tile.",
    );
  }

  const movementSpentRun = useRunStore.getState().run;
  assert.ok(movementSpentRun && movementSpentRun.status === "active");
  const spentPosition = { ...movementSpentRun.player.position };
  useRunStore.getState().movePlayerByDelta(stepDelta.x, stepDelta.y);
  const blockedByBudgetRun = useRunStore.getState().run;
  assert.ok(blockedByBudgetRun && blockedByBudgetRun.status === "active");
  assert.equal(
    blockedByBudgetRun.player.position.x,
    spentPosition.x,
    "Movement should fail once movement budget is exhausted.",
  );
  assert.equal(
    blockedByBudgetRun.player.position.y,
    spentPosition.y,
    "Movement should not change position after movement budget is exhausted.",
  );

  // Prepare deterministic attack target for action-spend checks.
  const attackRunBefore = useRunStore.getState().run;
  assert.ok(attackRunBefore && attackRunBefore.status === "active");
  const attackFloor = attackRunBefore.floors[attackRunBefore.currentFloor];
  const attackTemplate = templates.enemies[0];
  const attackEnemy: EnemyInstance = {
    ...attackFloor.enemies[0],
    enemyId: attackTemplate.id,
    hpCurrent: attackTemplate.stats.hp,
    position: { x: attackRunBefore.player.position.x + 1, y: attackRunBefore.player.position.y },
    state: "idle",
    lootResolved: false,
  };
  useRunStore.setState({
    run: {
      ...attackRunBefore,
      player: { ...attackRunBefore.player, facing: "right" },
      floors: {
        ...attackRunBefore.floors,
        [attackRunBefore.currentFloor]: {
          ...attackFloor,
          enemies: [attackEnemy],
        },
      },
    },
  });
  const beforeAttack = useRunStore.getState().run;
  assert.ok(beforeAttack && beforeAttack.status === "active");
  const roundBeforeAttack = beforeAttack.turnState.roundNumber;
  const torchBeforeAttack = beforeAttack.player.torch.fuelCurrent;
  useRunStore.getState().playerAttack();
  const afterFirstAttack = useRunStore.getState().run;
  assert.ok(afterFirstAttack && afterFirstAttack.status === "active");
  assert.equal(
    afterFirstAttack.turnState.player.actionAvailable,
    false,
    "Successful attack should consume action for the turn.",
  );
  assert.equal(
    afterFirstAttack.turnState.roundNumber,
    roundBeforeAttack,
    "Player attack should not auto-advance round (no post-action enemy batching).",
  );
  assert.equal(
    afterFirstAttack.player.torch.fuelCurrent,
    torchBeforeAttack,
    "Player attack should not drain torch; torch drains during enemy phase round step.",
  );

  const enemyHpAfterFirstAttack = afterFirstAttack.floors[afterFirstAttack.currentFloor].enemies[0]?.hpCurrent ?? 0;
  useRunStore.getState().playerAttack();
  const afterSecondAttackAttempt = useRunStore.getState().run;
  assert.ok(afterSecondAttackAttempt && afterSecondAttackAttempt.status === "active");
  const enemyHpAfterSecondAttempt =
    afterSecondAttackAttempt.floors[afterSecondAttackAttempt.currentFloor].enemies[0]?.hpCurrent ?? 0;
  assert.equal(
    enemyHpAfterSecondAttempt,
    enemyHpAfterFirstAttack,
    "Second action-consuming attack in same turn should be blocked and not apply damage.",
  );

  const beforeEndTurn = useRunStore.getState().run;
  assert.ok(beforeEndTurn && beforeEndTurn.status === "active");
  const roundBeforeEnd = beforeEndTurn.turnState.roundNumber;
  const torchBeforeEnd = beforeEndTurn.player.torch.fuelCurrent;
  const hpBeforeEnd = beforeEndTurn.player.vitals.hpCurrent;
  useRunStore.getState().endTurn();
  const afterEndTurn = useRunStore.getState().run;
  assert.ok(afterEndTurn, "Run should still exist after end turn flow.");
  if (afterEndTurn.status === "active") {
    assert.equal(afterEndTurn.turnState.phase, "player", "End turn should resolve enemy phase and return to player phase.");
    assert.equal(afterEndTurn.turnState.roundNumber, roundBeforeEnd + 1, "Round should advance exactly once per end turn.");
    assert.equal(
      afterEndTurn.player.torch.fuelCurrent,
      Math.max(0, torchBeforeEnd - beforeEndTurn.player.torch.fuelDrainPerTurn),
      "Torch should drain once per round during enemy phase.",
    );
    assert.equal(
      afterEndTurn.turnState.player.movementRemainingTiles,
      afterEndTurn.turnState.player.movementAllowanceTiles,
      "New player turn should reset movement budget.",
    );
    assert.equal(afterEndTurn.turnState.player.actionAvailable, true, "New player turn should reset action availability.");
    assert.ok(
      afterEndTurn.player.vitals.hpCurrent <= hpBeforeEnd,
      "Enemy phase should be able to apply damage before returning control to player.",
    );
  }

  // Save migration coverage: missing/invalid turnState should normalize safely.
  const migrationBaseline = useRunStore.getState().run;
  assert.ok(migrationBaseline, "Migration coverage requires an existing run state.");

  const snapshotMissingTurnState = mapRunStateToSnapshot(migrationBaseline);
  delete (snapshotMissingTurnState as { turnState?: unknown }).turnState;
  memoryStorage.setItem(
    "tower.mvp.runSave.v3",
    JSON.stringify({
      version: 3,
      savedAt: Date.now(),
      runSave: mapRunStateToRunSave(migrationBaseline),
      snapshot: snapshotMissingTurnState,
    }),
  );
  const migratedMissingTurnState = loadRunState();
  assert.ok(migratedMissingTurnState, "Missing turnState in snapshot should still load.");
  assert.ok(
    typeof migratedMissingTurnState?.turnState.roundNumber === "number" &&
      migratedMissingTurnState.turnState.roundNumber >= 1,
    "Missing turnState should default to safe initialized turn state.",
  );

  const snapshotInvalidTurnState = {
    ...mapRunStateToSnapshot(migrationBaseline),
    turnState: { roundNumber: "bad", phase: "weird" },
  };
  memoryStorage.setItem(
    "tower.mvp.runSave.v3",
    JSON.stringify({
      version: 3,
      savedAt: Date.now(),
      runSave: mapRunStateToRunSave(migrationBaseline),
      snapshot: snapshotInvalidTurnState,
    }),
  );
  const migratedInvalidTurnState = loadRunState();
  assert.ok(migratedInvalidTurnState, "Invalid turnState should still load via normalization fallback.");
  assert.ok(
    migratedInvalidTurnState?.turnState.phase === "player" || migratedInvalidTurnState?.turnState.phase === "enemies",
    "Invalid turnState should normalize to a valid phase.",
  );

  console.log("Simulation regression suite passed.");
}

void runRegressionSuite().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
