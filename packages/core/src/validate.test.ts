import { describe, expect, it } from "vitest";
import { validateSchema } from "./validate";

describe("validateSchema", () => {
  it("validates type", () => {
    expect(validateSchema({ type: "string" }, "hello").valid).toBe(true);
    expect(validateSchema({ type: "string" }, 123).valid).toBe(false);
    expect(validateSchema({ type: ["string", "number"] }, 123).valid).toBe(
      true,
    );
    expect(validateSchema({ type: ["string", "number"] }, true).valid).toBe(
      false,
    );
  });

  it("validates const and enum", () => {
    expect(validateSchema({ const: "foo" }, "foo").valid).toBe(true);
    expect(validateSchema({ const: "foo" }, "bar").valid).toBe(false);
    expect(validateSchema({ enum: ["a", "b"] }, "a").valid).toBe(true);
    expect(validateSchema({ enum: ["a", "b"] }, "c").valid).toBe(false);
  });

  it("validates number constraints", () => {
    const schema = {
      type: "number",
      minimum: 10,
      maximum: 20,
      multipleOf: 2,
    };
    expect(validateSchema(schema, 12).valid).toBe(true);
    expect(validateSchema(schema, 8).valid).toBe(false); // < min
    expect(validateSchema(schema, 22).valid).toBe(false); // > max
    expect(validateSchema(schema, 13).valid).toBe(false); // not multipleOf
  });

  it("validates string constraints", () => {
    const schema = {
      type: "string",
      minLength: 3,
      maxLength: 5,
      pattern: "^a.*z$",
    };
    expect(validateSchema(schema, "abcz").valid).toBe(true);
    expect(validateSchema(schema, "ab").valid).toBe(false); // too short
    expect(validateSchema(schema, "abcdef").valid).toBe(false); // too long
    expect(validateSchema(schema, "bbcz").valid).toBe(false); // pattern mismatch
  });

  it("validates array constraints", () => {
    const schema = {
      type: "array",
      minItems: 2,
      maxItems: 3,
      uniqueItems: true,
      items: { type: "number" },
    };
    expect(validateSchema(schema, [1, 2]).valid).toBe(true);
    expect(validateSchema(schema, [1]).valid).toBe(false); // too few
    expect(validateSchema(schema, [1, 2, 3, 4]).valid).toBe(false); // too many
    expect(validateSchema(schema, [1, 1]).valid).toBe(false); // not unique
    expect(validateSchema(schema, [1, "a"]).valid).toBe(false); // item type mismatch
  });

  it("validates object constraints", () => {
    const schema = {
      type: "object",
      required: ["a"],
      properties: {
        a: { type: "string" },
        b: { type: "number" },
      },
      additionalProperties: false,
    };
    expect(validateSchema(schema, { a: "s", b: 1 }).valid).toBe(true);
    expect(validateSchema(schema, { b: 1 }).valid).toBe(false); // missing required
    expect(validateSchema(schema, { a: 1 }).valid).toBe(false); // prop type mismatch
    expect(validateSchema(schema, { a: "s", c: 2 }).valid).toBe(false); // additional prop
  });

  it("validates applicators (allOf, anyOf, oneOf, not)", () => {
    const allOf = { allOf: [{ type: "string" }, { minLength: 3 }] };
    expect(validateSchema(allOf, "abc").valid).toBe(true);
    expect(validateSchema(allOf, "ab").valid).toBe(false);

    const anyOf = { anyOf: [{ type: "string" }, { type: "number" }] };
    expect(validateSchema(anyOf, "s").valid).toBe(true);
    expect(validateSchema(anyOf, 1).valid).toBe(true);
    expect(validateSchema(anyOf, true).valid).toBe(false);

    const oneOf = {
      oneOf: [
        { type: "number", multipleOf: 3 },
        { type: "number", multipleOf: 5 },
      ],
    };
    expect(validateSchema(oneOf, 3).valid).toBe(true);
    expect(validateSchema(oneOf, 5).valid).toBe(true);
    expect(validateSchema(oneOf, 15).valid).toBe(false); // matches both

    const not = { not: { type: "string" } };
    expect(validateSchema(not, 1).valid).toBe(true);
    expect(validateSchema(not, "s").valid).toBe(false);
  });

  it("validates if/then/else", () => {
    const schema = {
      if: { properties: { type: { const: "student" } } },
      then: { required: ["school"] },
      else: { required: ["work"] },
    };
    expect(validateSchema(schema, { type: "student", school: "A" }).valid).toBe(
      true,
    );
    expect(validateSchema(schema, { type: "student" }).valid).toBe(false);
    expect(validateSchema(schema, { type: "worker", work: "B" }).valid).toBe(
      true,
    );
    expect(validateSchema(schema, { type: "worker" }).valid).toBe(false);
  });

  it("validates nested if/then/else", () => {
    const schema = {
      type: "object",
      properties: {
        contactMethod: { type: "string" },
      },
      if: {
        properties: {
          contactMethod: { const: "phone" },
        },
      },
      then: {
        properties: {
          phoneNumber: {
            type: "string",
            title: "Phone Number",
            pattern: "^\\+?[0-9]{10,15}$",
          },
        },
        required: ["phoneNumber"],
      },
      else: {
        if: {
          properties: {
            contactMethod: { const: "mail" },
          },
        },
        then: {
          properties: {
            mailingAddress: {
              type: "string",
              title: "Mailing Address",
              minLength: 10,
            },
          },
          required: ["mailingAddress"],
        },
      },
    };

    // Case 1: Phone
    expect(
      validateSchema(schema, {
        contactMethod: "phone",
        phoneNumber: "+1234567890",
      }).valid,
    ).toBe(true);
    expect(
      validateSchema(schema, { contactMethod: "phone", phoneNumber: "123" })
        .valid,
    ).toBe(false); // pattern mismatch
    expect(validateSchema(schema, { contactMethod: "phone" }).valid).toBe(
      false,
    ); // missing phoneNumber

    // Case 2: Mail
    expect(
      validateSchema(schema, {
        contactMethod: "mail",
        mailingAddress: "123 Main St, Anytown, USA",
      }).valid,
    ).toBe(true);
    expect(
      validateSchema(schema, { contactMethod: "mail", mailingAddress: "short" })
        .valid,
    ).toBe(false); // too short
    expect(validateSchema(schema, { contactMethod: "mail" }).valid).toBe(false); // missing mailingAddress

    // Case 3: Other (no additional requirements)
    expect(validateSchema(schema, { contactMethod: "other" }).valid).toBe(true);
  });

  it("validates advanced object constraints (dependencies, propertyNames)", () => {
    const schema = {
      dependentRequired: { credit_card: ["billing_address"] },
      dependentSchemas: {
        credit_card: {
          properties: {
            billing_address: { type: "string" },
          },
        },
      },
      propertyNames: { pattern: "^[a-z_]+$" },
    };

    expect(
      validateSchema(schema, {
        credit_card: "123",
        billing_address: "123 Main St",
      }).valid,
    ).toBe(true);
    expect(validateSchema(schema, { credit_card: "123" }).valid).toBe(false); // missing dependent required
    expect(
      validateSchema(schema, { credit_card: "123", billing_address: 123 })
        .valid,
    ).toBe(false); // dependent schema fail
    expect(validateSchema(schema, { "Bad-Name": 1 }).valid).toBe(false); // propertyNames fail
  });

  it("validates advanced array constraints (prefixItems, contains)", () => {
    const schema = {
      prefixItems: [{ type: "string" }, { type: "number" }],
      items: { type: ["boolean", "number"] }, // additional items
      contains: { const: 1 },
      minContains: 1,
      maxContains: 2,
    };

    expect(validateSchema(schema, ["s", 1, true]).valid).toBe(true);
    expect(validateSchema(schema, ["s", 1, true, 1]).valid).toBe(true); // contains 1 twice
    expect(validateSchema(schema, ["s", 2, true]).valid).toBe(false); // does not contain 1
    expect(validateSchema(schema, ["s", 1, true, 1, 1]).valid).toBe(false); // contains 1 thrice (> maxContains)
    expect(validateSchema(schema, [1, 1]).valid).toBe(false); // prefixItems mismatch (0 should be string)
  });
});

describe("validateSchema fastFail", () => {
  it("should stop after first error when fastFail is true", () => {
    const schema = {
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: "number" },
      },
      required: ["a", "b"],
    };

    // This object has 2 errors: 'a' is number (type mismatch), 'b' is missing (required)
    // Actually 'b' missing is checked in 'required' block.
    // 'a' type mismatch is checked in 'properties' block.
    // The order depends on implementation.
    // In current implementation:
    // 1. required checks
    // 2. properties checks

    // Let's make an object that fails 'required' twice?
    // required: ['a', 'b'], value: {} -> fails 'a' then 'b'.

    const result = validateSchema(schema, {}, "", "#", true);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it("should return all errors when fastFail is false", () => {
    const schema = {
      type: "object",
      required: ["a", "b"],
    };
    const result = validateSchema(schema, {}, "", "#", false);
    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(1);
  });
});
