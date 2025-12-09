/**
 * JSON Schema draft version definitions and detection utilities.
 */
/**
 * Supported JSON Schema draft versions.
 */
export type SchemaDraft =
  | "draft-04"
  | "draft-07"
  | "draft-2019-09"
  | "draft-2020-12";

/**
 * Standard $schema URI patterns for each draft version.
 */
export const DRAFT_URIS: Record<SchemaDraft, string[]> = {
  "draft-04": [
    "http://json-schema.org/draft-04/schema#",
    "http://json-schema.org/draft-04/schema",
  ],
  "draft-07": [
    "http://json-schema.org/draft-07/schema#",
    "http://json-schema.org/draft-07/schema",
  ],
  "draft-2019-09": [
    "https://json-schema.org/draft/2019-09/schema",
    "https://json-schema.org/draft/2019-09/schema#",
  ],
  "draft-2020-12": [
    "https://json-schema.org/draft/2020-12/schema",
    "https://json-schema.org/draft/2020-12/schema#",
  ],
};

/**
 * Detect the JSON Schema draft version from a schema.
 * Detection is based on:
 * 1. The $schema URI if present
 * 2. Heuristics based on keywords used
 *
 * @param schema - The schema to detect the version of (can be object, boolean, or unknown)
 * @returns The detected draft version, defaults to "draft-2020-12" if unknown
 */
export function detectSchemaDraft(schema: unknown): SchemaDraft {
  // If not an object, default to latest
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return "draft-2020-12";
  }

  const s = schema as Record<string, unknown>;

  // Check $schema URI first
  if (s.$schema && typeof s.$schema === "string") {
    for (const [draft, uris] of Object.entries(DRAFT_URIS)) {
      if (uris.some((uri) => s.$schema === uri)) {
        return draft as SchemaDraft;
      }
    }
  }

  // Heuristic detection based on keywords

  // draft-2020-12: uses prefixItems
  if ("prefixItems" in s) {
    return "draft-2020-12";
  }

  // draft-2019-09: uses $recursiveRef/$recursiveAnchor or unevaluatedProperties/unevaluatedItems
  if (
    "$recursiveRef" in s ||
    "$recursiveAnchor" in s ||
    "unevaluatedProperties" in s ||
    "unevaluatedItems" in s
  ) {
    return "draft-2019-09";
  }

  // draft-04: uses "id" instead of "$id", or boolean exclusiveMaximum/exclusiveMinimum
  if ("id" in s && !("$id" in s)) {
    return "draft-04";
  }

  // draft-04: boolean exclusiveMaximum/exclusiveMinimum
  if (
    typeof s.exclusiveMaximum === "boolean" ||
    typeof s.exclusiveMinimum === "boolean"
  ) {
    return "draft-04";
  }

  // draft-04/07: uses dependencies keyword
  if ("dependencies" in s) {
    // Could be draft-04 or draft-07, check for other clues
    if ("$id" in s) {
      return "draft-07";
    }
    return "draft-04";
  }

  // draft-04/07: uses additionalItems
  if ("additionalItems" in s) {
    if ("$id" in s) {
      return "draft-07";
    }
    return "draft-04";
  }

  // Default to latest if no distinguishing features found
  return "draft-2020-12";
}
