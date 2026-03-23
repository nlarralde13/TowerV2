import type { EnemyRole, EnemyTier, ID, Vec2 } from "./common";

export interface EnemyTemplate {
  id: ID;
  name: string;
  role: EnemyRole;
  tier: EnemyTier;
  floorMin: number;
  floorMax: number;
  stats: {
    hp: number;
    damage: number;
    speed: number;
    attackSpeed: number;
    attackRange: number;
    aggroRange: number;
    poise: number;
  };
  behavior: {
    aiType: string;
    canRetreat: boolean;
    canStrafe: boolean;
  };
  drops: {
    lootTableId: ID;
  };
  xp: {
    kill: number;
  };
  render: {
    sprite: string;
    scale: number;
  };
}

export interface EnemyInstance {
  instanceId: ID;
  enemyId: ID;
  floor: number;
  position: Vec2;
  spawnAnchor: Vec2;
  hpCurrent: number;
  state: "idle" | "patrol" | "aggro" | "attacking" | "dead";
  aggroTargetId?: ID | null;
  modifiers?: string[];
  lootResolved: boolean;
}
