# TranSul Eixo — Fase 2B (esqueleto de navegação) — Plano de implementação

> **Para quem executa:** use `superpowers:subagent-driven-development` ou `superpowers:executing-plans`. Os passos usam caixas `- [ ]`. **Pare em cada checkpoint (A a E) e peça aprovação.** Em toda tela, use também a skill `frontend-design`.

**Objetivo:** entregar o alicerce de navegação do Eixo: um catálogo único de módulos e telas, a casca do sistema (barra lateral recolhível, topo com contexto global, trilha, layout de leitura, Ctrl+K) e uma tela "Em breve" para tudo o que ainda não foi construído, de modo que a estrutura total exista desde já e as funções entrem uma por vez.

**Arquitetura:** `lib/navegacao/` guarda o catálogo e as regras puras (visibilidade por perfil, busca, estado da barra), todas com teste. Barra lateral, Ctrl+K, trilha e as rotas leem **só** esse catálogo. `components/navegacao/` guarda a casca. `app/(sistema)/` guarda as rotas do sistema, uma página por tela do catálogo. Um teste varre `app/` e exige que toda rota do catálogo exista e que nenhuma rota exista fora dele.

**Stack:** a mesma da 2A (Next.js 16, Tailwind 4, base-ui, Tabler, Vitest, Playwright). **Nenhuma dependência nova.** O Ctrl+K usa o diálogo do base-ui e uma lista própria, sem `cmdk`.

**Spec:** `CLAUDE.md` (Módulos e navegação, Padrões de tela, Textos da interface), `docs/projeto-tecnico.md` (seção "Alicerce e estratégia de entrega") e `docs/decisoes.md` (decisão "Alicerce geral" de 29/10/2026). Sem documento de design separado: este plano faz esse papel; as escolhas minhas estão em "Decisões minhas".

## Restrições globais

- Estratégia: **alicerce completo primeiro, funções depois, uma por vez.** A estrutura total existe desde o início; o que não foi construído aparece como "Em breve".
- **Catálogo único** em `lib/navegacao/`: todos os módulos e telas, cada tela com nome, ícone Tabler, cor do módulo, rota, permissão (módulo e ação) e estado (`pronto`, `em-breve`, `restrito`). Barra lateral, Ctrl+K, trilha e rotas leem só o catálogo.
- **Um componente de tela vazia:** `TelaEmBreve` (nome, ícone, cor do módulo, uma linha do que a tela fará). Telas `em-breve` só aparecem para **Administrador** e **Diretoria**.
- Módulos e telas (de `CLAUDE.md`): Início (Tarefas, Resumo do dia, Mapa do sistema) · Frota (Acompanhamento, Placas, Abastecimento, Carteira, Análise) · Operacional (Pátio, Ordens de carregamento, Análise) · Operações (Operações, Comparativo, Análise) · Pessoas (Pessoas, Escala, Documentos, Diárias e premiação, Campanhas, Análise) · Parceiros (Parceiros, Conciliação, Livro do acionista, Locação) · Resultados (Visão geral, Por operação, Maturação, Fechamentos, Ajustes) · Cadastros · Administração.
- Barra lateral: grupos recolhíveis, modo compacto com painel flutuante, busca no menu, fixados, contadores que sobem ao grupo, memória por usuário, `Ctrl+B` (recolher) e `Ctrl+K` (buscar). Cada pessoa vê só o que pode usar.
- Esqueleto de leitura: contexto global (período, filial, operação, regime) → título e ações → barra de consulta → KPIs → conteúdo. Filtro, aba e rolagem ficam na URL; voltar devolve ao mesmo ponto.
- **Celular e tablet entram no desenho desde esta fase:** Pátio, totem, status diário, carteira e aprovação de casos são telas marcadas para celular e tablet; abaixo de `lg` a barra lateral vira gaveta.
- Toda escrita usa o motor de wizard (2D); nenhuma tela de escrita nasce fora dele. Nesta fase não há escrita.
- Telas de referência: 1366×768 e 1920×1080; mais 390×844 (celular) e 820×1180 (tablet) só para a casca.
- Sem rolagem horizontal da página. Tabela e rolagem lateral só dentro dela (2C).
- Textos em português, frases com letra minúscula normal, sem rótulos em maiúsculas, botão = verbo + objeto.
- Hex só em `app/tokens.css`. Sem credencial. Sem `supabase link`, sem MCP do Supabase, sem `--force`.
- Permissão de verdade (RLS) é da Fase 3. Aqui o perfil é provisório (constante `Administrador`) e a regra de visibilidade já é testada para todos os perfis.

## Review Focus

1. **Catálogo:** rota duplicada, rota sem página, página sem rota e `id` repetido não podem existir; nome de ícone sem componente quebra o teste, não a tela.
2. **Visibilidade:** telas `em-breve` nunca vazam para perfil sem permissão; módulo sem nenhuma tela visível some inteiro da barra; `restrito` aparece desabilitado só para quem deveria saber que existe.
3. **Memória por usuário:** `localStorage` indisponível, JSON corrompido ou de outra versão não pode quebrar a barra; grupo ou fixado que saiu do catálogo é descartado.
4. **Busca:** sem acento e sem diferença de maiúscula ("operacoes" acha "Operações"); termo vazio não lista tudo como resultado; sem resultado mostra o que fazer.
5. **Atalhos:** `Ctrl+B` e `Ctrl+K` não podem disparar com o foco em campo de texto digitando, nem duplicar com o do navegador; `Esc` fecha e devolve o foco; no Mac vale `⌘`.
6. **Casca:** sem rolagem horizontal em 1366, 1920, 820 e 390; com a barra recolhida o conteúdo ocupa a largura toda; a gaveta no celular fecha ao navegar.

---

## Checkpoint A — Catálogo aprovado (antes da casca)

Mostrar a tabela completa do catálogo (módulo, tela, rota, estado, dispositivos, permissão) e as perguntas de "Perguntas para Alexandre". **PARE: aguardar aprovação.**

---

## Tarefa 1: Catálogo único e perfis

**Arquivos:**
- Criar: `lib/navegacao/catalogo.ts`, `lib/navegacao/perfis.ts`
- Teste: `lib/navegacao/catalogo.test.ts`

**Interfaces:**
- `type EstadoDaTela = "pronto" | "em-breve" | "restrito"`; `type Dispositivo = "desktop" | "tablet" | "celular"`.
- `interface Tela { id: string; nome: string; icone: string; rota: string; permissao: { modulo: string; acao: "ver" }; estado: EstadoDaTela; descricao: string; dispositivos: readonly Dispositivo[] }` (`id` no formato `modulo.tela`, `icone` é nome de componente Tabler, `descricao` é a linha do que a tela fará).
- `interface ModuloDoCatalogo { id: "inicio" | Modulo; nome: string; icone: string; cor: "acao" | Modulo; rota: string; telas: readonly Tela[] }` com `Modulo` de `lib/visual/tons.ts`.
- `CATALOGO: readonly ModuloDoCatalogo[]` (9 módulos, na ordem do menu); `todasAsTelas(): readonly Tela[]`; `acharTela(rota: string): { modulo: ModuloDoCatalogo; tela: Tela } | undefined`.
- `perfis.ts`: `PERFIS = ["Administrador", "Diretoria", "Gestor de frota", "Operacional"] as const`; `type Perfil`; `PERFIS_QUE_VEEM_EM_BREVE = ["Administrador", "Diretoria"]`; `perfilAtual(): Perfil` devolve `"Administrador"` (provisório até a Fase 3).

- [ ] **Passo 1: testes que falham** em `catalogo.test.ts`: 9 módulos na ordem do `CLAUDE.md`; `id` e `rota` únicos em todo o catálogo; toda rota começa com `/` e sem barra no fim; toda rota de tela começa com a rota do seu módulo; cada módulo tem `cor` válida; `Pátio`, `Carteira` e `Status diário` têm `celular` e `tablet` em `dispositivos`; toda `descricao` não vazia e sem ponto de exclamação; `acharTela("/frota/placas")` devolve a tela e `acharTela("/nada")` devolve `undefined`; `perfilAtual()` está em `PERFIS`.
- [ ] **Passo 2:** `pnpm test`; esperado: FALHA.
- [ ] **Passo 3:** implementar o catálogo com todas as telas, todas `em-breve` exceto `Administração › Demonstração` (`pronto`, rota `/admin/demonstracao`) e as telas de `Início` que dependem só do catálogo, se Alexandre pedir.
- [ ] **Passo 4 (verificação):** `pnpm test`, `pnpm typecheck`, `pnpm lint`.
- [ ] **Passo 5:** commit `feat: catálogo único de navegação e perfis`.

---

## Tarefa 2: Visibilidade por perfil e busca

**Arquivos:**
- Criar: `lib/navegacao/visibilidade.ts`, `lib/navegacao/busca.ts`
- Teste: `lib/navegacao/visibilidade.test.ts`, `lib/navegacao/busca.test.ts`

**Interfaces:**
- `modulosVisiveis(perfil: Perfil, catalogo = CATALOGO): readonly ModuloDoCatalogo[]` — telas `em-breve` só para `PERFIS_QUE_VEEM_EM_BREVE`; módulo sem tela visível some; ordem preservada.
- `podeAbrir(perfil: Perfil, tela: Tela): boolean` — `pronto` para quem tem a permissão; `em-breve` só para quem vê em breve; `restrito` nunca abre.
- `buscarTelas(termo: string, perfil: Perfil): readonly ResultadoDeBusca[]` com `ResultadoDeBusca = { modulo: ModuloDoCatalogo; tela: Tela }`; sem acento nem maiúscula; termo vazio devolve `[]`; ordena começo de nome antes de meio de nome.

- [ ] **Passo 1: testes que falham:** `Gestor de frota` não vê nenhuma tela `em-breve` e, enquanto tudo for `em-breve`, só vê o que for `pronto`; `Administrador` e `Diretoria` veem as 9; `restrito` aparece na lista mas `podeAbrir` é falso; módulo sem tela visível some; `buscarTelas("operacoes", "Administrador")` acha "Operações"; `buscarTelas("  ", ...)` devolve `[]`; `buscarTelas("placa", ...)` coloca "Placas" antes de "Carteira de placas", se existir.
- [ ] **Passo 2:** `pnpm test`; esperado: FALHA.
- [ ] **Passo 3:** implementar as funções puras; normalizar com `String.prototype.normalize("NFD")`.
- [ ] **Passo 4 (verificação):** `pnpm test`, `pnpm lint`.
- [ ] **Passo 5:** commit `feat: visibilidade por perfil e busca no catálogo`.

---

## Tarefa 3: Telas em breve, rotas e a regra "rota ⇔ catálogo"

**Arquivos:**
- Mover: `app/admin/demonstracao/` para `app/(sistema)/admin/demonstracao/` (mantendo a URL); criar `app/(sistema)/<modulo>/<tela>/page.tsx` para cada tela do catálogo; `app/page.tsx` passa a redirecionar para `/inicio/tarefas`.
- Criar: `components/navegacao/tela-em-breve.tsx`, `components/navegacao/icones.ts`
- Teste: `components/navegacao/tela-em-breve.test.tsx`, `lib/navegacao/rotas.test.ts`, `e2e/rotas.spec.ts`

**Interfaces:**
- `iconeDe(nome: string): ComponentType<{ className?: string }>` em `icones.ts` (mapa de nomes do catálogo para componentes `@tabler/icons-react`; nome desconhecido lança erro no teste, não na tela).
- `<TelaEmBreve rota />`: lê o catálogo por `acharTela(rota)`; mostra ícone, nome, a cor do módulo (faixa e bolinha, nunca texto colorido), a `descricao` e a frase "Esta tela entra em breve."; `role="status"`. Rota fora do catálogo: `notFound()`.
- Cada `page.tsx` de tela: `export default function Pagina() { return <TelaEmBreve rota="/frota/placas" /> }` (uma linha por tela).

- [ ] **Passo 1: testes que falham.** `rotas.test.ts` varre `app/` atrás de `page.tsx` e exige: todo `rota` do catálogo tem página; toda página (exceto `app/page.tsx`) corresponde a uma rota do catálogo; `iconeDe` resolve todos os nomes de ícone do catálogo. `tela-em-breve.test.tsx`: mostra o nome, a descrição e "Esta tela entra em breve."; sem `#`. `e2e/rotas.spec.ts`: para cada tela `em-breve` do catálogo, `goto(rota)` responde 200, mostra o nome num `heading`, não rola na horizontal e não dá erro de console; `/rota-que-nao-existe` mostra a página de não encontrado.
- [ ] **Passo 2:** `pnpm test` e `pnpm test:e2e -g rotas`; esperado: FALHA.
- [ ] **Passo 3:** gerar as páginas a partir do catálogo e mover a demonstração; implementar `TelaEmBreve` com `frontend-design`.
- [ ] **Passo 4 (verificação):** `pnpm test`, `pnpm build`, `CI=1 pnpm test:e2e`.
- [ ] **Passo 5:** commits `feat: tela em breve e páginas de todas as rotas do catálogo` e `chore: demonstração dentro do grupo (sistema)`.

**Checkpoint B — PARE:** mostrar duas telas "Em breve" (claro e escuro) e a saída dos testes de rota. Aguardar aprovação.

---

## Tarefa 4: Estado da barra lateral e memória por usuário

**Arquivos:**
- Criar: `lib/navegacao/estado-da-barra.ts`
- Teste: `lib/navegacao/estado-da-barra.test.ts`

**Interfaces:**
- `interface EstadoDaBarra { versao: 1; compacta: boolean; gruposAbertos: readonly string[]; fixados: readonly string[] }`; `ESTADO_INICIAL`.
- `reduzir(estado, acao): EstadoDaBarra` com ações `alternarCompacta`, `alternarGrupo(id)`, `alternarFixado(idDaTela)`.
- `limparPeloCatalogo(estado, catalogo): EstadoDaBarra` — descarta grupo ou fixado que não existe mais.
- `lerEstado(usuario: string, armazenamento: Pick<Storage, "getItem">): EstadoDaBarra` e `gravarEstado(usuario, estado, armazenamento: Pick<Storage, "setItem">): void` — chave `eixo:barra:<usuario>`; JSON inválido, versão diferente ou armazenamento que lança erro devolvem `ESTADO_INICIAL`; nunca lançam.
- `somarContadores(contadores: Record<string, number>, catalogo): Record<string, number>` — o contador da tela sobe para o módulo (soma), ignorando id desconhecido.

- [ ] **Passo 1: testes que falham:** alternar grupo abre e fecha; fixar duas vezes desfixa; `lerEstado` com `getItem` que lança, com `"{"`, com `{"versao":2}` e com `null` devolve `ESTADO_INICIAL`; `gravarEstado` com `setItem` que lança não propaga; `limparPeloCatalogo` remove `"frota.inexistente"`; `somarContadores({ "frota.placas": 3, "frota.carteira": 2, "x.y": 9 })` dá `{ frota: 5 }`.
- [ ] **Passo 2:** `pnpm test`; esperado: FALHA.
- [ ] **Passo 3:** implementar como funções puras.
- [ ] **Passo 4 (verificação):** `pnpm test`, `pnpm lint`.
- [ ] **Passo 5:** commit `feat: estado da barra lateral com memória por usuário`.

---

## Tarefa 5: Barra lateral

**Arquivos:**
- Criar: `components/navegacao/barra-lateral.tsx`, `components/navegacao/grupo-do-menu.tsx`, `components/navegacao/atalhos.ts`
- Teste: `components/navegacao/barra-lateral.test.tsx`, `e2e/barra-lateral.spec.ts`

**Interfaces:**
- `<BarraLateral perfil usuario contadores? />` (cliente): lê `modulosVisiveis(perfil)`; cada módulo é um grupo recolhível com a cor forte numa faixa e a bolinha; item da tela com ícone Tabler, nome e contador; tela atual com `aria-current="page"`; item `em-breve` com a etiqueta "Em breve"; `restrito` desabilitado.
- Modo compacto: só ícones; ao passar o mouse ou focar num módulo abre um painel flutuante com as telas dele (`role="menu"`, `Esc` fecha); `Ctrl+B` alterna.
- Busca no menu: campo "Buscar no menu" filtra pelas funções de `busca.ts`; fixados no topo; fixar por botão com `aria-pressed`.
- `ehAtalhoDeTexto(alvo: EventTarget | null): boolean` em `atalhos.ts` — verdadeiro em `input`, `textarea`, `select` e `contenteditable`; atalhos `Ctrl+B` e `Ctrl+K` não disparam nesses campos.

- [ ] **Passo 1: testes que falham.** Vitest (`renderToStaticMarkup`): `Gestor de frota` não recebe nenhuma tela `em-breve`; `Administrador` recebe os 9 módulos; item da tela atual tem `aria-current`. `atalhos.test`: `ehAtalhoDeTexto` em `input`, `textarea`, `div contenteditable`. Playwright (1366 e 1920, claro e escuro): abrir e fechar grupo; recolher com `Ctrl+B` e a largura da barra diminui; no modo compacto o painel flutuante abre no foco e fecha com `Esc`; recarregar a página mantém o estado (memória); digitar "oper" na busca do menu mostra Operacional e Operações; `Ctrl+B` com o foco num campo de texto não recolhe.
- [ ] **Passo 2:** rodar; esperado: FALHA.
- [ ] **Passo 3:** implementar com `frontend-design`; o estado vem de `reduzir`, a persistência de `lerEstado` e `gravarEstado` num efeito.
- [ ] **Passo 4 (verificação):** `pnpm test`, `pnpm lint`, `pnpm build`, `CI=1 pnpm test:e2e`.
- [ ] **Passo 5:** commits `feat: barra lateral recolhível com painel flutuante` e `feat: busca, fixados e contadores no menu`.

**Checkpoint C — PARE:** mostrar a barra aberta, compacta e com o painel flutuante, claro e escuro, em 1366 e 1920. Aguardar aprovação.

---

## Tarefa 6: Topo com contexto global, trilha e layout de leitura

**Arquivos:**
- Criar: `components/navegacao/topo.tsx`, `components/navegacao/contexto-global.tsx`, `components/navegacao/trilha.tsx`, `components/layout/pagina-de-leitura.tsx`, `lib/navegacao/contexto.ts`, `app/(sistema)/layout.tsx`
- Teste: `lib/navegacao/contexto.test.ts`, `components/navegacao/trilha.test.tsx`, `e2e/topo.spec.ts`

**Interfaces:**
- `interface ContextoGlobal { periodo: string; filial: string; operacao: string; regime: string }` (`periodo` no formato `aaaa-mm`); `lerContexto(parametros: URLSearchParams, hoje: string): ContextoGlobal` — valor ausente ou inválido volta ao padrão (mês de `hoje`, `"todas"`, `"todas"`, `"gerencial"`); `escreverContexto(parametros: URLSearchParams, contexto: ContextoGlobal): URLSearchParams` — só grava o que difere do padrão.
- `<Trilha rota />`: Módulo › Tela, só com o catálogo; módulo é link para a primeira tela visível; a tela atual é texto com `aria-current="page"`.
- `<PaginaDeLeitura titulo acoes? consulta? kpis?>{conteudo}</PaginaDeLeitura>`: contexto global fica no topo do layout; aqui entram título, ações, barra de consulta e KPIs como espaços (slots), na ordem do `CLAUDE.md`.
- `app/(sistema)/layout.tsx`: casca (`BarraLateral` + `Topo` + conteúdo em largura total), `<main id="conteudo">` e um link "Pular para o conteúdo".

- [ ] **Passo 1: testes que falham:** `lerContexto(new URLSearchParams("periodo=2026-13"), "2026-10-29")` devolve o período `2026-10`; `periodo=2026-09` é mantido; `regime=xyz` volta a `gerencial`; `escreverContexto` com tudo no padrão devolve parâmetros vazios; ida e volta (`escrever` → `ler`) preserva um contexto válido. `trilha.test`: `/frota/placas` mostra "Frota" e "Placas" com `aria-current` na segunda; rota desconhecida não quebra. Playwright: trocar a filial muda a URL e voltar do navegador devolve a filial anterior; recarregar mantém o contexto; "Pular para o conteúdo" leva o foco ao `main`.
- [ ] **Passo 2:** rodar; esperado: FALHA.
- [ ] **Passo 3:** implementar. Opções de filial, operação e regime vêm de uma lista provisória em `lib/navegacao/contexto.ts` (só "Todas" e "Gerencial") até a Fase 4 trazer os cadastros.
- [ ] **Passo 4 (verificação):** `pnpm test`, `pnpm lint`, `pnpm build`, `CI=1 pnpm test:e2e`.
- [ ] **Passo 5:** commits `feat: contexto global na URL` e `feat: topo, trilha e layout de leitura`.

---

## Tarefa 7: Busca rápida (Ctrl+K)

**Arquivos:**
- Criar: `components/navegacao/busca-rapida.tsx`
- Teste: `components/navegacao/busca-rapida.test.tsx`, `e2e/busca-rapida.spec.ts`

**Interfaces:**
- `<BuscaRapida perfil />` (cliente): diálogo do base-ui aberto por `Ctrl+K` (`⌘K` no Mac) e por um botão "Buscar" no topo; campo com `role="combobox"`, lista com `role="listbox"`, setas movem a opção ativa (`aria-activedescendant`), `Enter` abre a tela com `router.push`, `Esc` fecha e devolve o foco a quem abriu. Resultado vem de `buscarTelas`; sem termo mostra os fixados e as últimas telas abertas; sem resultado diz "Nenhuma tela encontrada. Tente outro nome." e oferece limpar a busca.

- [ ] **Passo 1: testes que falham.** Playwright: `Ctrl+K` abre; digitar "carteira" mostra Frota › Carteira; `Enter` navega para `/frota/carteira`; `Esc` fecha e o foco volta ao botão; `Ctrl+K` com o foco num campo de texto da página **abre** (é atalho global de busca), mas digitar nele não aciona `Ctrl+B`; sem resultado mostra a mensagem. Vitest: renderização do estado vazio e sem resultado.
- [ ] **Passo 2:** rodar; esperado: FALHA.
- [ ] **Passo 3:** implementar com o diálogo do base-ui, sem dependência nova.
- [ ] **Passo 4 (verificação):** `pnpm test`, `pnpm lint`, `pnpm build`, `CI=1 pnpm test:e2e`.
- [ ] **Passo 5:** commit `feat: busca rápida com Ctrl+K`.

**Checkpoint D — PARE:** mostrar a busca rápida aberta e o fluxo digitar → Enter → tela, claro e escuro. Aguardar aprovação.

---

## Tarefa 8: Celular e tablet

**Arquivos:**
- Modificar: `components/navegacao/barra-lateral.tsx`, `components/navegacao/topo.tsx`, `playwright.config.ts` (projetos `celular-390` e `tablet-820`, só para os arquivos `e2e/casca.spec.ts`)
- Criar: `e2e/casca.spec.ts`

**Interfaces:**
- Abaixo de `lg` a barra lateral vira gaveta aberta por um botão "Abrir menu" no topo (`aria-expanded`), fecha ao navegar e com `Esc`; no celular o topo mostra o contexto global recolhido num botão "Contexto".
- Telas sem `celular` em `dispositivos` mostram, no celular, um aviso "Esta tela funciona melhor em um computador" **sem bloquear** o uso.

- [ ] **Passo 1: testes que falham** em `e2e/casca.spec.ts` (nos quatro tamanhos: 1366, 1920, 820, 390): sem rolagem horizontal em `/frota/placas` e `/operacional/patio`; em 820 e 390 o menu abre pela gaveta, mostra Pátio e fecha ao navegar; `/operacional/patio` não mostra o aviso no celular e `/pessoas/escala` mostra.
- [ ] **Passo 2:** `pnpm test:e2e -g casca`; esperado: FALHA.
- [ ] **Passo 3:** implementar a gaveta e o aviso; adicionar os dois projetos ao Playwright.
- [ ] **Passo 4 (verificação):** `CI=1 pnpm test:e2e` verde em todos os projetos.
- [ ] **Passo 5:** commit `feat: casca responsiva para tablet e celular`.

---

## Tarefa 9: Demonstração da casca, verificação final, revisão e pull request

**Arquivos:**
- Modificar: `app/(sistema)/admin/demonstracao/page.tsx` (agora dentro da casca real)
- Modificar: `CLAUDE.md` (linha "Estrutura": `app/(sistema)/` e `lib/navegacao/`) — **mudança de regra: só com o OK de Alexandre no checkpoint A**

- [ ] **Passo 1:** `verification-before-completion`: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `CI=1 pnpm test:e2e`, `supabase test db` (Docker). Colar a saída resumida.
- [ ] **Passo 2:** `requesting-code-review` na branch inteira; corrigir críticos e importantes, um commit por assunto.
- [ ] **Passo 3:** push e pull request "Fase 2B: esqueleto de navegação", sem `--force`; acompanhar `gh pr checks`. **Não fazer merge.**

**Checkpoint E — PARE:** capturas da casca (claro e escuro; 1366, 1920, 820 e 390), resultado do review e dos checks. O merge é de Alexandre.

---

## Perguntas para Alexandre

1. **Telas que o catálogo ainda não tem.** Para cumprir "Pátio, totem, status diário, carteira e aprovação de casos", proponho acrescentar: Operacional › **Totem**; Pessoas › **Status diário**; Início › **Tarefas** cobre a aprovação de casos. Posso incluir essas duas telas novas?
2. **Estrutura de pastas.** Para a casca não valer no futuro login, as rotas do sistema ficam em `app/(sistema)/<módulo>/`. Isso muda a linha "Estrutura" do `CLAUDE.md` (a URL não muda). Posso editar essa linha?
3. **Regime.** No contexto global, o "regime" tem quais valores? Proponho só "Gerencial" por enquanto (a competência gerencial já está definida), e acrescentar "Contábil" e "Caixa" quando existirem.
4. **Perfis.** Uso os quatro nomes de perfil que o `CLAUDE.md` cita (Administrador, Diretoria, Gestor de frota, Operacional). Faltam outros que a barra precise conhecer?
5. **Tela inicial.** `/` redireciona para Início › Tarefas. Está certo, ou a primeira tela é o Resumo do dia?

## Decisões minhas (para conferir)

- Sem `cmdk`: a busca rápida usa o diálogo do base-ui e uma lista própria. Menos uma dependência, mais código para testar.
- Perfil provisório `Administrador` até a Fase 3; a regra de visibilidade já é testada para os quatro perfis.
- Memória da barra em `localStorage` por usuário (provisório, até haver login), com versão no formato para poder mudar depois.
- O contexto global vive só na URL (`periodo`, `filial`, `operacao`, `regime`), sem estado paralelo.
- O contador do menu é só uma propriedade da barra; de onde ele vem (tarefas, casos) entra com cada função.
- `Mapa do sistema` (Início) fica `em-breve` nesta fase, mesmo podendo ser gerado do catálogo; entra na primeira função de Início.
- Não entram: densidade compacta/confortável, modo foco, painel lateral de detalhe, tabela (2C) e wizard (2D).
