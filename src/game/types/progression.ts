export interface XpLevelThreshold {
  level: number;
  xpToNext: number;
}

export interface XpRunSources {
  lootValueMultiplier: number;
  floorReachedFlat: number;
  bossKillFlat: number;
  roomDiscoveredFlat: number;
  puzzleSolvedFlat: number;
  enemyKillFlat: number;
  extractMultiplier: number;
  deathMultiplier: number;
}

export interface XpTable {
  maxLevel: number;
  levels: XpLevelThreshold[];
  runSources: XpRunSources;
}
