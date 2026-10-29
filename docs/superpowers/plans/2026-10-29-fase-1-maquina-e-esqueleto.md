# TranSul Eixo — Fase 1 (máquina e esqueleto) — Plano de implementação

> **Para quem executa:** use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. Os passos usam caixas `- [ ]`. **Pare em cada checkpoint (A a E) e peça aprovação.**

**Objetivo:** deixar a máquina pronta e entregar um esqueleto Next.js com qualidade automática, Supabase local e pipeline de pull request, publicando só uma página "TranSul Eixo".

**Arquitetura:** projeto Next.js (App Router, TS estrito, pnpm) na raiz da pasta, com as pastas do CLAUDE.md. Regras de formatação barradas por ESLint (`no-restricted-syntax`) com exceção só em `components/formato/`. Supabase local com uma migração que cria só os 9 schemas. Um workflow de PR com duas frentes: app (lint, tipos, testes, build, Playwright) e banco (lint do Supabase, pgTAP).

**Stack:** Next.js, TypeScript estrito, pnpm, Tailwind, shadcn/ui, ESLint, Prettier, Vitest, Playwright, Supabase CLI (como devDependency, `pnpm exec supabase`), GitHub Actions.

**Spec:** `docs/projeto-tecnico.md` (seções Máquina de desenvolvimento, Repositório, Arquitetura, Roteiro — Fase 1) e `CLAUDE.md`.

## Restrições globais

- Node 24 (LTS), pnpm, TypeScript `strict: true`.
- Nenhuma credencial em arquivo, commit, log ou conversa. `.env.local` fora do Git; `.env.example` só com nomes, sem valores.
- Nunca conectar ao Supabase da v1 (`oubrtcgtugeijbrxvblc`). Nesta fase nenhum comando toca a nuvem: tudo local.
- Nada de cor hexadecimal, `toLocaleString` ou `Intl.NumberFormat` fora de `components/formato/`.
- Tokens finais (cores, Barlow, placa) **não** entram: ficam para a Fase 2. Tailwind/shadcn só com o padrão neutro.
- Nomes de pastas, tabelas e textos de tela em português. Textos da interface: frases com minúscula normal.
- Uma branch por entrega: `fase-1-esqueleto`. Nada na `main` sem PR.
- Schemas do banco: `nucleo`, `operacional`, `pessoas`, `rh_clinico`, `parceiros`, `financeiro`, `sync`, `config`, `auditoria`. Sem tabelas.
- Telas de referência dos testes: 1366×768 e 1920×1080.

## Foco de revisão

1. Hex em template literal e em maiúscula (`` `#FF7A3D` ``, `"#fff"`) deve ser barrado; texto comum com `#` (ex.: `"Item #12"`) não.
2. `toLocaleString` por encadeamento opcional (`x?.toLocaleString()`) e `new Intl.NumberFormat`/`Intl.NumberFormat()` devem ser barrados; a exceção vale só para `components/formato/**`, não para `components/formato-x/`.
3. `.gitignore` deve ignorar `.env.local` e `.env.*.local` sem ignorar `.env.example`.
4. `.claude/skills/*` hoje são links simbólicos com caminho absoluto da sua máquina: no Git/CI viram arquivos quebrados. Decidir no checkpoint A.
5. A página não pode ter rolagem horizontal em 1366 nem em 1920.

---

## Checkpoint A — Ambiente (resultado já medido, só leitura)

| Item | Situação em 29/10/2026 |
| --- | --- |
| OneDrive | **Pasta não sincronizada.** Documentos aponta para `C:\Users\ALEXANDRE\Documents` (não `OneDrive\Documents`), o processo do OneDrive não está rodando e a pasta não tem atributo de nuvem. Pode seguir. |
| Node 24 LTS | OK: v24.16.0 (decisão de 29/10: 24 em vez de 22; sem nvm). |
| pnpm | **Falta.** |
| Git | OK (2.55.0). A pasta ainda **não é** repositório. |
| Docker Desktop | **Falta** (sem ele não há `supabase start`, nem pgTAP local). |
| Supabase CLI | **Falta** global; plano usa como devDependency (`pnpm exec supabase`), sem instalar nada global. |
| Python 3.12 | **Falta**: instalado 3.14.0 (o `py` não acha 3.12). Só necessário na fase 6; pode ficar para depois. |
| GitHub CLI | OK (2.100.0), logado como `alexandre652` (conta pessoal). A organização `transul-sistemas` e o repositório `transul-eixo` não foram verificados. |

**Você instala (eu não instalo nada sozinho):** pnpm (`corepack enable pnpm`, exige terminal de administrador); Docker Desktop (com WSL2); opcional agora: Python 3.12.

- [ ] Você confirma as instalações; eu repito só a verificação de versões.
- [ ] **Decisão sobre os links simbólicos das skills** (item 4 do foco). Recomendação: manter `.agents/skills/` como fonte versionada e trocar os links de `.claude/skills/` por links relativos (`../../.agents/skills/<nome>`), com `git config core.symlinks true` e Modo de Desenvolvedor do Windows ligado; o CI não precisa das skills.

**PARE: aguardar aprovação.**

---

## Tarefa 1: Repositório, .gitignore e .env.example

**Arquivos:**
- Criar: `.gitignore`, `.gitattributes`, `.env.example`, `.nvmrc`
- Já existem e entram no versionamento: `.agents/`, `.claude/skills/`, `skills-lock.json`, `CLAUDE.md`, `docs/`

**Produz:** repositório Git com branch `main` (commit inicial) e branch `fase-1-esqueleto`.

- [ ] **Passo 1:** `git init -b main`; configurar `core.autocrlf false` no repositório e criar `.gitattributes` com `* text=auto eol=lf`.
- [ ] **Passo 2:** `.gitignore` com: `node_modules/`, `.next/`, `out/`, `coverage/`, `playwright-report/`, `test-results/`, `.env`, `.env.local`, `.env.*.local`, `supabase/.temp/`, `supabase/.branches/`, `*.tsbuildinfo`, `next-env.d.ts`, `.vercel/`, `__pycache__/`, `.venv/`, `importacao/dados/`. **Não** ignorar `.agents/`, `.claude/skills/`, `skills-lock.json`.
- [ ] **Passo 3:** `.env.example` com só os nomes (linhas `NOME=` vazias): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (comentário: só workers). `.nvmrc` com `24`.
- [ ] **Passo 4 (verificação):** `git check-ignore -v .env.local` mostra a regra; `git check-ignore .env.example` não imprime nada; `git status --short` lista `.agents`, `.claude`, `skills-lock.json`.
- [ ] **Passo 5:** aplicar a decisão dos links simbólicos; verificar com `git ls-files -s .claude/skills | head` (modo `120000` e caminho relativo).
- [ ] **Passo 6:** `git add -A` e commit na `main`: `chore: estado inicial (CLAUDE.md, docs, skills)`; depois `git switch -c fase-1-esqueleto`.

---

## Tarefa 2: Next.js, estrutura de pastas e Tailwind + shadcn

**Arquivos:**
- Criar: `package.json` (com `"engines": {"node": ">=24 <25"}`, `"packageManager"`), `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/globals.css`, `components.json`, `lib/utils.ts`
- Criar pastas com `.gitkeep`: `app/{inicio,frota,operacional,operacoes,pessoas,parceiros,resultados,cadastros,admin}/`, `components/formato/`, `lib/dominio/`, `lib/dados/`, `workers/`, `importacao/`

- [ ] **Passo 1:** gerar com `pnpm create next-app` numa pasta temporária no scratchpad (TypeScript, ESLint, Tailwind, App Router, **sem** `src/`, alias `@/*`, pnpm) e copiar para a raiz, sem sobrescrever `CLAUDE.md` e `docs/`.
- [ ] **Passo 2:** em `tsconfig.json` confirmar `"strict": true` e acrescentar `"noUncheckedIndexedAccess": true`.
- [ ] **Passo 3:** `pnpm dlx shadcn@latest init` com base neutra, **sem** tema personalizado; adicionar só `button` para provar a configuração. Não escrever cor nem fonte à mão (a Fase 2 define os tokens).
- [ ] **Passo 4:** criar as pastas da lista acima com `.gitkeep`.
- [ ] **Passo 5 (verificação):** `pnpm exec tsc --noEmit` sem erros; `pnpm build` termina com sucesso; `node --version` mostra v24.
- [ ] **Passo 6:** commit `feat: esqueleto Next.js com Tailwind e shadcn`.

**Checkpoint B — PARE:** mostrar árvore de pastas, `package.json` e resultado do build. Aguardar aprovação.

---

## Tarefa 3: ESLint (regras de formatação), Prettier e Vitest

**Arquivos:**
- Criar/alterar: `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`
- Teste: `lib/qualidade/regras-lint.test.ts`, fixtures em `lib/qualidade/fixtures/` (excluídas do lint com `ignores`)

**Interfaces:**
- Produz: scripts `pnpm lint`, `pnpm lint:fix`, `pnpm format`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.
- Teste usa a API `ESLint` do Node com `overrideConfigFile` e `lintText(code, { filePath })`.

- [ ] **Passo 1: escrever os testes que falham** em `regras-lint.test.ts`, função auxiliar `lintar(codigo: string, caminho: string): Promise<string[]>` devolvendo as mensagens. Casos (caminho `app/teste.tsx`, salvo indicação):
  - `const c = "#FF7A3D"` → 1 erro; `const c = "#fff"` → 1 erro; `` const c = `#3D5AFE` `` → 1 erro
  - `const t = "Item #12"` → 0 erros
  - `n.toLocaleString("pt-BR")` → 1 erro; `n?.toLocaleString()` → 1 erro
  - `new Intl.NumberFormat("pt-BR")` → 1 erro; `Intl.NumberFormat("pt-BR")` → 1 erro
  - os três casos acima de formato, com caminho `components/formato/moeda.ts` → 0 erros
  - `toLocaleString` com caminho `components/formato-x/moeda.ts` → 1 erro
- [ ] **Passo 2:** `pnpm test` e confirmar que falha (regras ainda não existem).
- [ ] **Passo 3:** em `eslint.config.mjs`, `no-restricted-syntax` como erro com seletores: `Literal[value=/^#[0-9a-fA-F]{3,8}$/]`, `TemplateElement[value.raw=/^#[0-9a-fA-F]{3,8}$/]`, `CallExpression[callee.property.name='toLocaleString']`, `MemberExpression[property.name='NumberFormat'][object.name='Intl']`; mensagens em português dizendo onde formatar (ex.: "Use o componente de moeda em components/formato/"). Bloco de override `files: ["components/formato/**"]` desliga a regra. Hex só nos arquivos TS/TSX/JS; CSS fica fora do alcance do ESLint (registrar isso em `docs/decisoes.md`, tarefa 6).
- [ ] **Passo 4:** `.prettierrc.json` com `semi: true`, `singleQuote: false`, `trailingComma: "all"`, `printWidth: 100`; plugin `prettier-plugin-tailwindcss`; `eslint-config-prettier` por último na config do ESLint.
- [ ] **Passo 5:** `vitest.config.ts` com ambiente `node`, alias `@`, `include: ["**/*.test.ts", "**/*.test.tsx"]`, excluindo `e2e/`.
- [ ] **Passo 6 (verificação):** `pnpm test` verde; `pnpm lint` e `pnpm format:check` sem erros.
- [ ] **Passo 7:** commit `feat: lint de formatação, prettier e vitest`.

---

## Tarefa 4: Página inicial e Playwright em 1366 e 1920

**Arquivos:**
- Alterar: `app/page.tsx`, `app/layout.tsx` (título "TranSul Eixo", `lang="pt-BR"`)
- Criar: `playwright.config.ts`, `e2e/inicio.spec.ts`

**Interfaces:**
- `playwright.config.ts`: dois projetos, `tela-1366` (viewport 1366×768) e `tela-1920` (1920×1080), Chromium; `webServer` roda `pnpm build && pnpm start` quando `CI` está definido e `pnpm dev` no resto; `baseURL` `http://localhost:3000`.

- [ ] **Passo 1: teste que falha** em `e2e/inicio.spec.ts`: (a) `getByRole("heading", { name: "TranSul Eixo" })` visível; (b) `document.documentElement.scrollWidth <= window.innerWidth`; (c) título da aba contém "TranSul Eixo".
- [ ] **Passo 2:** `pnpm exec playwright install chromium` (você aprova o download) e `pnpm test:e2e`; esperado: FALHA.
- [ ] **Passo 3:** `app/page.tsx` com um `<h1>` "TranSul Eixo" e uma linha de apoio ("sistema de gestão para a TranSul"); sem cor, fonte ou tamanho escritos à mão além das classes padrão do Tailwind.
- [ ] **Passo 4 (verificação):** `pnpm test:e2e` verde nos dois projetos (6 testes).
- [ ] **Passo 5:** commit `feat: página inicial e testes de tela em 1366 e 1920`.

**Checkpoint C — PARE:** mostrar saída de lint, tipos, testes, Playwright e a página no navegador. Aguardar aprovação.

---

## Tarefa 5: Supabase local e migração dos schemas

**Arquivos:**
- Criar: `supabase/config.toml` (via `pnpm exec supabase init`), `supabase/migrations/<timestamp>_criar_schemas_das_areas.sql`, `supabase/tests/schemas.test.sql`

**Pré-requisito:** Docker Desktop rodando (checkpoint A).

- [ ] **Passo 1:** `pnpm add -D supabase`; `pnpm exec supabase init` (responder **não** para as configurações de VS Code/IntelliJ se perguntar). Não executar `supabase login`, `link` nem `db push`.
- [ ] **Passo 2: teste pgTAP que falha** em `supabase/tests/schemas.test.sql`: `plan(10)`; para cada um dos 9 schemas `has_schema('<nome>')`; e uma checagem de que nenhum deles contém tabelas (`is((select count(*) from information_schema.tables where table_schema = any(array[...9 nomes...])), 0::bigint, 'nenhuma tabela nos schemas das áreas')`).
- [ ] **Passo 3:** `pnpm exec supabase start` e `pnpm exec supabase test db`; esperado: FALHA nos 9 `has_schema`.
- [ ] **Passo 4:** migração com `create schema if not exists <nome>;` para os 9 schemas, uma linha cada, e comentário do que cada área guarda (de `docs/projeto-tecnico.md`). Sem tabelas, sem `grant` (permissões entram na Fase 3).
- [ ] **Passo 5 (verificação):** `pnpm exec supabase db reset` aplica sem erro (e pode rodar duas vezes); `pnpm exec supabase test db` verde (10 asserções); `pnpm exec supabase db lint --fail-on warning` sem alertas.
- [ ] **Passo 6:** `pnpm exec supabase stop`; commit `feat: supabase local com os schemas das áreas`.

**Checkpoint D — PARE:** mostrar migração e saídas. Observação para você: os "advisors" da nuvem não rodam em banco local; o equivalente no pull request é `supabase db lint`. Quando existir o `eixo-prod`, os advisors entram como conferência manual antes do merge.

---

## Tarefa 6: Pipeline de pull request e documentos

**Arquivos:**
- Criar: `.github/workflows/pull-request.yml`, `docs/glossario.md`, `docs/decisoes.md`

- [ ] **Passo 1:** `docs/glossario.md`: título, uma frase de regra ("cada métrica tem uma única definição"), e a estrutura de entrada (modelo vazio: Nome · Definição · Fórmula · Fonte · Onde aparece · Responsável · Data da decisão). Sem métricas.
- [ ] **Passo 2:** `docs/decisoes.md`: estrutura (modelo: Data · Decisão · Motivo · Alternativas · Quem decidiu) e as primeiras entradas reais já tomadas na Fase 1: Supabase CLI como devDependency; lint de hex não cobre CSS; links relativos das skills; `supabase db lint` como verificador local/CI.
- [ ] **Passo 3:** workflow disparado em `pull_request` para `main`, `permissions: contents: read`, `concurrency` cancelando execuções antigas. Duas jobs:
  - `app`: checkout, `pnpm/action-setup`, `actions/setup-node` com Node 24 e cache pnpm, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, instalar Chromium, `pnpm test:e2e`; subir `playwright-report/` como artefato em falha.
  - `banco`: checkout, `supabase/setup-cli`, `supabase start`, `supabase db lint --fail-on warning`, `supabase test db`.
  - Ações fixadas por versão principal (ex.: `actions/checkout@v4`); nenhum segredo; variáveis do app em build recebem valores vazios/fictícios locais do CI.
- [ ] **Passo 4 (verificação local):** `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e` e validar o YAML (`pnpm dlx @action-validator/cli .github/workflows/pull-request.yml`).
- [ ] **Passo 5:** commit `ci: pipeline de pull request e documentos base`.

---

## Tarefa 7: Verificação final e o que falta para publicar

- [ ] **Passo 1:** usar `verification-before-completion`: rodar todos os comandos da tarefa 6 passo 4 mais `supabase test db`, e colar a saída resumida no relatório.
- [ ] **Passo 2:** varredura de segredos: `git grep -nEi "(service_role|eyJ[A-Za-z0-9_-]{20,}|oubrtcgtugeijbrxvblc)"` — o único resultado aceitável é o nome `SUPABASE_SERVICE_ROLE_KEY` no `.env.example` e a menção ao identificador proibido em `CLAUDE.md`/`docs/`.
- [ ] **Passo 3:** relatório do que falta para publicar: (a) repositório `transul-eixo` privado na organização (hoje o `gh` está logado como conta pessoal `alexandre652`); (b) proteger a `main` (PR obrigatório, checks `app` e `banco`); (c) projeto `eixo` na Vercel ligado ao repositório, com Node 24; (d) projeto `eixo-prod` no Supabase (Fase 0). Nada disso é criado por mim sem sua ordem.
- [ ] **Passo 4:** usar `requesting-code-review` e `finishing-a-development-branch` (PR local, sem push).

**Checkpoint E — PARE:** entrega final, aguardar aprovação para push/PR.

---

## Revisão do plano contra a especificação

Cobertura dos 9 itens do pedido: 1 → checkpoint A; 2 → tarefa 2; 3 → tarefa 2; 4 → tarefas 3 e 4; 5 → tarefa 5; 6 → tarefa 1; 7 → tarefa 6; 8 → tarefa 4; 9 → tarefa 6. Linhas do foco de revisão: 1 e 2 → tarefa 3 passo 1; 3 → tarefa 1 passo 4; 4 → checkpoint A e tarefa 1 passo 5; 5 → tarefa 4 passo 1(b).
