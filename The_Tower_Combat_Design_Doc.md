# THE TOWER - Combat System Design Document (v0.3)

## 1. Combat Philosophy
Combat is tactical, lethal, and readable.
It uses the same turn engine as exploration.
Fights should feel meaningful and predictable in pacing — not grindy, not instantly fatal.

---

## 2. Authoritative Combat Timing
- No real-time combat loop.
- No post-action enemy auto-batching.
- No separate combat mode timer.
- Combat actions resolve during player phase and enemy phase only.

---

## 3. Player Turn Rules
- Movement allowance per turn: `floor(movementFeet / 5)`.
- One action per turn.
- End Turn is explicit and required to start enemy phase.

---

## 4. MVP Action Economy

Action-consuming:
- Attack
- Loot pickup
- Consume item
- Extraction attempt (full-turn style rule)

Free (MVP):
- Equip/unequip and inventory management, but only in player phase.

---

## 5. Combat Resolution Formula

Every player attack follows this sequence:

```
1. Hit check:    hit = random(0,1) < player.hitChance
2. Crit check:   crit = hit && random(0,1) < player.critChance
3. Raw damage:   rawDmg = player.totalStats.attack  (base + weapon avg)
4. Crit damage:  critDmg = crit ? floor(rawDmg × critMultiplier) : rawDmg
5. Final damage: finalDmg = max(1, critDmg - enemy.stats.defense)
```

**Expected DPR formula:**
```
DPR = hitChance × avgHitDmg × (1 + critChance × (critMultiplier − 1))
```

### Key properties
- A miss still consumes the player's action for the turn.
- `critMultiplier` is floored at 1.0 (crits always deal at least normal damage).
- `enemy.stats.defense` is explicit per template — not derived from tier.
- Enemy attacks on the player use: `max(1, enemy.damage − player.totalStats.defense)`.

---

## 6. Player Baseline Stats

Starting values (base stats before equipment):

| Stat | Base | With Starter Gear | Notes |
|------|------|-------------------|-------|
| HP | 75 | 75 | Worn chestguard adds no HP |
| Attack | 5 | 10 | Rusty sword avg (+5) adds on top |
| Defense | 1 | 4 | Worn chestguard adds +3 |
| HitChance | 0.75 | 0.75 | 75% base; gear can boost |
| CritChance | 0.0 | 0.03 | Weapon provides base crit (3%) |
| CritMultiplier | 1.5 | 1.5 | 150% on crits; can be boosted by gear |
| MovementFeet | 30 | 30 | 6 tiles/turn |

Tuning location: `public/data/playerDefaults.json`

---

## 7. Enemy Tier Pacing Targets

Combat is balanced to these approximate rounds-to-kill:

| Tier | Target Rounds | Defense | Example HP | Player Dmg/Round |
|------|--------------|---------|------------|-----------------|
| Weak (normal) | 2–3 | 0 | 16 | ~7.6 |
| Standard (normal) | 3–5 | 1 | 28 | ~6.9 |
| Veteran | 3–4 | 1 | 24 | ~6.9 |
| Elite | 5–8 | 3 | ~40 | ~5.4 |
| Boss | 8+ | 4–5 | ~55 | ~3.9–4.6 |

DPR estimates assume player starter gear (hitChance 0.75, critChance 0.03, attack 10).

Tuning location: `public/data/enemies.json` (each enemy has explicit `defense` field)

---

## 8. Current MVP Roster

| Enemy | Tier | HP | Defense | Damage | Behavior |
|-------|------|----|---------|--------|----------|
| Small Rat | normal | 16 | 0 | 5 | chase_attack, floors 1–4 |
| Skeleton | normal | 28 | 1 | 7 | chase_attack, floors 1–8 |
| Broken Archer | veteran | 24 | 1 | 10 | kite_shoot, ranged, floors 3–10 |

---

## 9. Input & Controls

| Input | Action |
|-------|--------|
| Left-click tile | Move to tile (click-to-move, path planned) |
| Left-click enemy | Face toward enemy + set as targeted |
| Enter | Confirm planned movement path |
| Escape | Cancel planned movement |
| F | Attack tile in front of player |
| G | Pick up loot at player tile |
| E | Extraction attempt |
| Space | End turn |
| I | Toggle inventory |
| C | Toggle character sheet |
| L | Toggle action log |
| J | Toggle journal |

**No keyboard movement.** All movement is click-based. Arrow keys and WASD do not move the player.

---

## 10. HUD & Feedback Systems

### Always-visible overlay (on canvas)
- **Player HP bar** (bottom-left of canvas): green → amber → red as HP drains. Shows current/max.
- **Player SP bar** (below HP): blue stamina bar. Shows current/max.

### Enemy targeting (on canvas, appears when enemy is clicked)
- Enemy body highlights (lighter red + amber ring) when targeted.
- **Enemy target box** (top-right of canvas): shows enemy name, HP bar, tier, and role.
- HP mini-bars drawn above all visible enemies on the canvas (green → amber → red).

### Combat log (right panel: L key)
Every attack generates a detailed log entry:
- Miss: `Missed Skeleton!`
- Normal hit: `Hit Skeleton for 9 damage.`
- Critical hit: `Hit Skeleton for 13 damage. ★ CRIT` (highlighted as warning)
- Kill: `Skeleton was defeated!` (separate entry)
- Enemy phase summary: total damage taken, kills, loot drops per phase.

---

## 11. MVP Scope

Implemented:
- Tile movement (click-to-move)
- Light attack with hit/miss/crit resolution
- Enemy phase attack/move behavior
- HP / damage / death
- Loot drop on enemy death
- HP + SP bars overlaid on canvas
- Enemy targeting and stats display
- Rich combat action log

Not included yet:
- Heavy attacks
- Dodge roll
- Initiative ordering
- Reactions / status effects
- Ranged attack implementation (archer behavior stubs exist)

---

## 12. Core Rule
Player success comes from turn decisions, not click speed.
