import type { Schema } from "./type";
import { resolveAbsolutePath } from "./util";

/**
 * Collect all dependencies for a node's schema.
 *
 * Key insight: We extract paths from condition keywords (if, oneOf, anyOf)
 * using extractReferencedPaths, but for then/else/allOf keywords, we recursively
 * call collectDependencies to ensure proper dependency isolation between
 * parent and child nodes.
 */
export function collectDependencies(
  schema: Schema,
  instanceLocation: string,
): Set<string> {
  const deps = new Set<string>();

  // Handle required
  if (schema.required) {
    for (const req of schema.required) {
      deps.add(resolveAbsolutePath(instanceLocation, `/${req}`));
    }
  }

  // Handle dependentRequired
  if (schema.dependentRequired) {
    for (const [prop, reqs] of Object.entries(schema.dependentRequired)) {
      deps.add(resolveAbsolutePath(instanceLocation, `/${prop}`));
      for (const req of reqs) {
        deps.add(resolveAbsolutePath(instanceLocation, `/${req}`));
      }
    }
  }

  // Handle dependentSchemas
  if (schema.dependentSchemas) {
    for (const [prop, subSchema] of Object.entries(schema.dependentSchemas)) {
      deps.add(resolveAbsolutePath(instanceLocation, `/${prop}`));
      const subDeps = collectDependencies(subSchema, instanceLocation);
      subDeps.forEach((d) => deps.add(d));
    }
  }

  // Handle if-then-else
  if (schema.if) {
    // Extract paths from the if condition
    const relativePaths = extractReferencedPaths(schema.if, "");
    for (const relPath of relativePaths) {
      deps.add(resolveAbsolutePath(instanceLocation, relPath));
    }

    // Recursively extract from then/else which may have nested conditions
    if (schema.then) {
      const thenDeps = collectDependencies(schema.then, instanceLocation);
      thenDeps.forEach((d) => deps.add(d));
    }
    if (schema.else) {
      const elseDeps = collectDependencies(schema.else, instanceLocation);
      elseDeps.forEach((d) => deps.add(d));
    }
  }

  // Handle oneOf - each option may check different conditions
  // We need both direct paths (from condition checks) and nested dependencies
  if (schema.oneOf) {
    for (const subSchema of schema.oneOf) {
      // Extract direct referenced paths from the condition
      const relativePaths = extractReferencedPaths(subSchema, "");
      for (const relPath of relativePaths) {
        deps.add(resolveAbsolutePath(instanceLocation, relPath));
      }
      // Also recursively collect dependencies from nested conditions
      const subDeps = collectDependencies(subSchema, instanceLocation);
      subDeps.forEach((d) => deps.add(d));
    }
  }

  // Handle anyOf - same treatment as oneOf
  if (schema.anyOf) {
    for (const subSchema of schema.anyOf) {
      const relativePaths = extractReferencedPaths(subSchema, "");
      for (const relPath of relativePaths) {
        deps.add(resolveAbsolutePath(instanceLocation, relPath));
      }
      const subDeps = collectDependencies(subSchema, instanceLocation);
      subDeps.forEach((d) => deps.add(d));
    }
  }

  // Handle allOf (may contain conditions)
  if (schema.allOf) {
    for (const subSchema of schema.allOf) {
      const subDeps = collectDependencies(subSchema, instanceLocation);
      subDeps.forEach((d) => deps.add(d));
    }
  }

  return deps;
}

/**
 * Maximum recursion depth for extractReferencedPaths to prevent stack overflow
 */
const MAX_EXTRACT_DEPTH = 100;

/**
 * Extract referenced paths from a conditional schema (if, oneOf, anyOf, etc.)
 * Returns paths relative to the current node
 *
 * @param conditionSchema - The schema to extract paths from
 * @param basePath - Base path for relative paths
 * @param depth - Current recursion depth (internal use)
 */
export function extractReferencedPaths(
  conditionSchema: Schema,
  basePath: string = "",
  depth: number = 0,
): string[] {
  // Prevent stack overflow on deeply nested schemas
  if (depth > MAX_EXTRACT_DEPTH) {
    console.warn(
      `extractReferencedPaths: max depth (${MAX_EXTRACT_DEPTH}) exceeded at path: ${basePath}`,
    );
    return [];
  }

  const paths: string[] = [];

  // Schema is expected to be pre-dereferenced
  const schema = conditionSchema;

  // properties - checking child properties
  if (schema.properties) {
    for (const key of Object.keys(schema.properties)) {
      const childPath = basePath ? `${basePath}/${key}` : `/${key}`;
      paths.push(childPath);
      // Recursively extract paths from nested conditions
      paths.push(
        ...extractReferencedPaths(schema.properties[key], childPath, depth + 1),
      );
    }
  }

  // items - checking array elements
  if (schema.items && typeof schema.items === "object") {
    // items condition means dependency on the array itself
    paths.push(basePath || "/");
    paths.push(...extractReferencedPaths(schema.items, basePath, depth + 1));
  }

  // prefixItems - checking specific indexed elements
  if (schema.prefixItems) {
    schema.prefixItems.forEach((itemSchema: Schema, index: number) => {
      const indexPath = basePath ? `${basePath}/${index}` : `/${index}`;
      paths.push(indexPath);
      paths.push(...extractReferencedPaths(itemSchema, indexPath, depth + 1));
    });
  }

  // const/enum - value constraints at current path
  if (schema.const !== undefined || schema.enum) {
    if (basePath) {
      paths.push(basePath);
    }
  }

  // type constraint
  if (schema.type && basePath) {
    paths.push(basePath);
  }

  // Value constraints (minimum, maximum, minLength, maxLength, pattern, format)
  const valueConstraints = [
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "minLength",
    "maxLength",
    "pattern",
    "format",
    "minItems",
    "maxItems",
    "uniqueItems",
    "minProperties",
    "maxProperties",
  ];
  for (const constraint of valueConstraints) {
    if (
      (schema as Record<string, unknown>)[constraint] !== undefined &&
      basePath
    ) {
      paths.push(basePath);
      break;
    }
  }

  // required
  if (schema.required) {
    for (const req of schema.required) {
      paths.push(basePath ? `${basePath}/${req}` : `/${req}`);
    }
  }

  // dependentRequired
  if (schema.dependentRequired) {
    for (const [prop, reqs] of Object.entries(schema.dependentRequired)) {
      paths.push(basePath ? `${basePath}/${prop}` : `/${prop}`);
      for (const req of reqs) {
        paths.push(basePath ? `${basePath}/${req}` : `/${req}`);
      }
    }
  }

  // dependentSchemas
  if (schema.dependentSchemas) {
    for (const [prop, subSchema] of Object.entries(schema.dependentSchemas)) {
      paths.push(basePath ? `${basePath}/${prop}` : `/${prop}`);
      paths.push(...extractReferencedPaths(subSchema, basePath, depth + 1));
    }
  }

  // Nested conditions - recursive handling
  if (schema.if) {
    paths.push(...extractReferencedPaths(schema.if, basePath, depth + 1));
  }
  if (schema.then) {
    paths.push(...extractReferencedPaths(schema.then, basePath, depth + 1));
  }
  if (schema.else) {
    paths.push(...extractReferencedPaths(schema.else, basePath, depth + 1));
  }

  // allOf/anyOf/oneOf
  for (const keyword of ["allOf", "anyOf", "oneOf"] as const) {
    const subSchemas = schema[keyword];
    if (subSchemas) {
      for (const subSchema of subSchemas) {
        paths.push(...extractReferencedPaths(subSchema, basePath, depth + 1));
      }
    }
  }

  // not - negation condition
  if (schema.not) {
    paths.push(...extractReferencedPaths(schema.not, basePath, depth + 1));
  }

  // contains - dependency on array elements
  if (schema.contains) {
    paths.push(basePath || "/");
    paths.push(...extractReferencedPaths(schema.contains, basePath, depth + 1));
  }

  // Deduplicate
  return [...new Set(paths)];
}
