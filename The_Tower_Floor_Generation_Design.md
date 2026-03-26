# THE TOWER - Floor Generation Design Doc (v0.3)

## 1. Purpose
Generate deterministic, readable floors that support tactical tile-based hybrid pacing.

## 2. Core Guarantees
- Entry and stairs path always valid.
- Extraction reachable when present.
- No soft locks.
- Deterministic from seed + floor rule.

## 3. Hybrid Support Requirements
Generated floors must support:
- clear tile walkability for click pathing
- predictable line/adjacency for tick-based enemy AI
- room layouts that remain readable for tactical positioning

## 4. Spawn Tuning Direction
- Spawn counts tied to room density for pacing.
- Early floors remain readable and non-overwhelming.
- Enemy placements must respect occupancy and pathability.

## 5. MVP Scope
- Graph-to-tile generation
- Rule-based room assignment
- Enemy + loot + interactable placement
- Validation pass before floor activation

## 6. Future Scope
- richer room templates
- more trap/terrain interactions
- tactical terrain costs integration
