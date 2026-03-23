
# THE TOWER — Inventory System Design Doc (v0.1)

## 1. Purpose

The inventory system is a core gameplay system in The Tower.  
It controls player decision-making, risk management, extraction pressure, and loot prioritization.

Inventory is not just storage — it is a gameplay mechanic.

---

## 2. Design Goals

The inventory system should:
- Force meaningful loot decisions
- Create tension during runs
- Reward backpack upgrades
- Support different playstyles (loot goblin vs fighter)
- Make extraction a strategic decision
- Be easy to understand but hard to optimize perfectly

---

## 3. Inventory System Overview

The inventory system consists of:

| System | Purpose |
|-------|---------|
| Backpack Grid | Main storage |
| Equipment Slots | Equipped gear |
| Belt Trinket Slots | Passive/triggered build customization |
| Carry Weight | Movement penalties |
| Item Sizes | Inventory puzzle |
| Stack Sizes | Resource management |

---

## 4. Backpack Grid

### Starting Backpack
Starter backpack size:

4 × 3 grid (12 slots)

Example:

[ ][ ][ ][ ]  
[ ][ ][ ][ ]  
[ ][ ][ ][ ]

### Backpack Upgrades

| Pack Tier | Grid Size |
|-----------|-----------|
| Small | 4 × 3 |
| Medium | 5 × 4 |
| Large | 6 × 5 |
| Huge | 8 × 6 |

Backpacks are major progression items.

---

## 5. Item Sizes

Items occupy space in the grid.

| Item | Size |
|------|------|
| Potion | 1 × 1 |
| Materials | 1 × 1 |
| Dagger | 1 × 2 |
| Sword | 1 × 3 |
| Bow | 2 × 3 |
| Shield | 2 × 2 |
| Armor | 3 × 3 |
| Rope | 2 × 1 |
| Grapple Hook | 2 × 2 |
| Relic | 2 × 2 |

This makes inventory management a spatial puzzle.

---

## 6. Item Weight System

Each item also has weight.

| Item | Weight |
|------|--------|
| Potion | 1 |
| Dagger | 2 |
| Sword | 4 |
| Bow | 5 |
| Shield | 6 |
| Armor | 10 |
| Materials | 1 |
| Rope | 3 |
| Relic | 2 |

### Carry Weight Effects

| Weight % | Effect |
|----------|-------|
| 0–50% | No penalty |
| 50–75% | -5% movement speed |
| 75–90% | -10% movement speed |
| 90–100% | -20% movement speed |
| >100% | -50% movement speed (half speed) |

This creates extraction pressure and decision making.

---

## 7. Equipment Slots

Equipped items do NOT take backpack space.

| Slot | Item Type |
|------|-----------|
| Main Hand | Weapon |
| Off Hand | Shield / Utility |
| Helmet | Armor |
| Chest | Armor |
| Legs | Armor |
| Feet | Armor |

---

## 8. Belt Trinket Slots

The belt has a fixed 3-slot trinket row (displayed between left/right equipment groupings in the UI).
These slots are for belt-only trinkets that add passive or triggered modifiers.

| Belt Config | Slots |
|-----------|------|
| MVP Fixed | 3 |

Items allowed in belt trinket slots:
- Belt trinkets only
- Trinkets can modify core loop behavior (combat, loot, movement, extraction hooks)
- Consumable quickbar behavior is out of scope for this belt row in MVP

---

## 9. Stack Sizes

| Item Type | Stack Size |
|-----------|-----------|
| Materials | 20 |
| Potions | 5 |
| Arrows | 50 |
| Bombs | 3 |
| Keys | 1 |
| Weapons | 1 |
| Armor | 1 |

Implementation rule:
- This table is guidance only; authoritative stack limits come from per-item `stackSize` in `items.json`.

---

## 10. Loot Decision System

When inventory is full, player must choose what to keep.

Common decision examples:
- Drop armor for crafting materials
- Drop weapon for relic
- Drop materials for potion
- Extract early vs risk deeper floors

This is a core gameplay loop.

---

## 11. Extraction Rule

Player keeps only:
- Equipped items
- Items inside backpack grid
- Items in belt

All other items are lost on death.

---

## 12. MVP Inventory Scope

For MVP, implement:

| Feature | MVP |
|---------|-----|
| Grid inventory | Yes |
| Item sizes | Yes |
| Equipment slots | Yes |
| Belt trinket slots (3) | Yes |
| Weight system | Yes |
| Backpack upgrades | Later |
| Item rotation | Later |
| Auto sort | Later |

---

## 13. Inventory Data Model (Concept)

### Inventory Grid
- width
- height
- items[]
- item positions

### Item Instance
- instanceId
- itemId
- quantity
- durability
- grid position
- container type

### Equipment
- slot -> item instance

### Belt
- fixed array of 3 trinket item instances (or null)

---

## 14. Player Inventory Progression

| Upgrade | Effect |
|---------|-------|
| Better backpack | More space |
| Strength stat | More carry weight |
| Better trinkets | Build customization and run-shaping effects |
| Skill perk | Reduced item weight |
| Relic | Special inventory bonus |

---

## 15. Summary

The inventory system provides:
- Spatial decision making
- Weight management
- Risk vs reward choices
- Extraction pressure
- Progression through backpack upgrades

Inventory is one of the primary difficulty systems in The Tower.
