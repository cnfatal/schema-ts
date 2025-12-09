# schema-ts

A high-performance Schema validation and UI generation framework based on TypeScript.

[![Demo](https://img.shields.io/badge/Demo-Live-brightgreen)](https://cnfatal.github.io/schema-ts/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Features

- **Full-stack Type Safety**: Complete TypeScript type inference from Schema definition to UI forms.
- **JSON Schema 2020-12 Standard**: Core validation engine strictly follows the latest JSON Schema spec, supporting complex logic.
- **Backward Compatibility**: Supports backward compatibility with earlier JSON Schema drafts (Draft 4, 6, 7, 2019-09).
- **Multi-framework Support**: One Schema, supports both React and Vue 3 for automatic form generation.
- **Highly Extensible**: Supports custom validation rules, custom UI components (Widgets), and internationalization (i18n).
- **Lightweight & Efficient**: Core library has zero external dependencies, suitable for both Node.js and browser environments.

## 🔗 Online Experience

[Click to visit Playground Demo](https://cnfatal.github.io/schema-ts/)

In the Playground, you can edit Schema in real-time and see the generated React form.

## Usage Examples (@schema-ts/core)

### Basic Validation

```typescript
import { Validator } from "@schema-ts/core";

const validator = new Validator();
const schema = {
  type: "object",
  properties: {
    username: { type: "string", minLength: 3 },
    age: { type: "number", minimum: 18 },
  },
  required: ["username"],
};

const result = validator.validate(schema, {
  username: "ts",
  age: 16,
});

if (!result.valid) {
  console.log(result.errors.map((err) => validator.formatError(err)));
  // Output: ["must NOT have fewer than 3 characters", "must be greater than or equal to 18"]
}
```

### Complex Logic Validation (if/then/else)

```typescript
const schema = {
  type: "object",
  properties: {
    isMember: { type: "boolean" },
    membershipNumber: { type: "string" },
  },
  if: {
    properties: { isMember: { const: true } },
  },
  then: {
    required: ["membershipNumber"],
  },
};

// When isMember is true, membershipNumber becomes a required field.
```

## UI Generation

### React (@schema-ts/react)

The React package provides a highly flexible `Form` component, supporting nested objects and arrays.

```tsx
import { Form } from "@schema-ts/react";

const schema = {
  type: "object",
  properties: {
    email: { type: "string", format: "email", title: "Email" },
    password: { type: "string", title: "Password" },
  },
};

function App() {
  return (
    <Form
      schema={schema}
      onChange={(data) => console.log("Form Data:", data)}
    />
  );
}
```

### Vue 3 (@schema-ts/vue)

The Vue package provides an out-of-the-box `Form` component.

```vue
<template>
  <Form :schema="schema" @change="handleChange" />
</template>

<script setup>
import { Form } from "@schema-ts/vue";

const schema = {
  type: "object",
  properties: {
    username: { type: "string", minLength: 3, title: "Username" },
    age: { type: "number", minimum: 18, title: "Age" },
  },
};

const handleChange = (data) => {
  console.log("Form Data:", data);
};
</script>
```

## Project Structure

- `packages/core`: Core validation engine, supporting JSON Schema 2020-12.
- `packages/react`: React integration library, providing `Form` component and Hooks.
- `packages/vue`: Vue 3 integration library, under construction.
- `packages/playground`: Online demo system, built with Vite + React.

## License

MIT
