# THE TOWER - Enemy & AI Design Document (v0.2)

## 1. Enemy Design Philosophy
Enemies are tactical problems solved through positioning, resource budgeting, and turn timing.

## 2. Authoritative Enemy Timing
- Enemies act only during enemy phase.
- Enemies do not react after each individual player action.
- Enemy behavior is resolved in deterministic order per phase.

## 3. MVP Enemy Phase Behavior
For each living enemy in enemy phase:
1. Evaluate aggro/target.
2. If in attack range, attack.
3. Else move according to behavior.
4. End actor action for this phase.

## 4. Aggro / Chase Model (Current)
- `chaser` role can acquire aggro by range and pursue.
- Non-chasers stay tethered unless in explicit aggro/attacking state.
- AI respects walkability, bounds, occupancy, and range checks.

## 5. Data-Driven Enemy Stats
Current template stats include:
- hp
- damage
- speed
- attackSpeed
- attackRange
- aggroRange
- poise

## 6. Future-Ready Direction
Current MVP keeps one enemy action budget per phase, with architecture prepared for:
- per-enemy speed/action budget
- initiative order
- ranged behaviors
- status effects and terrain penalties

## 7. MVP Roster
Use small roster and controlled spawn density for readability.
