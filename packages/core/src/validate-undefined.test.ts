import { describe, it, expect } from "vitest";
import { validateSchema } from "./validate";

describe("validate undefined fields", () => {
  it("should treat undefined value as missing field for required validation", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name", "age"],
    };

    // undefined value should be treated as missing
    const result1 = validateSchema(schema, { name: "John", age: undefined });
    expect(result1.valid).toBe(false);
    expect(result1.errors?.some((e) => e.error?.includes("age"))).toBe(true);

    // explicitly set to undefined should also be treated as missing
    const result2 = validateSchema(schema, {
      name: undefined,
      age: undefined,
    });
    expect(result2.valid).toBe(false);
    expect(result2.errors?.some((e) => e.error?.includes("name"))).toBe(true);
    expect(result2.errors?.some((e) => e.error?.includes("age"))).toBe(true);

    // null is different from undefined - null is present but fails type check
    const result3 = validateSchema(schema, { name: "John", age: null });
    expect(result3.valid).toBe(false);
    // age is present (not undefined) so it passes required check
    // but fails type validation since null is not a number
    const hasTypeError = JSON.stringify(result3.errors).includes("type");
    expect(hasTypeError).toBe(true);
  });

  it("should treat undefined value as missing for dependentRequired", () => {
    const schema = {
      type: "object",
      properties: {
        creditCard: { type: "string" },
        billingAddress: { type: "string" },
      },
      dependentRequired: {
        creditCard: ["billingAddress"],
      },
    };

    // creditCard with undefined should not trigger dependentRequired
    const result1 = validateSchema(schema, {
      creditCard: undefined,
    });
    expect(result1.valid).toBe(true);

    // creditCard with value should trigger dependentRequired
    const result2 = validateSchema(schema, {
      creditCard: "1234",
      billingAddress: undefined,
    });
    expect(result2.valid).toBe(false);
    expect(
      result2.errors?.some((e) => e.error?.includes("billingAddress")),
    ).toBe(true);

    // both present and valid
    const result3 = validateSchema(schema, {
      creditCard: "1234",
      billingAddress: "123 Main St",
    });
    expect(result3.valid).toBe(true);
  });

  it("should not validate schema for undefined property values", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", minLength: 5 },
        age: { type: "number", minimum: 0 },
      },
    };

    // undefined values should not be validated against their schema
    const result = validateSchema(schema, {
      name: undefined,
      age: undefined,
    });
    expect(result.valid).toBe(true);

    // but invalid values should still fail
    const result2 = validateSchema(schema, {
      name: "abc", // too short
      age: -1, // below minimum
    });
    expect(result2.valid).toBe(false);
  });

  it("should not count undefined values for minProperties/maxProperties", () => {
    const schema = {
      type: "object",
      minProperties: 2,
      maxProperties: 3,
    };

    // undefined values should not count towards property count
    const result1 = validateSchema(schema, {
      a: "1",
      b: undefined,
      c: "3",
    });
    expect(result1.valid).toBe(true); // only 2 defined properties (a, c), meets minProperties:2

    const result2 = validateSchema(schema, {
      a: "1",
      b: "2",
      c: undefined,
    });
    expect(result2.valid).toBe(true); // 2 defined properties (a, b)

    const result3 = validateSchema(schema, {
      a: "1",
      b: "2",
      c: "3",
      d: undefined,
    });
    expect(result3.valid).toBe(true); // 3 defined properties (a, b, c)

    const result4 = validateSchema(schema, {
      a: "1",
      b: "2",
      c: "3",
      d: "4",
    });
    expect(result4.valid).toBe(false); // 4 properties exceeds maximum
  });

  it("should not validate undefined values in patternProperties", () => {
    const schema = {
      type: "object",
      patternProperties: {
        "^num_": { type: "number", minimum: 0 },
      },
    };

    const result = validateSchema(schema, {
      num_a: 10,
      num_b: undefined,
      num_c: -5, // invalid: below minimum
    });
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.instanceLocation?.includes("c"))).toBe(
      true,
    );
    // num_b should not cause validation error (undefined values are ignored)
    expect(result.errors?.some((e) => e.instanceLocation?.includes("b"))).toBe(
      false,
    );
  });

  it("should not validate property names for undefined values", () => {
    const schema = {
      type: "object",
      propertyNames: {
        pattern: "^[a-z]+$", // only lowercase letters
      },
    };

    const result = validateSchema(schema, {
      valid: "test",
      INVALID: undefined, // key doesn't match pattern but value is undefined
      alsovalid: "foo",
    });
    // INVALID key should be ignored because its value is undefined
    expect(result.valid).toBe(true);

    const result2 = validateSchema(schema, {
      valid: "test",
      INVALID: "bar", // key doesn't match pattern and value is defined
    });
    // INVALID key should cause validation error
    expect(result2.valid).toBe(false);
  });

  it("should not validate undefined values in additionalProperties", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      additionalProperties: { type: "number" },
    };

    const result = validateSchema(schema, {
      name: "John",
      extra1: undefined,
      extra2: 123,
    });
    expect(result.valid).toBe(true);

    const result2 = validateSchema(schema, {
      name: "John",
      extra1: "invalid", // should fail type check
    });
    expect(result2.valid).toBe(false);
  });

  it("should not trigger dependentSchemas for undefined values", () => {
    const schema = {
      type: "object",
      properties: {
        creditCard: { type: "string" },
        billingAddress: { type: "string" },
      },
      dependentSchemas: {
        creditCard: {
          required: ["billingAddress"],
        },
      },
    };

    // creditCard with undefined should not trigger dependentSchemas
    const result1 = validateSchema(schema, {
      creditCard: undefined,
    });
    expect(result1.valid).toBe(true);

    // creditCard with value should trigger dependentSchemas
    const result2 = validateSchema(schema, {
      creditCard: "1234",
    });
    expect(result2.valid).toBe(false);
  });

  it("should handle nested objects with undefined values", () => {
    const schema = {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
          },
          required: ["name", "email"],
        },
      },
      required: ["user"],
    };

    // undefined nested property should fail required validation
    const result = validateSchema(schema, {
      user: {
        name: "John",
        email: undefined,
      },
    });
    expect(result.valid).toBe(false);
    // Check that there's an error about the required email property
    const errorStr = JSON.stringify(result.errors);
    expect(errorStr.includes("email")).toBe(true);
  });
});
