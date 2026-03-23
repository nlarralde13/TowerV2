
# THE TOWER — Master Design Document (v0.1)

## 1. Game Summary
**The Tower** is a run-based, top-down 16-bit action adventure game where the player enters a mysterious tower, explores procedurally generated floors, gathers loot and resources, and must extract safely to keep what they found.

The game focuses on:
- Risk vs reward
- Extraction
- Character progression
- Crafting
- Exploration
- Short runs with long-term progression

---

## 2. The Core Player Loop
Enter Tower → Explore Floor → Fight / Puzzle / Loot → Inventory fills → Decide: Extract or Climb → Extract = Keep Loot → Die = Lose Loot → After Action Report → Level Up → Craft / Upgrade → Enter Tower Again

---

## 3. Game Structure

| System | Description |
|-------|-------------|
| Runs | Each tower attempt |
| Floors | Procedurally generated levels |
| Rooms | Combat, loot, puzzle, etc |
| Extraction | Escape and keep loot |
| Death | Lose run inventory |
| Town | Crafting, upgrades |
| Character | Persistent leveling |
| Skills | Unlock abilities |
| Gear | Weapons and armor |
| Inventory | Limited carry space |

---

## 4. World & Story

### Setting
A medieval village trapped under a dome of twilight after a mysterious tower appears when the moon turns blue.

No magic existed before the tower.

The tower appears to be:
- Alive
- Watching
- Testing the villagers

The villagers must enter the tower to survive.

You are one of them.

---

## 5. Gameplay Style

| Feature | Style |
|--------|------|
| Perspective | Top-down (3/4 view) |
| Graphics | 16-bit SNES |
| Combat | Real-time |
| Movement | Click-to-move |
| Map | Fog of war |
| Floors | Procedural |
| Runs | 5–15 minutes |
| Progression | Persistent |
| Max Level | 99 |
| Engine | JavaScript |
| Rendering | HTML5 Canvas |

---

## 6. Floors

Each floor contains:
- Enemies
- Loot
- Crafting materials
- Puzzles
- Secret rooms
- Extraction points (some floors)
- Stairs up

### Floor Time Target
| Floor Range | Avg Time |
|-------------|----------|
| 1–5 | 5 min |
| 6–10 | 7 min |
| 11–20 | 10 min |
| 21+ | 15+ min |

---

## 7. Extraction System

You only keep items if you extract successfully.

### Example Extraction Methods
| Method | Required Item |
|-------|---------------|
| Rope out window | Rope + Grapple |
| Sewer escape | Sewer key |
| Break wall | Bomb |
| Magic gate | Rune |
| Boss exit | Kill boss |

---

## 8. Inventory System

| Slot | Notes |
|-----|------|
| Weapon | Equipped |
| Armor | Equipped |
| Ring | Equipped |
| Backpack | Storage |
| Belt | Quick items |

Backpack size upgrades over time. Carry weight affects movement speed, stamina use, and dodge speed.

---

## 9. Character Progression

### XP Sources
- Enemies killed
- Floors reached
- Loot extracted
- Puzzles solved
- Bosses killed
- Crafting
- Discovering rooms

### Level Cap
99

### Level Rewards
- HP
- Stamina
- Carry weight
- Skill points
- Unlock abilities

---

## 10. Skill Trees

| Tree | Focus |
|------|------|
| Strength | Melee, carry weight |
| Dexterity | Speed, dodge |
| Intelligence | Magic |
| Survival | Crafting, traps, loot |

---

## 11. Crafting

| Resource | Use |
|---------|-----|
| Wood | Weapons |
| Iron | Weapons/Armor |
| Cloth | Armor |
| Leather | Armor |
| Herbs | Potions |
| Oil | Fire |
| Rope | Extraction |
| Gems | Magic |
| Bone | Weapons |

Crafting occurs in town or rare crafting rooms in the tower.

---

## 12. After Action Report

Floors Reached: X  
Enemies Killed: X  
Puzzles Solved: X  
Loot Extracted Value: X  
Items Crafted: X  
Rooms Discovered: X  
Extraction Method: X  

XP Earned: X  
Level Up?  
Skill Points Earned: X  

---

## 13. Tone & Atmosphere
The game should feel:
- Quiet
- Lonely
- Strange
- Slightly funny
- Oppressive
- The Tower feels alive
- The Tower is studying the player

---

## 14. Technical Direction

| System | Approach |
|-------|----------|
| Engine | JavaScript |
| Render | HTML Canvas |
| Data | JSON |
| Floors | Procedural |
| RNG | Seeded |
| Save | Local |
| Platform | Browser + Mobile |
| Architecture | Engine separate from UI |

---

## 15. MVP (Minimum Viable Game)

### MVP Must Include:
- Movement
- Procedural floor
- Fog of war
- Enemies
- Combat
- Loot
- Inventory
- Extraction
- After action report
- Leveling

---

## 16. The Golden Rule
The game is not about beating the tower.  
The game is about deciding when to leave.
