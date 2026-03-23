import type { SeedString } from "../types";

export interface SeededRng {
  seed: SeedString;
  next: () => number;
  nextInt: (min: number, max: number) => number;
  chance: (probability: number) => boolean;
  pick: <T>(items: readonly T[]) => T;
  weightedPick: <T extends { weight: number }>(items: readonly T[]) => T;
}

function hashSeed(seed: SeedString): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seedNumber: number): () => number {
  let state = seedNumber >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assertRange(min: number, max: number): void {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error(`Invalid integer range: min=${min}, max=${max}`);
  }
}

export function createSeededRng(seed: SeedString): SeededRng {
  const generator = mulberry32(hashSeed(seed));

  const api: SeededRng = {
    seed,
    next: () => generator(),
    nextInt: (min, max) => {
      assertRange(min, max);
      const value = generator();
      return Math.floor(value * (max - min + 1)) + min;
    },
    chance: (probability) => {
      if (probability < 0 || probability > 1) {
        throw new Error(`Probability must be between 0 and 1, got ${probability}`);
      }
      return generator() < probability;
    },
    pick: (items) => {
      if (items.length === 0) {
        throw new Error("Cannot pick from an empty array");
      }
      return items[api.nextInt(0, items.length - 1)];
    },
    weightedPick: (items) => {
      if (items.length === 0) {
        throw new Error("Cannot pick from an empty weighted array");
      }
      const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
      if (totalWeight <= 0) {
        throw new Error("Weighted pick requires a positive total weight");
      }
      let roll = generator() * totalWeight;
      for (const item of items) {
        roll -= item.weight;
        if (roll <= 0) {
          return item;
        }
      }
      return items[items.length - 1];
    },
  };

  return api;
}
