# THE TOWER - Enemy & AI Design Document (v0.4)

## 1. Enemy Design Philosophy
Enemies are tactical problems solved through positioning, visibility, and stamina-aware timing windows.

---

## 2. Authoritative Enemy Timing
- Enemies are processed by the global tick loop.
- `tickIntervalMs = 1200`.
- Each active enemy evaluates and acts once per tick.
- Enemies do not execute immediate post-player-action batches.

---

## 3. MVP Enemy Tick Behavior
For each living enemy during tick update:
1. Evaluate aggro/target.
2. If in attack range, attack.
3. Else move according to behavior.
4. End update for that tick.

---

## 4. Aggro / Chase Model (Current)
- `chaser` role can acquire aggro by range and pursue.
- Non-chasers stay tethered unless in explicit `aggro`/`attacking` state.
- AI respects walkability, bounds, occupancy, and range checks.

---

## 5. Data-Driven Enemy Stats
All enemy stats live in `public/data/enemies.json`.

| Stat | Description |
|---|---|
| `hp` | Maximum and starting hit points |
| `damage` | Raw damage per attack (before player defense) |
| `defense` | Flat damage reduction applied against player attacks |
| `speed` | Reserved for future movement cadence tuning |
| `attackSpeed` | Reserved for future attack cadence tuning |
| `attackRange` | Maximum tile distance to attack player |
| `aggroRange` | Tile distance at which chasers acquire target |
| `poise` | Reserved for stagger/interrupt systems |

---

## 6. Enemy Tier Stat Bands (Guidance)
| Tier | HP Range | Defense | Damage |
|---|---|---|---|
| normal | 12-30 | 0-1 | 4-8 |
| veteran | 20-35 | 1-2 | 8-12 |
| elite | 35-55 | 3-4 | 10-16 |
| champion | 50-80 | 4-5 | 14-20 |
| boss | 60-120 | 4-6 | 16-30 |

---

## 7. Current MVP Roster
| ID | Name | Tier | HP | Def | Dmg | Floors | Behavior |
|---|---|---|---|---|---|---|---|
| `enemy_rat_small` | Small Rat | normal | 16 | 0 | 5 | 1-4 | chase_attack |
| `enemy_skeleton_basic` | Skeleton | normal | 28 | 1 | 7 | 1-8 | chase_attack |
| `enemy_archer_broken` | Broken Archer | veteran | 24 | 1 | 10 | 3-10 | kite_shoot |

---

## 8. Future-Ready Direction
Architecture should remain ready for:
- per-enemy cadence tuning via `speed`/`attackSpeed`
- ranged attack depth
- status effects and terrain penalties
- champion/boss behavior scripting
