import { describe, it, expect } from "vitest";
import {
  deepEqual,
  matchSchemaType,
  detectSchemaType,
  getJsonPointer,
  parseJsonPointer,
  setJsonPointer,
  removeJsonPointer,
  resolveAbsolutePath,
} from "./util";

describe("matchSchemaType", () => {
  it("matches string", () => {
    expect(matchSchemaType("hello", "string")).toBe(true);
    expect(matchSchemaType(123, "string")).toBe(false);
  });

  it("matches number and bigint", () => {
    expect(matchSchemaType(3.14, "number")).toBe(true);
    expect(matchSchemaType(42n, "number")).toBe(true);
    expect(matchSchemaType("42", "number")).toBe(false);
  });

  it("matches integer", () => {
    expect(matchSchemaType(42, "integer")).toBe(true);
    expect(matchSchemaType(3.14, "integer")).toBe(false);
    expect(matchSchemaType(42n, "integer")).toBe(false);
  });

  it("matches boolean", () => {
    expect(matchSchemaType(true, "boolean")).toBe(true);
    expect(matchSchemaType(false, "boolean")).toBe(true);
    expect(matchSchemaType("true", "boolean")).toBe(false);
  });

  it("matches object (non-array, non-null)", () => {
    expect(matchSchemaType({ a: 1 }, "object")).toBe(true);
    expect(matchSchemaType([], "object")).toBe(false);
    expect(matchSchemaType(null, "object")).toBe(false);
  });

  it("matches array", () => {
    expect(matchSchemaType([1, 2, 3], "array")).toBe(true);
    expect(matchSchemaType("not array", "array")).toBe(false);
  });

  it("matches null (null or undefined)", () => {
    expect(matchSchemaType(null, "null")).toBe(true);
    expect(matchSchemaType(undefined, "null")).toBe(true);
    expect(matchSchemaType(0, "null")).toBe(false);
  });

  it("returns false for unknown type", () => {
    // unknown schema type should not match anything
    expect(matchSchemaType("x", "foobar")).toBe(false);
  });
});

describe("getJsonPointer / get", () => {
  it("returns root for empty pointer", () => {
    const doc = { a: 1 };
    expect(getJsonPointer(doc, "")).toBe(doc);
  });

  it("retrieves nested properties", () => {
    const doc = { a: { b: { c: 3 } } };
    expect(getJsonPointer(doc, "/a/b/c")).toBe(3);
  });

  it("retrieves array elements by index", () => {
    const doc = { arr: [10, 20, 30] };
    expect(getJsonPointer(doc, "/arr/1")).toBe(20);
    expect(getJsonPointer(doc, "/arr/5")).toBe(undefined);
  });

  it("supports empty-token key (pointer '/')", () => {
    const doc: Record<string, unknown> = { "": 5 };
    expect(getJsonPointer(doc, "/")).toBe(5);
  });

  it("supports ~1 and ~0 unescaping", () => {
    const doc: Record<string, unknown> = {
      "a/b": 1,
      "m~n": 2,
    };
    expect(getJsonPointer(doc, "/a~1b")).toBe(1);
    expect(getJsonPointer(doc, "/m~0n")).toBe(2);
  });

  it("supports percent-encoded tokens", () => {
    const doc: Record<string, unknown> = { "sp ace": 7 };
    expect(getJsonPointer(doc, "/sp%20ace")).toBe(7);
  });
});

describe("deepEqual", () => {
  it("primitives and null/undefined/NaN", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(undefined, undefined)).toBe(true);
    // NaN is not === so deepEqual should return false with current implementation
    expect(deepEqual(NaN, NaN)).toBe(false);
  });

  it("arrays and nested arrays", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual([], [])).toBe(true);
  });

  it("objects, key order and nested objects", () => {
    const a = { x: 1, y: 2 },
      b = { y: 2, x: 1 };
    expect(deepEqual(a, b)).toBe(true);

    const o1 = { a: { b: { c: [1, 2, 3] } }, d: "str" },
      o2 = { d: "str", a: { b: { c: [1, 2, 3] } } };
    expect(deepEqual(o1, o2)).toBe(true);

    const extra = { a: 1, b: 2, c: 3 },
      missing = { a: 1, b: 2 };
    expect(deepEqual(extra, missing)).toBe(false);
  });

  it("different types are not equal", () => {
    expect(deepEqual({ a: 1 }, ["a"])).toBe(false);
    expect(deepEqual(1, "1")).toBe(false);
  });

  it("Date objects", () => {
    const date1 = new Date("2023-01-01");
    const date2 = new Date("2023-01-01");
    const date3 = new Date("2023-01-02");

    expect(deepEqual(date1, date2)).toBe(true);
    expect(deepEqual(date1, date3)).toBe(false);
    expect(deepEqual(date1, "2023-01-01")).toBe(false);
    expect(deepEqual(date1, date1.getTime())).toBe(false);
  });

  it("RegExp objects", () => {
    expect(deepEqual(/abc/, /abc/)).toBe(true);
    expect(deepEqual(/abc/gi, /abc/gi)).toBe(true);
    expect(deepEqual(/abc/, /def/)).toBe(false);
    expect(deepEqual(/abc/i, /abc/g)).toBe(false);
    expect(deepEqual(/abc/, "abc")).toBe(false);
  });

  it("Map objects", () => {
    const map1 = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    const map2 = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    const map3 = new Map([
      ["a", 1],
      ["b", 3],
    ]);
    const map4 = new Map([["a", 1]]);

    expect(deepEqual(map1, map2)).toBe(true);
    expect(deepEqual(map1, map3)).toBe(false);
    expect(deepEqual(map1, map4)).toBe(false);
    expect(deepEqual(map1, { a: 1, b: 2 })).toBe(false);
  });

  it("Set objects", () => {
    const set1 = new Set([1, 2, 3]);
    const set2 = new Set([1, 2, 3]);
    const set3 = new Set([1, 2, 4]);
    const set4 = new Set([1, 2]);

    expect(deepEqual(set1, set2)).toBe(true);
    expect(deepEqual(set1, set3)).toBe(false);
    expect(deepEqual(set1, set4)).toBe(false);
    expect(deepEqual(set1, [1, 2, 3])).toBe(false);
  });

  it("nested special objects", () => {
    const obj1 = {
      date: new Date("2023-01-01"),
      regex: /test/i,
      map: new Map([["key", "value"]]),
      set: new Set([1, 2]),
    };
    const obj2 = {
      date: new Date("2023-01-01"),
      regex: /test/i,
      map: new Map([["key", "value"]]),
      set: new Set([1, 2]),
    };
    const obj3 = {
      date: new Date("2023-01-02"),
      regex: /test/i,
      map: new Map([["key", "value"]]),
      set: new Set([1, 2]),
    };

    expect(deepEqual(obj1, obj2)).toBe(true);
    expect(deepEqual(obj1, obj3)).toBe(false);
  });
});

describe("parseJsonPointer", () => {
  it("parses empty pointer", () => {
    expect(parseJsonPointer("")).toEqual([]);
  });

  it("parses root pointer", () => {
    expect(parseJsonPointer("/")).toEqual([""]);
  });

  it("parses simple pointer", () => {
    expect(parseJsonPointer("/foo/bar")).toEqual(["foo", "bar"]);
  });

  it("parses pointer with escaped characters", () => {
    expect(parseJsonPointer("/foo~1bar/baz~0qux")).toEqual([
      "foo/bar",
      "baz~qux",
    ]);
  });

  it("parses pointer with percent-encoded characters", () => {
    expect(parseJsonPointer("/foo%20bar")).toEqual(["foo bar"]);
  });

  it("parses pointer without leading slash (loose mode)", () => {
    expect(parseJsonPointer("foo/bar")).toEqual(["foo", "bar"]);
  });
});

describe("setJsonPointer", () => {
  it("returns value when pointer is empty", () => {
    const doc = { a: 1 };
    const res = setJsonPointer(doc, "", 42);
    // setJsonPointer returns boolean for success; empty pointer is not allowed
    expect(res).toBe(false);
    // original document should be unchanged
    expect(doc.a).toBe(1);
  });

  it("sets nested object properties and creates intermediate objects", () => {
    const doc: Record<string, any> = {};
    setJsonPointer(doc, "/a/b/c", "x");
    expect(getJsonPointer(doc, "/a/b/c")).toBe("x");
  });

  it("creates arrays for numeric tokens and sets nested values", () => {
    const doc: Record<string, any> = {};
    setJsonPointer(doc, "/arr/2/x", 7);
    expect(Array.isArray(doc.arr)).toBe(true);
    expect(doc.arr.length).toBe(3);
    expect(getJsonPointer(doc, "/arr/2/x")).toBe(7);
  });

  it("sets array element by index and expands array", () => {
    const doc: Record<string, any> = { arr: [0] };
    setJsonPointer(doc, "/arr/1", 10);
    expect(getJsonPointer(doc, "/arr/1")).toBe(10);
    expect(doc.arr.length).toBe(2);
  });

  it("supports empty-token key '/'", () => {
    const doc: Record<string, any> = {};
    setJsonPointer(doc, "/", 5);
    expect(getJsonPointer(doc, "/")).toBe(5);
  });
});

describe("removeJsonPointer", () => {
  it("removes object property", () => {
    const doc = { a: 1, b: 2 };
    const res = removeJsonPointer(doc, "/a");
    expect(res).toBe(true);
    expect(doc).toEqual({ b: 2 });
  });

  it("removes nested object property", () => {
    const doc = { a: { b: { c: 3 } } };
    const res = removeJsonPointer(doc, "/a/b/c");
    expect(res).toBe(true);
    expect(doc).toEqual({ a: { b: {} } });
  });

  it("removes array element", () => {
    const doc = { arr: [1, 2, 3] };
    const res = removeJsonPointer(doc, "/arr/1");
    expect(res).toBe(true);
    expect(doc.arr).toEqual([1, 3]);
  });

  it("removes nested array element", () => {
    const doc = { a: [{ b: 1 }, { b: 2 }] };
    const res = removeJsonPointer(doc, "/a/0/b");
    expect(res).toBe(true);
    expect(doc.a[0]).toEqual({});
  });

  it("returns false for non-existent pointer", () => {
    const doc = { a: 1 };
    const res = removeJsonPointer(doc, "/b");
    expect(res).toBe(false);
    expect(doc).toEqual({ a: 1 });
  });

  it("returns false for intermediate non-existent path", () => {
    const doc = { a: 1 };
    const res = removeJsonPointer(doc, "/b/c");
    expect(res).toBe(false);
  });

  it("returns false for empty pointer", () => {
    const doc = { a: 1 };
    const res = removeJsonPointer(doc, "");
    expect(res).toBe(false);
  });

  it("returns false when removing from non-object/non-array", () => {
    const doc = { a: 1 };
    const res = removeJsonPointer(doc, "/a/b");
    expect(res).toBe(false);
  });
});

describe("detectSchemaType", () => {
  it("detects basic types", () => {
    expect(detectSchemaType("s")).toBe("string");
    expect(detectSchemaType(1)).toBe("integer");
    expect(detectSchemaType(1.5)).toBe("number");
    expect(detectSchemaType(true)).toBe("boolean");
    expect(detectSchemaType(null)).toBe("null");
    expect(detectSchemaType(undefined)).toBe("null");
    expect(detectSchemaType({})).toBe("object");
    expect(detectSchemaType([])).toBe("array");
  });

  it("detects bigint as number", () => {
    expect(detectSchemaType(10n)).toBe("number");
  });
});

describe("resolveAbsolutePath", () => {
  it("resolves paths relative to current node pointer", () => {
    expect(resolveAbsolutePath("/a/b", "/c")).toBe("/a/b/c");
  });

  it("returns relative path if it is empty and relativePath is root-relative", () => {
    expect(resolveAbsolutePath("", "/a")).toBe("/a");
  });

  it("returns relativePath as is if it does not start with /", () => {
    expect(resolveAbsolutePath("/a/b", "c")).toBe("c");
  });

  it("handles double slash-like joining", () => {
    expect(resolveAbsolutePath("/a", "/")).toBe("/a/");
  });
});
