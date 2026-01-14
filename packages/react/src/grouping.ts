/**
 * Utility functions for grouping properties based on their keywordLocation.
 * Used to organize properties from allOf/anyOf/oneOf in multi-column layouts.
 */

/**
 * Information about which composition block a property belongs to.
 */
export interface PropertyGroup {
  /** The composition keyword (allOf, anyOf, oneOf, etc.) */
  keyword: "allOf" | "anyOf" | "oneOf" | "dependentSchemas" | "root";
  /** Index within the composition array (for allOf/anyOf/oneOf) */
  index?: number;
  /** Key name (for dependentSchemas) */
  key?: string;
}

/**
 * Parse a keywordLocation to extract the composition group info.
 *
 * Examples:
 * - "#/properties/name" → { keyword: "root" }
 * - "#/allOf/0/properties/model" → { keyword: "allOf", index: 0 }
 * - "#/allOf/1/then/properties/dataset" → { keyword: "allOf", index: 1 }
 * - "#/anyOf/2/properties/foo" → { keyword: "anyOf", index: 2 }
 * - "#/dependentSchemas/type/properties/bar" → { keyword: "dependentSchemas", key: "type" }
 *
 * @param keywordLocation - The keywordLocation string from FieldNode
 * @returns PropertyGroup indicating which composition block the property belongs to
 */
export function parsePropertyGroup(keywordLocation: string): PropertyGroup {
  // Match allOf/anyOf/oneOf patterns: #/allOf/0/...
  const compositionMatch = keywordLocation.match(
    /^#\/(allOf|anyOf|oneOf)\/(\d+)/,
  );
  if (compositionMatch) {
    return {
      keyword: compositionMatch[1] as "allOf" | "anyOf" | "oneOf",
      index: parseInt(compositionMatch[2], 10),
    };
  }

  // Match dependentSchemas pattern: #/dependentSchemas/keyName/...
  const dependentMatch = keywordLocation.match(/^#\/dependentSchemas\/([^/]+)/);
  if (dependentMatch) {
    return {
      keyword: "dependentSchemas",
      key: dependentMatch[1],
    };
  }

  // Default to root group
  return { keyword: "root" };
}

/**
 * Generate a stable string key for a PropertyGroup.
 * Used as a Map key for grouping properties.
 *
 * @param group - The PropertyGroup to convert to a key
 * @returns A string key that uniquely identifies the group
 */
export function getGroupKey(group: PropertyGroup): string {
  if (group.keyword === "root") {
    return "root";
  }
  if (group.keyword === "dependentSchemas" && group.key !== undefined) {
    return `dependentSchemas/${group.key}`;
  }
  if (group.index !== undefined) {
    return `${group.keyword}/${group.index}`;
  }
  return group.keyword;
}

/**
 * Group items by their keywordLocation.
 * Items from the same composition block (e.g., allOf/0) are grouped together.
 *
 * @param items - Array of items with keywordLocation property
 * @returns Map from group key to array of items in that group
 */
export interface Group<T> {
  key: string;
  detail: PropertyGroup;
  items: T[];
}

/**
 * Group items by their originKeywordLocation (or keywordLocation as fallback).
 * Items from the same composition block (e.g., allOf/0) are grouped together.
 * Uses originKeywordLocation when available to get the true source of schema properties
 * from composition keywords like allOf, anyOf, oneOf, if/then/else.
 *
 * @param items - Array of items with keywordLocation and optional originKeywordLocation
 * @returns Array of groups, where each group contains the key, detail, and items
 */
export function groupByKeywordLocation<
  T extends { keywordLocation: string; originKeywordLocation?: string },
>(items: T[]): Group<T>[] {
  const groups = new Map<string, { detail: PropertyGroup; items: T[] }>();

  for (const item of items) {
    // Prefer originKeywordLocation which tracks the true source from composition keywords
    const location = item.originKeywordLocation ?? item.keywordLocation;
    const detail = parsePropertyGroup(location);
    const key = getGroupKey(detail);

    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(key, { detail, items: [item] });
    }
  }

  return Array.from(groups.entries()).map(([key, value]) => ({
    key,
    detail: value.detail,
    items: value.items,
  }));
}
