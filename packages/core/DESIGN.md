# Core Design Philosophy

`@schema-ts/core` is the heart of the project. It is not just a JSON Schema validator, but a **Schema Runtime** specifically designed for automatic UI form generation.

## Dynamic & Reactive

Unlike traditional static validators, `core` introduces the concept of a `SchemaRuntime`:

- **Abstract Nodes (FieldNode)**: Flattens the complex schema and value tree into a node tree that is easy to traverse.

- **Effective Schema**: Node tree will update automatically when schema or data changes. it alse resolve dynamic logic like `allOf`, `anyOf`, `oneOf`, `if/then/else` and `not`.

- **Dependency Tracking**: automatically analyzes dependencies between nodes. For example, if the schema of Field B depends on the value of Field A, `core` will automatically re-calculate the effective schema for Field B whenever Field A changes.

- **Version Control**: Through a `version` mechanism, the UI layer can efficiently detect schema changes and trigger re-renders.

## Event-Driven

Values change and schema updates are raised as events:

- Only one Node will recieve the change event when a value is changed.
- The UI layer can subscribe to schema change events and update children nodes recursively.

## Value Initialization

The runtime applies default values with careful consideration of json schema keywords compatibility.

The initialization logic respects the following priority:

- const / default
- required
- nullable

The initialization logic is as follows:

| default | required | nullable | initialize value                    |
| ------- | -------- | -------- | ----------------------------------- |
| yes     | any      | any      | default                             |
| no      | yes      | yes      | null                                |
| no      | yes      | no       | zero (`{}` `[]` `""`, `0`, `false`) |
| no      | no       | any      | removed                             |

- default: schema.default is defined.
- required: parent schema.required includes the property name.
- nullable: schema.type includes "null".
- removed: the property is not in the value.

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
