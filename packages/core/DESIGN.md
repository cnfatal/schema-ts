# Core Design Philosophy

`@schema-ts/core` is the heart of the project. It is not just a JSON Schema validator, but a **Schema Runtime** specifically designed for automatic UI form generation.

## Dynamic & Reactive

Unlike traditional static validators, `core` introduces the concept of a `SchemaRuntime`:

- **Abstract Nodes (FieldNode)**: Flattens the complex schema and value tree into a node tree that is easy to traverse.

- **Effective Schema**: Node tree will update automatically when schema or data changes. it alse resolve dynamic logic like `if/then/else` or `oneOf`.

- **Dependency Tracking**: automatically analyzes dependencies between fields. For example, if the schema of Field B depends on the value of Field A, `core` will automatically re-calculate the effective schema for B whenever A changes.

- **Version Control**: Through a `version` mechanism, the UI layer can efficiently detect schema changes and trigger re-renders.

## Event-Driven

Values change and schema updates are raised as events:

- Only one Node will recieve the change event when a value is changed.
- The UI layer can subscribe to schema change events and update children nodes recursively.

## Default Value Initialization

The runtime applies default values with careful consideration of container initialization and `required` properties.

### Container Initialization Rules

1. **Root node is always considered required** - it will be initialized if there are defaults or required containers to fill
2. **Nested containers follow the `required` chain** - only initialized if they are in parent's `required` array
3. **Optional nested containers are NOT auto-created** - prevents unexpected deep initialization

### Root Container Initialization

When the initial value is `undefined` or `null`, the runtime will auto-initialize the root container if:

- Any property has an explicit `default` value, OR
- Any `required` property is an object/array type (needs container initialization)

```typescript
// Example: Initial value is undefined
const schema = {
  type: "object",
  properties: {
    name: { type: "string" }, // no default
    status: { type: "string", default: "active" }, // has default
  },
};
// Result: { status: 'active' }
```

### Required Nested Container Behavior

Required nested objects/arrays are automatically initialized, following the `required` chain:

```typescript
// Example: Required nested containers
const schema = {
  type: "object",
  properties: {
    config: {
      type: "object",
      properties: {
        items: { type: "array", items: { type: "string" } },
        enabled: { type: "boolean", default: true },
      },
      required: ["items"],
    },
  },
  required: ["config"], // config is required
};
// Result: { config: { items: [], enabled: true } }
// - config is created because it's required
// - items is created as [] because it's required within config
// - enabled is filled with default value
```

### Optional Nested Container Behavior

Optional nested containers are **NOT** auto-initialized, even if they contain defaults or required properties inside:

```typescript
// Example: Optional nested object with defaults inside
const schema = {
  type: "object",
  properties: {
    metadata: {
      type: "object",
      properties: {
        labels: { type: "array", default: [] },
      },
      required: ["labels"],
    },
  },
  // metadata is NOT in required
};
// Result: undefined or {}
// metadata is NOT created because it's optional
// The required/default inside metadata doesn't matter until metadata is explicitly set
```

### Multi-Level Required Chain

The initialization follows the `required` chain and stops at the first optional level:

```typescript
// level1 is required -> level2 is required -> level3 has defaults
// All levels are initialized

// level1 is optional -> level2 is required -> level3 has defaults
// Nothing is initialized (stops at optional level1)
```

### autoFillDefaults Strategy

The `autoFillDefaults` option controls default value behavior:

- `'explicit'` (default): Only fills properties with explicit `default` or `const` values
- `'always'`: Fills type-based defaults (e.g., `""` for string, `[]` for array)
- `'never'`: Never auto-fills any defaults
