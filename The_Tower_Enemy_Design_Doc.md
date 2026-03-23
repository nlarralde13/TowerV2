
# THE TOWER — Enemy & AI Design Document (v0.1)

## 1. Enemy Design Philosophy
Enemies are combat puzzles, not just targets.
Each enemy creates a problem the player must solve.

| Enemy Type | The Problem They Create |
|-------------|------------------------|
| Fast enemy | Forces movement |
| Tank enemy | Forces heavy attacks |
| Ranged enemy | Forces closing distance |
| Shield enemy | Forces flanking |
| Exploding enemy | Forces spacing |
| Summoner | Forces target priority |
| Healer | Forces target priority |
| Boss | Forces pattern learning |

---

## 2. Enemy Roles

| Role | Behavior |
|------|----------|
| Chaser | Runs at player |
| Tank | Slow, high HP |
| Ranged | Attacks from distance |
| Support | Buffs/heals enemies |
| Summoner | Spawns enemies |
| Ambusher | Hides, surprise attack |
| Exploder | Runs at player and explodes |
| Controller | Slows / stuns player |
| Boss | Unique mechanics |

### Current MVP AI Rule (Implemented Baseline)
- `chaser` role: pursues player normally.
- Any role not `chaser`: uses tether AI.
- Tether AI behavior:
  - Has a spawn anchor at initial spawn tile.
  - Wanders only inside a 3x3 area centered on that anchor.
  - Does not pursue unless player is within 2 tiles of its current position.
  - If it steps while pursuing, it still cannot leave the 3x3 tether area.

---

## 3. Basic Enemy Stats

| Stat | Description |
|------|-------------|
| HP | Health |
| Damage | Attack damage |
| Speed | Movement speed |
| Attack Speed | Time between attacks |
| Range | Attack distance |
| Aggro Range | Detection distance |
| Poise | Resistance to stun |
| Loot Value | XP + loot |

---

## 4. Enemy Difficulty Tiers

| Tier | Description |
|------|-------------|
| Normal | Basic enemy |
| Veteran | More HP + damage |
| Elite | Special ability |
| Champion | Multiple abilities |
| Boss | Unique mechanics |

---

## 5. Elite Enemy Modifiers

| Modifier | Effect |
|----------|-------|
| Burning | Fire damage |
| Frozen | Slows player |
| Vampiric | Heals on hit |
| Fast | Moves fast |
| Giant | Huge HP |
| Split | Splits on death |
| Explosive | Explodes on death |
| Shielded | Has shield |
| Invisible | Cloaks |
| Summoner | Spawns adds |

---

## 6. Room Danger Levels

| Danger Level | Description |
|--------------|-------------|
| 1 | 1–2 weak enemies |
| 2 | 3–4 weak enemies |
| 3 | Mixed enemies |
| 4 | Elite enemy |
| 5 | Elite + group |
| 6 | Mini boss |
| 7 | Boss |

---

## 7. Spawn Types

| Spawn Type | Description |
|------------|-------------|
| Idle | Standing |
| Patrol | Walking path |
| Ambush | Hidden |
| Door burst | Break through door |
| Spawn circle | Appear magically |
| Drop from ceiling | Trap |
| Rise from ground | Undead |

---

## 8. Boss Design Philosophy
Boss fights should be pattern-based, multi-phase, and reward large loot.

---

## 9. MVP Enemy System

| Enemy | Behavior |
|------|----------|
| Rat | Chase |

Temporary roster lock for current MVP build:
- Only `Rat` (`chaser`) is enabled in `floorRules.enemyPool`.
- Additional enemies stay in data files but are disabled until pacing and AI are expanded.
