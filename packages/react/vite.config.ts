import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@schema-ts/core": path.resolve(__dirname, "../core/src/index.ts"),
    },
  },
});
