import {
  stringFormatValidator,
  type StringFormatValidatorInterface,
} from "./stringformat";
import type { Schema, Output, ErrorMessage } from "./type";
import { deepEqual, jsonPointerEscape, matchSchemaType } from "./util";
import { defaultErrorFormatter, type ErrorFormatter } from "./i18n";
import { normalizeSchema } from "./normalize";

export interface ValidatorOptions {
  fastFail?: boolean;
  shallow?: boolean;
}

export interface ValidatorConfig {
  formatValidator?: StringFormatValidatorInterface;
  errorFormatter?: ErrorFormatter;
}

export class Validator {
  private formatValidator: StringFormatValidatorInterface;
  private errorFormatter: ErrorFormatter;

  constructor(config: ValidatorConfig = {}) {
    this.formatValidator = config.formatValidator ?? stringFormatValidator;
    this.errorFormatter = config.errorFormatter ?? defaultErrorFormatter;
  }

  /**
   * Format an ErrorMessage to a localized string.
   */
  formatError(msg: ErrorMessage): string {
    return this.errorFormatter(msg);
  }

  validate(
    schema: Schema,
    value: unknown,
    keywordLocation: string = "#",
    instanceLocation: string = "",
    options: ValidatorOptions = {},
  ): Output {
    const { fastFail = false } = options;
    const output: Output = {
      valid: false,
      keywordLocation,
      absoluteKeywordLocation: keywordLocation,
      instanceLocation,
      absoluteInstanceLocation: instanceLocation,
      errors: [],
    };

    // Applicators: if/then/else
    if (schema.if) {
      const ifResult = this.validate(
        schema.if,
        value,
        keywordLocation + `/if`,
        `${instanceLocation}`,
        options,
      );
      if (ifResult.valid) {
        if (schema.then) {
          const thenResult = this.validate(
            schema.then,
            value,
            keywordLocation + `/then`,
            instanceLocation,
            options,
          );
          if (!thenResult.valid) {
            output.errors.push(...(thenResult.errors || []));
            if (fastFail) return output;
          }
        }
      } else if (schema.else) {
        const elseResult = this.validate(
          schema.else,
          value,
          keywordLocation + `/else`,
          instanceLocation,
          options,
        );
        if (!elseResult.valid) {
          output.errors.push(...(elseResult.errors || []));
          if (fastFail) return output;
        }
      }
    }

    // Applicators: allOf
    if (schema.allOf) {
      for (let index = 0; index < schema.allOf.length; index++) {
        const subSchema = schema.allOf[index];
        const result = this.validate(
          subSchema,
          value,
          keywordLocation + `/allOf/${index}`,
          instanceLocation,
          options,
        );
        if (!result.valid) {
          output.errors.push(...(result.errors || []));
          if (fastFail) return output;
        }
      }
    }

    // Applicators: anyOf
    if (schema.anyOf) {
      let hasValid = false;
      const errors: Output[] = [];
      for (let index = 0; index < schema.anyOf.length; index++) {
        const subSchema = schema.anyOf[index];
        const result = this.validate(
          subSchema,
          value,
          keywordLocation + `/anyOf/${index}`,
          instanceLocation,
          options,
        );
        if (result.valid) {
          hasValid = true;
          break;
        } else {
          errors.push(...(result.errors || []));
        }
      }
      if (!hasValid) {
        output.errors.push({
          valid: false,
          keywordLocation: `${keywordLocation}/anyOf`,
          instanceLocation,
          errors,
          error: this.formatError({ key: "validation.anyOf" }),
        });
        if (fastFail) return output;
      }
    }

    // Applicators: oneOf
    if (schema.oneOf) {
      const results = schema.oneOf.map((subSchema, index) =>
          this.validate(
            subSchema,
            value,
            keywordLocation + `/oneOf/${index}`,
            instanceLocation,
            options,
          ),
        ),
        validCount = results.filter((r) => r.valid).length;
      if (validCount !== 1) {
        output.errors.push({
          valid: false,
          keywordLocation: `${keywordLocation}/oneOf`,
          instanceLocation,
          errors: [],
          annotations: results,
          error: this.formatError({
            key: "validation.oneOf",
            params: { count: validCount },
          }),
        });
        if (fastFail) return output;
      }
    }

    // Applicators: not
    if (schema.not) {
      const result = this.validate(
        schema.not,
        value,
        keywordLocation + `/not`,
        instanceLocation,
        options,
      );
      if (result.valid) {
        output.errors.push({
          valid: false,
          keywordLocation: `${keywordLocation}/not`,
          instanceLocation,
          errors: [],
          annotations: [result],
          error: this.formatError({ key: "validation.not" }),
        });
        if (fastFail) return output;
      }
    }

    // Validation: const
    if (schema.const !== undefined) {
      if (!deepEqual(value, schema.const)) {
        output.errors.push({
          valid: false,
          keywordLocation: `${keywordLocation}/const`,
          instanceLocation,
          errors: [],
          error: this.formatError({ key: "validation.const" }),
        });
        if (fastFail) return output;
      }
    }

    // Validation: enum
    if (schema.enum) {
      if (!schema.enum.some((v) => deepEqual(value, v))) {
        output.errors.push({
          valid: false,
          keywordLocation: `${keywordLocation}/enum`,
          instanceLocation,
          errors: [],
          error: this.formatError({ key: "validation.enum" }),
        });
        if (fastFail) return output;
      }
    }

    // Type validation. If schema.type is provided, prefer that; otherwise
    // infer instanceType from the runtime value so that keywords like
    // minLength/prefixItems/contains/etc. without an explicit type still
    // apply when appropriate.
    let instanceType = "";
    if (schema.type) {
      const allowedTypes = Array.isArray(schema.type)
        ? schema.type
        : [schema.type];
      for (const type of allowedTypes) {
        if (this.checkType(value, type)) {
          instanceType = type;
          break;
        }
      }
      if (!instanceType) {
        output.errors.push({
          valid: false,
          keywordLocation: `${keywordLocation}/type`,
          instanceLocation,
          errors: [],
          error: this.formatError({
            key: "validation.type",
            params: { expected: allowedTypes.join(" or ") },
          }),
        });
        if (fastFail) return output;
      }
    } else {
      instanceType = this.detectType(value);
    }

    // Type specific validations
    if (instanceType === "object") {
      this.validateObject(
        schema,
        value as Record<string, unknown>,
        instanceLocation,
        keywordLocation,
        output,
        options,
      );
    } else if (instanceType === "array") {
      this.validateArray(
        schema,
        value as unknown[],
        keywordLocation,
        instanceLocation,
        output,
        options,
      );
    } else if (instanceType === "string") {
      this.validateString(
        schema,
        value as string,
        keywordLocation,
        instanceLocation,
        output,
        options,
      );
    } else if (instanceType === "number") {
      this.validateNumber(
        schema,
        value as number,
        keywordLocation,
        instanceLocation,
        output,
        options,
      );
    }

    output.valid = output.errors.length == 0;
    output.error = output.valid
      ? undefined
      : this.formatError({ key: "validation.failed" });
    return output;
  }

  private validateNumber(
    schema: Schema,
    value: number,
    keywordLocation: string,
    instanceLocation: string,
    output: Output,
    options: ValidatorOptions,
  ) {
    const { fastFail = false } = options;
    const addError = (keyword: string, msg: ErrorMessage) => {
      output.errors.push({
        valid: false,
        keywordLocation: `${keywordLocation}/${keyword}`,
        instanceLocation,
        errors: [],
        error: this.formatError(msg),
      });
    };

    if (schema.maximum !== undefined && value > schema.maximum) {
      addError("maximum", {
        key: "validation.maximum",
        params: { value: schema.maximum },
      });
      if (fastFail) return;
    }
    if (
      schema.exclusiveMaximum !== undefined &&
      value >= schema.exclusiveMaximum
    ) {
      addError("exclusiveMaximum", {
        key: "validation.exclusiveMaximum",
        params: { value: schema.exclusiveMaximum },
      });
      if (fastFail) return;
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      addError("minimum", {
        key: "validation.minimum",
        params: { value: schema.minimum },
      });
      if (fastFail) return;
    }
    if (
      schema.exclusiveMinimum !== undefined &&
      value <= schema.exclusiveMinimum
    ) {
      addError("exclusiveMinimum", {
        key: "validation.exclusiveMinimum",
        params: { value: schema.exclusiveMinimum },
      });
      if (fastFail) return;
    }
    if (schema.multipleOf !== undefined) {
      const remainder = value % schema.multipleOf;
      if (
        Math.abs(remainder) > 0.00001 &&
        Math.abs(remainder - schema.multipleOf) > 0.00001
      ) {
        addError("multipleOf", {
          key: "validation.multipleOf",
          params: { value: schema.multipleOf },
        });
        if (fastFail) return;
      }
    }
  }

  private validateString(
    schema: Schema,
    value: string,
    keywordLocation: string,
    instanceLocation: string,
    output: Output,
    options: ValidatorOptions,
  ) {
    const { fastFail = false } = options;
    const addError = (keyword: string, msg: ErrorMessage) => {
        output.errors.push({
          valid: false,
          keywordLocation: `${keywordLocation}/${keyword}`,
          instanceLocation,
          errors: [],
          error: this.formatError(msg),
        });
      },
      { length } = [...value];

    if (schema.maxLength !== undefined && length > schema.maxLength) {
      addError("maxLength", {
        key: "validation.maxLength",
        params: { value: schema.maxLength },
      });
      if (fastFail) return;
    }
    if (schema.minLength !== undefined && length < schema.minLength) {
      addError("minLength", {
        key: "validation.minLength",
        params: { value: schema.minLength },
      });
      if (fastFail) return;
    }
    if (schema.pattern !== undefined) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        addError("pattern", {
          key: "validation.pattern",
          params: { pattern: schema.pattern },
        });
        if (fastFail) return;
      }
    }
    if (schema.format !== undefined) {
      if (!this.validateFormat(schema.format, value)) {
        addError("format", {
          key: "validation.format",
          params: { format: schema.format },
        });
        if (fastFail) return;
      }
    }
  }

  private validateArray(
    schema: Schema,
    value: unknown[],
    keywordLocation: string,
    instanceLocation: string,
    output: Output,
    options: ValidatorOptions,
  ) {
    const { fastFail = false, shallow = false } = options;
    const addError = (keyword: string, msg: ErrorMessage) => {
      output.errors.push({
        valid: false,
        keywordLocation: `${keywordLocation}/${keyword}`,
        instanceLocation,
        errors: [],
        error: this.formatError(msg),
      });
    };

    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      addError("maxItems", {
        key: "validation.maxItems",
        params: { value: schema.maxItems },
      });
      if (fastFail) return;
    }
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      addError("minItems", {
        key: "validation.minItems",
        params: { value: schema.minItems },
      });
      if (fastFail) return;
    }
    if (schema.uniqueItems) {
      for (let i = 0; i < value.length; i++) {
        for (let j = i + 1; j < value.length; j++) {
          if (deepEqual(value[i], value[j])) {
            addError("uniqueItems", { key: "validation.uniqueItems" });
            return;
          }
        }
      }
    }

    let prefixItemsLength = 0;
    if (schema.prefixItems) {
      prefixItemsLength = schema.prefixItems.length;
      for (let index = 0; index < schema.prefixItems.length; index++) {
        const itemSchema = schema.prefixItems[index];
        if (index < value.length) {
          if (!shallow) {
            const result = this.validate(
              itemSchema,
              value[index],
              `${keywordLocation}/prefixItems/${index}`,
              `${instanceLocation}/${index}`,
              options,
            );
            if (!result.valid) {
              output.errors.push(result);
              if (fastFail) return;
            }
          }
        }
      }
    }

    if (schema.items && value.length > prefixItemsLength) {
      for (let i = prefixItemsLength; i < value.length; i++) {
        if (!shallow) {
          const result = this.validate(
            schema.items,
            value[i],
            `${keywordLocation}/items`,
            `${instanceLocation}/${i}`,
            options,
          );
          if (!result.valid) {
            output.errors.push(result);
            if (fastFail) return;
          }
        }
      }
    }

    if (schema.contains) {
      let containsCount = 0;
      for (let i = 0; i < value.length; i++) {
        const result = this.validate(
          schema.contains,
          value[i],
          `${keywordLocation}/contains`,
          `${instanceLocation}/${i}`,
          options,
        );
        if (result.valid) {
          containsCount++;
        }
      }

      if (schema.minContains !== undefined) {
        if (containsCount < schema.minContains) {
          addError("minContains", {
            key: "validation.minContains",
            params: { value: schema.minContains },
          });
          if (fastFail) return;
        }
      } else if (schema.minContains === undefined && containsCount === 0) {
        addError("contains", { key: "validation.contains" });
        if (fastFail) return;
      }

      if (schema.maxContains !== undefined) {
        if (containsCount > schema.maxContains) {
          addError("maxContains", {
            key: "validation.maxContains",
            params: { value: schema.maxContains },
          });
          if (fastFail) return;
        }
      }
    }
  }

  private validateObject(
    schema: Schema,
    value: Record<string, unknown>,
    keywordLocation: string,
    instanceLocation: string,
    output: Output,
    options: ValidatorOptions,
  ) {
    const { fastFail = false, shallow = false } = options;
    const addError = (keyword: string, msg: ErrorMessage) => {
        output.errors.push({
          valid: false,
          keywordLocation: `${keywordLocation}/${keyword}`,
          instanceLocation,
          errors: [],
          error: this.formatError(msg),
        });
      },
      keys = Object.keys(value);

    if (
      schema.maxProperties !== undefined &&
      keys.length > schema.maxProperties
    ) {
      addError("maxProperties", {
        key: "validation.maxProperties",
        params: { value: schema.maxProperties },
      });
      if (fastFail) return;
    }
    if (
      schema.minProperties !== undefined &&
      keys.length < schema.minProperties
    ) {
      addError("minProperties", {
        key: "validation.minProperties",
        params: { value: schema.minProperties },
      });
      if (fastFail) return;
    }

    if (schema.required) {
      for (const req of schema.required) {
        if (!(req in value)) {
          addError("required", {
            key: "validation.required",
            params: { property: req },
          });
          if (fastFail) return;
        }
      }
    }

    if (schema.dependentRequired) {
      for (const [prop, requiredProps] of Object.entries(
        schema.dependentRequired,
      )) {
        if (prop in value) {
          for (const req of requiredProps) {
            if (!(req in value)) {
              addError("dependentRequired", {
                key: "validation.dependentRequired",
                params: { source: prop, target: req },
              });
              if (fastFail) return;
            }
          }
        }
      }
    }

    const validatedKeys = new Set<string>();

    if (schema.properties) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (prop in value) {
          validatedKeys.add(prop);
          if (!shallow) {
            const result = this.validate(
              propSchema,
              value[prop],
              `${keywordLocation}/properties/${prop}`,
              `${instanceLocation}/${prop}`,
              options,
            );
            if (!result.valid) {
              output.errors.push(result);
              if (fastFail) return;
            }
          }
        }
      }
    }

    if (schema.patternProperties) {
      for (const [pattern, propSchema] of Object.entries(
        schema.patternProperties,
      )) {
        const regex = new RegExp(pattern);
        for (const key of keys) {
          if (regex.test(key)) {
            validatedKeys.add(key);
            if (!shallow) {
              const result = this.validate(
                propSchema,
                value[key],
                `${keywordLocation}/patternProperties/${jsonPointerEscape(pattern)}`,
                `${instanceLocation}/${jsonPointerEscape(key)}`,
                options,
              );
              if (!result.valid) {
                output.errors.push(...(result.errors || []));
                if (fastFail) return;
              }
            }
          }
        }
      }
    }

    if (schema.additionalProperties !== undefined) {
      const additionalKeys = keys.filter((k) => !validatedKeys.has(k));
      if (typeof schema.additionalProperties === "boolean") {
        if (!schema.additionalProperties && additionalKeys.length > 0) {
          addError("additionalProperties", {
            key: "validation.additionalProperties",
            params: { properties: additionalKeys.join(", ") },
          });
          if (fastFail) return;
        }
      } else {
        for (const key of additionalKeys) {
          if (!shallow) {
            const result = this.validate(
              schema.additionalProperties,
              value[key],
              `${keywordLocation}/additionalProperties`,
              `${instanceLocation}/${jsonPointerEscape(key)}`,
              options,
            );
            if (!result.valid) {
              output.errors.push(result);
              if (fastFail) return;
            }
          }
        }
      }
    }

    if (schema.propertyNames) {
      for (const key of keys) {
        const result = this.validate(
          schema.propertyNames,
          key,
          `${keywordLocation}/propertyNames`,
          `${instanceLocation}/${jsonPointerEscape(key)}`,
          options,
        );
        if (!result.valid) {
          output.errors.push(result);
          if (fastFail) return;
        }
      }
    }

    if (schema.dependentSchemas) {
      for (const [prop, depSchema] of Object.entries(schema.dependentSchemas)) {
        if (prop in value) {
          const result = this.validate(
            depSchema,
            value,
            `${keywordLocation}/dependentSchemas/${jsonPointerEscape(prop)}`,
            instanceLocation,
            options,
          );
          if (!result.valid) {
            output.errors.push(result);
            if (fastFail) return;
          }
        }
      }
    }
  }

  private detectType(value: unknown): string {
    if (value === null || value === undefined) return "null";
    if (Array.isArray(value)) return "array";
    if (Number.isInteger(value as number)) return "integer";
    return typeof value as string;
  }

  private checkType(value: unknown, type: string): boolean {
    return matchSchemaType(value, type);
  }

  private validateFormat(format: string, value: string): boolean {
    return this.formatValidator.validate(format, value);
  }
}

/**
 * Validates a value against a JSON Schema.
 * Support multiple JSON Schema drafts (04, 07, 2019-09, 2020-12) by normalizing
 * the schema to draft 2020-12 format before validation.
 */
export function validateSchema(
  schema: Schema | unknown,
  value: unknown,
  instancePath: string = "",
  schemaPath: string = "#",
  fastFail: boolean = false,
): Output {
  const normalizedSchema = normalizeSchema(schema);
  const validator = new Validator();
  return validator.validate(normalizedSchema, value, schemaPath, instancePath, {
    fastFail,
  });
}
