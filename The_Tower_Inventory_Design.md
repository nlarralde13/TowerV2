# THE TOWER - Inventory System Design Doc (v0.2)

## 1. Purpose
Inventory is a tactical resource system that drives risk decisions during turn-based runs.

## 2. Core Inventory Systems
- Backpack grid
- Equipment slots
- Belt trinket slots (fixed 3)
- Carry weight penalties
- Stack sizes from item templates

## 3. Belt Rule (Authoritative)
- Belt is a trinket/perk customization row.
- Belt is not a consumable quickbar.
- Consumables are used from inventory.

## 4. Turn Economy Integration
- Consume item: action cost.
- Loot pickup: action cost.
- Equip/unequip: free action for MVP, but still player-phase only.

## 5. Carry Weight
Carry weight modifies movement effectiveness and creates extraction pressure.

## 6. MVP Scope
- Grid inventory
- Equipment management
- 3-slot trinket belt
- Item use/drop/pickup flows
- Weight-aware stats

## 7. Future Scope
- Backpack upgrades
- Auto-sort and rotation
- Additional item interaction costs if needed
