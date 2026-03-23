import type { ID } from "./common";

export interface CombatEvent {
  id: ID;
  type:
    | "attack_started"
    | "attack_hit"
    | "attack_missed"
    | "damage_taken"
    | "enemy_killed"
    | "player_died"
    | "skill_used";
  sourceId: ID;
  targetId?: ID;
  value?: number;
  timestamp: number;
}

export interface LootEvent {
  id: ID;
  type: "loot_dropped" | "loot_picked_up" | "loot_destroyed";
  itemInstanceId: ID;
  actorId?: ID;
  timestamp: number;
}
