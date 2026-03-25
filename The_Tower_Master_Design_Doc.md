# THE TOWER - Master Design Document (v0.2)

## 1. Game Summary
The Tower is a run-based, top-down tactical extraction game.
The player explores procedural floors, manages risk, fights in turn-based encounters, and extracts to keep loot.

Core pillars:
- Risk vs reward
- Extraction decisions
- Tactical turn play
- Persistent progression

## 2. Core Loop
Enter Tower -> Explore Floor -> Fight / Loot / Manage Inventory -> Decide: Extract or Climb ->
Extract = Keep Loot -> Die = Lose Run Loot -> Run Summary -> XP / Level -> Next Run

## 3. Gameplay Model (Authoritative)
- One unified turn engine for exploration and combat.
- 1 tile = 5 feet.
- Player turn budget:
  - movement tiles = floor(movementFeet / 5)
  - one action per turn
- End Turn is explicit and starts enemy phase.
- Enemy phase resolves all enemy actions once per round.
- Torch/resource drain is round-based (not time-based).

## 4. Current MVP Turn Flow
1. Player phase starts with movement/action refreshed.
2. Player spends movement and/or action.
3. Player ends turn manually.
4. Enemy phase executes.
5. Round advances.
6. Next player phase starts.

## 5. Inventory / Extraction Direction
- Grid inventory with weight pressure remains core.
- Belt is a fixed 3-slot trinket customization row.
- Belt is not a consumable quickbar.
- Extraction is a tactical decision inside the same turn ruleset.

## 6. Technical Direction
- Engine logic separate from rendering.
- Canvas rendering + React UI + Zustand state.
- JSON-driven content in `/public/data`.
- One authoritative timing model: turn/phase/round.

## 7. Golden Rule
The game is about deciding when to leave, not clearing everything.
