import type { FloorState, PlayerDefaults, PlayerState, ProfileSave, RunSave, RunState } from "../types";

const RUN_SAVE_KEY = "tower.mvp.runSave.v3";
const RUN_SAVE_LEGACY_KEY = "tower.mvp.runSave.v1";
const RUN_SAVE_V2_KEY = "tower.mvp.runSave.v2";
const PROFILE_SAVE_KEY = "tower.mvp.profileSave.v1";

interface RunStateSnapshot {
  runId: string;
  seed: string;
  startedAt: number;
  status: RunState["status"];
  currentFloor: number;
  player: PlayerState;
  floors: Record<number, FloorState>;
  discoveredTileKeys: string[];
  defeatedEnemyIds: string[];
  extractedItemIds: string[];
  availableExtractionNodeIds: string[];
  summary?: RunState["summary"];
}

interface PersistedRunEnvelopeV2 {
  version: 2;
  savedAt: number;
  runSave: RunSave;
  snapshot: RunStateSnapshot;
}

interface PersistedRunEnvelopeV3 {
  version: 3;
  savedAt: number;
  runSave: RunSave;
  snapshot: RunStateSnapshot;
}

interface PersistedRunEnvelopeV1Legacy {
  version: 1;
  savedAt: number;
  run: RunState;
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizePlayerEquipment(player: PlayerState): PlayerState {
  const equipment = (player as PlayerState & { equipment?: Record<string, unknown> }).equipment ?? {};
  const nextEquipment = {
    mainHand: (equipment.mainHand ?? equipment.weapon ?? null) as PlayerState["equipment"]["mainHand"],
    offHand: (equipment.offHand ?? equipment.offhand ?? null) as PlayerState["equipment"]["offHand"],
    helmet: (equipment.helmet ?? null) as PlayerState["equipment"]["helmet"],
    chest: (equipment.chest ?? null) as PlayerState["equipment"]["chest"],
    legs: (equipment.legs ?? null) as PlayerState["equipment"]["legs"],
    feet: (equipment.feet ?? equipment.boots ?? null) as PlayerState["equipment"]["feet"],
  };

  const beltSlots = Array.isArray(player.belt?.slots) ? player.belt.slots : [];
  const normalizedBeltSlots = beltSlots.slice(0, 3);
  while (normalizedBeltSlots.length < 3) {
    normalizedBeltSlots.push(null);
  }

  return {
    ...player,
    equipment: nextEquipment,
    belt: {
      ...player.belt,
      slots: normalizedBeltSlots,
    },
  };
}

// Explicit mapper: RunState -> contract RunSave.
export function mapRunStateToRunSave(run: RunState): RunSave {
  const floor = run.floors[run.currentFloor];
  const equipped: RunSave["equipped"] = {
    mainHand: run.player.equipment.mainHand,
    offHand: run.player.equipment.offHand,
    helmet: run.player.equipment.helmet,
    chest: run.player.equipment.chest,
    legs: run.player.equipment.legs,
    feet: run.player.equipment.feet,
  };

  return {
    runVersion: 3,
    seed: run.seed,
    floor: run.currentFloor,
    player: {
      hp: run.player.vitals.hpCurrent,
      stamina: run.player.vitals.staminaCurrent,
      position: run.player.position,
    },
    inventory: run.player.inventory.items,
    equipped,
    exploredTiles: run.discoveredTileKeys,
    groundLoot: floor?.groundLoot ?? [],
    defeatedEnemies: run.defeatedEnemyIds,
    extractionState: {
      availableNodeIds: run.availableExtractionNodeIds,
    },
  };
}

// Explicit mapper: RunState -> snapshot (full restore payload).
export function mapRunStateToSnapshot(run: RunState): RunStateSnapshot {
  return {
    runId: run.runId,
    seed: run.seed,
    startedAt: run.startedAt,
    status: run.status,
    currentFloor: run.currentFloor,
    player: run.player,
    floors: run.floors,
    discoveredTileKeys: run.discoveredTileKeys,
    defeatedEnemyIds: run.defeatedEnemyIds,
    extractedItemIds: run.extractedItemIds,
    availableExtractionNodeIds: run.availableExtractionNodeIds,
    summary: run.summary,
  };
}

// Explicit mapper: snapshot -> RunState.
export function mapSnapshotToRunState(snapshot: RunStateSnapshot): RunState {
  const normalizedPlayer = normalizePlayerEquipment(snapshot.player);
  return {
    runId: snapshot.runId,
    seed: snapshot.seed,
    startedAt: snapshot.startedAt,
    status: snapshot.status,
    currentFloor: snapshot.currentFloor,
    player: normalizedPlayer,
    floors: snapshot.floors,
    discoveredTileKeys: snapshot.discoveredTileKeys,
    defeatedEnemyIds: snapshot.defeatedEnemyIds,
    extractedItemIds: snapshot.extractedItemIds,
    availableExtractionNodeIds: snapshot.availableExtractionNodeIds,
    summary: snapshot.summary,
  };
}

function isRunEnvelopeV2(value: unknown): value is PersistedRunEnvelopeV2 {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Partial<PersistedRunEnvelopeV2>;
  return row.version === 2 && Boolean(row.snapshot) && Boolean(row.runSave);
}

function isRunEnvelopeV3(value: unknown): value is PersistedRunEnvelopeV3 {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Partial<PersistedRunEnvelopeV3>;
  return row.version === 3 && Boolean(row.snapshot) && Boolean(row.runSave);
}

function isRunEnvelopeV1Legacy(value: unknown): value is PersistedRunEnvelopeV1Legacy {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Partial<PersistedRunEnvelopeV1Legacy>;
  return row.version === 1 && Boolean(row.run);
}

export function saveRunState(run: RunState): void {
  if (!hasStorage()) {
    return;
  }
  const envelope: PersistedRunEnvelopeV3 = {
    version: 3,
    savedAt: Date.now(),
    runSave: mapRunStateToRunSave(run),
    snapshot: mapRunStateToSnapshot(run),
  };
  window.localStorage.setItem(RUN_SAVE_KEY, JSON.stringify(envelope));
}

export function loadRunState(): RunState | null {
  if (!hasStorage()) {
    return null;
  }

  const v2 = parseJson<unknown>(window.localStorage.getItem(RUN_SAVE_KEY));
  if (isRunEnvelopeV3(v2)) {
    return mapSnapshotToRunState(v2.snapshot);
  }

  const v2Legacy = parseJson<unknown>(window.localStorage.getItem(RUN_SAVE_V2_KEY));
  if (isRunEnvelopeV2(v2Legacy)) {
    const migrated = mapSnapshotToRunState(v2Legacy.snapshot);
    saveRunState(migrated);
    window.localStorage.removeItem(RUN_SAVE_V2_KEY);
    return migrated;
  }

  // Migration path from older v1 direct RunState blob.
  const legacy = parseJson<unknown>(window.localStorage.getItem(RUN_SAVE_LEGACY_KEY));
  if (isRunEnvelopeV1Legacy(legacy)) {
    saveRunState(legacy.run);
    window.localStorage.removeItem(RUN_SAVE_LEGACY_KEY);
    return legacy.run;
  }

  return null;
}

export function clearRunState(): void {
  if (!hasStorage()) {
    return;
  }
  window.localStorage.removeItem(RUN_SAVE_KEY);
  window.localStorage.removeItem(RUN_SAVE_V2_KEY);
  window.localStorage.removeItem(RUN_SAVE_LEGACY_KEY);
}

function createProfileFromDefaults(playerDefaults: PlayerDefaults): ProfileSave {
  return {
    profileVersion: 1,
    player: {
      level: playerDefaults.baseStats.level,
      xp: playerDefaults.baseStats.xp,
      stats: {
        hp: playerDefaults.baseStats.hp,
        stamina: playerDefaults.baseStats.stamina,
        attack: playerDefaults.baseStats.attack,
        defense: playerDefaults.baseStats.defense,
        speed: playerDefaults.baseStats.speed,
        carryWeight: playerDefaults.baseStats.carryWeight,
      },
    },
    unlocks: {
      skills: [...playerDefaults.unlockedSkills],
      recipes: [...playerDefaults.unlockedRecipes],
    },
  };
}

export function saveProfile(profile: ProfileSave): void {
  if (!hasStorage()) {
    return;
  }
  window.localStorage.setItem(PROFILE_SAVE_KEY, JSON.stringify(profile));
}

export function loadProfile(playerDefaults: PlayerDefaults): ProfileSave {
  if (!hasStorage()) {
    return createProfileFromDefaults(playerDefaults);
  }
  const existing = parseJson<ProfileSave>(window.localStorage.getItem(PROFILE_SAVE_KEY));
  if (!existing || typeof existing.profileVersion !== "number") {
    const created = createProfileFromDefaults(playerDefaults);
    saveProfile(created);
    return created;
  }
  return existing;
}

export function applyRunSummaryToProfile(params: {
  profile: ProfileSave;
  run: RunState;
}): ProfileSave {
  const { profile, run } = params;
  const xpEarned = run.summary?.xpEarned ?? 0;
  return {
    ...profile,
    player: {
      ...profile.player,
      xp: profile.player.xp + xpEarned,
      level: Math.max(profile.player.level, run.player.level),
      stats: {
        ...run.player.stats,
      },
    },
    unlocks: {
      ...profile.unlocks,
      skills: Array.from(new Set([...profile.unlocks.skills, ...run.player.unlockedSkillIds])),
    },
  };
}
