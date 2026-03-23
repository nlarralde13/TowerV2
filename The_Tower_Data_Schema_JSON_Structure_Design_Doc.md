# THE TOWER — Data Schema / JSON Structure Design Doc (v0.1)

## 1. Purpose

This document defines the core JSON data structures for the MVP of **The Tower**.

Goals:
- Keep balancing data outside gameplay logic
- Make procedural generation deterministic and debuggable
- Support clean separation between engine, UI, and content
- Make it easy to expand enemies, items, floors, and loot later
- Keep MVP schemas simple enough to implement quickly

---

## 2. Data Design Rules

### Rule 1 — Use stable IDs
Every major object should have a unique string `id`.

Examples:
- `enemy_rat_small`
- `weapon_rusty_sword`
- `floor_band_01`
- `loottable_floor_1_common`

Do not use display names as identifiers.

### Rule 2 — Keep display text separate from rules
Names and flavor can live in the same file for MVP, but gameplay-critical fields should remain explicit and structured.

### Rule 3 — Prefer explicit fields over “smart” parsing
Bad:
```json
{ "type": "fast fire rat" }
```

Good:
```json
{
  "role": "chaser",
  "element": "fire",
  "speed": 1.3
}
```

### Rule 4 — MVP first
Do not add fields that are not needed for MVP logic yet.

---

## 3. Suggested File Layout

```text
/public/data/
  enemies.json
  items.json
  lootTables.json
  floorRules.json
  xpTable.json
  extractionRules.json
  skills.json
  playerDefaults.json
  rooms.json
```

---

## 4. Common Shared Patterns

### 4.1 ID Pattern
Every primary game object should include:
```json
{
  "id": "unique_id_here"
}
```

### 4.2 Rarity Enum
Use one of:
- `common`
- `uncommon`
- `rare`
- `epic`
- `legendary`
- `relic`

### 4.3 Item Type Enum
Use one of:
- `weapon`
- `armor`
- `trinket`
- `material`
- `consumable`
- `tool`
- `quest`
- `relic`

### 4.4 Enemy Role Enum
Use one of:
- `chaser`
- `tank`
- `ranged`
- `support`
- `summoner`
- `ambusher`
- `exploder`
- `controller`
- `boss`

---

## 5. enemies.json

Defines enemy templates, not live enemy instances.

### Schema
```json
[
  {
    "id": "enemy_rat_small",
    "name": "Small Rat",
    "role": "chaser",
    "tier": "normal",
    "floorMin": 1,
    "floorMax": 4,
    "stats": {
      "hp": 20,
      "damage": 4,
      "speed": 1.4,
      "attackSpeed": 1.0,
      "attackRange": 1,
      "aggroRange": 5,
      "poise": 0
    },
    "behavior": {
      "aiType": "chase_attack",
      "canRetreat": false,
      "canStrafe": false
    },
    "drops": {
      "lootTableId": "loot_enemy_floor_1"
    },
    "xp": {
      "kill": 5
    },
    "render": {
      "sprite": "rat_small.png",
      "scale": 1
    }
  }
]
```

### Required Fields
- `id`
- `name`
- `role`
- `tier`
- `floorMin`
- `floorMax`
- `stats`
- `behavior.aiType`
- `drops.lootTableId`
- `xp.kill`

### Notes
- `floorMin` and `floorMax` control availability by depth
- `tier` should be one of: `normal`, `veteran`, `elite`, `champion`, `boss`
- Live spawned enemies should copy from this template and add runtime state
- Current MVP AI rule:
  - `role: "chaser"` pursues player normally.
  - Any non-`chaser` role is tethered to a 3x3 around spawn and only pursues if player is within 2 tiles.

---

## 6. items.json

Defines all item templates.

### Schema
```json
[
  {
    "id": "weapon_rusty_sword",
    "name": "Rusty Sword",
    "type": "weapon",
    "subtype": "sword",
    "rarity": "common",
    "value": 18,
    "weight": 4,
    "gridSize": {
      "w": 1,
      "h": 3
    },
    "stackSize": 1,
    "equipSlot": "mainHand",
    "stats": {
      "damageMin": 4,
      "damageMax": 7,
      "attackSpeed": 1.0,
      "critChance": 0.03
    },
    "requirements": {
      "level": 1
    },
    "tags": ["starter", "melee"],
    "render": {
      "icon": "weapon_rusty_sword.png"
    }
  },
  {
    "id": "mat_scrap_iron",
    "name": "Scrap Iron",
    "type": "material",
    "subtype": "metal",
    "rarity": "common",
    "value": 6,
    "weight": 1,
    "gridSize": {
      "w": 1,
      "h": 1
    },
    "stackSize": 20,
    "tags": ["crafting"],
    "render": {
      "icon": "mat_scrap_iron.png"
    }
  }
]
```

### Required Fields
- `id`
- `name`
- `type`
- `rarity`
- `value`
- `weight`
- `gridSize`
- `stackSize`

### Conditional Fields
- Weapons should include `equipSlot` (`mainHand`) and weapon stats
- Armor should include `equipSlot` (`helmet` / `chest` / `legs` / `feet` / `offHand`) and defense stats
- Trinkets should include belt/trinket tags and only equip into trinket belt slots
- Consumables should include usage data later
- Tools should include extraction or utility tags

---

## 7. lootTables.json

Defines what can drop and at what chance.

### Schema
```json
[
  {
    "id": "loot_enemy_floor_1",
    "rolls": 1,
    "entries": [
      {
        "itemId": "mat_scrap_iron",
        "weight": 50,
        "minQty": 1,
        "maxQty": 2
      },
      {
        "itemId": "consumable_small_potion",
        "weight": 20,
        "minQty": 1,
        "maxQty": 1
      },
      {
        "itemId": "weapon_rusty_sword",
        "weight": 5,
        "minQty": 1,
        "maxQty": 1
      }
    ]
  }
]
```

### Required Fields
- `id`
- `rolls`
- `entries`

### Entry Fields
- `itemId`
- `weight`
- `minQty`
- `maxQty`

### Notes
- `weight` is relative, not percentage
- `rolls` lets one table drop multiple results later if needed

---

## 8. floorRules.json

Defines procedural generation rules by floor band or exact floor.

### Schema
```json
[
  {
    "id": "floor_band_01",
    "floorMin": 1,
    "floorMax": 5,
    "map": {
      "width": 24,
      "height": 24,
      "roomCountMin": 6,
      "roomCountMax": 10,
      "puzzleChance": 0.15,
      "secretChance": 0.05,
      "extractionChance": 0.35
    },
    "spawns": {
      "enemyPool": ["enemy_rat_small", "enemy_skeleton_basic", "enemy_slime_green"],
      "eliteChance": 0.03,
      "bossChance": 0.0
    },
    "loot": {
      "roomLootTableId": "loot_floor_1_room",
      "chestLootTableId": "loot_floor_1_chest"
    },
    "gating": {
      "recommendedLevel": 1,
      "requiredLevel": 1
    },
    "xpMultiplier": 1.0
  }
]
```

### Required Fields
- `id`
- `floorMin`
- `floorMax`
- `map`
- `spawns`
- `loot`
- `gating`
- `xpMultiplier`

### Notes
- This file is the backbone for difficulty pacing
- For MVP, banded floor rules are simpler than exact per-floor definitions
- Current MVP pacing lock:
  - Keep `spawns.enemyPool` to one chaser enemy type for now (`enemy_rat_small`) to avoid early overwhelm.
  - Spawn count should be low and room-count-driven in runtime logic.

---

## 9. xpTable.json

Defines XP thresholds for levels.

### Schema
```json
{
  "maxLevel": 99,
  "levels": [
    { "level": 1, "xpToNext": 100 },
    { "level": 2, "xpToNext": 150 },
    { "level": 3, "xpToNext": 220 },
    { "level": 4, "xpToNext": 320 },
    { "level": 5, "xpToNext": 450 }
  ],
  "runSources": {
    "lootValueMultiplier": 0.5,
    "floorReachedFlat": 100,
    "bossKillFlat": 500,
    "roomDiscoveredFlat": 10,
    "puzzleSolvedFlat": 50,
    "enemyKillFlat": 5,
    "extractMultiplier": 1.25,
    "deathMultiplier": 0.4
  }
}
```

### Required Fields
- `maxLevel`
- `levels`
- `runSources`

### Notes
- `levels` should include all 99 levels in final file
- `runSources` lets you rebalance XP without changing code

---

## 10. extractionRules.json

Defines extraction methods and their requirements.

### Schema
```json
[
  {
    "id": "extract_rope_window",
    "name": "Rope Window",
    "floors": {
      "min": 3,
      "max": 30
    },
    "requirements": {
      "itemsAny": [],
      "itemsAll": ["tool_rope", "tool_grapple_hook"],
      "minLevel": 1
    },
    "results": {
      "success": "extract",
      "consumeItems": ["tool_rope"]
    },
    "ui": {
      "label": "Climb down through the broken tower window."
    }
  }
]
```

### Required Fields
- `id`
- `name`
- `floors`
- `requirements`
- `results`

### Notes
- `itemsAll` means all listed items are required
- `itemsAny` is useful for future alternate keys or routes
- `results.success` can remain simple for MVP

---

## 11. skills.json

Defines active and passive skills.

### Schema
```json
[
  {
    "id": "skill_shield_bash",
    "name": "Shield Bash",
    "tree": "strength",
    "kind": "active",
    "unlockLevel": 5,
    "cost": {
      "stamina": 20,
      "mana": 0
    },
    "cooldown": 8,
    "effects": [
      {
        "type": "damage",
        "value": 18
      },
      {
        "type": "stun",
        "duration": 1.2
      }
    ],
    "targeting": {
      "shape": "cone",
      "range": 1
    }
  }
]
```

### Required Fields
- `id`
- `name`
- `tree`
- `kind`
- `unlockLevel`

### Notes
- For MVP, you can support only a few effect types:
  - `damage`
  - `heal`
  - `stun`
  - `dash`
  - `buff`

---

## 12. playerDefaults.json

Defines the starting profile and run-ready base stats.

### Schema
```json
{
  "baseStats": {
    "level": 1,
    "xp": 0,
    "hp": 100,
    "stamina": 50,
    "attack": 10,
    "defense": 5,
    "speed": 1,
    "carryWeight": 50
  },
  "equipment": {
    "mainHand": "weapon_rusty_sword",
    "offHand": null,
    "helmet": null,
    "chest": null,
    "legs": null,
    "feet": null
  },
  "inventory": {
    "backpack": {
      "w": 4,
      "h": 3
    },
    "beltSlots": 3
  },
  "unlockedSkills": [],
  "unlockedRecipes": []
}
```

### Required Fields
- `baseStats`
- `equipment`
- `inventory`

### Belt Rule (MVP)
- `inventory.beltSlots` is fixed at `3` for trinket slots in MVP.
- Belt slots are for trinket items only (customization modifiers), not quick-use consumables.

---

## 13. rooms.json

Defines room types and optional content weights for generation flavor.

### Schema
```json
[
  {
    "id": "room_combat_basic",
    "type": "combat",
    "weight": 50,
    "tags": ["early_floor"],
    "allowedFloorMin": 1,
    "allowedFloorMax": 99
  },
  {
    "id": "room_loot_chest",
    "type": "loot",
    "weight": 20,
    "tags": ["reward"],
    "allowedFloorMin": 1,
    "allowedFloorMax": 99
  }
]
```

### Notes
For MVP this can stay small, but it gives you an expandable content layer later.

---

## 14. Runtime Structures vs Template Data

JSON files should define **templates**.
Runtime state should be stored separately in code.

Example:
- `items.json` defines the sword template
- runtime state stores one specific sword instance with durability, seed roll, and current location

### Example runtime item instance
```json
{
  "instanceId": "itm_inst_0001",
  "itemId": "weapon_rusty_sword",
  "quantity": 1,
  "durability": 82,
  "rarityOverride": null,
  "position": {
    "container": "inventory",
    "x": 0,
    "y": 0
  }
}
```

This should **not** live in the template file.

---

## 15. Save JSON Shape

For MVP, save state should be split into profile and active run.

### 15.1 Profile Save
```json
{
  "profileVersion": 1,
  "player": {
    "level": 7,
    "xp": 4820,
    "stats": {
      "hp": 160,
      "stamina": 80,
      "attack": 16,
      "defense": 11,
      "speed": 1,
      "carryWeight": 62
    }
  },
  "unlocks": {
    "skills": ["skill_shield_bash"],
    "recipes": ["recipe_small_potion"]
  }
}
```

### 15.2 Active Run Save
```json
{
  "runVersion": 1,
  "seed": "tower_run_12345",
  "floor": 3,
  "player": {
    "hp": 74,
    "stamina": 31,
    "position": { "x": 8, "y": 14 }
  },
  "inventory": [],
  "equipped": {},
  "exploredTiles": ["8,14", "8,15", "9,15"],
  "groundLoot": [],
  "defeatedEnemies": ["enemy_inst_04", "enemy_inst_08"],
  "extractionState": {
    "availableNodeIds": ["extract_rope_window"]
  }
}
```

---

## 16. Validation Checklist

Before using any data file, validate:

### enemies.json
- all IDs unique
- all loot table references exist
- `floorMin <= floorMax`

### items.json
- all IDs unique
- `gridSize.w >= 1`
- `gridSize.h >= 1`
- `stackSize >= 1`

### lootTables.json
- each `itemId` exists in `items.json`
- `minQty <= maxQty`
- `weight > 0`

### floorRules.json
- floor bands do not overlap unless intended
- enemy IDs exist
- loot table IDs exist

### extractionRules.json
- referenced item IDs exist
- floor ranges valid

This will save you a lot of debugging later.

---

## 17. MVP Minimum Required Files

For the first playable version, you only truly need:

- `enemies.json`
- `items.json`
- `lootTables.json`
- `floorRules.json`
- `xpTable.json`
- `playerDefaults.json`

Everything else can start small or be hardcoded temporarily if needed.

---

## 18. Recommended Next Step

After this schema doc, define the matching TypeScript interfaces for:

- `EnemyTemplate`
- `ItemTemplate`
- `LootTable`
- `FloorRule`
- `XpTable`
- `ExtractionRule`
- `SkillTemplate`
- `PlayerDefaults`
- `RunSave`
- `ProfileSave`

That is the clean bridge from design into implementation.
