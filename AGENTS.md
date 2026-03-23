# THE TOWER — Codex Instructions

This repository contains the game design and MVP implementation for a game called "The Tower".

## Source of Truth Documents (Root Folder)
The following design documents define the system behavior and data structures.
Codex must follow these documents when generating code:

- The_Tower_Combat_Design_Doc.md
- The_Tower_Enemy_Design_Doc.md
- The_Tower_Loot_Design_Doc.md
- The_Tower_Extraction_Design_Doc.md
- The_Tower_Leveling_XP_Design_Doc.md
- The_Tower_Inventory_Design.md
- The_Tower_MVP_Technical_Architecture.md
- The_Tower_Data_Schema_JSON_Structure_Design_Doc.md
- The_Tower_TypeScript_Interfaces_Design_Doc.md

If there is a conflict between code and these documents, the documents are correct.

## Architecture Rules
- Game engine logic must be separate from rendering.
- Rendering uses HTML5 Canvas.
- UI uses React.
- State management uses Zustand.
- Game data is loaded from JSON in /public/data.
- Do not hardcode balancing values in code.
- Use TypeScript interfaces defined in the TypeScript Interfaces Design Doc.
- Systems must be modular and separated into:
  - engine
  - systems
  - world
  - entities
  - render
  - store

## MVP Scope
The MVP includes only:
- Movement
- Floor generation
- Combat
- Enemies
- Loot
- Inventory
- Extraction
- XP and leveling
- Run summary
- Save/load

Do NOT implement:
- Multiplayer
- Online accounts
- Full crafting system
- Town simulation
- Advanced skill trees
- Cutscenes
- Large content sets

## Development Order
Systems must be implemented in this order:
1. Types and data loaders
2. Seeded RNG
3. Floor generation
4. Movement
5. Fog of war
6. Enemy spawning
7. Combat
8. Loot
9. Inventory
10. Extraction
11. XP and leveling
12. Run summary
13. Save/load

## Code Style
- Small modules
- Clear TypeScript types
- No large monolithic files
- Prefer pure functions in engine systems
- Avoid circular dependencies

## When generating code
Codex should:
1. Create types first
2. Then data loaders
3. Then engine systems
4. Then store
5. Then rendering
6. Then UI