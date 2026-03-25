# THE TOWER - Extraction System Design Document (v0.2)

## 1. Extraction Philosophy
Extraction is a tactical commitment, not a background timer.

## 2. Core Extraction Rules
- You keep only what you extract.
- Dying loses run loot.
- Extraction is resolved inside player phase rules.

## 3. Turn Economy Rule
- Extraction uses a full-turn style interaction cost.
- It requires player phase and available action.
- It does not run in enemy phase.

## 4. Extraction Methods (Data-Driven)
Keep extraction methods in `extractionRules.json` with floor and item requirements.

## 5. MVP Scope
- Stair/extraction-node validation
- Rule check (items/level requirements)
- Successful extraction ends run and builds run summary

## 6. Future Scope
- Additional extraction methods and penalties
- More conditional extraction nodes
- Event-driven extraction outcomes
