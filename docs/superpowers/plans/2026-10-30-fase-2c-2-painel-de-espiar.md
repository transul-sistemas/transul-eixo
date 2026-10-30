# Fase 2C-2: painel lateral de espiar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (a sessão executa inline) para implementar este plano tarefa a tarefa. Os passos usam caixas `- [ ]`.

**Goal:** clicar numa linha de `/frota/placas` abre, por cima da lista, um painel com o resumo da placa (situação, conjunto, gestor, operação e alertas), sem perder filtros, página, ordem nem rolagem; Esc fecha e o foco volta à linha de origem; o estado fica em `?espiar=PLACA`; funciona em desktop, tablet e celular.

**Architecture:** o painel é um `Drawer` modal do base-ui (lateral de 420 px em desktop e tablet, folha de baixo no celular). Aberto, fechado e trocado de placa por navegação (`router.push`/`replace`) do parâmetro `espiar`; a lista é a mesma instância no DOM, então `scrollTop` e o resto sobrevivem. O servidor lê `espiar`, chama `obterPlaca()` (mesma fonte e mesmo barramento do exemplo) em paralelo com a lista e entrega o detalhe serializado ao painel; um erro do painel nunca derruba a lista. O clique no painel abre na hora (otimista), e o conteúdo chega do servidor.

**Tech Stack:** Next.js 16 (Server Components, transições), `@base-ui/react/drawer`, Zod só onde já existe, Vitest, Playwright.

**Spec:** `CLAUDE.md` (Padrões de tela, Qualidade de interação regras 1 e 6, Armadilhas conhecidas), `docs/decisoes.md` (entradas da 2C-1) e a escolha de Alexandre de 30/10/2026 (caminho A, resumida em "Decisões aprovadas").

## Decisões aprovadas

1. **Painel sobreposto em todas as larguras:** Drawer modal, 420 px à direita em desktop e tablet, folha de baixo (até 85% da altura, arrastar para baixo fecha) no celular. A lista fica por baixo, intacta.
2. **A célula da Placa vira o botão "Espiar AAA0A00"** (teclado e leitor de tela). O clique na linha inteira é só atalho de mouse e de toque.
3. **`?espiar=PLACA` na URL:** recarregar e compartilhar devolvem o painel aberto.
4. **Ordem das entregas:** (1) painel abrindo e fechando, (2) conteúdo do resumo, (3) "Placa anterior" e "Próxima placa" como checkpoint à parte, andando só pelas linhas da página atual.
5. **Capturas em cada checkpoint:** 1366 e 1920, claro e escuro, mais tablet (820) e celular (390), também em claro e escuro.

## Propostas minhas (Alexandre revisa ao aprovar o plano)

- **Fechar:** se o painel foi aberto pela lista, fechar é `history.back()` (desfaz um passo, o Voltar do navegador faz o mesmo); se veio de link direto, fechar troca a URL sem `espiar` (`replace`). Trocar de placa dentro do painel usa `replace`, para não encher o histórico.
- **Foco ao fechar:** volta ao botão "Espiar" da placa que estava aberta no momento de fechar (se o painel andou com anterior/próxima, é a última); se essa linha não está na página, vai para a caixa da tabela.
- **Conjunto no painel:** cada placa do conjunto é um botão "Espiar AAA0B45" que troca o painel (`replace`).
- **"Abrir ficha completa":** aparece desligado (`aria-disabled`) com a dica "Entra na próxima entrega" até a 2C-3, que o transforma em link para `/frota/placas/AAA0A00`.
- **Placa fora do exemplo ou mal escrita:** formato inválido é ignorado (o painel não abre); formato válido que não existe abre o painel com "Placa não encontrada" e o botão de fechar.
- **Placas baixadas** (VND e SUC) podem ser espiadas por link, mesmo escondidas da lista por padrão.

## Global Constraints

- Sem cor, tamanho de fonte ou formato à mão: tokens, `Etiqueta`, `Placa`, `Moeda`, `components/formato/` (`formatarData`, `formatarInteiro`, `formatarKm`). Proibido `Intl`, `toLocale*` e `toFixed` fora de `components/formato/`; hex só em `app/tokens.css`. Cor de status diz como está a placa; cor de módulo só no cabeçalho.
- Textos em português, minúsculas normais, botão = verbo + objeto ("Espiar AAA0A00", "Fechar painel", "Abrir ficha completa"); erro diz o que houve e como resolver; nada de maiúsculas em rótulo.
- Parâmetro da URL: `espiar` (placa normalizada: maiúscula, só letras e números, 7 caracteres). Nenhum outro parâmetro muda ao abrir ou fechar o painel.
- Armadilhas: `obterPlaca()` pede só as colunas necessárias (sem `select *`); sem Server Action nova; a fonte de exemplo continua a única porta de `lib/exemplo/` e nada do navegador a importa (`lib/dados/placas-tipos`, sem a fonte).
- Foco e teclado (regra 6): foco entra no painel ao abrir (no título), Esc fecha, foco volta à linha; botões com alvo de 24 px ou mais; `aria-disabled` (não `disabled`) onde o foco não pode sair do botão.
- Fechar é fechar (regra 1): depois de abrir e fechar, a URL (sem `espiar`), a página, a ordem, os filtros, o tamanho da página, as colunas e a rolagem da tabela são os mesmos de antes.
- Sem push, sem merge, sem `--force`; sem Supabase na nuvem; sem segredo em arquivo. Commits por assunto com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. O push e o PR só no fim, com autorização.

## Review Focus

Entradas que o desenho implica e nenhuma tarefa de regra cobre por si; cada uma ganha teste na tarefa dona.

1. `?espiar=` com minúscula, hífen (`aaa-0a00`), espaços, 7 caracteres inválidos, texto enorme, `<script>`, repetido duas vezes, placa que não existe, placa baixada: nunca quebra a página, nunca vira HTML, e abre só quando o formato é válido. (Tarefas 1 e 4)
2. Foco ao fechar quando a linha de origem sumiu (mudou a página, o filtro ou veio de link direto): cai na caixa da tabela, nunca no `body`. (Tarefa 3)
3. Sequências de histórico: abrir → Esc → Voltar; abrir → trocar pelo conjunto → fechar; link direto → fechar; recarregar com o painel aberto; abrir → Voltar → Avançar. Nenhuma sai do sistema nem deixa o painel e a URL em estados diferentes. (Tarefa 3)
4. O painel falha (ou demora) e a lista segue de pé; fechar enquanto carrega cancela a abertura (`?lento` e `?falhaNoPainel`). (Tarefas 3 e 4)
5. Celular: rolar o conteúdo da folha não fecha a folha; arrastar o puxador para baixo fecha; janela baixa (390×500) e paisagem rolam por dentro, com o cabeçalho do painel sempre visível. (Tarefa 3)

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---------|------------------|
| `lib/navegacao/espiar.ts` (+ teste) | `lerEspiar`, `comEspiar`, `vizinhas` |
| `lib/dados/placas-tipos.ts`, `placas.ts`, `fonte.ts`, `fonte-de-exemplo.ts` | `DetalheDaPlaca`, `obterPlaca()`, `FonteDePlacas.obter` |
| `components/tabela/painel-de-espiar.tsx` | o Drawer: abrir, fechar, foco, histórico, layout por largura |
| `components/tabela/resumo-da-placa.tsx` | o conteúdo do resumo (situação, conjunto, gestor, operação, CR, alertas e dados) |
| `components/tabela/pendencia-da-lista.tsx` | `espiar(placa)`, `fecharPainel()` e a placa espiada otimista no provedor da lista |
| `components/tabela/tabela-de-dados.tsx`, `tabela-de-placas.tsx` | botão "Espiar", clique na linha como atalho |
| `app/(sistema)/frota/placas/pagina-de-placas.tsx` | lê `espiar`, busca o detalhe em paralelo, tolera erro |
| `e2e/espiar.spec.ts` (desktop) e `e2e/espiar.casca.spec.ts` (tablet e celular) | os testes de tela |

## Tarefa 1: as regras do parâmetro (`lib/navegacao/espiar.ts`)

**Interfaces — Produces:** `PARAMETRO_DE_ESPIAR = "espiar"`; `lerEspiar(params: URLSearchParams): string | null` (normaliza com `normalizarPlaca`, aceita só 7 letras ou números, senão `null`); `comEspiar(params: URLSearchParams, placa: string | null): URLSearchParams` (põe ou tira `espiar`, sem mexer em mais nada); `vizinhas(placas: readonly string[], atual: string): { anterior: string | null; proxima: string | null; posicao: number | null; total: number }`.

- [ ] **Passo 1 (testes primeiro, `espiar.test.ts`):** `lerEspiar`: `AAA0A00`, `aaa0a00`, `aaa-0a00`, `" AAA0A00 "` dão `AAA0A00`; `AAA0A0`, `AAA0A000`, `""`, `"<script>"`, `"%00"`, 500 caracteres e `espiar` repetido (vale o primeiro) dão `null` ou o primeiro válido, nunca erro; `comEspiar` preserva `q`, `chip`, `sigla`, `baixadas`, `ordem`, `pagina`, `tam`, `foco` e o contexto global, e `comEspiar(p, null)` tira só o `espiar`; ida e volta. `vizinhas`: meio, primeira (`anterior` nulo), última (`proxima` nula), placa fora da lista (`posicao` nulo, os dois nulos), lista vazia, lista de uma placa.
- [ ] **Passo 2:** ver falhar; implementar; ver passar. Commit `feat: regras do parâmetro espiar e das placas vizinhas`.

## Tarefa 2: o botão "Espiar" na célula da Placa e o atalho na linha

**Files:** `components/tabela/tabela-de-placas.tsx`, `tabela-de-dados.tsx`, `pendencia-da-lista.tsx`

**Interfaces:** a coluna `placa` renderiza `<button type="button" aria-haspopup="dialog" data-espiar-placa="AAA0A00" aria-label="Espiar AAA0A00">` com a mini placa dentro; `TabelaDeDados` ganha `aoClicarNaLinha?: (linha: T, origem: HTMLElement) => void`, que ignora clique em `a`, `button`, `input`, `select`, com tecla modificadora ou com texto selecionado. O provedor da lista ganha `espiar(placa: string): void` (por ora só empurra `?espiar=` por `router.push`, numa transição própria, sem esmaecer a tabela).

- [ ] **Passo 1 (testes primeiro):** unitário: a célula da Placa tem o botão com o nome "Espiar AAA0A00" e `data-espiar-placa`; a linha tem `cursor-pointer`. e2e (`espiar.spec.ts`): clicar no botão põe `?espiar=AAA0A00` na URL; clicar em qualquer ponto da linha (fora de botão) também; clicar num botão de dentro da linha (ordenar não é da linha; usar o botão do Conjunto) não abre dois; selecionar texto na linha e soltar o mouse não abre; Ctrl+clique não abre; Enter e Espaço no botão abrem; nenhum outro parâmetro muda.
- [ ] **Passo 2:** ver falhar; implementar; ver passar. Commit `feat: botão Espiar na célula da Placa e clique na linha como atalho`.

## Tarefa 3: o painel abrindo e fechando (sem conteúdo ainda)

**Files:** `components/tabela/painel-de-espiar.tsx`, `pendencia-da-lista.tsx`, `pagina-de-placas.tsx`, `e2e/espiar.spec.ts`, `e2e/espiar.casca.spec.ts`

**Interfaces:** `PainelDeEspiar({ placa: string | null, detalhe: DetalheDaPlaca | null, erro: boolean, placasDaPagina: string[] }): JSX` (client). Abre com `placa !== null`; título = a placa; corpo = "Carregando o resumo…" (`role="status"`) até a Tarefa 5; botão "Fechar painel"; `Drawer` com `swipeDirection` `right` (≥ 640 px) ou `down` (celular), `modal`, `finalFocus` apontando para `[data-espiar-placa="…"]` ou, na falta, para a caixa da tabela. `fecharPainel()` no provedor: `history.back()` se o painel foi aberto pela lista nesta sessão da página, senão `router.replace` sem `espiar`. Abrir é otimista (`useOptimistic`): o painel aparece no clique, antes de o servidor responder.

- [ ] **Passo 1 (e2e primeiro, 1366 e 1920):**
  - abrir mostra o painel (`dialog` nomeado pela placa), com o foco no título; a lista atrás fica inerte;
  - **Esc fecha** e o foco volta ao botão "Espiar AAA0A00" daquela linha (`toBeFocused`); o botão "Fechar painel" e o clique no fundo também fecham, com o mesmo foco;
  - **nada se perde:** com `?chip=impedida&ordem=-gestor&pagina=2&tam=50`, a tabela rolada (`scrollTop` e `scrollLeft` anotados) e as colunas escolhidas por cookie, abrir e fechar deixam a URL sem `espiar` idêntica à de antes, a página, a ordem, os chips e o `scrollTop`/`scrollLeft` iguais, e o resumo "Mostrando 26–50" igual;
  - **histórico:** abrir → Esc → URL de antes (uma entrada só a menos); abrir → Voltar do navegador fecha e o foco volta à linha; Voltar de novo não sai do sistema (continua em `/frota/placas`); abrir → Voltar → Avançar reabre; link direto `?espiar=AAA0A00` abre, e fechar tira o `espiar` sem sair da lista; recarregar com o painel aberto mantém o painel;
  - **foco quando a linha sumiu:** abrir por link direto de uma placa que não está na página e fechar leva o foco à caixa da tabela, nunca ao `body`;
  - **convivência:** Esc com o menu Colunas aberto fecha só o menu; com o painel aberto no modo foco, Esc fecha o painel e continua em foco; o `?lento=2500` mostra o painel na hora (otimista) e, se se fecha antes de chegar, nada reabre depois;
  - `?espiar=` inválido (`aaa`, `<script>`) não abre painel e não quebra; `?espiar=` válido que não existe abre o painel (o conteúdo "não encontrada" vem na Tarefa 4/5).
  - tablet 820 e celular 390 (`espiar.casca.spec.ts`): o painel abre por toque na linha; no tablet fica à direita com 420 px; no celular é folha de baixo (altura ≤ 85% da janela), o botão Fechar tem 40 px ou mais, arrastar o puxador para baixo fecha, rolar o conteúdo não fecha, e em 390×500 e em paisagem o corpo rola por dentro com o cabeçalho à vista; a página não rola na horizontal.
- [ ] **Passo 2:** ver falhar; implementar (`PainelDeEspiar`, provedor, página lendo `lerEspiar`); ver passar.
- [ ] **Passo 3:** `pnpm lint && pnpm typecheck && pnpm test`, e2e do painel verdes. Commit `feat: painel de espiar (abrir, fechar, foco, histórico e layouts)`.

### CHECKPOINT 1 — o painel abre e fecha
Capturas de 1366 e 1920 (claro e escuro) e de tablet 820 e celular 390 (claro e escuro): painel fechado, aberto sobre a lista, aberto no celular (folha de baixo) e na janela baixa; mais a rota para abrir com `pnpm dev`. Parar e pedir aprovação do visual.

## Tarefa 4: os dados do painel (`obterPlaca`)

**Files:** `lib/dados/placas-tipos.ts`, `placas.ts`, `fonte.ts`, `fonte-de-exemplo.ts`, `placas.test.ts`

**Interfaces — Produces:** `interface DetalheDaPlaca extends LinhaDePlaca { ano: number | null; renavam: string; desde: string /* aaaa-mm-ddThh:mm */; crs: { codigo: string; nome: string; inicio: string; fim: string | null }[] }`; `obterPlaca(placa: string, hoje: string, opcoes?: OpcoesDaConsulta): Promise<DetalheDaPlaca | null>`; `FonteDePlacas.obter(placa, hoje, opcoes)`. `OpcoesDaConsulta.simulacao` ganha `falhaNoPainel?: boolean` (só a fonte de exemplo obedece, e depois de conferir `EIXO_DADOS`); `?falhaNoPainel=1` e `?lento` valem para o painel.

- [ ] **Passo 1 (testes primeiro):** placa existente (`AAA0A04`, o "A DEFINIR") devolve o detalhe com os mesmos campos da linha mais `ano`, `renavam`, `desde` e `crs`; `aaa-0a04` e `" aaa0a04 "` acham a mesma; placa inexistente devolve `null`; placa baixada (VND/SUC) é encontrada (a lista as esconde, o painel não); o detalhe do cavalo com CRs sobrepostos traz os dois CRs; sem `EIXO_DADOS=exemplo` recusa com a mesma mensagem da lista; `falhaNoPainel` falha só `obter`, não `consultar`; `lento` vale; e o teste de barramento continua verde (nada novo importa `lib/exemplo/`).
- [ ] **Passo 2:** ver falhar; implementar; ver passar. A página passa a buscar o detalhe em paralelo com a lista (`Promise.all`), com `try/catch` só no detalhe: o erro vira `erro: true` para o painel, e a lista segue. Teste e2e: com `?espiar=AAA0A04&falhaNoPainel=1` a lista aparece e o painel mostra o erro com "Tentar de novo" (que recarrega só o painel).
- [ ] **Passo 3:** commit `feat: obterPlaca e o detalhe da placa para o painel`.

## Tarefa 5: o conteúdo do resumo

**Files:** `components/tabela/resumo-da-placa.tsx` (+ teste), `painel-de-espiar.tsx`

**Interfaces:** `ResumoDaPlaca({ detalhe, aoEspiar }): JSX`, em seções com título e lista de definição (`<dl>`): **cabeçalho** (mini placa grande, tipo e modelo, ano); **Situação** (`Etiqueta` com a sigla e o nome por extenso, "há N dias", "desde dd/mm/aaaa hh:mm"); **Conjunto** (as placas do conjunto como botões "Espiar AAA0B45" que chamam `aoEspiar`; "Sem conjunto" se solo); **Gestor**; **Operação** e **CR vigente** (código e nome; os dois CRs se sobrepostos, com o aviso); **Alertas** (cada um com o texto por extenso, ou "Sem alertas"); **Dados** (motorista, filial, CRLV vence em com aviso se vencido, KM, Valor FIPE em `Moeda`); e o rodapé fixo com "Abrir ficha completa" desligado (`aria-disabled`, dica "Entra na próxima entrega").

- [ ] **Passo 1 (testes primeiro):** unitário de `ResumoDaPlaca` para os casos feios: `AAA0A04` (modelo "A DEFINIR" e alerta), `AAA0A10` (dois CRs vigentes), `AAA0A22` (cavalo em trânsito sem motorista), `AAA0A24` (CRLV vencido), `AAA0C17` (implemento solto há 35 dias), uma placa sem operação e sem CR e uma baixada: cada seção correta, valores vazios como "—", datas em dd/mm/aaaa, KM sem casas, FIPE com centavos, alertas com texto; nada de hex, `Intl` ou `toFixed` fora de `components/formato/`; títulos em ordem (sem pular nível). e2e: abrir cada uma dessas placas mostra os alertas por extenso; clicar numa placa do conjunto troca o painel (`replace`, uma entrada de histórico só) e Esc volta ao foco da linha da placa então aberta; "Abrir ficha completa" desligado não navega; placa inexistente mostra "Placa não encontrada" com o que fazer e o botão de fechar; carregando mostra o esqueleto (`?lento`), sem pulo de layout.
- [ ] **Passo 2:** ver falhar; implementar; ver passar. Commit `feat: resumo da placa no painel de espiar`.

### CHECKPOINT 2 — o resumo
Capturas de 1366 e 1920, tablet e celular (claro e escuro) do resumo de `AAA0A00`, de um caso feio com alertas, do estado de carregando, de "não encontrada" e do erro com "Tentar de novo"; a rota. Parar e pedir aprovação.

## Tarefa 6: Placa anterior e Próxima placa (checkpoint à parte)

**Files:** `painel-de-espiar.tsx`, `lib/navegacao/espiar.ts` (já tem `vizinhas`), `pagina-de-placas.tsx` (passa `placasDaPagina`)

**Interfaces:** no cabeçalho do painel, os botões "Placa anterior" e "Próxima placa" (com o texto "3 de 25") andam pelas linhas da página atual, na ordem em que aparecem; trocar usa `router.replace`; `aria-disabled` (o foco fica no botão) na primeira e na última, e nas duas se a placa aberta não está nesta página (dica "Esta placa não está nesta página"). Não atravessam páginas. A linha da placa aberta rola para a vista atrás do painel (`scrollIntoView({ block: "nearest" })`).

- [ ] **Passo 1 (testes primeiro):** e2e: de `AAA0A00` o "Próxima placa" abre a segunda linha da página (a ordem da tabela, inclusive com `?ordem=-gestor`), o resumo troca, a URL troca com `replace` (uma entrada só no histórico: Voltar depois de andar três placas fecha o painel), o foco fica no botão, o texto mostra "2 de 25"; na primeira, "Placa anterior" é `aria-disabled` e não faz nada; na última, o mesmo com "Próxima placa"; com `tam=25` não passa da linha 25; link direto de placa fora da página desliga os dois; ao fechar, o foco vai para a linha da última placa vista e essa linha está à vista; o `scrollTop` da tabela só muda o necessário para mostrar a linha. tablet e celular: os botões têm 40 px ou mais e cabem no cabeçalho sem rolar.
- [ ] **Passo 2:** ver falhar; implementar; ver passar. Commit `feat: placa anterior e próxima no painel de espiar`.

### CHECKPOINT 3 — anterior e próxima
Capturas (1366 e 1920, tablet e celular, claro e escuro) do painel com os botões, no começo, no meio e no fim da página; a rota. Parar e pedir aprovação.

## Tarefa 7: fechamento

- [ ] **Passo 1:** em build limpo: `pnpm exec prettier --check .`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm exec supabase test db`, `pnpm exec supabase db lint --fail-on warning` e o e2e completo em modo CI (1366, 1920, tablet 820, celular 390).
- [ ] **Passo 2:** revisão por revisor independente (skill `requesting-code-review`), com atenção aos cinco itens de "Review Focus" e às 14 armadilhas; corrigir o importante com teste; registrar o resto em `docs/decisoes.md`.
- [ ] **Passo 3:** `docs/decisoes.md`: o que a 2C-2 decidiu (as propostas acima, como foram aprovadas) e a tabela de "Qualidade de interação" com as regras 1 e 6 agora ativas.
- [ ] **Passo 4:** push da branch e PR "Fase 2C-2: painel de espiar", sem merge, mostrando os checks (só com a autorização de Alexandre).

### CHECKPOINT 4 — final da 2C-2
Capturas finais, resultado dos checks e a rota. Aprovar antes da 2C-3.

## O que fica fora da 2C-2

Ficha completa da placa e o link "Abrir ficha completa" ativo, linha vira link e `th scope="row"`, "voltar da ficha devolve página e linha" (2C-3); seleção em lote e ações de gravação (2D); painel acoplado e não modal em telas largas (descartado); rota interceptada do Next (descartada).
