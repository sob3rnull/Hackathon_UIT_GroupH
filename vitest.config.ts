import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // Vitest resolves `server-only` to its client-guard entry, which throws
      // on import. Tests run in node, which is the environment the guard is
      // meant to permit, so point it at a no-op instead.
      "server-only": path.resolve(import.meta.dirname, "./src/test/server-only-stub.ts"),
    },
  },
});
