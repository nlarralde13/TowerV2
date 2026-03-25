# THE TOWER - Combat System Design Document (v0.2)

## 1. Combat Philosophy
Combat is tactical, lethal, and readable.
It uses the same turn engine as exploration.

## 2. Authoritative Combat Timing
- No real-time combat loop.
- No post-action enemy auto-batching.
- No separate combat mode timer.
- Combat actions resolve during player phase and enemy phase only.

## 3. Player Turn Rules
- Movement allowance per turn: floor(movementFeet / 5).
- One action per turn.
- End Turn is explicit and required to start enemy phase.

## 4. MVP Action Economy
Action-consuming:
- Attack
- Loot pickup
- Consume item
- Extraction attempt (full-turn style rule)

Free (MVP):
- Equip/unequip and inventory management, but only in player phase.

## 5. Combat Resolution
- Player attack checks target tile/range and resolves hit deterministically.
- Enemy phase resolves after End Turn.
- Round then advances and budgets refresh for player phase.

## 6. Damage & Survivability
- Keep deterministic formulas and explicit state transitions.
- Balance target: mistakes are costly; tactical positioning matters.

## 7. MVP Scope
Included:
- Tile movement
- Light attack
- Enemy phase attack/move behavior
- HP/damage/death
- Loot drop on enemy death

Not included yet:
- Heavy attacks
- Dodge roll timing model
- Initiative ordering
- Reactions

## 8. Core Rule
Player success comes from turn decisions, not click speed.
