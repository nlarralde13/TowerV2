# THE TOWER - MVP Technical Architecture (v0.4)

## 1. MVP Goal
Deliver a playable vertical slice with grid movement and hybrid tick-based combat pacing.

---

## 2. Stack
- Next.js
- TypeScript
- React
- Zustand
- HTML5 Canvas
- JSON data in `/public/data`
- localStorage persistence

---

## 3. Architecture Principles
- Engine logic is separate from rendering/UI.
- Data-driven balancing via JSON.
- One dominant gameplay timing model.
- Tick pacing is authoritative; no player-facing turn step is required.

---

## 4. Authoritative Gameplay Timing
The run uses a global tick model:
- `tickIntervalMs = 1200`
- Player stamina regenerates `+2` per tick
- Enemies evaluate/act once per tick

No action points or bonus actions in the active ruleset.

---

## 5. Hybrid Gameplay Flow
1. Player moves by click-to-path (tile-based).
2. Player issues actions via skill bar/buttons (Q/W/R/T).
3. Global ticks continue advancing world state.
4. Enemy AI resolves during tick updates.
5. Stamina gates player action frequency.
6. Torch and run state updates remain internal timing concerns.

---

## 6. System Responsibilities
- `engine/systems`: movement/combat/loot/inventory/extraction/fog/torch rules.
- `store`: authoritative run state transitions and persistence boundaries.
- `render`: map/entities/HUD drawing only.
- `components`: input and presentation only.

---

## 7. Input Model
- Movement is click-only.
- Space confirms planned movement, Escape cancels.
- Skill hotkeys: `Q`, `W`, `R`, `T` (`Q` is basic attack in MVP).
- `G` picks up nearby loot.
- No End Turn control in hybrid mode.

---

## 8. Economy Model
- Removed: action points, bonus actions, full-turn costs.
- Added: stamina-first action gating.
- Canonical starting stamina values:
  - `staminaMax = 50`
  - `staminaCurrent = 50`
  - `staminaRegenPerTick = 2`
- Basic sword attack cost: `5 stamina`.

---

## 9. Persistence
Run saves must persist hybrid timing and stamina state safely.
Older saves missing stamina/tick fields must normalize to safe defaults.

---

## 10. Testing/Regression Requirements
Coverage should verify:
- Tick interval pacing behavior
- Stamina spend and regen
- Attack blocked when stamina is insufficient
- Enemy update cadence per tick
- Movement remains tile-based and free in MVP
- Save migration/defaulting for stamina/timing fields

---

## 11. Expansion Path
Keep architecture extensible for:
- Per-skill cooldowns
- Per-enemy cadence tuning
- Status effects and terrain costs
- Deeper skill system on `Q/W/R/T`
without replacing the hybrid tick foundation.
