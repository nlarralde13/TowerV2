# THE TOWER - Data Schema / JSON Structure Design Doc (v0.2)

## 1. Purpose
Define JSON schemas that support a deterministic, unified turn-based game model.

## 2. Schema Principles
- Stable IDs.
- Explicit fields.
- Data-driven balancing.
- Runtime save snapshots include authoritative turn state.

## 3. Turn-Based Rules in Data
Core tactical constants and values come from data where practical:
- player movement feet values
- enemy attack/aggro ranges
- loot/extraction/XP rule inputs

## 4. Enemy Template Notes
Enemy templates keep:
- attack range
- aggro range
- speed (reserved for future initiative/action-budget expansion)

AI semantics are runtime-driven by phase rules:
- enemies execute only in enemy phase
- no per-player-action enemy batching

## 5. Item/Inventory Notes
- `stackSize` in `items.json` is authoritative.
- Belt slots are trinket-only and fixed to 3 in MVP.
- Consumable quickbar is out of scope.

## 6. Save Snapshot Requirements
Run snapshots must carry `turnState` including:
- round number
- phase
- player movement/action budget
- enemy phase metadata
- future extension block (initiative/actor budgets/status placeholders)

Missing or invalid `turnState` from legacy saves must default safely.

## 7. Recommended Files
`enemies.json`, `items.json`, `lootTables.json`, `floorRules.json`, `xpTable.json`, `extractionRules.json`, `playerDefaults.json`.

## 8. Validation Requirements
Validators must enforce:
- enum correctness
- cross-file ID references
- sane numeric bounds
- save-schema migration tolerance for turn-state evolution
