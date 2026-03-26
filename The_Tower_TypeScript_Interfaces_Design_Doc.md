# THE TOWER - TypeScript Interfaces Design Doc (v0.3)

## 1. Purpose
Define runtime and persistence interfaces for the hybrid tick-based ruleset.

## 2. Core Direction
- Replace action-point assumptions with stamina-driven action gating.
- Keep grid movement and pathing tile-based.
- Keep timing state centralized and extensible.

## 3. Key Runtime Contracts

### 3.1 Player Stats/Vitals
Player runtime state must include stamina fields:
- `staminaCurrent`
- `staminaMax`
- `staminaRegenPerTick`

Combat and skill use spend stamina instead of action/bonus-action flags.

### 3.2 Timing State
Run timing state should include:
- `tickIntervalMs`
- `tickCount` (or equivalent monotonically increasing tick marker)
- optional cadence metadata for player/enemy update windows

Legacy turn-oriented fields may exist during migration but are not authoritative for gameplay economy.

### 3.3 RunState
Must include:
- run identity/status/floor
- player state (including stamina)
- floors/discovery/defeated/extracted tracking
- timing state
- optional run summary

### 3.4 EnemyTemplate / EnemyInstance
Enemy templates remain data-driven (`attackRange`, `aggroRange`, `speed`, etc.).
Enemy instances track runtime behavior state and tick-driven execution outcomes.

### 3.5 Inventory Contracts
- Belt remains a fixed 3-slot trinket/perk row.
- Belt is not a consumable quickbar.

## 4. Persistence Contracts
### 4.1 RunSave
Save schema must include stamina and timing state fields used by hybrid pacing.

### 4.2 Migration Rule
Missing/invalid stamina or timing fields must normalize safely:
- `staminaMax = 50`
- `staminaCurrent = staminaMax`
- `staminaRegenPerTick = 2`
- `tickIntervalMs = 1200`

## 5. Store Type Guidance
Store-facing snapshots should expose UI-friendly values:
- stamina current/max
- skill affordability (cost checks)
- timing/cooldown indicators (when present)

## 6. Extension Guidance
Interfaces must remain open to:
- per-skill cooldowns
- per-enemy cadence variations
- status effects and terrain costs
- future initiative-like modes if needed
without replacing hybrid timing structures.
