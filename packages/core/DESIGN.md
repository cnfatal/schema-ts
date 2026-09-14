# Core Design Philosophy

`@schema-ts/core` is the heart of the project. It is not just a JSON Schema validator, but a **Schema Runtime** specifically designed for automatic UI form generation.

## Dynamic & Reactive

Unlike traditional static validators, `core` introduces the concept of a `SchemaRuntime`:

- **Abstract Nodes (FieldNode)**: Flattens the complex schema and value tree into a node tree that is easy to traverse.

- **Effective Schema**: Node tree will update automatically when schema or data changes. it alse resolve dynamic logic like `allOf`, `anyOf`, `oneOf`, `if/then/else` and `not`.

- **Dependency Tracking**: automatically analyzes dependencies between nodes. For example, if the schema of Field B depends on the value of Field A, `core` will automatically re-calculate the effective schema for Field B whenever Field A changes.

- **Version Control**: Through a `version` mechanism, the UI layer can efficiently detect schema changes and trigger re-renders.

## Two-Phase Node Building

The runtime uses a two-phase approach when building/updating the node tree:

### Phase 1: Structure & Defaults

- Resolve effective schema for each node
- Apply default values based on schema constraints
- Build the complete node tree structure
- Recursively process all children

### Phase 2: Validation

- Validate all nodes after the entire subtree structure is built
- All default values are already applied, ensuring validation sees final values
- Emit error change notifications

This separation is critical for handling complex scenarios like `if-then-else` schema switches, where:

1. Parent node's effective schema changes (e.g., `mode: "standalone"` → `mode: "cluster"`)
2. New child nodes are created with their containers
3. Child nodes need their defaults filled (e.g., `replicaCount: 2`)
4. Parent validation checks constraints (e.g., `minProperties: 1`)

Without two-phase building, validation might run before child defaults are applied, causing false validation errors.

## Event-Driven

Values change and schema updates are raised as events:

- Only one Node will recieve the change event when a value is changed.
- The UI layer can subscribe to schema change events and update children nodes recursively.

## Value Initialization

The runtime applies default values with careful consideration of JSON Schema keywords compatibility.

### Default Value Priority

When determining the initial value for a field, the following priority order is used:

1. **`const`** - If defined, always use the const value
2. **`default`** - If defined, use the schema's default value
3. **Type-based defaults** - Based on `required` and `nullable` status

### Initialization Decision Matrix

| default | required | nullable | initialize value                    |
| ------- | -------- | -------- | ----------------------------------- |
| yes     | any      | any      | default                             |
| no      | yes      | yes      | null                                |
| no      | yes      | no       | zero (`{}` `[]` `""`, `0`, `false`) |
| no      | no       | any      | removed (undefined)                 |

**Definitions:**

- **default**: `schema.default` is defined
- **required**: Parent's `schema.required` array includes this property name
- **nullable**: `schema.type` includes `"null"` (e.g., `type: ["string", "null"]`)
- **removed**: The property is not present in the value object

### Object Property Initialization

For object types, child properties are initialized based on:

1. **Required properties**: Always initialized (recursively apply default rules)
2. **Properties with `default`**: Initialized with their default value
3. **Optional properties without default**: Not initialized (removed)

```
// Schema
{
  type: "object",
  required: ["name"],
  properties: {
    name: { type: "string" },           // required, no default → ""
    age: { type: "integer", default: 0 }, // has default → 0
    email: { type: "string" }           // optional, no default → removed
  }
}

// Initialized value
{ name: "", age: 0 }  // email is not present
```

### Array Item Initialization

- **`prefixItems`**: Each item is always initialized (treated as required)
- **`items`**: Only initialized when explicitly added by user

### Two-Phase Default Application

Default values are applied during Phase 1 of node building:

1. **Schema resolution**: Determine effective schema (handles `if/then/else`, `allOf`, etc.)
2. **Container creation**: Create `{}` or `[]` for required container types
3. **Property filling**: Fill required properties and properties with defaults
4. **Recursive descent**: Apply same logic to all child nodes

This ensures all defaults are in place before Phase 2 validation runs.

### Conditional Evaluation and Defaults

`default` is a JSON Schema annotation and does not affect validation. Because the
runtime materializes defaults during Phase 1, `if`/`then`/`else` conditions are
evaluated against a **default-projected copy** of the value rather than the raw
submission. This keeps a discriminator that declares a default (for example
`enabled: { default: false }`) consistent with the value the form displays: the
`else` branch is selected on first render instead of leaking `then` fields until
the switch is toggled.

The projection mirrors the default rules above and never mutates stored state, so
JSON Schema semantics are preserved for genuinely absent values: a condition that
only lists `properties` (without `required`) still matches when the property is
absent. To treat a missing discriminator as "condition not met", authors should
either write `required` inside `if` or opt into `BetterNormalizer`:

```ts
new SchemaRuntime(validator, schema, value, { normalizer: "better" });
```

The default `"draft"` normalizer never rewrites conditions, keeping the runtime
faithful to JSON Schema.

## Materialization Model

The runtime keeps a **single value**. Conditional keywords must be evaluated
against the value the form will display, so defaults and conditions must agree.
Two mechanisms cooperate:

- **Materialization** writes defaults into the stored value (`applyDefaults`),
  during Phase 1 of node building.
- **Projection** builds a _read-only evaluation view_ (`projectDefaults`) used
  only to evaluate `if`/`anyOf`/`oneOf`. It is never stored, rendered or
  submitted.

The invariant is: **the projection must equal the value materialization is about
to produce.** If the two use different rules, a condition can select a branch the
form never shows. In `charts/default/llamafactory`, `basic.finetuningType`
defaults to `"lora"` inside the optional `basic` object; the root-level `if`s
could not see it and rendered `quantization`, `lora` and `freeze` at once.

### The rule

A missing object property (or a missing `prefixItems` slot) is materialized iff:

```
required
  OR subschema.default !== undefined
  OR (policy.materializeContainers AND hasNestedDefault(subschema))
```

`hasNestedDefault(schema)` is a pure predicate: the schema declares a `default`
anywhere in its **unconditional** structure — `properties`, `allOf`, `items` and
`prefixItems`, recursed. Conditional branches (`if`/`then`/`else`, `anyOf`,
`oneOf`) are intentionally **not** traversed: a default that exists only under a
branch must not cause its container to be created. The predicate is cached per
schema object with a `WeakMap`.

`applyDefaults` and `projectDefaults` share this predicate, so the stored value
and the evaluation view cannot diverge.

### Policies

| policy    | `materializeContainers` | owner              | behaviour                                                                                                                                                       |
| :-------- | :---------------------- | :----------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strict`  | `false`                 | `DraftNormalizer`  | JSON-Schema faithful: `default` is an annotation and an absent optional container stays absent.                                                                 |
| `display` | `true`                  | `BetterNormalizer` | "Materialize as displayed": an optional container that (transitively) declares a default is created and filled, so ancestor conditions see the displayed value. |

The policy lives on the normalizer and is read by the runtime; there is no
separate runtime flag to keep in sync.

### Why not a fix point

Materialization is bottom-up (defaults sit on descendants) while branch selection
is top-down (a parent must pick a branch before its children exist). The
projection breaks that cycle with one deterministic preview. Iterating the
resolve → materialize cycle to a fixed point would remove the residual ordering
assumptions but costs an unbounded loop per change and can oscillate; the shared
predicate covers the authored cases without it.

### Worked example

```
basic (optional, no default, but finetuningType.default = "lora")
  └─ root allOf[5..7].if references basic.finetuningType
```

- `strict`: `basic` stays absent, every `if` sees `finetuningType` missing, and
  `quantization` / `lora` / `freeze` are all merged. JSON-Schema faithful, but not
  what the form displays.
- `display`: `basic` is materialized as `{ finetuningType: "lora" }` and the
  `if`s select the `lora` branch only. The stored value gains an explicit
  `basic`.

### Edge cases and decisions

- **Undefined containers.** The validator skips `required` for a non-object
  instance, so for an entirely `undefined` node `not(properties x const false
required x)` is _invalid_ and its `then` is excluded. `display` instead stores
  `x: false` and evaluates the same branch for an explicit reason.
- **`allOf` order.** JSON Schema does not define an order for `allOf`
  ([Rendering Order](#rendering-order) is presentation only). Conditions must not
  depend on it: the projection pre-projects every unconditional `properties`
  before evaluating conditions, then projects branch defaults as they merge.
- **Scalars.** Only containers gain the new rule; an optional scalar keeps the
  `required || default` rule, so `display` never invents `""`/`0`.
- **Arrays.** Only missing `prefixItems` are filled; `items` beyond the current
  length are never created.

### Verification

- `display` selects `lora` for the LLaMA-Factory gating (no `quantization` /
  `freeze`) while `strict` keeps the vacuous result.
- `applyDefaults` and `projectDefaults` agree under every policy.
- `hasNestedDefault` ignores defaults under `then`/`else`/`anyOf`/`oneOf`.
- Rendering order stays as specified in [Rendering Order](#rendering-order).

## State Consistency

The value states after any operation must match the value initialization logic.

### Action Behavior

| action            | effect                                        | note                                         |
| :---------------- | :-------------------------------------------- | :------------------------------------------- |
| `initialize`      | default or (required ? (null/zero) : removed) | runtime materialization                      |
| `add-property`    | default or (null/zero)                        | added field is behaviorally required         |
| `add-item`        | item.default or (null/zero)                   | added item is behaviorally required          |
| `remove-property` | required ? (noop) : removed                   | required enforces presence                   |
| `remove-item`     | required ? (noop) : removed                   | required enforces presence                   |
| `input-zero`      | (null/zero)                                   | user-provided value, independent of required |
| `clear`           | required ? (null) : removed                   | re-evaluate presence                         |
| `validate`        | removed ? skip : validate                     | removed nodes are non-existent               |

## User Interface Notes

- When value of a field is removed or undefined, the field component should be inactive state, the default value is should not be showed as placeholder(not the actual value).

### Rendering Order

Field order is deterministic and follows the schema definition order:

1. A schema's own `properties`, in declaration order.
2. Then each `allOf` entry in array order. An entry appends only keys that are
   not already present; a redeclared key keeps its first position.
3. `if`/`then`/`else`, `anyOf` and `oneOf` contributions append after the same
   base, in evaluation order.
4. Array items follow index order (`prefixItems` first, then `items`).

`x-order` (a number) overrides the definition order: entries are sorted ascending
with a **stable** sort, so entries without `x-order` (treated as `Infinity`) and
entries sharing the same `x-order` keep their definition order.

This is a presentation convention. JSON Schema does not define a rendering order,
and `allOf` is semantically unordered for validation — the runtime guarantees
only that the order is deterministic and derived from the schema. Condition
evaluation must therefore never depend on `allOf` order.
