import { defineConfig, devices } from "@playwright/test";

// Telas de referência do CLAUDE.md: 1366 × 768 (padrão) e 1920 de largura.
// PORTA troca a porta dos testes (padrão 3000), para não colidir com um `pnpm dev` aberto.
const PORTA = process.env.PORTA ?? "3000";
const ENDERECO = `http://localhost:${PORTA}`;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: ENDERECO, trace: "retain-on-failure" },
  projects: [
    {
      name: "tela-1366",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
    },
    {
      name: "tela-1920",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } },
    },
  ],
  webServer: {
    // No CI o passo anterior do workflow já rodou o build.
    command: process.env.CI ? `pnpm start -p ${PORTA}` : `pnpm dev -p ${PORTA}`,
    url: ENDERECO,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
