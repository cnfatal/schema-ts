---
"@schema-ts/core": minor
"@schema-ts/react": minor
---

### @schema-ts/core

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
