export function matchSchemaType(value: unknown, type: string): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" || typeof value === "bigint";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
    case "array":
      return Array.isArray(value);
    case "null":
      return value === null || value === undefined;
    default:
      return false;
  }
}

export function detectSchemaType(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  const type = typeof value;
  if (type === "string") {
    return "string";
  }
  if (type === "boolean") {
    return "boolean";
  }
  if (type === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  if (type === "bigint") {
    return "number";
  }
  if (type === "object") {
    return "object";
  }
  // For unrecognized types (function, symbol, etc.), return "unknown"
  return "unknown";
}

export function parseJsonPointer(jsonPointer: string): string[] {
  if (jsonPointer === "") return [];
  const pointer =
    jsonPointer.charAt(0) === "/" ? jsonPointer.substring(1) : jsonPointer;
  return pointer
    .split("/")
    .map((t) => jsonPointerUnescape(decodeURIComponent(t)));
}

export function getJsonPointer(obj: unknown, jsonPointer: string): unknown {
  return get(obj, parseJsonPointer(jsonPointer));
}

export function removeJsonPointer(obj: unknown, jsonPointer: string): boolean {
  const path = parseJsonPointer(jsonPointer);
  if (path.length === 0) {
    return false;
  }
  if (obj === null || obj === undefined) {
    return false;
  }

  let current: unknown = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    if (Array.isArray(current)) {
      const idx = Number(segment);
      if (isNaN(idx) || idx < 0 || idx >= current.length) {
        return false;
      }
      current = current[idx];
    } else if (typeof current === "object" && current !== null) {
      if (!Object.hasOwn(current, segment)) {
        return false;
      }
      current = (current as Record<string, unknown>)[segment];
    } else {
      return false;
    }

    if (current === null || current === undefined) {
      return false;
    }
  }

  const lastSegment = path[path.length - 1];
  if (Array.isArray(current)) {
    const idx = Number(lastSegment);
    if (isNaN(idx) || idx < 0 || idx >= current.length) {
      return false;
    }
    current.splice(idx, 1);
    return true;
  } else if (typeof current === "object" && current !== null) {
    if (Object.hasOwn(current, lastSegment)) {
      delete (current as Record<string, unknown>)[lastSegment];
      return true;
    }
  }

  return false;
}

/**
 * Sets a value at the specified JSON Pointer path within an object.
 *
 * This function modifies the object in place by setting a value at the location
 * specified by the JSON Pointer. If intermediate paths don't exist, they will be
 * automatically created as objects or arrays based on the next path segment
 * (numeric segments create arrays, non-numeric create objects).
 *
 * @param obj - The object to modify. Must be a non-null object or array.
 * @param jsonPointer - A JSON Pointer string (RFC 6901) indicating where to set the value.
 *                      Examples: "/foo", "/foo/0", "/foo/bar/baz"
 * @param value - The value to set at the specified location.
 * @returns `true` if the value was successfully set, `false` otherwise.
 *
 * @remarks
 * - Returns `false` if `jsonPointer` is an empty string (cannot replace root object).
 *   To replace the entire object, handle this case in the calling code.
 * - Returns `false` if `obj` is null or undefined.
 * - For array paths, automatically extends the array if the index is beyond current length.
 * - Automatically initializes missing intermediate containers as arrays or objects.
 *
 * @example
 * ```typescript
 * const obj = { foo: { bar: 1 } };
 * setJsonPointer(obj, "/foo/bar", 2); // true, obj.foo.bar is now 2
 * setJsonPointer(obj, "/foo/baz", 3); // true, obj.foo.baz is now 3
 * setJsonPointer(obj, "/new/path", 4); // true, obj.new.path is now 4
 * setJsonPointer(obj, "", 5); // false, cannot replace root object
 *
 * const arr = [1, 2, 3];
 * setJsonPointer(arr, "/0", 10); // true, arr[0] is now 10
 * setJsonPointer(arr, "/5", 20); // true, arr is now [10, 2, 3, undefined, undefined, 20]
 * ```
 */
export function setJsonPointer(
  obj: unknown,
  jsonPointer: string,
  value: unknown,
): boolean {
  const path = parseJsonPointer(jsonPointer);
  if (path.length === 0) {
    return false;
  }
  if (obj === null || obj === undefined) {
    return false;
  }
  let current: unknown = obj;

  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    const isLast = i === path.length - 1;

    if (Array.isArray(current)) {
      const idx = Number(segment);
      if (isNaN(idx) || idx < 0) {
        return false;
      }
      // ensure array has enough length
      if (idx >= current.length) {
        for (let k = current.length; k <= idx; k++) current.push(undefined);
      }
      if (isLast) {
        current[idx] = value;
        return true;
      }
      // initialize next container if absent
      if (
        current[idx] === null ||
        current[idx] === undefined ||
        typeof current[idx] !== "object"
      ) {
        // decide next container based on next token: numeric -> array, else object
        const nextToken = path[i + 1];
        const nextIdx = Number(nextToken);
        current[idx] = !isNaN(nextIdx) ? [] : {};
      }
      current = current[idx];
    } else if (typeof current === "object" && current !== null) {
      if (isLast) {
        (current as Record<string, unknown>)[segment] = value;
        return true;
      }
      // initialize next container if absent
      if (
        !Object.hasOwn(current, segment) ||
        (current as Record<string, unknown>)[segment] === undefined
      ) {
        const nextToken = path[i + 1];
        const nextIdx = Number(nextToken);
        (current as Record<string, unknown>)[segment] = !isNaN(nextIdx)
          ? []
          : {};
      }
      current = (current as Record<string, unknown>)[segment];
    } else {
      // cannot traverse further
      return false;
    }
  }
  return true;
}

export function getJsonPointerParent(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash <= 0 ? "" : path.substring(0, lastSlash);
}

export function get(obj: unknown, path: string[]): unknown {
  let current = obj;
  for (const segment of path) {
    if (Array.isArray(current)) {
      const currentIndex = Number(segment);
      if (
        isNaN(currentIndex) ||
        currentIndex < 0 ||
        currentIndex >= current.length
      ) {
        return undefined;
      } else {
        current = current[currentIndex];
      }
    } else if (typeof current === "object" && current !== null) {
      if (!Object.hasOwn(current, segment)) {
        return undefined;
      } else {
        current = (current as Record<string, unknown>)[segment];
      }
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Deep equality comparison for two values.
 * Supports primitives, arrays, plain objects, Date, Map, Set, and RegExp.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  // Strict equality (handles primitives and same reference)
  if (a === b) return true;

  // Handle null and non-object cases
  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  ) {
    return false;
  }

  // Handle Date
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (a instanceof Date || b instanceof Date) {
    return false;
  }

  // Handle RegExp
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }
  if (a instanceof RegExp || b instanceof RegExp) {
    return false;
  }

  // Handle Map
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !deepEqual(value, b.get(key))) {
        return false;
      }
    }
    return true;
  }
  if (a instanceof Map || b instanceof Map) {
    return false;
  }

  // Handle Set
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const value of a) {
      // For Sets, we need to check if an equal value exists in b
      let found = false;
      for (const bValue of b) {
        if (deepEqual(value, bValue)) {
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    return false;
  }

  // Handle Arrays
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i++) {
      if (!deepEqual(arrA[i], arrB[i])) return false;
    }
    return true;
  }

  // Handle plain objects
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.hasOwn(b, key)) return false;
    if (
      !deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    ) {
      return false;
    }
  }

  return true;
}

export function jsonPointerEscape(str: string): string {
  return str.replace(/~/g, "~0").replace(/\//g, "~1");
}

export function jsonPointerUnescape(str: string): string {
  return str.replace(/~1/g, "/").replace(/~0/g, "~");
}

export function jsonPointerJoin(base: string, token: string): string {
  if (base === "") return "/" + jsonPointerEscape(token);
  else return base + "/" + jsonPointerEscape(token);
}

/**
 * Convert a relative path to an absolute path
 * @param nodePath The node's jsonPointer, e.g. "/a/b"
 * @param relativePath Relative path, e.g. "/c" means /a/b/c
 */
export function resolveAbsolutePath(
  nodePath: string,
  relativePath: string,
): string {
  if (relativePath.startsWith("/")) {
    // Relative to current node's child path
    return nodePath === "" ? relativePath : nodePath + relativePath;
  }
  return relativePath;
}

/**
 * Maximum size for the regex cache to prevent memory leaks.
 */
const MAX_REGEX_CACHE_SIZE = 1000;

/**
 * Cache for compiled RegExp objects.
 * null value indicates an invalid pattern.
 */
const regexCache = new Map<string, RegExp | null>();

/**
 * Safely test a regex pattern against a string.
 * Returns false if the pattern is invalid instead of throwing.
 * Uses caching to avoid creating RegExp objects repeatedly.
 */
export function safeRegexTest(pattern: string, value: string): boolean {
  let regex = regexCache.get(pattern);

  // Check if we've already processed this pattern
  if (regex === undefined) {
    try {
      regex = new RegExp(pattern);
      // Evict oldest entry if cache is full (Map maintains insertion order)
      if (regexCache.size >= MAX_REGEX_CACHE_SIZE) {
        const firstKey = regexCache.keys().next().value;
        if (firstKey !== undefined) {
          regexCache.delete(firstKey);
        }
      }
      regexCache.set(pattern, regex);
    } catch {
      // Invalid regex pattern - cache as null
      regexCache.set(pattern, null);
      return false;
    }
  }

  // null means the pattern was invalid
  if (regex === null) {
    return false;
  }

  return regex.test(value);
}
