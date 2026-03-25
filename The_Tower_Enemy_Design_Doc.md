# THE TOWER - Enemy & AI Design Document (v0.3)

## 1. Enemy Design Philosophy
Enemies are tactical problems solved through positioning, resource budgeting, and turn timing.

---

## 2. Authoritative Enemy Timing
- Enemies act only during enemy phase.
- Enemies do not react after each individual player action.
- Enemy behavior is resolved in deterministic order per phase.

---

## 3. MVP Enemy Phase Behavior
For each living enemy in enemy phase:
1. Evaluate aggro/target.
2. If in attack range, attack.
3. Else move according to behavior.
4. End actor action for this phase.

---

## 4. Aggro / Chase Model (Current)
- `chaser` role can acquire aggro by range and pursue.
- Non-chasers stay tethered unless in explicit aggro/attacking state.
- AI respects walkability, bounds, occupancy, and range checks.

---

## 5. Data-Driven Enemy Stats

All enemy stats live in `public/data/enemies.json`. Every template now includes:

| Stat | Description |
|------|-------------|
| `hp` | Maximum and starting hit points |
| `damage` | Raw damage per attack (before player defense) |
| `defense` | Flat damage reduction applied against player attacks |
| `speed` | Tile movement speed (reserved for future speed-based turn ordering) |
| `attackSpeed` | Attack frequency modifier (reserved for future multi-action phases) |
| `attackRange` | Maximum tile distance to attack player (1 = melee) |
| `aggroRange` | Tile distance at which chasers acquire the player as target |
| `poise` | Interrupt/stagger resistance (reserved for future stagger system) |

`defense` is **explicit per template**, not derived from tier. This allows fine-grained tuning without tier-wide side effects.

---

## 6. Enemy Tier Stat Bands

Use these as design guidelines when creating new enemies:

| Tier | HP Range | Defense | Damage | Pacing Target |
|------|----------|---------|--------|--------------|
| normal | 12–30 | 0–1 | 4–8 | 2–5 rounds |
| veteran | 20–35 | 1–2 | 8–12 | 3–5 rounds |
| elite | 35–55 | 3–4 | 10–16 | 5–8 rounds |
| champion | 50–80 | 4–5 | 14–20 | 7–10 rounds |
| boss | 60–120 | 4–6 | 16–30 | 8+ rounds |

Pacing is calculated relative to player starter gear (attack 10, hitChance 0.75, critMult 1.5).
See `The_Tower_Combat_Design_Doc.md` §7 for the DPR formula.

---

## 7. Current MVP Roster

| ID | Name | Tier | HP | Def | Dmg | Floors | Behavior |
|----|------|------|----|-----|-----|--------|----------|
| `enemy_rat_small` | Small Rat | normal | 16 | 0 | 5 | 1–4 | chase_attack |
| `enemy_skeleton_basic` | Skeleton | normal | 28 | 1 | 7 | 1–8 | chase_attack |
| `enemy_archer_broken` | Broken Archer | veteran | 24 | 1 | 10 | 3–10 | kite_shoot |

---

## 8. Future-Ready Direction
Current MVP keeps one enemy action budget per phase, with architecture prepared for:
- Per-enemy speed/action budget
- Initiative order
- Ranged attack implementation (archer `kite_shoot` behavior is stubbed)
- Status effects and terrain penalties
- Champion and boss tiers (stat bands defined above)
