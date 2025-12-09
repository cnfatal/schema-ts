import js from "@eslint/js";
import configPrettier from "eslint-config-prettier";
import pluginImport from "eslint-plugin-import";
import pluginPrettier from "eslint-plugin-prettier";
import { defineConfig } from "eslint/config";
import globals from "globals";
import { configs as tsConfigs } from "typescript-eslint";

export default defineConfig(
  // 1. Global Ignores
  {
    ignores: ["**/dist", "**/node_modules", "**/coverage", "pnpm-lock.yaml"],
  },

  // 2. Base Configuration (JS, TS, Perfectionist)
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
  },
  js.configs.recommended,
  ...tsConfigs.recommended,

  // 3. Import Plugin Configuration
  pluginImport.flatConfigs.recommended,
  pluginImport.flatConfigs.typescript,

  // 4. Global Settings & Language Options
  {
    languageOptions: {
      ecmaVersion: "latest",
      globals: { ...globals.browser, ...globals.node },
      sourceType: "module",
    },
    settings: {
      "import/resolver": {
        node: true,
        typescript: true,
      },
    },
  },

  // 5. Custom Rules
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: {
      prettier: pluginPrettier,
    },
    rules: {
      // TypeScript Rules Adjustments
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/prefer-as-const": "error",
      // Import Rules
      "import/no-duplicates": "error",
      "import/order": "error",
      // Code Quality
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-duplicate-imports": "error",
      "object-shorthand": ["error", "always"],
      "prefer-const": "error",
      // Prettier Integration (Runs as ESLint rules)
      "prettier/prettier": "error",
    },
  },

  // 6. Disable Type Checking for JS Files
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...tsConfigs.disableTypeChecked,
  },

  // 7. Relax Rules for Test Files
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // 8. Prettier Configuration (Must be last to override conflicting formatting rules)
  configPrettier,
);
