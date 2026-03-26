# THE TOWER - Extraction System Design Document (v0.3)

## 1. Extraction Philosophy
Extraction is a tactical commitment, not a background timer.

## 2. Core Extraction Rules
- You keep only what you extract.
- Dying loses run loot.
- Extraction follows run-state validity checks (location/rules), not action-point budgets.

## 3. Economy Rule
- No action-point or bonus-action cost in MVP.
- Extraction is currently free when requirements are met.
- Extraction remains blocked by invalid context (wrong tile, unmet requirements, etc.).

## 4. Extraction Methods (Data-Driven)
Keep extraction methods in `extractionRules.json` with floor and item requirements.

## 5. MVP Scope
- Stair/extraction-node validation
- Rule check (items/level requirements)
- Successful extraction ends run and builds run summary

## 6. Future Scope
- Optional stamina cost or cast-time mechanics
- Additional extraction methods and penalties
- Event-driven extraction outcomes
