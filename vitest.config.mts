import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    // Os testes do lint carregam a configuração do ESLint, lenta na primeira chamada.
    testTimeout: 30_000,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**", ".agents/**", ".claude/**", "e2e/**"],
  },
});
