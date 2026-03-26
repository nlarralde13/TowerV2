# THE TOWER - Loot & Itemization Design Document (v0.3)

## 1. Loot Philosophy
Loot drives risk and extraction decisions throughout a run.

## 2. Loot in Hybrid Flow
- Loot appears from deterministic enemy/floor rules.
- Loot pickup is proximity-based and free in MVP.
- Loot behavior should remain readable and deterministic.

## 3. Data-Driven Itemization
Item behavior and stack limits are authoritative in `items.json`.
Rarity, value, weight, and tags remain template-driven.

## 4. Sources
- Enemy death drops
- Chests/interactables
- Floor reward placements

## 5. MVP Scope
- Deterministic loot tables
- Ground loot state
- Pickup flow integrated with inventory
- Loot value contributes to run summary / XP systems

## 6. Future Scope
- Optional stamina-costed loot interactions
- Expanded affixes/rarity curves
- Item-specific tactical interactions
