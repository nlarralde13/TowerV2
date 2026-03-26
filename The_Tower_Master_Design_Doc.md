# THE TOWER - Master Design Document (v0.3)

## 1. Game Summary
The Tower is a run-based, top-down tactical extraction game.
The player explores procedural floors, manages risk, fights with tile positioning, and extracts to keep loot.

Core pillars:
- Risk vs reward
- Extraction decisions
- Tactical positioning
- Persistent progression

## 2. Core Loop
Enter Tower -> Explore Floor -> Fight / Loot / Manage Inventory -> Decide: Extract or Climb ->
Extract = Keep Loot -> Die = Lose Run Loot -> Run Summary -> XP / Level -> Next Run

## 3. Gameplay Model (Authoritative)
- Hybrid tick-paced model for exploration and combat.
- 1 tile = 5 feet.
- Movement is tile-based and free in MVP.
- Action points and bonus actions are removed.
- Stamina is the pacing resource.
- Global tick drives world updates behind the scenes.

Canonical values:
- `tickIntervalMs = 1200`
- `staminaMax = 50`
- `staminaCurrent = 50`
- `staminaRegenPerTick = 2`
- Basic sword attack stamina cost: `5`

## 4. Inventory / Extraction Direction
- Weight-based inventory remains core.
- Belt is a fixed 3-slot trinket customization row.
- Belt is not a consumable quickbar.
- Extraction is condition-gated and free in MVP (no action-point cost).

## 5. Technical Direction
- Engine logic separate from rendering.
- Canvas rendering + React UI + Zustand state.
- JSON-driven content in `/public/data`.
- One authoritative timing model: hybrid global tick.

## 6. Golden Rule
The game is about deciding when to leave, not clearing everything.
