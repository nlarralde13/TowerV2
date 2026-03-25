# THE TOWER - Leveling & XP System Design Document (v0.2)

## 1. Purpose
Leveling provides persistent progression across tactical extraction runs.

## 2. XP Sources
Primary:
- Extracted loot value
- Floors reached
- Bosses killed
Secondary:
- Rooms discovered
- Puzzles solved
- Enemies killed

## 3. Turn-Based Compatibility
XP sources are event/state driven and independent of real-time combat pacing.
Round-based progression must not change XP formula semantics.

## 4. Run Outcome Multipliers
- Successful extraction applies extraction multiplier.
- Death applies reduced XP multiplier.

## 5. MVP Scope
- XP table from JSON
- Run summary aggregation
- Profile level/xp persistence

## 6. Future Scope
- Additional bonus sources tied to tactical objectives
- More nuanced run-performance multipliers
