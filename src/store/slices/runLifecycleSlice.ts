import type { StateCreator } from "zustand";
import { clearRunState, loadProfile, loadRunState, saveRunState } from "@game/data";
import { createInitialRunState } from "@game/engine";
import {
  buildRunSummary,
  canPerformInteraction,
  canExtractAtPosition,
  clampPlayerVitalsToEffectiveStats,
  explainTurnEconomyFailure,
  getTorchRevealRadius,
  revealTilesAroundPosition,
  syncFloorOccupancy,
} from "@game/systems";
import type { RunState } from "@game/types";
import { makeTileKey } from "@game/world";
import { withActionLogs } from "../actionLog";
import type { RunBootstrapData, RunStoreState } from "../types";
import { persistRunTransition } from "./persistenceSlice";

export interface RunLifecycleSlice {
  setBootstrapData: (data: RunBootstrapData) => void;
  startRun: (seed: string) => void;
  resumeSavedRun: () => void;
  tryExtract: () => void;
  restart: () => void;
}

export const createRunLifecycleSlice: StateCreator<
  RunStoreState & RunLifecycleSlice,
  [],
  [],
  RunLifecycleSlice
> = (set, get) => ({
  setBootstrapData: (data) => {
    const profile = loadProfile(data.playerDefaults);
    const savedRun = loadRunState();
    const hasSavedRun = Boolean(savedRun && savedRun.status === "active");
    set({ bootstrapData: data, profile, hasSavedRun });
  },

  startRun: (seed) => {
    const bootstrapData = get().bootstrapData;
    if (!bootstrapData) {
      throw new Error("Cannot start run before bootstrapData has been set.");
    }
    const run = createInitialRunState({
      runId: `run_${Date.now()}`,
      seed,
      floorRules: bootstrapData.floorRules,
      enemyTemplates: bootstrapData.enemyTemplates,
      playerDefaults: bootstrapData.playerDefaults,
    });

    const currentFloor = run.floors[run.currentFloor];
    const revealRadius = getTorchRevealRadius(run.player.torch);
    const revealedTiles = revealTilesAroundPosition({
      tiles: currentFloor.tiles,
      width: currentFloor.width,
      height: currentFloor.height,
      center: run.player.position,
      radius: revealRadius,
    });
    currentFloor.tiles = revealedTiles;
    run.discoveredTileKeys = revealedTiles.filter((tile) => tile.explored).map((tile) => makeTileKey(tile.x, tile.y));
    run.floors[run.currentFloor] = syncFloorOccupancy(currentFloor);

    saveRunState(run);
    set((state) => ({
      run,
      hasSavedRun: true,
      actionLog: withActionLogs(state.actionLog, [
        { category: "system", message: `Run started (seed: ${seed}).` },
        {
          category: "system",
          eventType: "torch_start",
          message: `Torch lit at ${run.player.torch.fuelCurrent.toFixed(1)} fuel (radius ${revealRadius}).`,
        },
      ]),
    }));
  },

  resumeSavedRun: () => {
    const savedRun = loadRunState();
    const bootstrapData = get().bootstrapData;
    if (!savedRun || savedRun.status !== "active") {
      set({ hasSavedRun: false });
      return;
    }
    if (bootstrapData) {
      savedRun.player = clampPlayerVitalsToEffectiveStats(
        savedRun.player,
        new Map(bootstrapData.itemTemplates.map((item) => [item.id, item])),
      );
    }
    const currentFloor = savedRun.floors[savedRun.currentFloor];
    if (currentFloor) {
      const resumeRadius = getTorchRevealRadius(savedRun.player.torch);
      const resumedTiles = revealTilesAroundPosition({
        tiles: currentFloor.tiles,
        width: currentFloor.width,
        height: currentFloor.height,
        center: savedRun.player.position,
        radius: resumeRadius,
      });
      savedRun.discoveredTileKeys = resumedTiles.filter((tile) => tile.explored).map((tile) => makeTileKey(tile.x, tile.y));
      savedRun.floors[savedRun.currentFloor] = syncFloorOccupancy({ ...currentFloor, tiles: resumedTiles });
    }
    set({
      run: savedRun,
      hasSavedRun: true,
      actionLog: withActionLogs(get().actionLog, [{ category: "system", message: "Saved run resumed." }]),
    });
  },

  tryExtract: () => {
    const run = get().run;
    const bootstrapData = get().bootstrapData;
    if (!run || !bootstrapData) return;
    const gate = canPerformInteraction(run, "extract");
    if (!gate.allowed) {
      set((state) => ({
        actionLog: withActionLogs(state.actionLog, [
          { category: "system", message: explainTurnEconomyFailure(gate.reason, "You can only extract during the player phase.") },
        ]),
      }));
      return;
    }
    const floor = run.floors[run.currentFloor];
    if (!floor) return;

    if (!canExtractAtPosition(floor, run.player.position)) {
      set((state) => ({
        actionLog: withActionLogs(state.actionLog, [
          { category: "system", message: "Extraction failed: not on extraction tile." },
        ]),
      }));
      return;
    }

    const itemTemplatesById = new Map(bootstrapData.itemTemplates.map((item) => [item.id, item]));
    const methodId =
      floor.tiles.find((tile) => tile.x === run.player.position.x && tile.y === run.player.position.y)?.roomType ===
      "extraction"
        ? "extract_rope_window"
        : "extract_stairwell";

    const summary = buildRunSummary({
      run,
      extracted: true,
      extractionMethodId: methodId,
      itemTemplatesById,
      xpTable: bootstrapData.xpTable,
    });

    const nextRun: RunState = { ...run, status: "extracted", summary };
    const persisted = persistRunTransition(nextRun, get().profile, bootstrapData);
    set((state) => ({
      run: nextRun,
      hasSavedRun: persisted.hasSavedRun,
      profile: persisted.profile,
      actionLog: withActionLogs(state.actionLog, [{ category: "system", message: "Extraction successful." }]),
    }));
  },

  restart: () => {
    clearRunState();
    set((state) => ({
      run: null,
      hasSavedRun: false,
      actionLog: withActionLogs(state.actionLog, [{ category: "system", message: "Run reset to menu." }]),
    }));
  },
});
