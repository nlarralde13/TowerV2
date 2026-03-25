# THE TOWER — Project Overview

The Tower is a 2D top-down extraction action-adventure game.

Core loop:
Enter the tower → Fight → Loot → Manage Inventory → Decide Risk → Extract → Gain XP → Level Up → Repeat

The game is built as a browser-based game using:
- Next.js
- TypeScript
- React
- Zustand
- HTML5 Canvas
- JSON-driven game data

This repository contains both the design documents and the MVP implementation.

## MVP Features
- Procedural floors
- Unified turn-based tactical flow (exploration + combat share one turn engine)
- Enemies
- Loot and rarity
- Grid inventory + weight
- Extraction system
- XP and leveling
- Run summary
- Save/load

## Architecture Principles
- Engine logic separate from rendering
- Data-driven systems via JSON
- Deterministic generation via seeds
- Modular systems
- MVP-first development

## Inventory Rules (Authoritative)
- Item stack limits are authoritative per item in `items.json` via `stackSize`.
- Category stack tables in design docs are balancing guidance only.
- If carry weight exceeds 100%, movement speed is reduced to 50%.
- Equipment layout for current MVP direction: `mainHand`, `offHand`, `helmet`, `chest`, `legs`, `feet`.
- Belt uses a fixed 3-slot trinket row for build customization (belt trinkets), not quick-use consumables.

## Enemy Tuning (Current MVP Baseline)
- Spawn density is intentionally low and derived from floor room count.
- Floor enemy pools are currently locked to one chaser type (`enemy_rat_small`) for pacing.
- Non-chaser enemies use tether AI:
  - wander in a 3x3 around spawn
  - only pursue when player is within 2 tiles

## Turn Economy Rules (Authoritative MVP)
- `move 1 tile`: costs `movement` (1 tile)
- `attack`: costs `action`
- `loot pickup`: costs `action`
- `open chest`: costs `action` (reserved for interactable implementation)
- `open door`: costs `action` (reserved for interactable implementation)
- `extract`: costs `full turn` (requires available action in player phase; consumes turn budget)
- `consume item`: costs `action`
- `equip/unequip`: `free action` (no action/movement cost, but player phase only)
- `use key`: costs `action` (reserved for interactable implementation)

Canonical table and helpers live in `src/game/systems/turnEconomy.ts`.

## Development Order
1. Types
2. Data loading
3. Seeded RNG
4. Floor generation
5. Movement
6. Fog of war
7. Enemies
8. Combat
9. Loot
10. Inventory
11. Extraction
12. XP/Leveling
13. Run summary
14. Save/load
