# Registro de decisões

Cada decisão que muda o rumo do projeto entra aqui, uma por bloco, da mais recente para a mais antiga.

Modelo de entrada:

- **Data** · **Decisão** · **Motivo** · **Alternativas descartadas** · **Quem decidiu**

---

## 29/10/2026 — Logo da TranSul em PNG provisório; pedir o SVG oficial à agência

- **Decisão:** o logo oficial horizontal da TranSul (preto, PNG com fundo transparente, 1854 × 653) entra em `public/marca/transul-horizontal-preto.png` como **provisório**. O arquivo só é usado por um componente, `components/marca/assinatura-transul.tsx`, que serve à assinatura "para TranSul" e ao símbolo dentro do logotipo do Eixo. Quando o SVG oficial chegar, a troca mexe só nesse componente e em `app/icon.svg`. O SVG vetorial oficial **deve ser pedido à agência** (pendência).
- **Motivo:** PNG não escala bem e não permite trocar de cor com nitidez em telas grandes ou PDFs; a marca oficial precisa de vetor.
- **Quem decidiu:** Alexandre.
- **Observação:** as placas de veículo continuam sem o símbolo.

## 29/10/2026 — icon.svg com cores literais (exceção só para esse arquivo)

- **Decisão:** `app/icon.svg` é o único arquivo `.svg` autorizado a ter cor literal. Nenhum outro `.svg` do projeto pode conter hexadecimal; um teste confere.
- **Motivo:** o ícone da aba é um SVG estático, que não enxerga as variáveis CSS da página (os tokens).
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Azuis do Eixo e da TranSul

- **Decisão:** o azul oficial da TranSul é `#151F6D`, só na assinatura "para TranSul". O azul de ação do Eixo (botões e links) é `#3355FF`. O `#0B3D91` provisório foi removido do projeto técnico.
- **Motivo:** substituir a premissa provisória pelas cores definidas.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Fase 2 em quatro entregas; ECharts fora da Fase 2

- **Decisão:** 2A base visual; 2B esqueleto (barra lateral, topo, Ctrl+K, trilha, layout de leitura); 2C dados (tabela TanStack, painel de espiar, ficha padrão); 2D wizard (React Hook Form + Zod, stepper, resumo ao vivo, "+" em painel lateral, rascunho). Cada uma com branch, tela de demonstração e pull request próprios. ECharts fica fora da Fase 2.
- **Motivo:** a Fase 2 do roteiro reúne vários projetos independentes.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Projeto eixo-prod criado no Supabase, vazio e sem link até a Fase 3

- **Decisão:**
  - o projeto **`eixo-prod`** foi criado no Supabase, na organização `transul-sistemas` (plano **Free**), região São Paulo (`sa-east-1`);
  - Data API ligada, "Automatically expose new tables" **desligado** e "Enable automatic RLS" **ligado**;
  - a organização da v1 fica **separada**, por causa do aviso de cota de 01/11;
  - o desenvolvimento da Fase 2 roda **todo local**; o `eixo-prod` fica **vazio** por enquanto;
  - o `supabase link` com o `eixo-prod` só é feito por **Alexandre**, na Fase 3.
- **Motivo:** tabelas novas só ficam acessíveis pela API quando recebem permissão explícita, e nascem com RLS ligado (regra inviolável 5). A organização separada evita que a cota e o aviso da v1 afetem o Eixo.
- **Alternativas descartadas:** usar a organização da v1.
- **Quem decidiu:** Alexandre.
- **Observação:** nenhuma URL, chave ou senha do projeto entra em arquivo do repositório (ver regra 8 do `CLAUDE.md`).

## 29/10/2026 — Pendências de plano antes da importação e da produção

- **Decisão:**
  - o upgrade do Supabase para **Pro** depende da aprovação da diretoria e é pendência **antes de importar dados da v1 (Fase 3)**, porque o plano Free não tem backup diário;
  - **Vercel Pro** e **GitHub Team** são pendências **antes da produção** (o GitHub Team também libera a proteção da `main`, ver decisão abaixo).
- **Motivo:** dados reais da empresa não devem entrar num projeto sem backup diário, e a produção precisa dos recursos desses planos.
- **Alternativas descartadas:** importar a v1 no plano Free.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Proteção da main limitada pelo plano Free do GitHub

- **Decisão:** o ruleset `proteger-main` existe, mas **não é aplicado** enquanto o repositório privado estiver no plano Free do GitHub. Por isso a `main` não bloqueia merge sem pull request nem sem os checks `app` e `banco`. Até o upgrade, o combinado é só fazer merge por pull request com os dois checks verdes. O upgrade para o plano **Team** é pendência **antes da produção**.
- **Motivo:** o plano Free não aplica rulesets em repositório privado.
- **Alternativas descartadas:** tornar o repositório público (os arquivos citam o identificador da v1 e terão dados da empresa).
- **Quem decidiu:** Alexandre.

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
