# Schema-TS AI Guide

## Overview

TypeScript monorepo(pnpm workspace) for schema validation and UI generation.

- `@schema-ts/core`: Schema runtime, dynamic resolution (if/then/else), and dependency tracking.
  - `SchemaRuntime` manages state;
  - `FieldNode` is the stable reference for UI components.

- `@schema-ts/react`: React hooks for form generation.
  - `Form.tsx`: Main form component.
  - `FormField` component for rendering fields.
  - `SimpleFieldRenderer.tsx`: Field rendering logic.

- `@schema-ts/vue`: Vue components for form generation.
- `@schema-ts/playground`: React UI Render example for testing schemas and forms based on `schema-ts/react`.

## Commands

- `pnpm build`: Build all.
- `pnpm typecheck`: Check types.
- `pnpm test`: Run Vitest (`*.test.ts`).
- `pnpm dev`: Watch mode.

## Conventions

- **Language**: English only for comments/commits.
- **Compatibility**: No backward compatibility (active development).
- **Refactoring**: Extract independent logic into standalone functions.
- **Note**: Rebuild dependent packages after core changes.
