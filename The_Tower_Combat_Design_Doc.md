
# THE TOWER — Combat System Design Document (v0.1)

## 1. Combat Philosophy
Combat should feel:
- Fast
- Dangerous
- Readable
- Skill-based (not button mashing)
- Loot-driven (gear matters)
- Build-driven (skills matter)
- Avoidable (combat is not always required)
- Costly (mistakes matter)

This is tactical real-time combat.

---

## 2. Combat Goals

| Goal | Reason |
|------|-------|
| Fights last 10–30 seconds | Keep runs moving |
| Player can die quickly | Keeps tension high |
| Positioning matters | Skill expression |
| Gear matters | Loot excitement |
| Skills matter | Builds feel different |
| Dodging matters | Player skill |
| Multiple enemies dangerous | Prevent button mashing |
| Boss fights are long | Big moments |

---

## 3. Player Combat Actions

| Action | Description |
|-------|-------------|
| Light Attack | Fast, low damage |
| Heavy Attack | Slow, high damage |
| Block | Reduce damage |
| Dodge Roll | Avoid damage |
| Skill | Special ability |
| Use Item | Potion, bomb, etc |
| Swap Weapon | Secondary weapon |

---

## 4. Control Scheme (Keyboard)

| Key | Action |
|-----|-------|
| Left Click | Move |
| A | Light Attack |
| S | Heavy Attack |
| D | Block |
| Space | Dodge |
| 1–4 | Skills |
| Q | Use Item |
| E | Interact |
| Tab | Map |
| I | Inventory |

---

## 5. Combat Stats

| Stat | What It Does |
|------|-------------|
| HP | Health |
| Stamina | Dodge, heavy attack, block |
| Attack | Damage |
| Defense | Damage reduction |
| Speed | Move speed |
| Crit Chance | Chance to crit |
| Crit Damage | Crit multiplier |
| Carry Weight | Inventory |
| Magic | Spell damage |
| Luck | Loot quality |

---

## 6. Damage Formula

Damage = Weapon Damage + Attack - Enemy Defense

Critical Hit:
Crit Damage = Damage × 1.5

Heavy Attack:
Heavy = Damage × 1.8

Backstab:
Backstab = Damage × 2.0

---

## 7. Stamina System

| Action | Stamina Cost |
|-------|--------------|
| Light Attack | 5 |
| Heavy Attack | 15 |
| Dodge | 20 |
| Block | 5 per hit |
| Sprint | 10/sec |

If stamina = 0:
- Cannot dodge
- Cannot heavy attack
- Slow movement

---

## 8. Weapons

| Weapon | Speed | Damage | Range |
|-------|------|-------|------|
| Dagger | Fast | Low | Very Short |
| Sword | Medium | Medium | Short |
| Axe | Slow | High | Short |
| Spear | Medium | Medium | Long |
| Bow | Medium | Medium | Long |
| Staff | Slow | High | Long |

---

## 9. Enemy Types

| Enemy | Behavior |
|------|----------|
| Rat | Fast, low HP |
| Skeleton | Balanced |
| Knight | Slow, high armor |
| Archer | Ranged |
| Mage | Ranged magic |
| Slime | Splits |
| Rogue | Dodges |
| Brute | Slow heavy hits |
| Boss | Unique mechanics |

---

## 10. Combat Flow Example

Enter room → Enemy sees player → Enemy approaches → Player attacks → Enemy attacks → Player dodges → Player heavy attack → Enemy dies → Loot drops

---

## 11. Status Effects

| Effect | Description |
|-------|-------------|
| Poison | Damage over time |
| Burn | Damage over time |
| Freeze | Slow |
| Shock | Stun chance |
| Bleed | Damage when moving |
| Weak | -Damage |
| Slow | -Speed |

---

## 12. Skills (Examples)

| Skill | Type |
|------|------|
| Fireball | Damage |
| Ice Nova | Freeze |
| Dash Strike | Movement |
| Shield Bash | Stun |
| Whirlwind | AoE |
| Arrow Rain | AoE |
| Trap | Utility |
| Heal | Survival |

---

## 13. Death

When player dies:
- Lose all run loot
- Keep XP
- Keep level
- Keep town progress
- Keep unlocked skills

Death should be punishing but fair.

---

## 14. MVP Combat System

### MVP Needs Only:
- Move
- Light attack
- Dodge
- Enemy AI (chase + attack)
- HP
- Damage
- Enemy death
- Loot drop

---

## 15. Combat Feel Rules

| Rule | Why |
|-----|----|
| Player dies in ~5–8 hits | Tension |
| Enemies die in 3–6 hits | Feels strong |
| Dodge has i-frames | Skill |
| Heavy attack interrupts | Strategy |
| Getting surrounded = dangerous | Positioning |
| Bosses have patterns | Learning |
| Hit feedback | Game feel |
| Screen shake on heavy | Impact |
| Sound on hit | Feedback |

---

## 16. Core Combat Rule

The player should win because they played well, not because they clicked faster.
