# THE TOWER - MVP Technical Architecture (v0.3)

## 1. MVP Goal
Deliver a playable vertical slice with one unified turn engine across exploration and combat.

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
- Deterministic systems (seeded generation and explicit turn order).
- One dominant timing model only.

---

## 4. Authoritative Gameplay Timing
Turn state in `RunState` is source of truth:
- `roundNumber`
- `phase` (`player` | `enemies`)
- Player movement/action budget
- Enemy phase queue metadata
- Future extension slots (initiative/actor budgets/status effects)

---

## 5. Unified Turn Flow
1. Start player phase with refreshed movement/action.
2. Player uses movement/action.
3. Player manually ends turn.
4. Enemy phase resolves enemy AI actions.
5. Round advances.
6. Torch drains per round.
7. Next player phase starts.

---

## 6. System Responsibilities
- `engine/systems`: movement/combat/loot/inventory/extraction/fog/torch rules.
- `store`: authoritative run state transitions and persistence boundaries.
- `render`: map/entities/HUD drawing only.
- `components`: input and presentation only.

---

## 7. Input Model

**Movement is click-only.**
- Canvas tile-click computes a path via `findPath`.
- Path is previewed on canvas (blue = reachable, red = out of range).
- Enter confirms the path; Escape cancels.
- WASD and arrow keys do **not** move the player.

**Enemy targeting:**
- Clicking an enemy tile faces the player toward that enemy (`setPlayerFacing`) and marks it as the active target.
- The targeted enemy is highlighted on canvas (amber ring + lighter body).
- Attack (F key or Attack button) hits the tile directly in front of the player's facing direction.

**Other keyboard hotkeys:** F (attack), G (loot), E (extract), Space (end turn), I/C/L/J (panels).

---

## 8. HUD & Feedback Layer

### Canvas overlays (always visible)
- **Player HP bar** (bottom-left): green → amber → red, shows current/max HP.
- **Player SP bar** (below HP): blue stamina bar, shows current/max.
- **Enemy HP mini-bars**: drawn above every visible enemy circle, colour-coded by HP %.
- **Enemy target box** (top-right, shown when enemy is targeted): name, HP bar, tier, role label.

### Action log (right panel, L key)
All combat events generate named, categorised log entries:
- Miss: `Missed [EnemyName]!`
- Hit: `Hit [EnemyName] for [N] damage.`
- Crit: `Hit [EnemyName] for [N] damage. ★ CRIT` (warning level, visually distinct)
- Kill: `[EnemyName] was defeated!`
- Enemy phase: damage total, kill count, loot drops.

### Viewport event console (below canvas)
Shows last 8 meaningful events (combat, loot, system) with timestamps.
Filtered to exclude noisy system messages (run start, save status, torch light).

---

## 9. Combat Stats Added to PlayerStatSet

Two new stats were added as part of the turn-based combat rebalance:

| Stat | Type | Default | Description |
|------|------|---------|-------------|
| `hitChance` | float 0–1 | 0.75 | Probability to hit per attack. Capped at 1.0. |
| `critMultiplier` | float ≥1.0 | 1.5 | Damage multiplier on a critical hit. Floored at 1.0. |

These are set from `playerDefaults.json`, stacked additively with equipment bonuses, and clamped in `playerStats.ts`.

Enemy templates also gained an explicit `defense` field (flat damage reduction vs player attacks).

---

## 10. Deprecated Direction (Removed)
The architecture no longer targets:
- Continuous/sub-tile player controller
- Mixed continuous/discrete combat timing
- Real-time combat loop
- Post-action enemy auto-resolution
- WASD keyboard movement

---

## 11. Persistence
Run saves must persist turn state and safely migrate old saves without turn data.
Invalid or missing turn fields must be normalized with safe defaults.
New stats (`hitChance`, `critMultiplier`) in `PlayerStatSet` are initialized to 0 by `createEmptyStatSet`; saves created before these fields existed will pick up the base values from `playerDefaults` on the next new run.

---

## 12. Testing/Regression Requirements
Simulation/regression coverage must verify:
- Movement allowance per turn
- One action per turn
- Explicit enemy phase sequencing
- Round advance
- Torch drain per round
- Save migration for turn state
- Hit/miss/crit combat resolution

---

## 13. Expansion Path
Keep types/helpers extensible for:
- Initiative ordering
- Per-actor budgets
- Reactions/status effects
- Terrain movement costs
- Click-to-attack on adjacent enemy tiles
- Dodge/block actions consuming stamina
without replacing the current architecture.
