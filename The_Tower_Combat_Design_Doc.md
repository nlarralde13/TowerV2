# THE TOWER - Combat System Design Document (v0.4)

## 1. Combat Philosophy
Combat is tactical, lethal, and readable.
Movement remains tile-based and click-driven.
Pacing is controlled by a global system tick and stamina, not action points.

---

## 2. Authoritative Combat Timing (Hybrid)
- No manual end turn.
- No action points or bonus actions.
- No round UI requirement for players.
- Global tick drives combat pacing behind the scenes.

### Canonical timing values
- `tickIntervalMs = 1200`
- Player stamina regen: `+2` per tick
- Enemy AI update cadence: once per tick per active enemy

---

## 3. Stamina Economy (Authoritative)
Action points are removed from gameplay rules.

Starting baseline:
- `staminaMax = 50`
- `staminaCurrent = 50`
- `staminaRegenPerTick = 2`

MVP stamina costs:
- Basic sword attack: `5 stamina`

Rules:
- If stamina is below cost, the attack fails and no hit check occurs.
- Successful or missed attacks both consume stamina cost.
- Movement does not consume stamina in MVP.

---

## 4. Interaction Cost Model (MVP)
There is no action/bonus-action economy in this model.

| Interaction | Cost Type | Cost |
|---|---|---|
| Move tile/path | free | 0 |
| Attack (basic sword) | stamina | 5 |
| Loot pickup | free | 0 |
| Consume item | free (for now) | 0 |
| Equip/unequip | free | 0 |
| Extract | free (condition-gated) | 0 |

Future skills may add stamina costs and cooldowns per skill definition.

---

## 5. Combat Resolution Formula
Every player attack follows this sequence:

```text
1. Validate stamina >= attack cost
2. Spend stamina cost
3. Hit check:    hit = random(0,1) < player.hitChance
4. Crit check:   crit = hit && random(0,1) < player.critChance
5. Raw damage:   rawDmg = player.totalStats.attack
6. Crit damage:  critDmg = crit ? floor(rawDmg * critMultiplier) : rawDmg
7. Final damage: finalDmg = max(1, critDmg - enemy.stats.defense)
```

Expected DPR:
```text
DPR = hitChance * avgHitDmg * (1 + critChance * (critMultiplier - 1))
```

---

## 6. Baseline Player Combat Stats
Starting values (base before equipment):

| Stat | Base | Notes |
|---|---|---|
| HP | 75 | Tuned in player defaults |
| Attack | 5 | Equipment adds flat attack |
| Defense | 1 | Equipment adds flat defense |
| HitChance | 0.75 | 75% base |
| CritChance | 0.00 | Gear may add |
| CritMultiplier | 1.5 | Minimum 1.0 |
| MovementFeet | 30 | 1 tile = 5 feet |
| Stamina | 50/50 | Regen +2 per tick |

Tuning location: `public/data/playerDefaults.json`

---

## 7. Enemy Pacing
Enemy behavior evaluates once per tick:
1. Evaluate aggro/target
2. Attack if in range
3. Otherwise move by behavior rules

No per-action immediate enemy reaction outside tick processing.

---

## 8. Input & Controls (Current)
| Input | Action |
|---|---|
| Left-click tile | Plan/execute movement path |
| Left-click enemy | Target and face enemy |
| Space | Confirm planned movement |
| Escape | Cancel planned movement |
| Q | Skill 1 (Attack) |
| W | Skill 2 placeholder |
| R | Skill 3 placeholder |
| T | Skill 4 placeholder |
| G | Pick up nearby loot |
| I/C/L/J | Toggle UI panels |

No End Turn control in hybrid mode.

---

## 9. HUD & Feedback
- Show HP and stamina bars clearly.
- Show attack affordability via stamina (enabled/disabled state).
- Keep tick/round processing behind the scenes.
- Event log should prioritize meaningful combat and loot events, not timing internals.

---

## 10. Core Rule
Player success should come from positioning, timing windows, and stamina management, not click spam.
