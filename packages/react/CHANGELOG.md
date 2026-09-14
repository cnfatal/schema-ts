# @schema-ts/react

## 0.2.2

### Patch Changes

- Updated dependencies [742894f]
  - @schema-ts/core@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies [5dcef3c]
  - @schema-ts/core@0.2.1

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

### Patch Changes

- Updated dependencies [b64242a]
  - @schema-ts/core@0.2.0

## 0.1.6

### Patch Changes

- 5a16ac5: default and remove logic
- Updated dependencies [5a16ac5]
  - @schema-ts/core@0.1.6

## 0.1.5

### Patch Changes

- Updated dependencies [5055eb6]
  - @schema-ts/core@0.1.5

## 0.1.4

### Patch Changes

- e90d1da: context
- Updated dependencies [e90d1da]
  - @schema-ts/core@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [61ee5c2]
  - @schema-ts/core@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [1a153f2]
  - @schema-ts/core@0.1.2

## 0.1.1

### Patch Changes

- Release v0.1.1
- Updated dependencies
  - @schema-ts/core@0.1.1
