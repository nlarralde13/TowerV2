
# THE TOWER — Floor Generation Design Doc (v0.1)

## 1. Purpose
The floor generator creates replayable, deterministic tower floors that support:
- exploration
- combat pacing
- loot rhythm
- extraction tension
- predictable difficulty scaling

This system must produce floors that feel authored, not chaotic.

---

## 2. Final Design Decisions

| Decision | Locked Choice |
|---|---|
| Generator model | Hybrid graph-to-tilemap |
| Early floor room count | 6–10 rooms |
| Stairs | Present on every floor |
| Extraction | Present only on some floors |
| Boss floors | Special-case generation for MVP |
| Loops | Minimal for MVP |
| Early traps | No |
| Map size | Fixed for MVP; content density scales |

---

## 3. Generator Philosophy

The generator should:
1. Build a high-level room graph
2. Assign room purpose based on path position
3. Convert the graph into a tilemap layout
4. Populate the floor with enemies, loot, and interactables
5. Validate the result before use

---

## 4. MVP Floor Model

Each floor is built in two layers:

### Layer 1 — Abstract Room Graph
Defines:
- Entry room
- Critical path
- Side branches
- Loot branches
- Optional extraction branch
- Stairs location

### Layer 2 — Physical Tilemap
Defines:
- Room shapes
- Corridors
- Doors
- Walls
- Walkable tiles
- Blocked tiles

---

## 5. Fixed Map Size for MVP

Recommended MVP map size:
- 24 × 24 tiles OR
- 32 × 32 tiles

Difficulty should scale by:
- Room count
- Enemy density
- Branch count
- Elite chance
- Loot quality
- Extraction rarity

---

## 6. Floor Bands

| Floor Band | Purpose |
|---|---|
| 1–3 | Onboarding |
| 4–6 | Pressure begins |
| 7–10 | Denser combat |
| 11–15 | More elites |
| 16–20 | High risk |
| Boss floors | Special generation |

---

## 7. Core Floor Guarantees

Every generated floor must guarantee:
- One entry room
- One stairs room
- Path from entry to stairs
- Extraction reachable if present
- No soft locks
- Safe spawn area
- Deterministic output from seed

---

## 8. Generation Pipeline

### Phase 1 — Select Floor Rule Set
Input:
- Run seed
- Floor number

Controls:
- Room count
- Enemy density
- Loot density
- Elite chance
- Extraction chance

### Phase 2 — Generate Abstract Graph
Early floors:
- 6–10 total rooms
- 4–6 critical path rooms
- 1–3 side branches

### Phase 3 — Assign Room Roles
Room types:
- Entry
- Combat
- Loot
- Puzzle
- Special
- Extraction
- Stairs
- Boss
- Empty

### Phase 4 — Layout Placement
Place rooms into grid while:
- Avoiding overlap
- Preserving connectivity
- Keeping layout readable

### Phase 5 — Tilemap Conversion
Convert rooms and corridors into tiles.

### Phase 6 — Populate Floor
Add:
- Enemies
- Loot
- Interactables
- Doors
- Props

Current MVP spawn tuning (implemented):
- Spawn count per floor is intentionally low and tied to room count, not tile count.
- Spawn range is derived from room count:
  - minimum spawns = `max(2, floor(roomCountMin * 0.5))`
  - maximum spawns = `max(minimum spawns, roomCountMin)`
- This keeps early floors readable and prevents immediate overwhelm.

### Phase 7 — Validation Pass
Ensure:
- Floor is completable
- Extraction reachable if present
- No blocked paths
- Spawn area safe

---

## 9. Room Templates

| Template | Use |
|---|---|
| Small square | Entry, loot |
| Medium square | Combat |
| Horizontal rectangle | Corridors/combat |
| Vertical rectangle | Corridors |
| Large chamber | Combat/special |
| Boss arena | Boss floors |

---

## 10. Corridor Rules

Corridors should be:
- Short
- Readable
- Minimal loops
- Wide enough for combat

---

## 11. Stairs Rules

- Present every floor
- Located at end of critical path
- Never in entry room

---

## 12. Extraction Rules

Extraction:
- Not guaranteed every floor
- Usually on side branch
- Often at risky dead end
- Must be reachable

---

## 13. Boss Floor Rules

Boss floors are special-case generated:
- Boss arena
- Pre-boss setup room
- Reward room
- Exit or stairs

---

## 14. Trap Rules

For MVP:
- Floors 1–3: No traps
- Later floors: Minimal traps

---

## 15. Summary

The generator should create floors that feel:
- Designed
- Fair
- Replayable
- Deterministic
- Increasingly dangerous
