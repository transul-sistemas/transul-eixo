# Registro de decisões

Cada decisão que muda o rumo do projeto entra aqui, uma por bloco, da mais recente para a mais antiga.

Modelo de entrada:

- **Data** · **Decisão** · **Motivo** · **Alternativas descartadas** · **Quem decidiu**

---

## 29/10/2026 — Lint de hexadecimal também em texto maior (limite conhecido)

- **Decisão:** o ESLint barra hex como texto inteiro e também embutido: depois de `[`, `(`, `:` ou `,` (`bg-[#FF7A3D]`, `color:#fff`, `gradient(#fff)`), ou depois de espaço quando tem letra de a a f (`1px solid #fff`).
- **Motivo:** o padrão só para texto inteiro deixava passar valores arbitrários do Tailwind, o jeito mais provável de quebrar a regra inviolável 6. Achado do code review da Fase 1.
- **Limite conhecido:** hex só com dígitos depois de espaço (`1px solid #000`) passa, para não barrar textos como "Pedido #1234". Esses casos precisam ser pegos em revisão.
- **Quem decidiu:** confirmado por Alexandre.

## 29/10/2026 — Ícones e fonte provisórios na Fase 1 (lucide e Geist), Tabler e Barlow na Fase 2

- **Decisão:** o esqueleto da Fase 1 mantém o padrão do shadcn e do `create-next-app`: ícones **lucide** (`components.json`) e fonte **Geist** (`app/layout.tsx`). A Fase 2 troca para **Tabler** (ícones) e **Barlow** (fonte), como pede o `CLAUDE.md`, junto com os tokens do Eixo.
- **Motivo:** a Fase 1 não define identidade visual; trocar agora seria trabalho jogado fora.
- **Quem decidiu:** Alexandre.
- **Observação:** o 2FA (MFA) do Supabase Auth e o cache dos navegadores do Playwright no CI também ficam para a Fase 2.

## 29/10/2026 — Repositório do GitHub deve ser criado como privado

- **Decisão:** o repositório `transul-eixo` na organização `transul-sistemas` é criado como **privado**.
- **Motivo:** arquivos versionados (`CLAUDE.md`, `docs/`) citam o identificador do projeto da v1 e, no futuro, terão dados da empresa.
- **Alternativas descartadas:** repositório público.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Validação do workflow só no primeiro pull request

- **Decisão:** `.github/workflows/pull-request.yml` não é validado localmente com validador externo (`pnpm dlx @action-validator/cli`). A validação acontece no primeiro pull request.
- **Motivo:** o validador baixaria e executaria um pacote externo na máquina; o risco não compensa para um arquivo de 53 linhas.
- **Alternativas descartadas:** liberar o validador externo.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Supabase só local, sem nuvem e sem o projeto da v1

- **Decisão:**
  - o Supabase local roda só no Docker;
  - são proibidos `supabase link`, `supabase login`, `supabase db push` e qualquer comando que fale com um projeto na nuvem;
  - são proibidas as ferramentas MCP do Supabase (`list_projects`, `execute_sql`, `apply_migration` etc.) sem pedido explícito de Alexandre;
  - o projeto da v1 (`oubrtcgtugeijbrxvblc`) nunca é usado, nem para leitura;
  - o `link` com o `eixo-prod` é feito por Alexandre, em outro momento.
- **Motivo:** a Fase 1 é toda local; evitar qualquer escrita ou leitura acidental em banco de produção ou no da v1.
- **Alternativas descartadas:** liberar leitura da v1 pelo MCP; deixar o `link` para o assistente.
- **Quem decidiu:** Alexandre.
- **Observação:** o job `banco` do pull request usa `supabase start` no runner, sem token, `link` nem segredo.

## 29/10/2026 — Cor hexadecimal barrada em todo CSS, exceto no arquivo de tokens

- **Decisão:** o Stylelint (`color-no-hex`) barra cor hexadecimal em qualquer arquivo `.css`. A única exceção é **`app/tokens.css`**, o arquivo de tokens que será criado na Fase 2. O ESLint barra hexadecimal em TS/TSX/JS fora de `components/formato/`.
- **Motivo:** regra inviolável 6 do CLAUDE.md: o padrão visual é garantido pela ferramenta. O ESLint não enxerga CSS, então o Stylelint fecha essa brecha.
- **Alternativas descartadas:** deixar o CSS sem verificação; liberar também `app/globals.css`.
- **Quem decidiu:** Alexandre.
- **Observação:** até a Fase 2 não existe `app/tokens.css`; o teste em `lib/qualidade/regras-lint.test.ts` já garante a exceção só para esse caminho.

## 29/10/2026 — Node 24 LTS em vez do 22

- **Decisão:** o projeto usa o Node 24 LTS já instalado, sem `nvm`. `engines` do `package.json`: `>=24 <25`. pnpm ativado por `corepack enable pnpm`.
- **Motivo:** evitar manter duas versões na máquina; o 24 é LTS.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Skills versionadas como links simbólicos relativos

- **Decisão:** `.agents/skills/` é a fonte; `.claude/skills/<nome>` são links simbólicos relativos (`../../.agents/skills/<nome>`), com `core.symlinks=true` no repositório e Modo de Desenvolvedor ligado no Windows.
- **Motivo:** os links originais eram junções com caminho absoluto da máquina e quebrariam no Git e no CI.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Verificador do Supabase no pull request

- **Decisão:** `supabase db lint --fail-on warning` mais testes pgTAP (`supabase test db`). Os advisors da nuvem entram quando existir o projeto `eixo-prod`.
- **Motivo:** advisors não rodam em banco local.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Supabase CLI como dependência do projeto

- **Decisão:** `supabase` entra como devDependency e roda com `pnpm exec supabase`; nada instalado globalmente.
- **Motivo:** mesma versão na máquina e no CI.
