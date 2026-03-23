# THE TOWER — TypeScript Interfaces Design Doc (v0.1)

## 1. Purpose

This document defines the core TypeScript interfaces for the MVP of **The Tower**.

Goals:
- Keep runtime data shapes aligned with JSON schema
- Separate template data from live runtime state
- Give Codex exact contracts to build against
- Reduce rewrite risk as systems expand
- Keep MVP interfaces narrow and practical

---

## 2. Design Rules

### Rule 1 — Separate templates from instances
A template is static design data loaded from JSON.  
An instance is a live runtime object inside a run.

Examples:
- `EnemyTemplate` = design data from `enemies.json`
- `EnemyInstance` = one spawned enemy on Floor 3

### Rule 2 — Keep engine-facing types explicit
Avoid vague `any`-style bags of data.  
Prefer named fields even if it means slightly more boilerplate.

### Rule 3 — Keep UI state separate from game state
The run should not depend on menu toggles, tooltip state, or panel visibility.

### Rule 4 — MVP first
Only include fields needed for the first playable slice.

---

## 3. Shared Primitive Types

```ts
export type ID = string;
export type SeedString = string;

export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "relic";

export type ItemType =
  | "weapon"
  | "armor"
  | "trinket"
  | "material"
  | "consumable"
  | "tool"
  | "quest"
  | "relic";

export type EquipSlot =
  | "mainHand"
  | "offHand"
  | "helmet"
  | "chest"
  | "legs"
  | "feet";

export type EnemyRole =
  | "chaser"
  | "tank"
  | "ranged"
  | "support"
  | "summoner"
  | "ambusher"
  | "exploder"
  | "controller"
  | "boss";

export type EnemyTier =
  | "normal"
  | "veteran"
  | "elite"
  | "champion"
  | "boss";

export type RoomType =
  | "entry"
  | "combat"
  | "loot"
  | "puzzle"
  | "special"
  | "extraction"
  | "boss"
  | "stairs"
  | "empty"
  | "blocked";

export type SkillTree =
  | "strength"
  | "dexterity"
  | "intelligence"
  | "survival";

export type SkillKind = "active" | "passive";

export type Direction = "up" | "down" | "left" | "right";
```

---

## 4. Utility Interfaces

```ts
export interface Vec2 {
  x: number;
  y: number;
}

export interface Size2D {
  w: number;
  h: number;
}

export interface StatBlock {
  hp: number;
  stamina: number;
  attack: number;
  defense: number;
  speed: number;
  carryWeight: number;
}

export interface RuntimeVitals {
  hpCurrent: number;
  staminaCurrent: number;
}

export interface RangeBand {
  min: number;
  max: number;
}
```

---

## 5. Template Interfaces

## 5.1 EnemyTemplate

```ts
export interface EnemyTemplate {
  id: ID;
  name: string;
  role: EnemyRole;
  tier: EnemyTier;
  floorMin: number;
  floorMax: number;
  stats: {
    hp: number;
    damage: number;
    speed: number;
    attackSpeed: number;
    attackRange: number;
    aggroRange: number;
    poise: number;
  };
  behavior: {
    aiType: string;
    canRetreat: boolean;
    canStrafe: boolean;
  };
  drops: {
    lootTableId: ID;
  };
  xp: {
    kill: number;
  };
  render: {
    sprite: string;
    scale: number;
  };
}
```

## 5.2 ItemTemplate

```ts
export interface ItemTemplate {
  id: ID;
  name: string;
  type: ItemType;
  subtype?: string;
  rarity: Rarity;
  value: number;
  weight: number;
  gridSize: Size2D;
  stackSize: number;
  equipSlot?: EquipSlot;
  stats?: {
    damageMin?: number;
    damageMax?: number;
    attackSpeed?: number;
    critChance?: number;
    defense?: number;
    resistance?: number;
  };
  requirements?: {
    level?: number;
  };
  tags?: string[];
  render: {
    icon: string;
  };
}
```

## 5.3 LootTable

```ts
export interface LootTableEntry {
  itemId: ID;
  weight: number;
  minQty: number;
  maxQty: number;
}

export interface LootTable {
  id: ID;
  rolls: number;
  entries: LootTableEntry[];
}
```

## 5.4 FloorRule

```ts
export interface FloorRule {
  id: ID;
  floorMin: number;
  floorMax: number;
  map: {
    width: number;
    height: number;
    roomCountMin: number;
    roomCountMax: number;
    puzzleChance: number;
    secretChance: number;
    extractionChance: number;
  };
  spawns: {
    enemyPool: ID[];
    eliteChance: number;
    bossChance: number;
  };
  loot: {
    roomLootTableId: ID;
    chestLootTableId: ID;
  };
  gating: {
    recommendedLevel: number;
    requiredLevel: number;
  };
  xpMultiplier: number;
}
```

## 5.5 ExtractionRule

```ts
export interface ExtractionRule {
  id: ID;
  name: string;
  floors: RangeBand;
  requirements: {
    itemsAny: ID[];
    itemsAll: ID[];
    minLevel: number;
  };
  results: {
    success: "extract";
    consumeItems: ID[];
  };
  ui: {
    label: string;
  };
}
```

## 5.6 SkillTemplate

```ts
export interface SkillEffect {
  type: "damage" | "heal" | "stun" | "dash" | "buff";
  value?: number;
  duration?: number;
}

export interface SkillTemplate {
  id: ID;
  name: string;
  tree: SkillTree;
  kind: SkillKind;
  unlockLevel: number;
  cost: {
    stamina: number;
    mana: number;
  };
  cooldown?: number;
  effects: SkillEffect[];
  targeting?: {
    shape: "self" | "line" | "cone" | "area";
    range: number;
  };
}
```

## 5.7 PlayerDefaults

```ts
export interface PlayerDefaults {
  baseStats: {
    level: number;
    xp: number;
    hp: number;
    stamina: number;
    attack: number;
    defense: number;
    speed: number;
    carryWeight: number;
  };
  equipment: Record<EquipSlot, ID | null>;
  inventory: {
    backpack: Size2D;
    // Fixed at 3 for MVP trinket belt row.
    beltSlots: number;
  };
  unlockedSkills: ID[];
  unlockedRecipes: ID[];
}
```

---

## 6. Runtime Interfaces

## 6.1 ItemInstance

```ts
export interface ItemInstance {
  instanceId: ID;
  itemId: ID;
  quantity: number;
  durability?: number;
  rarityOverride?: Rarity | null;
  position: {
    container: "inventory" | "belt" | "equipment" | "ground";
    x?: number;
    y?: number;
    slot?: EquipSlot | number;
  };
}
```

## 6.2 EnemyInstance

```ts
export interface EnemyInstance {
  instanceId: ID;
  enemyId: ID;
  floor: number;
  position: Vec2;
  hpCurrent: number;
  state: "idle" | "patrol" | "aggro" | "attacking" | "dead";
  aggroTargetId?: ID | null;
  modifiers?: string[];
  lootResolved: boolean;
}
```

## 6.3 TileState

```ts
export interface TileState {
  x: number;
  y: number;
  walkable: boolean;
  visible: boolean;
  explored: boolean;
  roomType: RoomType;
  occupiedByEnemyId?: ID | null;
  occupiedByLootIds?: ID[];
  interactableId?: ID | null;
}
```

## 6.4 FloorState

```ts
export interface FloorState {
  floorNumber: number;
  seed: SeedString;
  width: number;
  height: number;
  tiles: TileState[];
  enemies: EnemyInstance[];
  groundLoot: ItemInstance[];
  extractionNodeIds: ID[];
  discoveredRooms: ID[];
  roomTypeCounts: Partial<Record<RoomType, number>>;
}
```

## 6.5 InventoryGrid

```ts
export interface InventoryGrid {
  width: number;
  height: number;
  items: ItemInstance[];
}
```

## 6.6 EquipmentState

```ts
export interface EquipmentState {
  mainHand: ItemInstance | null;
  offHand: ItemInstance | null;
  helmet: ItemInstance | null;
  chest: ItemInstance | null;
  legs: ItemInstance | null;
  feet: ItemInstance | null;
}
```

## 6.7 BeltState

```ts
export interface BeltState {
  // Fixed 3-slot trinket belt row for MVP.
  slots: Array<ItemInstance | null>;
}
```

## 6.8 PlayerState

```ts
export interface PlayerState {
  id: ID;
  name: string;
  level: number;
  xp: number;
  unspentStatPoints: number;
  unspentSkillPoints: number;
  stats: StatBlock;
  vitals: RuntimeVitals;
  position: Vec2;
  facing: Direction;
  inventory: InventoryGrid;
  equipment: EquipmentState;
  belt: BeltState;
  unlockedSkillIds: ID[];
  activeSkillIds: ID[];
  statusEffects: string[];
}
```

## 6.9 RunSummary

```ts
export interface RunSummary {
  runId: ID;
  seed: SeedString;
  floorsReached: number;
  enemiesKilled: number;
  bossesKilled: number;
  roomsDiscovered: number;
  puzzlesSolved: number;
  lootExtractedValue: number;
  extracted: boolean;
  extractionMethodId?: ID | null;
  causeOfDeath?: string | null;
  xpEarned: number;
  levelUpsGained: number;
  durationSeconds: number;
}
```

## 6.10 RunState

```ts
export interface RunState {
  runId: ID;
  seed: SeedString;
  startedAt: number;
  status: "active" | "extracted" | "dead" | "complete";
  currentFloor: number;
  player: PlayerState;
  floors: Record<number, FloorState>;
  discoveredTileKeys: string[];
  defeatedEnemyIds: ID[];
  extractedItemIds: ID[];
  availableExtractionNodeIds: ID[];
  summary?: RunSummary;
}
```

---

## 7. Persistence Interfaces

## 7.1 ProfileSave

```ts
export interface ProfileSave {
  profileVersion: number;
  player: {
    level: number;
    xp: number;
    stats: StatBlock;
  };
  unlocks: {
    skills: ID[];
    recipes: ID[];
  };
}
```

## 7.2 RunSave

```ts
export interface RunSave {
  runVersion: number;
  seed: SeedString;
  floor: number;
  player: {
    hp: number;
    stamina: number;
    position: Vec2;
  };
  inventory: ItemInstance[];
  equipped: Partial<Record<EquipSlot, ItemInstance | null>>;
  exploredTiles: string[];
  groundLoot: ItemInstance[];
  defeatedEnemies: ID[];
  extractionState: {
    availableNodeIds: ID[];
  };
}
```

---

## 8. Event Interfaces

These are optional for MVP but strongly recommended so systems can talk cleanly.

```ts
export interface CombatEvent {
  id: ID;
  type:
    | "attack_started"
    | "attack_hit"
    | "attack_missed"
    | "damage_taken"
    | "enemy_killed"
    | "player_died"
    | "skill_used";
  sourceId: ID;
  targetId?: ID;
  value?: number;
  timestamp: number;
}

export interface LootEvent {
  id: ID;
  type: "loot_dropped" | "loot_picked_up" | "loot_destroyed";
  itemInstanceId: ID;
  actorId?: ID;
  timestamp: number;
}
```

---

## 9. Store Shape Guidance

## Run Store
Should hold:
- `RunState`
- methods for movement, combat, pickup, extraction, summary

## UI Store
Should hold:
- inventory open/closed
- map open/closed
- pause state
- hovered item
- tooltip state
- debug overlay toggle

Avoid mixing these.

---

## 10. Recommended File Mapping

Suggested source layout:

```text
src/game/types/
  common.ts
  items.ts
  enemies.ts
  floors.ts
  player.ts
  run.ts
  saves.ts
  events.ts
```

### Suggested ownership
- `common.ts` → primitives, enums, Vec2, Size2D
- `items.ts` → ItemTemplate, ItemInstance, LootTable
- `enemies.ts` → EnemyTemplate, EnemyInstance
- `floors.ts` → TileState, FloorRule, FloorState
- `player.ts` → PlayerDefaults, PlayerState, EquipmentState
- `run.ts` → RunState, RunSummary
- `saves.ts` → ProfileSave, RunSave
- `events.ts` → CombatEvent, LootEvent

---

## 11. Validation Notes

When loading JSON into these interfaces, validate:

- all template IDs are unique
- cross-file references exist
- numeric values are sane
- floor ranges are valid
- required arrays are not missing

Do not assume JSON is correct.

---

## 12. Immediate Implementation Target

Before coding systems, create these interface files first:

1. `common.ts`
2. `items.ts`
3. `enemies.ts`
4. `floors.ts`
5. `player.ts`
6. `run.ts`
7. `saves.ts`

That gives Codex a clean contract for the rest of the repo.

---

## 13. Summary

These interfaces are the bridge between:
- your design docs
- your JSON data files
- your runtime engine
- your UI

If these stay clean, the project stays clean.
