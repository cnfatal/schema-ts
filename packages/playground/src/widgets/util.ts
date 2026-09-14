import type { Schema } from "@schema-ts/core";

/** Number of instance-tree segments ("/a/b" -> 2, "" -> 0). */
export function instanceLevel(instanceLocation: string): number {
  return instanceLocation.split("/").filter(Boolean).length;
}

/** Non-nullable schema type. */
export function schemaType(schema: Schema): string | undefined {
  const type = schema.type;
  if (Array.isArray(type))
    return type.find((item) => item !== "null") as string;
  return type as string | undefined;
}

/** True when an object is a flat string map (additionalProperties: string). */
export function isStringMap(schema: Schema): boolean {
  const additional = schema.additionalProperties;
  if (additional === true) return true;
  if (additional && typeof additional === "object") {
    const type = (additional as Schema).type;
    return (
      type === "string" || (Array.isArray(type) && type.includes("string"))
    );
  }
  return false;
}

/** Complex or boolean fields span both columns of the primitive grid. */
export function isWideField(schema: Schema): boolean {
  const type = schemaType(schema);
  return type === "object" || type === "array" || type === "boolean";
}

/**
 * True when an object has nothing the form can render: no declared properties
 * that themselves carry editable content, and no dynamic properties.
 */
export function isEffectivelyEmpty(schema: Schema): boolean {
  if (schemaType(schema) !== "object") return false;

  const properties = Object.values(schema.properties ?? {});
  const hasDynamic = Boolean(
    schema.additionalProperties || schema.patternProperties,
  );
  if (properties.length === 0) return !hasDynamic;

  return properties.every((child) => isEffectivelyEmpty(child as Schema));
}
