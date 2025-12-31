import { describe, it, expect } from "vitest";
import type { Schema } from "./type";
import { collectDependencies, extractReferencedPaths } from "./dependency";

describe("collectDependencies", () => {
  describe("required", () => {
    it("collects dependencies from required fields", () => {
      const schema: Schema = {
        type: "object",
        required: ["name", "email"],
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/name");
      expect(deps).toContain("/email");
      expect(deps.size).toBe(2);
    });

    it("collects dependencies from required fields with nested path", () => {
      const schema: Schema = {
        type: "object",
        required: ["city"],
      };
      const deps = collectDependencies(schema, "/address");
      expect(deps).toContain("/address/city");
      expect(deps.size).toBe(1);
    });
  });

  describe("dependentRequired", () => {
    it("collects dependencies from dependentRequired", () => {
      const schema: Schema = {
        type: "object",
        dependentRequired: {
          creditCard: ["billingAddress"],
        },
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/creditCard");
      expect(deps).toContain("/billingAddress");
      expect(deps.size).toBe(2);
    });

    it("handles multiple dependentRequired entries", () => {
      const schema: Schema = {
        type: "object",
        dependentRequired: {
          foo: ["bar", "baz"],
          qux: ["quux"],
        },
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/foo");
      expect(deps).toContain("/bar");
      expect(deps).toContain("/baz");
      expect(deps).toContain("/qux");
      expect(deps).toContain("/quux");
      expect(deps.size).toBe(5);
    });
  });

  describe("dependentSchemas", () => {
    it("collects dependencies from dependentSchemas", () => {
      const schema: Schema = {
        type: "object",
        dependentSchemas: {
          creditCard: {
            required: ["billingAddress"],
          },
        },
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/creditCard");
      expect(deps).toContain("/billingAddress");
      expect(deps.size).toBe(2);
    });

    it("handles nested dependentSchemas with conditions", () => {
      const schema: Schema = {
        type: "object",
        dependentSchemas: {
          hasAddress: {
            if: {
              properties: { country: { const: "US" } },
            },
            then: {
              required: ["state"],
            },
          },
        },
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/hasAddress");
      expect(deps).toContain("/country");
      expect(deps).toContain("/state");
    });
  });

  describe("if-then-else", () => {
    it("collects dependencies from if condition", () => {
      const schema: Schema = {
        type: "object",
        if: {
          properties: { type: { const: "business" } },
        },
        then: {
          required: ["taxId"],
        },
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/type");
      expect(deps).toContain("/taxId");
    });

    it("collects dependencies from else branch", () => {
      const schema: Schema = {
        type: "object",
        if: {
          properties: { type: { const: "business" } },
        },
        then: {
          required: ["taxId"],
        },
        else: {
          required: ["ssn"],
        },
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/type");
      expect(deps).toContain("/taxId");
      expect(deps).toContain("/ssn");
    });

    it("handles nested if-then-else", () => {
      const schema: Schema = {
        type: "object",
        if: {
          properties: { country: { const: "US" } },
        },
        then: {
          if: {
            properties: { state: { const: "CA" } },
          },
          then: {
            required: ["caLicense"],
          },
        },
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/country");
      expect(deps).toContain("/state");
      expect(deps).toContain("/caLicense");
    });

    it("handles if with const at property level", () => {
      const schema: Schema = {
        type: "object",
        if: {
          properties: {
            role: { const: "admin" },
          },
        },
        then: {
          properties: {
            permissions: { type: "array" },
          },
        },
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/role");
    });
  });

  describe("oneOf", () => {
    it("collects dependencies from oneOf conditions", () => {
      const schema: Schema = {
        type: "object",
        oneOf: [
          { properties: { type: { const: "A" } }, required: ["fieldA"] },
          { properties: { type: { const: "B" } }, required: ["fieldB"] },
        ],
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/type");
      expect(deps).toContain("/fieldA");
      expect(deps).toContain("/fieldB");
    });

    it("handles oneOf with nested conditions", () => {
      const schema: Schema = {
        type: "object",
        oneOf: [
          {
            properties: { category: { const: "vehicle" } },
            if: {
              properties: { vehicleType: { const: "car" } },
            },
            then: {
              required: ["numWheels"],
            },
          },
        ],
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/category");
      expect(deps).toContain("/vehicleType");
      expect(deps).toContain("/numWheels");
    });
  });

  describe("anyOf", () => {
    it("collects dependencies from anyOf conditions", () => {
      const schema: Schema = {
        type: "object",
        anyOf: [
          { properties: { email: { format: "email" } } },
          { properties: { phone: { pattern: "^\\d{10}$" } } },
        ],
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/email");
      expect(deps).toContain("/phone");
    });

    it("handles anyOf with nested conditions", () => {
      const schema: Schema = {
        type: "object",
        anyOf: [
          {
            if: {
              properties: { contactMethod: { const: "email" } },
            },
            then: {
              required: ["emailAddress"],
            },
          },
        ],
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/contactMethod");
      expect(deps).toContain("/emailAddress");
    });
  });

  describe("allOf", () => {
    it("collects dependencies from allOf", () => {
      const schema: Schema = {
        type: "object",
        allOf: [{ required: ["name"] }, { required: ["age"] }],
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/name");
      expect(deps).toContain("/age");
    });

    it("handles allOf with if-then-else", () => {
      const schema: Schema = {
        type: "object",
        allOf: [
          {
            if: {
              properties: { hasLicense: { const: true } },
            },
            then: {
              required: ["licenseNumber"],
            },
          },
        ],
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/hasLicense");
      expect(deps).toContain("/licenseNumber");
    });
  });

  describe("complex scenarios", () => {
    it("collects dependencies from multiple sources", () => {
      const schema: Schema = {
        type: "object",
        required: ["id"],
        dependentRequired: {
          email: ["emailVerified"],
        },
        if: {
          properties: { type: { const: "premium" } },
        },
        then: {
          required: ["subscriptionId"],
        },
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/id");
      expect(deps).toContain("/email");
      expect(deps).toContain("/emailVerified");
      expect(deps).toContain("/type");
      expect(deps).toContain("/subscriptionId");
    });

    it("handles deeply nested conditions", () => {
      const schema: Schema = {
        type: "object",
        allOf: [
          {
            oneOf: [
              {
                if: {
                  properties: { deep: { const: "value" } },
                },
                then: {
                  anyOf: [{ required: ["a"] }, { required: ["b"] }],
                },
              },
            ],
          },
        ],
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/deep");
      expect(deps).toContain("/a");
      expect(deps).toContain("/b");
    });

    it("handles nested instanceLocation", () => {
      const schema: Schema = {
        type: "object",
        required: ["street", "city"],
        if: {
          properties: { country: { const: "US" } },
        },
        then: {
          required: ["state", "zipCode"],
        },
      };
      const deps = collectDependencies(schema, "/user/address");
      expect(deps).toContain("/user/address/street");
      expect(deps).toContain("/user/address/city");
      expect(deps).toContain("/user/address/country");
      expect(deps).toContain("/user/address/state");
      expect(deps).toContain("/user/address/zipCode");
    });

    it("deduplicates repeated paths", () => {
      const schema: Schema = {
        type: "object",
        required: ["name"],
        dependentRequired: {
          name: ["email"],
        },
        if: {
          properties: { name: { minLength: 1 } },
        },
        then: {
          required: ["name"],
        },
      };
      const deps = collectDependencies(schema, "");
      // /name appears in required, dependentRequired key, and if condition
      // but should only appear once in the set
      expect(deps).toContain("/name");
      expect(deps).toContain("/email");
      // Count occurrences by converting to array
      const depsArray = Array.from(deps);
      const nameCount = depsArray.filter((d) => d === "/name").length;
      expect(nameCount).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("returns empty set for empty schema", () => {
      const schema: Schema = {};
      const deps = collectDependencies(schema, "");
      expect(deps.size).toBe(0);
    });

    it("returns empty set for simple type schema", () => {
      const schema: Schema = { type: "string" };
      const deps = collectDependencies(schema, "");
      expect(deps.size).toBe(0);
    });

    it("handles empty required array", () => {
      const schema: Schema = {
        type: "object",
        required: [],
      };
      const deps = collectDependencies(schema, "");
      expect(deps.size).toBe(0);
    });

    it("handles empty oneOf array", () => {
      const schema: Schema = {
        type: "object",
        oneOf: [],
      };
      const deps = collectDependencies(schema, "");
      expect(deps.size).toBe(0);
    });

    it("handles empty anyOf array", () => {
      const schema: Schema = {
        type: "object",
        anyOf: [],
      };
      const deps = collectDependencies(schema, "");
      expect(deps.size).toBe(0);
    });

    it("handles empty allOf array", () => {
      const schema: Schema = {
        type: "object",
        allOf: [],
      };
      const deps = collectDependencies(schema, "");
      expect(deps.size).toBe(0);
    });

    it("handles root instanceLocation", () => {
      const schema: Schema = {
        required: ["field"],
      };
      const deps = collectDependencies(schema, "");
      expect(deps).toContain("/field");
    });
  });
});
describe("extractReferencedPaths", () => {
  it("extracts paths from properties", () => {
    const schema: Schema = {
      properties: {
        foo: { type: "string" },
        bar: {
          properties: {
            baz: { type: "number" },
          },
        },
      },
    };
    const paths = extractReferencedPaths(schema);
    expect(paths).toContain("/foo");
    expect(paths).toContain("/bar");
    expect(paths).toContain("/bar/baz");
  });

  it("extracts paths from items", () => {
    const schema: Schema = {
      items: {
        properties: {
          foo: { type: "string" },
        },
      },
    };
    const paths = extractReferencedPaths(schema);
    // items dependency means dependency on the array itself (basePath)
    expect(paths).toContain("/");
    expect(paths).toContain("/foo");
  });

  it("extracts paths from prefixItems", () => {
    const schema: Schema = {
      prefixItems: [
        { type: "string" },
        { properties: { foo: { type: "number" } } },
      ],
    };
    const paths = extractReferencedPaths(schema);
    expect(paths).toContain("/0");
    expect(paths).toContain("/1");
    expect(paths).toContain("/1/foo");
  });

  it("extracts paths from const and enum", () => {
    const schema: Schema = {
      properties: {
        foo: { const: "bar" },
        baz: { enum: [1, 2] },
      },
    };
    const paths = extractReferencedPaths(schema);
    expect(paths).toContain("/foo");
    expect(paths).toContain("/baz");
  });

  it("extracts paths from conditional keywords (if, then, else)", () => {
    const schema: Schema = {
      if: {
        properties: { type: { const: "A" } },
      },
      then: {
        properties: { valueA: { type: "string" } },
      },
      else: {
        properties: { valueB: { type: "number" } },
      },
    };
    const paths = extractReferencedPaths(schema);
    expect(paths).toContain("/type");
    expect(paths).toContain("/valueA");
    expect(paths).toContain("/valueB");
  });

  it("extracts paths from combinators (allOf, anyOf, oneOf)", () => {
    const schema: Schema = {
      oneOf: [
        { properties: { foo: { type: "string" } } },
        { properties: { bar: { type: "number" } } },
      ],
    };
    const paths = extractReferencedPaths(schema);
    expect(paths).toContain("/foo");
    expect(paths).toContain("/bar");
  });

  it("handles value constraints", () => {
    const schema: Schema = {
      properties: {
        age: { minimum: 18, maximum: 100 },
        name: { minLength: 2, pattern: "^[A-Z]" },
      },
    };
    const paths = extractReferencedPaths(schema);
    expect(paths).toContain("/age");
    expect(paths).toContain("/name");
  });

  it("deduplicates paths", () => {
    const schema: Schema = {
      allOf: [
        { properties: { foo: { type: "string" } } },
        { properties: { foo: { minLength: 1 } } },
      ],
    };
    const paths = extractReferencedPaths(schema);
    expect(paths.filter((p) => p === "/foo").length).toBe(1);
  });

  it("extracts paths from dependentSchemas", () => {
    const schema: Schema = {
      dependentSchemas: {
        creditCard: {
          properties: {
            billingAddress: { type: "string" },
          },
        },
      },
    };
    const paths = extractReferencedPaths(schema);
    // Should include the trigger property
    expect(paths).toContain("/creditCard");
    // Should include properties from the dependent schema
    expect(paths).toContain("/billingAddress");
  });

  it("extracts paths from contains", () => {
    const schema: Schema = {
      contains: {
        properties: {
          id: { type: "number" },
        },
      },
    };
    const paths = extractReferencedPaths(schema);
    // contains means dependency on the array itself
    expect(paths).toContain("/");
    expect(paths).toContain("/id");
  });
});
