
# THE TOWER — MVP Technical Architecture Document (v0.1)

## 1. MVP Goal
Build a playable vertical slice that includes:
- Movement
- Procedural floors
- Combat
- Loot
- Inventory management
- Extraction
- XP and Leveling

If these systems work together, the game is viable.

---

## 2. Tech Stack

| Layer | Technology |
|------|------------|
| Framework | Next.js |
| Language | TypeScript |
| Rendering | HTML5 Canvas |
| UI | React |
| Game State | Zustand |
| Data | JSON |
| Save System | localStorage |
| Styling | CSS |
| Build Target | Browser / PWA |

---

## 3. Folder Structure

```
/src
  /app
  /components
  /game
    /engine
    /systems
    /world
    /entities
    /data
    /types
    /utils
  /render
    /canvas
    /hud
  /store
/public
  /data
  /images
  /audio
```

---

## 4. Core Game Systems (MVP Scope)

| System | Description |
|-------|-------------|
| Movement | Player movement and collision |
| Floor Generation | Procedural floor layout |
| Combat | Attack, dodge, damage, death |
| Enemy AI | Basic enemy behavior |
| Loot | Item drops and rarity |
| Inventory | Grid inventory + equipment |
| Extraction | Exit floor with loot |
| XP/Leveling | Progression system |
| Fog of War | Map discovery |
| Run Summary | End-of-run report |

---

## 5. Game Engine vs Rendering

### Game Engine (Logic Only)
- Movement rules
- Combat calculations
- Loot generation
- Inventory validation
- XP calculation
- Extraction logic

### Rendering Layer
- Draw map
- Draw player
- Draw enemies
- Draw UI
- Draw inventory
- Draw HUD

Engine should NOT depend on rendering.

---

## 6. State Management

### Run State
- Player stats
- Inventory
- Current floor
- Generated map
- Enemies
- Loot on ground
- Explored tiles
- Extraction points
- Run timer
- Seed

### UI State
- Inventory open
- Map open
- Pause menu
- Tooltips
- Debug mode

---

## 7. Data Files (JSON)

```
/public/data/
  enemies.json
  items.json
  lootTables.json
  xpTable.json
  floorRules.json
  extractionRules.json
  skills.json
```

Keep balancing data out of code.

---

## 8. Save System

### Persistent Save
- Player level
- Skills
- Crafting unlocks
- Permanent upgrades

### Run Save
- Current floor
- Inventory
- HP/Stamina
- Map state
- Seed
- Enemies alive
- Loot on ground

Use localStorage for MVP.

---

## 9. MVP Content Scope

| Category | Amount |
|---------|--------|
| Floors | 5–10 |
| Enemy Types | 3 |
| Bosses | 1 |
| Weapons | 3 |
| Armor | 3–5 |
| Skills | 3 |
| Extraction Types | 1–2 |
| Crafting Recipes | 3 |

Keep MVP small.

---

## 10. Development Phases

| Phase | Focus |
|------|------|
| 1 | Project setup, types, renderer |
| 2 | Floor generation + movement |
| 3 | Combat + enemies |
| 4 | Loot + inventory |
| 5 | Extraction + run summary |
| 6 | XP + leveling |
| 7 | Save system |
| 8 | MVP polish |

---

## 11. MVP Success Criteria

The MVP is complete when a player can:
1. Start a run
2. Explore procedural floors
3. Fight enemies
4. Collect loot
5. Manage inventory
6. Extract
7. Gain XP
8. Level up
9. Start another run stronger

---

## 12. Architecture Summary

| Layer | Responsibility |
|------|----------------|
| Engine | Game rules |
| Store | Game state |
| Renderer | Visuals |
| UI | Menus/HUD |
| Data | JSON config |
| Save | Persistence |

This structure allows the game to grow without needing a full rewrite.
