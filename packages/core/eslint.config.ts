import { defineConfig } from "eslint/config";
import baseConfig from "../../eslint.config";

export default defineConfig(
  {
    ignores: ["dist", "node_modules", "coverage"],
  },
  ...baseConfig,
);
