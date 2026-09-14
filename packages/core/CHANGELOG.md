# @schema-ts/core

## 0.2.0

### Minor Changes

- b64242a: ### @schema-ts/core

  - Evaluate `if`/`then`/`else` against a default-projected value so defaults such
    as `false`, `0` and `""` select the correct branch on first render, and fix
    default materialization for falsy and required values.
  - Add the opt-in `normalizer: "better"` runtime option (`BetterNormalizer`), with
    a `nonEmptyRequiredStrings` option that adds `minLength: 1` to required,
    non-nullable strings.
  - Add a generic extension point for custom validation keywords
    (`ValidatorConfig.keywords`); the playground implements `x-validate`
    (cross-field validation with a CEL expression) and `x-resource-enum`
    (dialog resource picker) on top of it.
  - Cut redundant work in the two-phase node build: stop shallow-validating every
    recursive `resolveEffectiveSchema` level, reuse the phase-1 effective schema
    during validation when defaults did not change the value, and share the
    missing-property default rule between `applyDefaults` and `projectDefaults`.

  ### @schema-ts/react
  - Validate a field on blur (`onBlur` widget prop), subscribe to runtime events
    through `Form`'s `onEvent` prop, read the runtime via
    `FormHandle.getRuntime()`, and skip the first external-value sync so mounting
    no longer marks every field as touched.

## 0.1.6

### Patch Changes

- 5a16ac5: default and remove logic

## 0.1.5

### Patch Changes

- 5055eb6: activate validation

## 0.1.4

### Patch Changes

- e90d1da: context

## 0.1.3

### Patch Changes

- 61ee5c2: update default strategy

## 0.1.2

### Patch Changes

- 1a153f2: enhance setValue notify

## 0.1.1

### Patch Changes

- Release v0.1.1
