# TranSul Eixo — Fase 2A (base visual) — Plano de implementação

> **Para quem executa:** use `superpowers:subagent-driven-development` ou `superpowers:executing-plans`. Os passos usam caixas `- [ ]`. **Pare em cada checkpoint (A a E) e peça aprovação.** Em toda tela, use também a skill `frontend-design`.

**Objetivo:** entregar a base visual do Eixo (tokens claro/escuro, Barlow, Tabler, cores de módulos e status, botões, etiquetas, placa Mercosul, logotipo e componentes de formato) e uma tela de demonstração com cada peça, aprovada por Alexandre.

**Arquitetura:** os valores de cor vivem só em `app/tokens.css` (único lugar onde o Stylelint aceita hex). `app/globals.css` liga esses tokens às variáveis do shadcn, então o padrão visual vem da ferramenta. Formatação de número e data vive só em `components/formato/` (única exceção do ESLint). Cada peça visual é um componente pequeno, com teste de unidade (Vitest, `renderToStaticMarkup`, sem biblioteca nova) e teste de tela (Playwright, 1366 e 1920, claro e escuro).

**Stack:** Next.js 16, Tailwind 4, shadcn (base-nova), Barlow e Barlow Semi Condensed (`next/font/google`), `@tabler/icons-react`, `next-themes`, Vitest, Playwright.

**Spec:** `CLAUDE.md` (Identidade visual, Padrões de tela, Textos da interface), `docs/projeto-tecnico.md` (seção Identidade visual e Padrões de base) e a mensagem de Alexandre de 29/10/2026 que divide a Fase 2 em 2A a 2D. **Não há documento de design separado:** este plano faz esse papel; as escolhas minhas estão em "Decisões minhas" no fim, para Alexandre conferir.

## Restrições globais

- Dependências novas, só estas: `@tabler/icons-react` e `next-themes`. Remover `lucide-react` (não é importado por nenhum arquivo). Nada de ECharts, TanStack, React Hook Form, Zod (ficam para 2C e 2D).
- Cores (claro, copiadas do `CLAUDE.md`): Frota `#4338CA` (índigo, trocada em 29/10 por ficar a 1,5 do azul de ação), Operacional `#FF7A3D`, Operações `#7C5CFF`, Pessoas `#E8508A`, Parceiros `#13A8A4`, Resultados `#1FA971`, Cadastros e Administração `#64748B`. Status: em atividade `#22A06B`, atenção `#E8A317`, impedida `#E5484D`, pátio `#2E9BEA`, fora `#8A94A6`. Base: fundo `#F6F7FB`, superfície branca, texto `#0F1729`, linha `#ECEEF4`. Azul de ação do Eixo `#3355FF`. Azul oficial da TranSul `#151F6D`, só na assinatura "para TranSul".
- Cada cor de módulo e de status tem versão **forte** (ícone, cabeçalho, botão) e **suave** (fundos). Cor de módulo diz onde a pessoa está; cor de status diz como está a placa. Nunca misturar.
- Hex só em `app/tokens.css`. Nenhum hex, tamanho de fonte ou formato de número escrito à mão em TS/TSX/CSS fora disso. O lint barra; não desligar regra.
- Fonte: Barlow; Barlow Semi Condensed nas placas. Ícones: Tabler.
- Moeda: `R$ 1.284.300,00`, sempre com centavos, alinhada à direita, algarismos de largura fixa, negativo com sinal e em vermelho. Valor interno em **centavos inteiros** (`number`; 15 dígitos cabem no inteiro seguro). Digitação: 1, 2, 3, 4 resulta em `R$ 12,34`. Outros formatos: km sem casas, litros e km/l com duas, percentual com uma, data `dd/mm/aaaa`.
- Textos em português, frases com letra minúscula normal, sem rótulos em maiúsculas. Botão = verbo + objeto.
- Telas de referência: 1366×768 e 1920×1080. Sem rolagem horizontal da página.
- Uma branch (`fase-2a-base-visual`), pull request com os checks `app` e `banco` verdes. Sem `--force`. Sem credencial. Sem `supabase link` e sem as ferramentas MCP do Supabase.

## Review Focus

1. **Moeda:** `-0` não pode virar `-R$ 0,00` nem ficar vermelho; `-1` centavo é `-R$ 0,01` em vermelho; 15 dígitos (`999999999999999`) não viram notação científica; `null` e `undefined` viram `—`.
2. **Campo de moeda:** colar `"R$ 12,34abc"`, apagar até zerar, passar de 15 dígitos e teclas que não são dígito não podem quebrar o valor.
3. **Data:** `"2026-01-01"` não pode virar 31/12 por fuso; o instante `2026-03-01T01:00:00Z` é 28/02/2026 em São Paulo; data inválida vira `—`.
4. **Placa:** minúscula, hífen, espaços e texto vazio não quebram; o formato antigo aparece como foi escrito (a conversão para Mercosul é regra de domínio da Fase 4); leitor de tela recebe "Placa ABC1D23".
5. **Tema:** primeira carga sem piscar nem erro de hidratação; segue o tema do sistema na primeira visita; texto sobre cada fundo suave e branco sobre o azul de ação com contraste mínimo 4,5:1 nos dois temas; sem rolagem horizontal em nenhum dos dois temas.

---

## Checkpoint A — Documentos e azuis (aprovação antes de código)

Mostrar o diff da Tarefa 1 e confirmar as três perguntas abertas em "Perguntas para Alexandre". **PARE: aguardar aprovação.**

---

## Tarefa 1: Documentos e registro de decisões

**Arquivos:**
- Modificar: `docs/projeto-tecnico.md` (linha da pendência "Logotipo e cores oficiais da TranSul"; tabela Identidade visual, linha Base)
- Modificar: `CLAUDE.md` (linha "Base" da seção Identidade visual) — **mudança de regra: só com o OK de Alexandre no checkpoint A**
- Modificar: `docs/decisoes.md`
- Criar: este plano, já em `docs/superpowers/plans/`

- [ ] **Passo 1:** em `docs/projeto-tecnico.md`, trocar a pendência do `#0B3D91` por item resolvido: azul oficial da TranSul `#151F6D`; azul de ação do Eixo `#3355FF`. Garantir que `#0B3D91` não aparece mais (`git grep -n 0B3D91` sem resultado).
- [ ] **Passo 2:** acrescentar o azul de ação `#3355FF` na linha Base da tabela Identidade visual (projeto técnico) e na linha Base do `CLAUDE.md` ("Azul de ação do Eixo `#3355FF`").
- [ ] **Passo 3:** `docs/decisoes.md`: uma entrada "Fase 2 em quatro entregas (2A a 2D); ECharts fora da Fase 2" e uma "Azul de ação `#3355FF` e azul da TranSul `#151F6D`", com as decisões da mensagem de Alexandre.
- [ ] **Passo 4 (verificação):** `pnpm format:check` sem erros; `git grep -n 0B3D91` vazio.
- [ ] **Passo 5:** commit `docs: azuis do Eixo e Fase 2 em quatro entregas` (plano incluído).

---

## Tarefa 2: Tokens claro/escuro e tema

**Arquivos:**
- Criar: `app/tokens.css`, `components/tema/provedor-de-tema.tsx`, `components/tema/alternador-de-tema.tsx`, `lib/qualidade/contraste.ts`
- Modificar: `app/globals.css` (importa `tokens.css`; `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--ring`, `--border`, `--input`, `--destructive`, `--sidebar*` passam a apontar para tokens; remover `--chart-*` e a referência a `--font-geist-mono`), `app/layout.tsx`
- Teste: `lib/qualidade/tokens.test.ts`, `lib/qualidade/contraste.test.ts`

**Interfaces:**
- Produz (nomes de token, todos em `:root` e em `.dark`): `--fundo`, `--superficie`, `--texto`, `--texto-suave`, `--linha`, `--acao`, `--acao-texto`, `--marca-transul`; `--modulo-<m>` e `--modulo-<m>-suave` para `<m>` em `frota`, `operacional`, `operacoes`, `pessoas`, `parceiros`, `resultados`, `cadastros` (Administração usa `--modulo-cadastros`); `--status-<s>` e `--status-<s>-suave` para `<s>` em `em-atividade`, `atencao`, `impedida`, `patio`, `fora`. Total: 32 tokens por tema (8 de base, 14 de módulos, 10 de status).
- Produz: `contraste(a: string, b: string): number` em `lib/qualidade/contraste.ts` (razão WCAG entre dois hex `#RRGGBB`).
- Produz: `<ProvedorDeTema>` (envolve `next-themes` com `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`) e `<AlternadorDeTema>` (botão que alterna claro/escuro, com texto "Alternar tema").

- [ ] **Passo 1: testes que falham.** `tokens.test.ts` lê `app/tokens.css` e afirma: (a) os 32 nomes de token acima existem no bloco `:root` e no `.dark`; (b) no `:root`, `--modulo-frota` = `#4338CA`, `--status-atencao` = `#E8A317`, `--fundo` = `#F6F7FB`, `--texto` = `#0F1729`, `--linha` = `#ECEEF4`, `--acao` = `#3355FF`, `--marca-transul` = `#151F6D` (e os demais valores do CLAUDE.md). `contraste.test.ts`: `contraste("#000000", "#FFFFFF")` ≈ 21; `contraste("#FFFFFF", "#3355FF")` ≥ 4,5; `--texto` sobre `--fundo` e sobre `--superficie` ≥ 4,5 nos dois temas lendo os valores do CSS.
- [ ] **Passo 2:** `pnpm test`; esperado: FALHA (arquivos não existem).
- [ ] **Passo 3:** `pnpm add next-themes`. Criar `app/tokens.css`: valores fortes em hex; suaves por `color-mix(in srgb, var(--modulo-x) 14%, var(--superficie))` (claro) e `22%` (escuro); tema escuro com as mesmas cores fortes de módulo e status e base própria (valores na seção "Decisões minhas"). Implementar `contraste` (luminância relativa WCAG).
- [ ] **Passo 4:** ligar `globals.css` aos tokens e `layout.tsx` ao `<ProvedorDeTema>` (`suppressHydrationWarning` no `<html>`); criar o alternador.
- [ ] **Passo 5 (verificação):** `pnpm test` verde; `pnpm lint` sem erros (prova que o hex ficou só em `tokens.css`); `pnpm build`.
- [ ] **Passo 6:** commit `feat: tokens do Eixo em claro e escuro`.

---

## Tarefa 3: Fonte Barlow e ícones Tabler

**Arquivos:**
- Modificar: `app/layout.tsx` (Barlow em `--font-sans`; Barlow Semi Condensed em `--font-placa`; remover Geist), `app/globals.css` (`--font-placa`), `components.json` (`"iconLibrary": "tabler"`), `package.json`
- Teste: `e2e/fonte.spec.ts`

**Interfaces:**
- Produz: variáveis CSS `--font-sans` (Barlow) e `--font-placa` (Barlow Semi Condensed); classe `font-placa` do Tailwind.

- [ ] **Passo 1: teste que falha** em `e2e/fonte.spec.ts`: em `/`, `getComputedStyle(document.body).fontFamily` contém `Barlow`; e `document.fonts.check('16px Barlow')` é verdadeiro depois de `document.fonts.ready`.
- [ ] **Passo 2:** `pnpm test:e2e -g fonte`; esperado: FALHA (hoje é Geist).
- [ ] **Passo 3:** `pnpm add @tabler/icons-react`; `pnpm remove lucide-react`; trocar fontes em `layout.tsx` com `next/font/google` (`subsets: ["latin"]`, pesos 400, 500, 600, 700, `display: "swap"`); `iconLibrary` para `tabler`. Se o CLI do shadcn não aceitar `tabler`, parar e perguntar (não contornar).
- [ ] **Passo 4 (verificação):** `pnpm test:e2e -g fonte` verde nos dois projetos; `pnpm build`; `git grep -n "lucide\|Geist"` vazio fora de `docs/` e do lockfile.
- [ ] **Passo 5:** commit `feat: Barlow e ícones Tabler`.

**Checkpoint B — PARE:** mostrar `app/tokens.css` (claro e escuro) e a página inicial nos dois temas. Aguardar aprovação da paleta escura e dos suaves.

---

## Tarefa 4: Componentes de formato

**Arquivos:**
- Criar: `components/formato/moeda-valor.ts` (lógica pura), `components/formato/moeda.tsx` (componentes `Moeda` e `CampoMoeda`), `components/formato/numero.ts`, `components/formato/data.ts`
- Teste: `components/formato/moeda-valor.test.ts`, `components/formato/moeda.test.tsx`, `components/formato/numero.test.ts`, `components/formato/data.test.ts`

**Interfaces:**
- `formatarMoeda(centavos: number | null | undefined): string` → `"R$ 1.284.300,00"` (com espaço sem quebra entre `R$` e o número, como o `Intl` pt-BR devolve); negativo com sinal na frente (`"-R$ 12,34"`); `-0` → `"R$ 0,00"` (sem sinal); `null`, `undefined` e `NaN` → `"—"`.
- `proximoValorDoCampo(atual: number, tecla: string): number` — dígito acrescenta à direita (1, 2, 3, 4 → 1234 centavos); `"Backspace"` remove o último dígito; qualquer outra tecla devolve `atual`; limite de 15 dígitos (acima disso devolve `atual`).
- `centavosDoTextoColado(texto: string): number` — só os dígitos, limitado a 15.
- `<Moeda valor={centavos} />` (servidor ou cliente): `<span>` com `tabular-nums text-right`, `data-negativo` e cor do token de impedida quando `valor < 0`.
- `<CampoMoeda valor onChange rotulo />` (cliente): `<input inputMode="numeric">` que mostra `formatarMoeda(valor)`, trata `onKeyDown` com `proximoValorDoCampo` e `onPaste` com `centavosDoTextoColado`.
- `formatarKm(n)` → `"12.345 km"`; `formatarLitros(n)` → `"1.234,50 L"`; `formatarKmPorLitro(n)` → `"3,25 km/l"`; `formatarPercentual(pontos)` → `"12,3%"` (recebe `12.34`); todos com `—` para ausente.
- `formatarData(valor: string | Date | null | undefined): string` → `"01/01/2026"`; texto `aaaa-mm-dd` é fatiado sem passar por `Date`; `Date` e timestamps ISO usam `America/Sao_Paulo`; inválido → `—`.

- [ ] **Passo 1: testes que falham.** Casos com os valores do spec e do Review Focus: `formatarMoeda(128430000)` = `"R$ 1.284.300,00"` (com U+00A0); `formatarMoeda(-1234)` = `"-R$ 12,34"`; `formatarMoeda(-0)` = `"R$ 0,00"`; `formatarMoeda(999999999999999)` = `"R$ 9.999.999.999.999,99"`; `formatarMoeda(null)` = `"—"`. `proximoValorDoCampo` aplicado a `1,2,3,4` = `1234`; `"Backspace"` 1234→123; `"a"` mantém; 16.º dígito mantém. `centavosDoTextoColado("R$ 12,34abc")` = `1234`. `<Moeda valor={-1234}>` (via `renderToStaticMarkup`) contém `data-negativo` e `<Moeda valor={0}>` não. `formatarData("2026-01-01")` = `"01/01/2026"`; `formatarData(new Date("2026-03-01T01:00:00Z"))` = `"28/02/2026"`; `formatarData("lixo")` = `"—"`. Percentual, km, litros e km/l com os exemplos acima.
- [ ] **Passo 2:** `pnpm test`; esperado: FALHA.
- [ ] **Passo 3:** implementar tudo em `components/formato/` usando `Intl` só aí. O limite de 15 dígitos vem de `numeric(15,2)`.
- [ ] **Passo 4 (verificação):** `pnpm test` verde; `pnpm lint` sem erros; `git grep -nE "toLocale|Intl\\."` só aponta para `components/formato/`.
- [ ] **Passo 5:** commit `feat: componentes de formato (moeda, números e data)`.

---

## Tarefa 5: Botões e etiquetas

**Arquivos:**
- Modificar: `components/ui/button.tsx` (variantes pelos tokens; variante `default` usa `--primary`→`--acao`)
- Criar: `lib/visual/tons.ts`, `components/etiqueta.tsx`
- Teste: `lib/visual/tons.test.ts`, `components/etiqueta.test.tsx`

**Interfaces:**
- `lib/visual/tons.ts`: `MODULOS = ["frota","operacional","operacoes","pessoas","parceiros","resultados","cadastros"] as const`; `STATUS = ["em-atividade","atencao","impedida","patio","fora"] as const`; tipos `Modulo`, `Status`; `variavelDoModulo(m: Modulo): string` e `variavelDoStatus(s: Status): string` devolvem `"--modulo-frota"` etc.
- `<Etiqueta modulo | status>children</Etiqueta>`: união discriminada (`{ modulo: Modulo } | { status: Status }`), nunca os dois. Fundo suave do token, bolinha na versão forte, texto na cor `--texto`; `data-tom="modulo:frota"` ou `"status:atencao"`. Só intensidade suave (a sólida do modo TV vem com o Operacional).

- [ ] **Passo 1: testes que falham.** `tons.test.ts`: cada nome de `MODULOS` e `STATUS` tem token existente em `app/tokens.css` (lido do arquivo). `etiqueta.test.tsx`: `<Etiqueta status="atencao">` contém `data-tom="status:atencao"`; a saída não contém `#`; `// @ts-expect-error` para `<Etiqueta modulo="frota" status="atencao">` e para `<Etiqueta>` sem tom.
- [ ] **Passo 2:** `pnpm test`; esperado: FALHA.
- [ ] **Passo 3:** implementar. No botão, trocar só o que depende de cor para tokens; manter a estrutura do shadcn.
- [ ] **Passo 4 (verificação):** `pnpm test`, `pnpm typecheck` (o `@ts-expect-error` precisa estar valendo), `pnpm lint`.
- [ ] **Passo 5:** commit `feat: botões e etiquetas do Eixo`.

---

## Tarefa 6: Placa Mercosul e logotipo

**Arquivos:**
- Criar: `lib/dominio/placa.ts`, `components/placa.tsx`, `components/marca/assinatura-transul.tsx`, `components/marca/logotipo.tsx`, `app/icon.svg`
- Remover: `app/favicon.ico`
- Teste: `lib/dominio/placa.test.ts`, `components/placa.test.tsx`, `components/marca/logotipo.test.tsx`, `components/marca/assinatura-transul.test.tsx`, `lib/qualidade/svg.test.ts`

**Interfaces:**
- `normalizarPlaca(texto: string): string` — maiúscula, só letras e números (`" abc-1d23 "` → `"ABC1D23"`; `""` → `""`). Não converte formato antigo para Mercosul (Fase 4).
- `<Placa placa tamanho? />` com `tamanho` em `"p" | "m" | "g"` (padrão `"m"`): mini placa com faixa azul no alto (token da Frota), texto em `font-placa`, `role="img"` e `aria-label="Placa ABC1D23"`; placa vazia mostra `"—"` com `aria-label="Sem placa"`.
- `<AssinaturaTranSul apenasSimbolo? />` em `components/marca/assinatura-transul.tsx`: **único** componente que referencia `public/marca/transul-horizontal-preto.png` (PNG provisório, fundo transparente, conteúdo preto). Pinta o logo por máscara (`mask-image`) com `background-color` do token `--marca-transul` (`#151F6D` no claro; tom claro no escuro), sem filtro; `apenasSimbolo` recorta só o símbolo (região esquerda da imagem). Tem `role="img"` e `aria-label="TranSul"`. As placas de veículo (`<Placa>`) não o usam.
- `<Logotipo recolhido? comAssinatura? />` em `components/marca/logotipo.tsx`: placa do Eixo com faixa azul, o símbolo (`<AssinaturaTranSul apenasSimbolo />`) dentro e `EIXO` embaixo; ao lado o texto `TranSul Eixo`; com `comAssinatura` (padrão) a assinatura `para` + `<AssinaturaTranSul />` na cor `--marca-transul` (`#151F6D`); com `recolhido` só a placa com o símbolo.
- `app/icon.svg`: ícone da aba, **único** outro lugar do símbolo (recorte do PNG embutido, ou polígonos redesenhados; decidir no checkpoint C). SVG estático não enxerga CSS da página, então leva as cores literais (exceção registrada em `docs/decisoes.md`, só para este arquivo). O logo provisório em PNG já está em `public/marca/`.

- [ ] **Passo 1: testes que falham.** `placa.test.ts`: `normalizarPlaca(" abc-1d23 ")` = `"ABC1D23"`; `normalizarPlaca("ABC-1234")` = `"ABC1234"`; `normalizarPlaca("")` = `""`. `placa.test.tsx`: `<Placa placa="abc1d23">` contém `aria-label="Placa ABC1D23"`; `<Placa placa="">` contém `aria-label="Sem placa"`; saída sem `#`. `logotipo.test.tsx`: contém `TranSul Eixo`, `EIXO` e `para TranSul`; `recolhido` não contém `TranSul Eixo`; `<Placa>` não contém a assinatura (`data-marca`). `assinatura-transul.test.tsx`: `<AssinaturaTranSul>` tem `aria-label="TranSul"` e a máscara usa o caminho do PNG; o caminho `transul-horizontal-preto.png` só aparece em `components/marca/assinatura-transul.tsx` (varredura dos `.ts`, `.tsx` e `.css`). `svg.test.ts`: todo `.svg` do repositório (fora `node_modules`, `.next`, `.agents`, `.claude`) exceto `app/icon.svg` não contém hexadecimal; `app/icon.svg` existe.
- [ ] **Passo 2:** `pnpm test`; esperado: FALHA.
- [ ] **Passo 3:** implementar, só com tokens e `currentColor`. Criar `app/icon.svg` e remover o `favicon.ico`.
- [ ] **Passo 4 (verificação):** `pnpm test`, `pnpm lint`, `pnpm build`.
- [ ] **Passo 5:** commit `feat: placa Mercosul, logotipo e ícone`.

**Checkpoint C — PARE:** mostrar os componentes isolados (capturas) e a saída dos testes. Aguardar aprovação antes da tela de demonstração.

---

## Tarefa 7: Tela de demonstração

**Arquivos:**
- Criar: `app/admin/demonstracao/page.tsx` (em Administração, para não criar pasta nova fora do módulo), `e2e/demonstracao.spec.ts`
- Modificar: `app/page.tsx` (usa `<Logotipo>`), `e2e/inicio.spec.ts` se o título mudar

**Interfaces:**
- Consome: `Logotipo`, `AlternadorDeTema`, `Button`, `Etiqueta`, `Placa`, `Moeda`, `CampoMoeda`, `formatar*` das tarefas anteriores.
- A página tem seções: cores dos módulos, cores de status, botões, etiquetas (módulo e status), placas (três tamanhos e vazia), moeda (positiva, negativa, zero, 15 dígitos), campo de moeda, outros formatos, logotipo e ícone, tema. Todas em largura total.

- [ ] **Passo 1: testes que falham** em `e2e/demonstracao.spec.ts` (rodam nos projetos `tela-1366` e `tela-1920`, nos temas claro e escuro, ativando o escuro com `colorScheme: "dark"`): (a) sem rolagem horizontal; (b) o texto `R$ 1.284.300,00` aparece inteiro e o valor negativo tem `data-negativo` e cor diferente do texto comum; (c) clicar no campo de moeda e digitar `1234` mostra `R$ 12,34`; (d) `<Moeda>` com `1111111` e `8888888` têm a mesma largura (algarismos de largura fixa); (e) o alternador troca `html.dark`; (f) a página sem erro no console (hidratação).
- [ ] **Passo 2:** `pnpm test:e2e -g demonstracao`; esperado: FALHA.
- [ ] **Passo 3:** montar a página com `frontend-design`, só com tokens e componentes (nada de cor ou formato à mão).
- [ ] **Passo 4 (verificação):** `pnpm test:e2e` (todos) verde; capturas em 1366 e 1920, claro e escuro, salvas na pasta temporária da sessão (fora do Git).
- [ ] **Passo 5:** commit `feat: tela de demonstração da base visual`.

**Checkpoint D — PARE:** Alexandre abre `/admin/demonstracao` (`pnpm dev`) e aprova o visual nos dois temas e nas duas larguras.

---

## Tarefa 8: Verificação final, revisão e pull request

- [ ] **Passo 1:** `verification-before-completion`: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `CI=1 pnpm test:e2e`, e `supabase test db` (Docker). Colar a saída resumida.
- [ ] **Passo 2:** `git grep -nEi "#[0-9a-f]{3,8}\b" -- '*.ts' '*.tsx' '*.css' ':!app/tokens.css'` sem resultado.
- [ ] **Passo 3:** `requesting-code-review` na branch inteira; corrigir críticos e importantes, um commit por assunto.
- [ ] **Passo 4:** push da branch e pull request "Fase 2A: base visual", sem `--force`; acompanhar `gh pr checks`. **Não fazer merge.**

**Checkpoint E — PARE:** mostrar o resultado do review e dos checks; o merge é de Alexandre.

---

## Perguntas para Alexandre

1. **Azul de ação `#3355FF` e azul da Frota `#3D5AFE` são quase iguais.** Botão azul pode ser confundido com "estou na Frota". Mantenho os dois como estão, ou o azul de ação ganha um tom diferente?
2. **Início não tem cor de módulo.** Uso o azul de ação como identidade do Início?
3. **Edito a linha Base do `CLAUDE.md`** para incluir `#3355FF` (Tarefa 1, passo 2)? É mudança de regra, por isso só com o seu OK.

## Decisões minhas (para conferir)

- Tema escuro (proposta, a aprovar no checkpoint B): fundo `#0E1322`, superfície `#161C2E`, texto `#E8ECF6`, linha `#263049`; cores fortes de módulo e status iguais às do claro; suaves a 22% sobre a superfície.
- Suaves do claro: 14% da cor sobre a superfície, em sRGB.
- Texto da etiqueta na cor do texto, com bolinha colorida, para o contraste não depender de cada cor.
- Valor de moeda em centavos inteiros, e a tela de demonstração em `app/admin/demonstracao/`.
- `next/font/google` para Barlow (como já era com a Geist); o build precisa de rede.
- `next-themes` para o tema (uma dependência pequena, padrão com o shadcn).
- Densidade, modo foco, régua de status completa e modo TV não entram na 2A.
