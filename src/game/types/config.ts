import type { ID, RangeBand, SkillKind, SkillTree } from "./common";

export interface ExtractionRule {
  id: ID;
  name: string;
  floors: RangeBand;
  requirements: {
    itemsAny: ID[];
    itemsAll: ID[];
    minLevel: number;
  };
  results: {
    success: "extract";
    consumeItems: ID[];
  };
  ui: {
    label: string;
  };
}

export interface SkillEffect {
  type: "damage" | "heal" | "stun" | "dash" | "buff";
  value?: number;
  duration?: number;
}

export interface SkillTemplate {
  id: ID;
  name: string;
  tree: SkillTree;
  kind: SkillKind;
  unlockLevel: number;
  cost: {
    stamina: number;
    mana: number;
  };
  cooldown?: number;
  effects: SkillEffect[];
  targeting?: {
    shape: "self" | "line" | "cone" | "area";
    range: number;
  };
}
