# THE TOWER - Data Schema / JSON Structure Design Doc (v0.3)

## 1. Purpose
Define JSON schemas that support a deterministic hybrid tick-based game model.

## 2. Schema Principles
- Stable IDs.
- Explicit fields.
- Data-driven balancing.
- Runtime save snapshots include authoritative timing + stamina state.

## 3. Hybrid Rules in Data
Core tactical constants and values come from data where practical:
- player movement feet values
- stamina defaults and regeneration values
- enemy attack/aggro ranges
- loot/extraction/XP rule inputs

## 4. Enemy Template Notes
Enemy templates keep:
- attack range
- aggro range
- speed/attackSpeed (for cadence tuning)

AI semantics are runtime-driven by global tick updates.

## 5. Item/Inventory Notes
- `stackSize` in `items.json` is authoritative.
- Belt slots are trinket-only and fixed to 3 in MVP.
- Consumable quickbar is out of scope.

## 6. Save Snapshot Requirements
Run snapshots must carry timing and stamina state, including:
- tick interval/counter metadata
- stamina current/max/regen values
- any migration-safe legacy timing fields still needed by code

Missing or invalid timing/stamina fields from legacy saves must default safely.

## 7. Recommended Files
`enemies.json`, `items.json`, `lootTables.json`, `floorRules.json`, `xpTable.json`, `extractionRules.json`, `playerDefaults.json`.

## 8. Validation Requirements
Validators must enforce:
- enum correctness
- cross-file ID references
- sane numeric bounds
- save-schema migration tolerance for stamina/timing evolution
