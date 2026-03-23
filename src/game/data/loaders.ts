import type {
  EnemyTemplate,
  ExtractionRule,
  FloorRule,
  ItemTemplate,
  LootTable,
  PlayerDefaults,
  RoomTemplate,
  SkillTemplate,
  XpTable,
} from "../types";
import {
  type GameDataTemplates,
  validateCrossReferences,
  validateEnemiesJson,
  validateExtractionRulesJson,
  validateFloorRulesJson,
  validateItemsJson,
  validateLootTablesJson,
  validatePlayerDefaultsJson,
  validateRoomsJson,
  validateSkillsJson,
  validateXpTableJson,
} from "./validators";

export type JsonFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const DATA_ROOT = "/data";

async function loadJson(path: string, fetcher: JsonFetcher): Promise<unknown> {
  const response = await fetcher(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function resolveDataPath(fileName: string): string {
  return `${DATA_ROOT}/${fileName}`;
}

export async function loadEnemies(fetcher: JsonFetcher = fetch): Promise<EnemyTemplate[]> {
  const json = await loadJson(resolveDataPath("enemies.json"), fetcher);
  return validateEnemiesJson(json);
}

export async function loadItems(fetcher: JsonFetcher = fetch): Promise<ItemTemplate[]> {
  const json = await loadJson(resolveDataPath("items.json"), fetcher);
  return validateItemsJson(json);
}

export async function loadLootTables(fetcher: JsonFetcher = fetch): Promise<LootTable[]> {
  const json = await loadJson(resolveDataPath("lootTables.json"), fetcher);
  return validateLootTablesJson(json);
}

export async function loadFloorRules(fetcher: JsonFetcher = fetch): Promise<FloorRule[]> {
  const json = await loadJson(resolveDataPath("floorRules.json"), fetcher);
  return validateFloorRulesJson(json);
}

export async function loadXpTable(fetcher: JsonFetcher = fetch): Promise<XpTable> {
  const json = await loadJson(resolveDataPath("xpTable.json"), fetcher);
  return validateXpTableJson(json);
}

export async function loadExtractionRules(fetcher: JsonFetcher = fetch): Promise<ExtractionRule[]> {
  const json = await loadJson(resolveDataPath("extractionRules.json"), fetcher);
  return validateExtractionRulesJson(json);
}

export async function loadSkills(fetcher: JsonFetcher = fetch): Promise<SkillTemplate[]> {
  const json = await loadJson(resolveDataPath("skills.json"), fetcher);
  return validateSkillsJson(json);
}

export async function loadPlayerDefaults(fetcher: JsonFetcher = fetch): Promise<PlayerDefaults> {
  const json = await loadJson(resolveDataPath("playerDefaults.json"), fetcher);
  return validatePlayerDefaultsJson(json);
}

export async function loadRooms(fetcher: JsonFetcher = fetch): Promise<RoomTemplate[]> {
  const json = await loadJson(resolveDataPath("rooms.json"), fetcher);
  return validateRoomsJson(json);
}

export interface LoadGameDataOptions {
  fetcher?: JsonFetcher;
  includeOptionalRooms?: boolean;
}

export async function loadGameData(options: LoadGameDataOptions = {}): Promise<GameDataTemplates> {
  const fetcher = options.fetcher ?? fetch;

  const [enemies, items, lootTables, floorRules, xpTable, extractionRules, skills, playerDefaults] =
    await Promise.all([
      loadEnemies(fetcher),
      loadItems(fetcher),
      loadLootTables(fetcher),
      loadFloorRules(fetcher),
      loadXpTable(fetcher),
      loadExtractionRules(fetcher),
      loadSkills(fetcher),
      loadPlayerDefaults(fetcher),
    ]);

  let rooms: RoomTemplate[] | undefined;
  if (options.includeOptionalRooms) {
    rooms = await loadRooms(fetcher);
  }

  return validateCrossReferences({
    enemies,
    items,
    lootTables,
    floorRules,
    xpTable,
    extractionRules,
    skills,
    playerDefaults,
    rooms,
  });
}
