import { initializeRunTurnState, type FloorState, type PlayerDefaults, type PlayerState, type ProfileSave, type RunSave, type RunState } from "../types";

const RUN_SAVE_KEY = "tower.mvp.runSave.v3";
const RUN_SAVE_LEGACY_KEY = "tower.mvp.runSave.v1";
const RUN_SAVE_V2_KEY = "tower.mvp.runSave.v2";
const PROFILE_SAVE_KEY = "tower.mvp.profileSave.v1";
const CURRENT_RUN_SAVE_VERSION = 3;
const CURRENT_PROFILE_SAVE_VERSION = 1;

export interface RunStateSnapshot {
  runId: string;
  seed: string;
  startedAt: number;
  status: RunState["status"];
  currentFloor: number;
  turnState?: unknown;
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

function createEmptyPlayerStatSet(): PlayerState["baseStats"] {
  return {
    str: 0,
    dex: 0,
    vit: 0,
    int: 0,
    lck: 0,
    hp: 0,
    stamina: 0,
    attack: 0,
    defense: 0,
    hitChance: 0,
    critChance: 0,
    critMultiplier: 0,
    dodgeChance: 0,
    hpRegen: 0,
    staminaRegen: 0,
    movementFeet: 0,
    magicFind: 0,
    armor: 0,
    carryWeight: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isVec2(value: unknown): value is { x: number; y: number } {
  if (!isRecord(value)) {
    return false;
  }
  return isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isItemInstance(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.instanceId !== "string" || typeof value.itemId !== "string" || !isFiniteNumber(value.quantity)) {
    return false;
  }
  const position = value.position;
  if (!isRecord(position) || typeof position.container !== "string") {
    return false;
  }
  const container = position.container;
  if (container !== "inventory" && container !== "equipment" && container !== "ground" && container !== "belt") {
    return false;
  }
  if (container === "inventory" || container === "ground") {
    if (container === "inventory") {
      return true;
    }
    return isFiniteNumber(position.x) && isFiniteNumber(position.y);
  }
  if (container === "equipment") {
    return typeof position.slot === "string";
  }
  if (container === "belt") {
    return isFiniteNumber(position.slot) || isFiniteNumber(position.slotIndex);
  }
  return false;
}

function isItemInstanceArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => isItemInstance(entry));
}

function isPlayerStateSnapshot(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const inventory = value.inventory;
  const equipment = value.equipment;
  const belt = value.belt;
  const torch = value.torch;
  const vitals = value.vitals;

  if (!isVec2(value.position) || typeof value.facing !== "string") {
    return false;
  }
  if (!isRecord(vitals) || !isRecord(inventory) || !isRecord(equipment) || !isRecord(belt)) {
    return false;
  }
  if (!isFiniteNumber(vitals.hpCurrent) || !isFiniteNumber(vitals.staminaCurrent)) {
    return false;
  }
  if (!isFiniteNumber(inventory.width) || !isFiniteNumber(inventory.height) || !isItemInstanceArray(inventory.items)) {
    return false;
  }

  if (
    !("mainHand" in equipment) ||
    !("offHand" in equipment) ||
    !("helmet" in equipment) ||
    !("chest" in equipment) ||
    !("legs" in equipment) ||
    !("feet" in equipment)
  ) {
    return false;
  }
  const equipmentValues = [equipment.mainHand, equipment.offHand, equipment.helmet, equipment.chest, equipment.legs, equipment.feet];
  if (!equipmentValues.every((entry) => entry === null || isItemInstance(entry))) {
    return false;
  }
  if (!Array.isArray(belt.slots) || !belt.slots.every((entry) => entry === null || isItemInstance(entry))) {
    return false;
  }
  if (typeof torch !== "undefined") {
    if (
      !isRecord(torch) ||
      !isFiniteNumber(torch.fuelCurrent) ||
      !isFiniteNumber(torch.fuelMax) ||
      !isFiniteNumber(torch.fuelDrainPerTurn) ||
      !isFiniteNumber(torch.highFuelThreshold) ||
      !isFiniteNumber(torch.lowFuelThreshold) ||
      !isFiniteNumber(torch.revealRadiusHigh) ||
      !isFiniteNumber(torch.revealRadiusMedium) ||
      !isFiniteNumber(torch.revealRadiusLow)
    ) {
      return false;
    }
  }

  return true;
}

function isFloorStateSnapshot(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const tiles = value.tiles;
  const enemies = value.enemies;
  const groundLoot = value.groundLoot;
  if (!isFiniteNumber(value.floorNumber) || typeof value.seed !== "string") {
    return false;
  }
  if (!isFiniteNumber(value.width) || !isFiniteNumber(value.height)) {
    return false;
  }
  if (!Array.isArray(tiles) || !Array.isArray(enemies) || !isItemInstanceArray(groundLoot)) {
    return false;
  }
  if (!isStringArray(value.extractionNodeIds) || !Array.isArray(value.discoveredRooms)) {
    return false;
  }
  return true;
}

function isRunStateSnapshot(value: unknown): value is RunStateSnapshot {
  if (!isRecord(value)) {
    return false;
  }
  if (
    typeof value.runId !== "string" ||
    typeof value.seed !== "string" ||
    !isFiniteNumber(value.startedAt) ||
    !isFiniteNumber(value.currentFloor)
  ) {
    return false;
  }
  if (value.status !== "active" && value.status !== "extracted" && value.status !== "dead" && value.status !== "complete") {
    return false;
  }
  if (!isPlayerStateSnapshot(value.player) || !isRecord(value.floors)) {
    return false;
  }
  if (!Object.values(value.floors).every((floor) => isFloorStateSnapshot(floor))) {
    return false;
  }
  if (
    !isStringArray(value.discoveredTileKeys) ||
    !isStringArray(value.defeatedEnemyIds) ||
    !isStringArray(value.extractedItemIds) ||
    !isStringArray(value.availableExtractionNodeIds)
  ) {
    return false;
  }
  return true;
}

function isRunTurnStateSnapshot(value: unknown): value is RunState["turnState"] {
  if (!isRecord(value)) {
    return false;
  }
  if (!isFiniteNumber(value.roundNumber) || (value.phase !== "player" && value.phase !== "enemies")) {
    return false;
  }
  if (!isRecord(value.player) || !isRecord(value.enemies)) {
    return false;
  }
  if (
    !isFiniteNumber(value.player.movementAllowanceTiles) ||
    !isFiniteNumber(value.player.movementRemainingTiles) ||
    (typeof value.player.lastAttackRound !== "undefined" && !isFiniteNumber(value.player.lastAttackRound))
  ) {
    return false;
  }
  if (!Array.isArray(value.enemies.pendingEnemyIds) || !value.enemies.pendingEnemyIds.every((entry) => typeof entry === "string")) {
    return false;
  }
  if (value.enemies.activeEnemyId !== null && typeof value.enemies.activeEnemyId !== "string") {
    return false;
  }
  if (!isRecord(value.future)) {
    return false;
  }
  if (!Array.isArray(value.future.initiativeOrder) || !value.future.initiativeOrder.every((entry) => typeof entry === "string")) {
    return false;
  }
  if (value.future.currentActorId !== null && typeof value.future.currentActorId !== "string") {
    return false;
  }
  if (!isRecord(value.future.actorBudgets)) {
    return false;
  }
  for (const budget of Object.values(value.future.actorBudgets)) {
    if (!isRecord(budget)) {
      return false;
    }
    if (
      !isFiniteNumber(budget.movementTilesRemaining) ||
      !isFiniteNumber(budget.actionPointsRemaining) ||
      !isFiniteNumber(budget.speed)
    ) {
      return false;
    }
  }
  if (value.future.terrainCostProfileId !== null && typeof value.future.terrainCostProfileId !== "string") {
    return false;
  }
  if (!Array.isArray(value.future.activeStatusEffectIds) || !value.future.activeStatusEffectIds.every((entry) => typeof entry === "string")) {
    return false;
  }
  return true;
}

function isRunSaveContract(value: unknown): value is RunSave {
  if (!isRecord(value)) {
    return false;
  }
  if (!isFiniteNumber(value.runVersion) || typeof value.seed !== "string" || !isFiniteNumber(value.floor)) {
    return false;
  }
  if (!isRecord(value.player) || !isRecord(value.extractionState)) {
    return false;
  }
  if (
    !isFiniteNumber(value.player.hp) ||
    !isFiniteNumber(value.player.stamina) ||
    !isVec2(value.player.position)
  ) {
    return false;
  }
  // Backward-compatible optional field.
  // Invalid turnState is tolerated; normalize from snapshot/player defaults on restore.
  if (typeof value.turnState !== "undefined" && !isRunTurnStateSnapshot(value.turnState)) {
    // noop
  }
  if (typeof value.player.torchFuel !== "undefined" && !isFiniteNumber(value.player.torchFuel)) {
    return false;
  }
  if (!isItemInstanceArray(value.inventory) || !isStringArray(value.exploredTiles) || !isItemInstanceArray(value.groundLoot)) {
    return false;
  }
  if (!isStringArray(value.defeatedEnemies) || !isRecord(value.equipped) || !isStringArray(value.extractionState.availableNodeIds)) {
    return false;
  }
  return true;
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

  const torchRow = (player as PlayerState & { torch?: Partial<PlayerState["torch"]> }).torch;
  const fallbackFuelMax = Math.max(1, torchRow?.fuelMax ?? 120);
  const normalizedTorch: PlayerState["torch"] = {
    fuelCurrent: Math.max(0, Math.min(fallbackFuelMax, torchRow?.fuelCurrent ?? fallbackFuelMax)),
    fuelMax: fallbackFuelMax,
    fuelDrainPerTurn: Math.max(0.01, torchRow?.fuelDrainPerTurn ?? 1),
    highFuelThreshold: Math.min(1, Math.max(0, torchRow?.highFuelThreshold ?? 0.66)),
    lowFuelThreshold: Math.min(1, Math.max(0, torchRow?.lowFuelThreshold ?? 0.33)),
    revealRadiusHigh: Math.max(1, Math.floor(torchRow?.revealRadiusHigh ?? 6)),
    revealRadiusMedium: Math.max(1, Math.floor(torchRow?.revealRadiusMedium ?? 4)),
    revealRadiusLow: Math.max(1, Math.floor(torchRow?.revealRadiusLow ?? 2)),
  };

  const normalizedBaseStats = player.baseStats ?? createEmptyPlayerStatSet();
  const normalizedEquipmentStats = player.equipmentStats ?? createEmptyPlayerStatSet();
  const normalizedBuffStats = player.buffStats ?? createEmptyPlayerStatSet();
  const normalizedTotalStats = player.totalStats ?? {
    ...normalizedBaseStats,
  };

  return {
    ...player,
    title: player.title ?? "The Climber",
    gold: typeof player.gold === "number" ? player.gold : 0,
    baseStats: normalizedBaseStats,
    equipmentStats: normalizedEquipmentStats,
    buffStats: normalizedBuffStats,
    totalStats: normalizedTotalStats,
    equipment: nextEquipment,
    belt: {
      ...player.belt,
      slots: normalizedBeltSlots,
    },
    torch: normalizedTorch,
  };
}

function normalizeRunTurnState(
  turnState: unknown,
  player: PlayerState,
): RunState["turnState"] {
  const fallback = initializeRunTurnState(player);
  if (!isRunTurnStateSnapshot(turnState)) {
    return fallback;
  }
  const movementAllowanceTiles = Math.max(0, Math.floor(turnState.player.movementAllowanceTiles));
  const movementRemainingTiles = Math.max(0, Math.min(movementAllowanceTiles, Math.floor(turnState.player.movementRemainingTiles)));
  const lastAttackRound =
    typeof turnState.player.lastAttackRound === "number" ? Math.max(0, Math.floor(turnState.player.lastAttackRound)) : 0;
  return {
    roundNumber: Math.max(1, Math.floor(turnState.roundNumber)),
    phase: turnState.phase,
    player: {
      movementAllowanceTiles,
      movementRemainingTiles,
      lastAttackRound,
    },
    enemies: {
      pendingEnemyIds: turnState.enemies.pendingEnemyIds,
      activeEnemyId: turnState.enemies.activeEnemyId,
    },
    future: {
      initiativeOrder: turnState.future.initiativeOrder,
      currentActorId: turnState.future.currentActorId,
      actorBudgets: Object.fromEntries(
        Object.entries(turnState.future.actorBudgets).map(([actorId, budget]) => [
          actorId,
          {
            movementTilesRemaining: Math.max(0, Math.floor(budget.movementTilesRemaining)),
            actionPointsRemaining: Math.max(0, Math.floor(budget.actionPointsRemaining)),
            speed: Math.max(0, budget.speed),
          },
        ]),
      ),
      terrainCostProfileId: turnState.future.terrainCostProfileId,
      activeStatusEffectIds: turnState.future.activeStatusEffectIds,
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
    turnState: run.turnState,
    player: {
      hp: run.player.vitals.hpCurrent,
      stamina: run.player.vitals.staminaCurrent,
      torchFuel: run.player.torch.fuelCurrent,
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
    turnState: run.turnState,
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
  const normalizedTurnState = normalizeRunTurnState(snapshot.turnState, normalizedPlayer);
  return {
    runId: snapshot.runId,
    seed: snapshot.seed,
    startedAt: snapshot.startedAt,
    status: snapshot.status,
    currentFloor: snapshot.currentFloor,
    turnState: normalizedTurnState,
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
  return row.version === 2 && isRunStateSnapshot(row.snapshot) && isRunSaveContract(row.runSave);
}

function isRunEnvelopeV3(value: unknown): value is PersistedRunEnvelopeV3 {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Partial<PersistedRunEnvelopeV3>;
  return row.version === 3 && isRunStateSnapshot(row.snapshot) && isRunSaveContract(row.runSave);
}

function isRunEnvelopeV1Legacy(value: unknown): value is PersistedRunEnvelopeV1Legacy {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Partial<PersistedRunEnvelopeV1Legacy>;
  return row.version === 1 && isRunStateSnapshot(row.run);
}

function isUnsupportedFutureRunEnvelope(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  if (!isFiniteNumber(value.version)) {
    return false;
  }
  return value.version > CURRENT_RUN_SAVE_VERSION;
}

function isProfileSaveV1(value: unknown): value is ProfileSave {
  if (!isRecord(value) || value.profileVersion !== CURRENT_PROFILE_SAVE_VERSION) {
    return false;
  }
  if (!isRecord(value.player) || !isRecord(value.player.stats) || !isRecord(value.unlocks)) {
    return false;
  }
  if (!isFiniteNumber(value.player.level) || !isFiniteNumber(value.player.xp)) {
    return false;
  }
  if (
    !isFiniteNumber(value.player.stats.hp) ||
    !isFiniteNumber(value.player.stats.stamina) ||
    !isFiniteNumber(value.player.stats.attack) ||
    !isFiniteNumber(value.player.stats.defense) ||
    !isFiniteNumber(value.player.stats.speed) ||
    !isFiniteNumber(value.player.stats.carryWeight)
  ) {
    return false;
  }
  if (!isStringArray(value.unlocks.skills) || !isStringArray(value.unlocks.recipes)) {
    return false;
  }
  return true;
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

  const v3 = parseJson<unknown>(window.localStorage.getItem(RUN_SAVE_KEY));
  if (isRunEnvelopeV3(v3)) {
    return mapSnapshotToRunState(v3.snapshot);
  }
  if (isUnsupportedFutureRunEnvelope(v3)) {
    window.localStorage.removeItem(RUN_SAVE_KEY);
    return null;
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
    const migrated = mapSnapshotToRunState(legacy.run);
    saveRunState(migrated);
    window.localStorage.removeItem(RUN_SAVE_LEGACY_KEY);
    return migrated;
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
        speed: playerDefaults.baseStats.movementFeet,
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
  const existing = parseJson<unknown>(window.localStorage.getItem(PROFILE_SAVE_KEY));
  if (!isProfileSaveV1(existing)) {
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
        hp: run.player.totalStats.hp,
        stamina: run.player.totalStats.stamina,
        attack: run.player.totalStats.attack,
        defense: run.player.totalStats.defense,
        speed: run.player.totalStats.movementFeet,
        carryWeight: run.player.totalStats.carryWeight,
      },
    },
    unlocks: {
      ...profile.unlocks,
      skills: Array.from(new Set([...profile.unlocks.skills, ...run.player.unlockedSkillIds])),
    },
  };
}
