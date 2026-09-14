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
