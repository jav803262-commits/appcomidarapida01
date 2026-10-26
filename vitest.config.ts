import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // tsconfig usa jsx: "preserve" (lo transforma Next); en las pruebas lo transforma esbuild.
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node", // las pruebas de componentes usan `// @vitest-environment jsdom`
    setupFiles: ["tests/setup.ts"],
  },
});
