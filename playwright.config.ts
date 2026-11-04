import { defineConfig, devices } from "@playwright/test";
import { sessaoDe, supabaseLocal } from "./e2e/apoio/usuarios-de-teste";

// Telas de referência do CLAUDE.md: 1366 × 768 (padrão) e 1920 de largura. Tablet (820) e celular
// (390) só rodam o e2e/casca.spec.ts, que testa a gaveta, o contexto recolhido e o aviso.
const SO_DA_CASCA = /casca\.spec\.ts/;
// PORTA troca a porta dos testes (padrão 3000), para não colidir com um `pnpm dev` aberto.
const PORTA = process.env.PORTA ?? "3000";
const ENDERECO = `http://localhost:${PORTA}`;
// O login (fatia 3.8): o projeto "preparar" cria os usuários de teste no Supabase local e guarda a
// sessão de cada perfil; os testes de tela entram como Administrador. O servidor recebe só o endereço
// e a chave publicável do Supabase local (a chave secreta fica no preparo, nunca no app).
const SUPABASE = supabaseLocal();
const COMO_ADMINISTRADOR = { storageState: sessaoDe("administrador") };
const PREPARAR = /preparar\.setup\.ts/;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: ENDERECO, trace: "retain-on-failure" },
  projects: [
    { name: "preparar", testMatch: PREPARAR, use: { ...devices["Desktop Chrome"] } },
    {
      name: "tela-1366",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 768 },
        ...COMO_ADMINISTRADOR,
      },
      testIgnore: [SO_DA_CASCA, PREPARAR],
      dependencies: ["preparar"],
    },
    {
      name: "tela-1920",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        ...COMO_ADMINISTRADOR,
      },
      testIgnore: [SO_DA_CASCA, PREPARAR],
      dependencies: ["preparar"],
    },
    {
      name: "tablet-820",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 820, height: 1180 },
        hasTouch: true,
        ...COMO_ADMINISTRADOR,
      },
      testMatch: SO_DA_CASCA,
      dependencies: ["preparar"],
    },
    {
      name: "celular-390",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, ...COMO_ADMINISTRADOR },
      testMatch: SO_DA_CASCA,
      dependencies: ["preparar"],
    },
  ],
  webServer: {
    // No CI o passo anterior do workflow já rodou o build.
    command: process.env.CI ? `pnpm start -p ${PORTA}` : `pnpm dev -p ${PORTA}`,
    url: ENDERECO,
    reuseExistingServer: !process.env.CI,
    // Os testes de tela usam os dados de exemplo (lib/exemplo/).
    // E sem o indicador "N" do Next em desenvolvimento, que cobre botões no celular emulado.
    env: {
      EIXO_DADOS: "exemplo",
      EIXO_TESTES: "1",
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: SUPABASE.chavePublicavel,
    },
    timeout: 180_000,
  },
});
