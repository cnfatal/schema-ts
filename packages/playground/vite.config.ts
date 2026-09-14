import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
/// <reference types="vitest" />

export default defineConfig({
  base: "/schema-ts/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@schema-ts/core": path.resolve(__dirname, "../core/src/index.ts"),
      "@schema-ts/react": path.resolve(__dirname, "../react/src/index.ts"),
    },
  },
  server: {
    port: 3000,
  },
});
