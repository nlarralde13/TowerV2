import { DataValidationError } from "./errors";

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function expectRecord(value: unknown, path: string): UnknownRecord {
  if (!isRecord(value)) {
    throw new DataValidationError(`Expected object at ${path}`);
  }
  return value;
}

export function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new DataValidationError(`Expected array at ${path}`);
  }
  return value;
}

export function expectString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new DataValidationError(`Expected non-empty string at ${path}`);
  }
  return value;
}

export function expectNumber(
  value: unknown,
  path: string,
  options: { integer?: boolean; min?: number; max?: number } = {},
): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new DataValidationError(`Expected number at ${path}`);
  }
  if (options.integer && !Number.isInteger(value)) {
    throw new DataValidationError(`Expected integer at ${path}`);
  }
  if (typeof options.min === "number" && value < options.min) {
    throw new DataValidationError(`Expected ${path} >= ${options.min}`);
  }
  if (typeof options.max === "number" && value > options.max) {
    throw new DataValidationError(`Expected ${path} <= ${options.max}`);
  }
  return value;
}

export function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new DataValidationError(`Expected boolean at ${path}`);
  }
  return value;
}

export function expectOptionalString(value: unknown, path: string): string | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }
  return expectString(value, path);
}

export function expectStringArray(value: unknown, path: string): string[] {
  const arr = expectArray(value, path);
  return arr.map((entry, index) => expectString(entry, `${path}[${index}]`));
}

export function assertUniqueIds(items: Array<{ id: string }>, path: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new DataValidationError(`Duplicate id "${item.id}" in ${path}`);
    }
    seen.add(item.id);
  }
}

export function assertReferenceExists(
  collection: Set<string>,
  id: string,
  path: string,
  targetName: string,
): void {
  if (!collection.has(id)) {
    throw new DataValidationError(`${path} references missing ${targetName} "${id}"`);
  }
}
