import { defineConfig, devices } from "@playwright/test";

// Telas de referência do CLAUDE.md: 1366 × 768 (padrão) e 1920 de largura. Tablet (820) e celular
// (390) só rodam o e2e/casca.spec.ts, que testa a gaveta, o contexto recolhido e o aviso.
const SO_DA_CASCA = /casca\.spec\.ts/;
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
      testIgnore: SO_DA_CASCA,
    },
    {
      name: "tela-1920",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } },
      testIgnore: SO_DA_CASCA,
    },
    {
      name: "tablet-820",
      use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true },
      testMatch: SO_DA_CASCA,
    },
    {
      name: "celular-390",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
      testMatch: SO_DA_CASCA,
    },
  ],
  webServer: {
    // No CI o passo anterior do workflow já rodou o build.
    command: process.env.CI ? `pnpm start -p ${PORTA}` : `pnpm dev -p ${PORTA}`,
    url: ENDERECO,
    reuseExistingServer: !process.env.CI,
    // Os testes de tela usam os dados de exemplo (lib/exemplo/).
    // E sem o indicador "N" do Next em desenvolvimento, que cobre botões no celular emulado.
    env: { EIXO_DADOS: "exemplo", EIXO_TESTES: "1" },
    timeout: 180_000,
  },
});
