# Schema-TS AI Coding Guide

## Project Overview

TypeScript monorepo for type-safe schema validation and UI form generation.

- `@schema-ts/core`: Validation engine & interface definitions.
- `@schema-ts/react` / `@schema-ts/vue`: UI rendering and state management.

## Workflows

- `pnpm build`: Build all packages.
- `pnpm typecheck`: Check types.
- `pnpm test`: Run Vitest (tests are `*.test.ts` next to source).
- `pnpm dev`: Watch mode.

## Code Conventions

- **Human Language**: Write comments and commit messages in English only.
- **Compability**: Never consider backward compatibility, as all packages are in active development.
- **TypeScript**: Use `import type` for type-only imports (`verbatimModuleSyntax`).
- **Imports**: Use package names (e.g., `@schema-ts/core`), not relative paths between packages.
- **React**: Use `useState`/`useCallback`. Clear field errors on value change.
- **Vue**: Use `reactive`/`ref`. Mutate reactive objects directly in `handleChange`.
- **Errors**: Always propagate error paths via `[key, ...err.path]`.

## Adding Features

- **New Schema**: Implement `Schema` in `core/src/index.ts`, add factory to `SchemaValidator`, and test in `core/src/index.test.ts`.
- **Form UI**:
  - React: Update components using `useForm`.
  - Vue: Update `Form.vue` template.
  - Both switch on `field.schema.type`.
- Vue reactive objects cannot be reassigned - use `Object.assign(values, newValues)`
- When making changes to packages in development, dependent packages may need rebuilding
