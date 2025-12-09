import pluginVue from "eslint-plugin-vue";
import { defineConfig } from "eslint/config";
import { parser } from "typescript-eslint";

import baseConfig from "../../eslint.config";

export default defineConfig(
  {
    ignores: ["dist", "node_modules", "coverage"],
  },
  ...baseConfig,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser,
      },
    },
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
);
