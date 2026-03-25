# THE TOWER - Loot & Itemization Design Document (v0.2)

## 1. Loot Philosophy
Loot drives risk and extraction decisions across rounds.

## 2. Loot in Turn-Based Flow
- Loot appears from deterministic enemy/floor rules.
- Loot pickup is a player-phase interaction with action cost.
- Loot does not bypass turn economy.

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
- Pickup flow integrated with inventory and action budget
- Loot value contributes to run summary / XP systems

## 6. Future Scope
- Expanded affixes/rarity curves
- Item-specific tactical interactions
