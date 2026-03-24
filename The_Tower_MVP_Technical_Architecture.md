
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

---

## 13. Movement Architecture Evolution (Grid-Backed World, Continuous Controller)

### 13.1 Movement Model Shift
The movement model is evolving from rigid tile stepping to a smoother controller feel while preserving the grid as the world foundation.

Key distinction:
- **Tile-based world representation**: The world is authored and stored as grid tiles (layout, room metadata, interactables, spawn zones, fog metadata, pathing reference).
- **Tile-based logic**: Some gameplay rules can remain tile-aware (pathfinding, room ownership, broad collision partitioning, procedural generation).
- **Visual/player movement feel**: Player motion can be continuous/sub-tile and still run on top of a tile-backed simulation model.

These three concerns do not need to be identical. The grid remains authoritative for world structure, while the controller layer evolves for better action feel.

### 13.2 Target Architecture
- **Grid-backed world** remains source of truth for environment and authored gameplay metadata.
- **Continuous player controller** uses sub-tile/continuous position and velocity-style movement updates.
- **Optional future continuous enemy controller** can be introduced per enemy archetype as needed.
- **Tile-driven collision metadata with sub-tile checks**:
  - Collision data remains tile-authored.
  - Runtime movement performs sub-tile collision sampling against nearby tile metadata.
- **Radius/proximity-based interactions** replace strict same-tile requirements for pickups, triggers, and interactables where appropriate.
- **Fog-of-war reveal by player radius** becomes position/radius-driven from continuous coordinates (instead of only current tile identity).

### 13.3 Phased Implementation Plan

#### Phase 1: Feel Upgrade Without Core Rewrite
- Keep existing logical tile occupancy model where needed.
- Add smooth interpolation between tile positions for player presentation.
- Preserve current movement rules and collision outcomes.
- Objective: improve responsiveness and motion feel with minimal systemic change.

#### Phase 2: Continuous Player Coordinates
- Change player position from integer tile coordinates to sub-tile/continuous coordinates.
- Keep tiles as the environmental data model and authoring backbone.
- Update movement and collision to sample surrounding tiles from continuous position.
- Update fog reveal to use player radius from continuous position.
- Support smoother directional input and movement vectors.

#### Phase 3: Continuous Combat/AI Interaction Layer
- Add continuous enemy movement where it materially improves gameplay.
- Migrate interaction checks to proximity/radius triggers.
- Improve action combat support:
  - chase behavior
  - dodge space
  - attack range handling
  - smoother local navigation around obstacles

---

## 14. Systems Impact

### 14.1 Player State / Coordinate System
- Introduce continuous position (float world coordinates) for player controller.
- Keep tile coordinate derivation as a helper for systems that still need tile indexing.
- Store both:
  - authoritative continuous position
  - derived/queried tile coordinate as needed

### 14.2 Collision Detection
- Replace single-step tile gating with sub-step movement checks against tile collision metadata.
- Use local neighborhood sampling (current tile and adjacent tiles) for collision resolution.
- Preserve deterministic movement by fixed update order and stable collision rules.

### 14.3 Fog of War
- Reveal tiles by radius around continuous player position.
- Tile reveal remains persisted as tile metadata (`visible` / `explored`), preserving existing map-state model.

### 14.4 Interactions and Triggers
- Shift from exact tile overlap toward proximity thresholds for:
  - loot pickup
  - extraction trigger
  - interactable activation
- Keep trigger ownership attached to tile metadata for authoring simplicity.

### 14.5 Enemy AI and Pathing
- Keep high-level pathfinding grid-based initially.
- Convert path outputs (tile paths) into continuous steering/intent at runtime as needed.
- Allow mixed-mode enemies during migration (tile-stepped + continuous) behind feature flags or per-template config.

### 14.6 Combat / Range Handling
- Move attack validation toward distance/arc/range checks from continuous positions.
- Preserve deterministic hit resolution by stable update ticks and explicit ordering.
- Keep current discrete combat rules during early migration where risk is high.

### 14.7 Rendering and Animation Alignment
- Renderer consumes continuous transform for player (and later enemies).
- Grid still drives floor drawing, fog cells, and authored interaction overlays.
- Keep visual-to-collision alignment explicit to avoid art/collision drift.

### 14.8 Save/Load Implications
- Save format must include continuous coordinates and movement state required for deterministic restore.
- Include migration handling from older tile-only saves.
- Persist fog/interactable state in tile terms, preserving compatibility with existing world metadata.

---

## 15. What Stays the Same
- Procedural generation remains tile-based.
- Rooms and floor layout remain tile-based.
- World metadata remains tile-based.
- High-level pathfinding can remain grid-based.
- Existing engine investment is preserved as much as possible.

---

## 16. Design Recommendations
- Do **not** replace the engine wholesale.
- Evolve the controller layer first and keep systems modular.
- Preserve the grid as simulation and authoring structure.
- Target **free-form movement feel** before attempting fully physics-driven movement.
- Use phased rollout and mixed-mode support to reduce migration risk.

---

## 17. Risks and Tradeoffs
- Collision complexity increases with continuous movement and sub-step checks.
- Trigger detection must be redefined (tile overlap to proximity/radius semantics).
- Movement feel requires tuning effort (acceleration, deceleration, turn response).
- Art tile alignment and collision boundaries can diverge if not consistently authored and sampled.
- AI and combat timing become more complex with mixed discrete/continuous actors.

---

## 18. Recommended Final Direction
The game should keep the grid as the world model, while movement evolves toward a continuous controller to achieve a smoother ARPG-style feel without discarding the current engine foundation.
