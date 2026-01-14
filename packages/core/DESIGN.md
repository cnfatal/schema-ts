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

## Field Initialization Rules

The runtime applies default values with careful consideration of json schema keywords compatibility.

The initialization logic respects the following schema properties:

| default | required | nullable | initialize value                    |
| ------- | -------- | -------- | ----------------------------------- |
| yes     | any      | any      | default                             |
| no      | yes      | yes      | null                                |
| no      | yes      | no       | zero (`{}` `[]` `""`, `0`, `false`) |
| no      | no       | any      | undefined(not initialized)          |

- default: schema.default is defined.
- required: parent schema.required includes the property name.
- nullable: schema.type includes "null".

action behavior:

| action          | effect                                 |
| --------------- | -------------------------------------- |
| initialize      | default -> null -> zero                |
| add-property    | default -> null -> zero                |
| add-item        | item.default -> item.null -> item.zero |
| remove-property | required ? (null / zero) : undefined   |
| clear           | required ? (null / zero) : undefined   |
