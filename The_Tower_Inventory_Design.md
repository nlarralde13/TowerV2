# THE TOWER - Inventory System Design Doc (v0.3)

## 1. Purpose
Inventory is a tactical resource system that drives risk decisions during hybrid tick-paced runs.

## 2. Core Inventory Systems
- Weight-based inventory (no slot-count cap)
- Equipment slots
- Belt trinket slots (fixed 3)
- Carry weight penalties
- Stack sizes from item templates

## 3. Belt Rule (Authoritative)
- Belt is a trinket/perk customization row.
- Belt is not a consumable quickbar.
- Consumables are used from inventory lists/loadout flows.

## 4. Economy Integration
- No action points or bonus actions.
- Inventory interactions are free in MVP unless explicitly stamina-costed later.
- Current default:
  - Loot pickup: free
  - Consume item: free
  - Equip/unequip: free

## 5. Carry Weight
Carry weight modifies movement effectiveness and creates extraction pressure.

## 6. MVP Scope
- Weight-based inventory list
- Equipment management
- 3-slot trinket belt
- Item use/drop/pickup flows
- Tooltip-driven item details

## 7. Future Scope
- Optional stamina costs for selected inventory interactions
- Auto-sort/filter tools
- Backpack upgrades and advanced management UX
