# THE TOWER - TypeScript Interfaces Design Doc (v0.2)

## 1. Purpose
Define runtime and persistence interfaces for the unified turn-based engine.

## 2. Core Direction
- Replace legacy `StatBlock`/`player.stats` assumptions with modern player stat sets.
- `RunState.turnState` is authoritative for phase/round/action economy.
- Keep interfaces extensible for initiative and actor budgets.

## 3. Key Runtime Contracts

### 3.1 Player Stats
Use explicit stat sets (base/equipment/buff/total) including `movementFeet`.
Derived movement per turn = `floor(movementFeet / 5)` tiles.

### 3.2 RunTurnState
Must include:
- `roundNumber`
- `phase` (`player` | `enemies`)
- `player` budget (`movementAllowanceTiles`, `movementRemainingTiles`, `actionAvailable`)
- `enemies` phase metadata (`pendingEnemyIds`, `activeEnemyId`)
- `future` extension block (`initiativeOrder`, `currentActorId`, `actorBudgets`, terrain/status placeholders)

### 3.3 RunState
Must include:
- run identity/status/floor
- `turnState`
- `player`
- floors/discovery/defeated/extracted tracking
- optional run summary

### 3.4 EnemyTemplate / EnemyInstance
Enemy templates stay data-driven (`attackRange`, `aggroRange`, `speed`, etc.).
Enemy instances track runtime state (`idle|patrol|aggro|attacking|dead`) and phase execution outcomes.

### 3.5 Inventory Contracts
- Belt is `Array<ItemInstance | null>` fixed to 3 slots in MVP.
- Belt accepts trinket behavior only.

## 4. Persistence Contracts
### 4.1 RunSave
Run save schema must include optional/normalized `turnState` for backwards compatibility.

### 4.2 Migration Rule
Missing/invalid turn-state fields must normalize to safe defaults derived from player stats.

## 5. Store Type Guidance
Store-facing types should expose turn info in a UI-friendly snapshot shape:
- phase
- round
- movement remaining/allowance
- action availability

## 6. Extension Guidance
Interfaces must remain open to:
- initiative ordering
- per-actor movement/action budgets
- terrain movement costs
- status effects/reactions
without replacing current `RunTurnState`.
