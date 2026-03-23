
# THE TOWER — Leveling & XP System Design Document (v0.1)

## 1. Purpose of Leveling
Leveling provides long-term progression and unlocks player power over time.

Leveling increases:
- HP
- Stamina
- Carry Weight
- Stats
- Skill Points
- Crafting Tiers
- Floor Access
- Extraction Options
- Town Upgrades

---

## 2. XP Sources

| Source | XP Weight |
|-------|-----------|
| Extracted Loot Value | Very High |
| Floors Reached | High |
| Bosses | High |
| Rooms Discovered | Medium |
| Puzzles Solved | Medium |
| Enemies Killed | Low |
| Crafting | Low |
| Extraction Bonus | Multiplier |
| Death | Partial XP |

---

## 3. XP Formula

Base XP =
(Loot Value × 0.5)
+ (Floor Reached × 100)
+ (Boss Killed × 500)
+ (Rooms Discovered × 10)
+ (Puzzles Solved × 50)
+ (Enemies Killed × 5)

Apply Floor Multiplier

If Extract:
    XP × 1.25

If Death:
    XP × 0.40

---

## 4. Floor XP Multiplier

| Floor | Multiplier |
|------|------------|
| 1–5 | 1.0 |
| 6–10 | 1.2 |
| 11–15 | 1.5 |
| 16–20 | 2.0 |
| 21–30 | 3.0 |
| 31–40 | 4.0 |
| 41–50 | 5.0 |

---

## 5. Level Curve (XP to Next Level)

| Level | XP |
|------|----|
| 1 | 100 |
| 2 | 150 |
| 3 | 220 |
| 4 | 320 |
| 5 | 450 |
| 6 | 650 |
| 7 | 900 |
| 8 | 1200 |
| 9 | 1600 |
| 10 | 2100 |
| 11 | 2800 |
| 12 | 3600 |
| 13 | 4500 |
| 14 | 5600 |
| 15 | 7000 |
| 16 | 9000 |
| 17 | 11500 |
| 18 | 14500 |
| 19 | 18000 |
| 20 | 22000 |
| 25 | 40000 |
| 30 | 65000 |
| 35 | 100000 |
| 40 | 150000 |
| 50 | 300000 |
| 60 | 600000 |
| 70 | 1,200,000 |
| 80 | 2,200,000 |
| 90 | 4,000,000 |
| 99 | 8,000,000 |

---

## 6. Floor Level Requirements

| Floor | Recommended Level | Required Level |
|------|-------------------|----------------|
| 1 | 1 | 1 |
| 5 | 5 | 4 |
| 10 | 10 | 9 |
| 15 | 15 | 13 |
| 20 | 20 | 17 |
| 25 | 25 | 21 |
| 30 | 30 | 25 |
| 40 | 40 | 32 |
| 50 | 50 | 40 |
| 60 | 60 | 48 |
| 70 | 70 | 56 |
| 80 | 80 | 65 |
| 90 | 90 | 75 |
| 99 | 99 | 85 |

---

## 7. Level Rewards

### Every Level
- +10 HP
- +5 Stamina
- +2 Carry Weight
- +1 Stat Point

### Every 2 Levels
- +1 Skill Point

### Every 5 Levels
- Unlock new skill tier
- Unlock new crafting tier

### Every 10 Levels
- Unlock new biome
- Unlock new extraction type
- Unlock town upgrades

---

## 8. Power Growth Example

| Stat | Level 1 | Level 20 |
|------|---------|----------|
| HP | 100 | 300 |
| Attack | 10 | 30 |
| Defense | 5 | 25 |
| Carry | 50 | 90 |

---

## 9. Summary

Leveling System Goals:
- Early levels fast
- Mid levels moderate
- Late levels slow
- Extraction is main XP source
- Floors gated by level
- Risk vs reward scaling
