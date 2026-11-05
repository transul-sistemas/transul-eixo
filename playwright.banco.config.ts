import { defineConfig, devices } from "@playwright/test";
import { sessaoDe, supabaseLocal } from "./e2e/apoio/usuarios-de-teste";

// O e2e PEQUENO do modo banco (fatia 3.9a): lista, painel, ficha, perfil sem vínculo e o escopo por
// carteira e por filial, lendo do Supabase local com os dados de desenvolvimento (`pnpm db:dev-dados`)
// e a sessão de cada perfil. Roda só no CI do pull request (job modo-banco); o e2e de sempre continua
// no modo exemplo (playwright.config.ts).
const PORTA = process.env.PORTA ?? "3000";
const ENDERECO = `http://localhost:${PORTA}`;
const SUPABASE = supabaseLocal();

export default defineConfig({
  testDir: "./e2e-banco",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: ENDERECO,
    trace: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    // O mesmo preparo do e2e de sempre: um usuário de cada perfil, ligado às pessoas que o gerador
    // de dados já criou (o gestor e o Operacional do e2e, pelo CPF).
    {
      name: "preparar",
      testDir: "./e2e",
      testMatch: /preparar\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "preparar-banco",
      testMatch: /preparar-banco\.setup\.ts/,
      dependencies: ["preparar"],
    },
    {
      name: "banco-1366",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 768 },
        storageState: sessaoDe("administrador"),
      },
      testIgnore: /\.setup\.ts$/,
      dependencies: ["preparar-banco"],
    },
  ],
  webServer: {
    command: process.env.CI ? `pnpm start -p ${PORTA}` : `pnpm dev -p ${PORTA}`,
    url: ENDERECO,
    reuseExistingServer: !process.env.CI,
    env: {
      EIXO_DADOS: "banco",
      EIXO_TESTES: "1",
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: SUPABASE.chavePublicavel,
    },
    timeout: 180_000,
  },
});
