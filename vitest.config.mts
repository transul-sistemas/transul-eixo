import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // Nos testes não há o ambiente react-server do Next: o "server-only" vira o módulo vazio do pacote.
      "server-only": fileURLToPath(new URL("node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Os testes do lint carregam a configuração do ESLint, lenta na primeira chamada.
    testTimeout: 30_000,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**", ".agents/**", ".claude/**", "e2e/**"],
  },
});
