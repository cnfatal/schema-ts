import {
  Validator,
  getJsonPointer,
  type KeywordValidationContext,
} from "@schema-ts/core";
import { ParseError, parse } from "@marcbachmann/cel-js";

/** Rule value accepted by the `x-validate` keyword. */
export interface XValidateRule {
  /** CEL expression that must evaluate to true for the value to be valid. */
  expr: string;
  /** Message shown when the expression is false. */
  message?: string;
}

export interface XValidateOptions {
  /** Keyword to register. Defaults to `x-validate`. */
  keyword?: string;
}

/**
 * Extension: cross-field validation with a CEL expression.
 *
 * This is deliberately outside the core. The core only exposes the
 * `ValidatorConfig.keywords` extension point; this factory registers a
 * `x-validate` keyword on top of it.
 *
 * The expression is evaluated with:
 * - `self`   – the current field value
 * - `parent` – the parent object
 * - `root`   – the whole form value
 * - every property of the parent object as a bare name
 *
 * ```json
 * {
 *   "type": "number",
 *   "x-validate": { "expr": "self > parent.min", "message": "Must be greater than min" }
 * }
 * ```
 */
export function createXValidateValidator(
  options: XValidateOptions = {},
): Validator {
  const keyword = options.keyword ?? "x-validate";
  const cache = new Map<
    string,
    (context: Record<string, unknown>) => unknown
  >();

  const compile = (expression: string) => {
    let compiled = cache.get(expression);
    if (!compiled) {
      compiled = parse(expression) as (
        context: Record<string, unknown>,
      ) => unknown;
      cache.set(expression, compiled);
    }
    return compiled;
  };

  const handler = (context: KeywordValidationContext): string | undefined => {
    const raw = (context.schema as Record<string, unknown>)[keyword];
    const rule: XValidateRule =
      typeof raw === "string" ? { expr: raw } : (raw as XValidateRule);
    if (!rule || typeof rule.expr !== "string") {
      return undefined;
    }

    let evaluate: (scope: Record<string, unknown>) => unknown;
    try {
      evaluate = compile(rule.expr);
    } catch (error) {
      return error instanceof ParseError
        ? `Invalid CEL expression: ${error.message}`
        : "Invalid CEL expression";
    }

    const parentIndex = context.instanceLocation.lastIndexOf("/");
    const parentPath =
      parentIndex > 0 ? context.instanceLocation.slice(0, parentIndex) : "";
    const parent = getJsonPointer(context.rootValue, parentPath);
    const scope: Record<string, unknown> = {
      self: context.value,
      parent: parent ?? context.rootValue,
      root: context.rootValue,
      ...(parent && typeof parent === "object" ? parent : {}),
    };

    let result: unknown;
    try {
      result = evaluate(scope);
    } catch (error) {
      return error instanceof Error
        ? `CEL error: ${error.message}`
        : "CEL error";
    }

    return result
      ? undefined
      : (rule.message ?? `Validation failed: ${rule.expr}`);
  };

  return new Validator({ keywords: { [keyword]: handler } });
}
