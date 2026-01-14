import { describe, it, expect } from "vitest";
import {
  parsePropertyGroup,
  getGroupKey,
  groupByKeywordLocation,
} from "./grouping";

describe("grouping utilities", () => {
  describe("parsePropertyGroup", () => {
    it("parses root properties", () => {
      expect(parsePropertyGroup("#/properties/name")).toEqual({
        keyword: "root",
      });
    });

    it("parses allOf properties", () => {
      expect(parsePropertyGroup("#/allOf/0/properties/model")).toEqual({
        keyword: "allOf",
        index: 0,
      });
      expect(parsePropertyGroup("#/allOf/1/then/properties/dataset")).toEqual({
        keyword: "allOf",
        index: 1,
      });
    });

    it("parses anyOf properties", () => {
      expect(parsePropertyGroup("#/anyOf/2/properties/foo")).toEqual({
        keyword: "anyOf",
        index: 2,
      });
    });

    it("parses oneOf properties", () => {
      expect(parsePropertyGroup("#/oneOf/0/properties/bar")).toEqual({
        keyword: "oneOf",
        index: 0,
      });
    });

    it("parses dependentSchemas properties", () => {
      expect(
        parsePropertyGroup("#/dependentSchemas/type/properties/bar"),
      ).toEqual({
        keyword: "dependentSchemas",
        key: "type",
      });
    });

    it("handles nested paths within allOf", () => {
      expect(
        parsePropertyGroup("#/allOf/0/if/then/properties/conditional"),
      ).toEqual({
        keyword: "allOf",
        index: 0,
      });
    });
  });

  describe("getGroupKey", () => {
    it("returns 'root' for root group", () => {
      expect(getGroupKey({ keyword: "root" })).toBe("root");
    });

    it("returns allOf/index for allOf groups", () => {
      expect(getGroupKey({ keyword: "allOf", index: 0 })).toBe("allOf/0");
      expect(getGroupKey({ keyword: "allOf", index: 1 })).toBe("allOf/1");
    });

    it("returns dependentSchemas/key for dependentSchemas groups", () => {
      expect(getGroupKey({ keyword: "dependentSchemas", key: "type" })).toBe(
        "dependentSchemas/type",
      );
    });
  });

  describe("groupByKeywordLocation", () => {
    it("groups items by their composition source", () => {
      const items = [
        { keywordLocation: "#/properties/name", value: "name" },
        { keywordLocation: "#/allOf/0/properties/model", value: "model" },
        {
          keywordLocation: "#/allOf/0/then/properties/modelConfig",
          value: "modelConfig",
        },
        { keywordLocation: "#/allOf/1/properties/dataset", value: "dataset" },
      ];

      const groups = groupByKeywordLocation(items);

      expect(groups.length).toBe(3);
      expect(groups.find((g) => g.key === "root")?.items).toEqual([
        { keywordLocation: "#/properties/name", value: "name" },
      ]);
      expect(groups.find((g) => g.key === "allOf/0")?.items).toEqual([
        { keywordLocation: "#/allOf/0/properties/model", value: "model" },
        {
          keywordLocation: "#/allOf/0/then/properties/modelConfig",
          value: "modelConfig",
        },
      ]);
      expect(groups.find((g) => g.key === "allOf/1")?.items).toEqual([
        { keywordLocation: "#/allOf/1/properties/dataset", value: "dataset" },
      ]);
    });

    it("handles empty array", () => {
      const groups = groupByKeywordLocation([]);
      expect(groups.length).toBe(0);
    });
  });
});
