import { readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import {
  loadGameData,
  loadProfile,
  loadRunState,
  saveRunState,
  type JsonFetcher,
} from "../src/game/data";
import { createInitialRunState } from "../src/game/engine";
import { playerLightAttack, resolveEnemyDeathLoot, spawnEnemiesForFloor, tryMoveByDelta } from "../src/game/systems";
import { consumeTorchFuel, getTorchRevealRadius, restoreTorchFuel } from "../src/game/systems/torch";
import type { EnemyInstance, FloorState, RunState } from "../src/game/types";

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
    playerDefaults: templates.playerDefaults,
  });
  const runB = createInitialRunState({
    runId: "sim_run",
    seed: "sim_seed_alpha",
    floorRules: templates.floorRules,
    enemyTemplates: templates.enemies,
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

  console.log("Simulation regression suite passed.");
}

void runRegressionSuite().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
