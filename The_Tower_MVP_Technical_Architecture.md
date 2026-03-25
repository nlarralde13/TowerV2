# THE TOWER - MVP Technical Architecture (v0.2)

## 1. MVP Goal
Deliver a playable vertical slice with one unified turn engine across exploration and combat.

## 2. Stack
- Next.js
- TypeScript
- React
- Zustand
- HTML5 Canvas
- JSON data in `/public/data`
- localStorage persistence

## 3. Architecture Principles
- Engine logic is separate from rendering/UI.
- Data-driven balancing via JSON.
- Deterministic systems (seeded generation and explicit turn order).
- One dominant timing model only.

## 4. Authoritative Gameplay Timing
Turn state in `RunState` is source of truth:
- `roundNumber`
- `phase` (`player` | `enemies`)
- player movement/action budget
- enemy phase queue metadata
- future extension slots (initiative/actor budgets/status effects)

## 5. Unified Turn Flow
1. Start player phase with refreshed movement/action.
2. Player uses movement/action.
3. Player manually ends turn.
4. Enemy phase resolves enemy AI actions.
5. Round advances.
6. Torch drains per round.
7. Next player phase starts.

## 6. System Responsibilities
- `engine/systems`: movement/combat/loot/inventory/extraction/fog/torch rules.
- `store`: authoritative run state transitions and persistence boundaries.
- `render`: map/entities/HUD drawing only.
- `components`: input and presentation only.

## 7. Deprecated Direction (Removed)
The architecture no longer targets:
- continuous/sub-tile player controller
- mixed continuous/discrete combat timing
- real-time combat loop
- post-action enemy auto-resolution

## 8. Persistence
Run saves must persist turn state and safely migrate old saves without turn data.
Invalid or missing turn fields must be normalized with safe defaults.

## 9. Testing/Regression Requirements
Simulation/regression coverage must verify:
- movement allowance per turn
- one action per turn
- explicit enemy phase sequencing
- round advance
- torch drain per round
- save migration for turn state

## 10. Expansion Path
Keep types/helpers extensible for:
- initiative ordering
- per-actor budgets
- reactions/status effects
- terrain movement costs
without replacing the current architecture.
