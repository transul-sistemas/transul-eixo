# Fase 2C-1: lista de placas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (a sessão executa inline) para implementar este plano tarefa a tarefa. Os passos usam caixas `- [ ]`.

**Goal:** `/frota/placas` mostra a lista de placas com dados de exemplo: chips de status com contagem, busca, ordenação com desempate pela chave, paginação no servidor, estados carregando/vazio/erro, densidade, colunas escolhíveis e reordenáveis, tudo na URL ou em cookie validado.

**Architecture:** o servidor dirige. A página lê a URL (`?q`, `?chip`, `?sigla`, `?baixadas`, `?ordem`, `?pagina`, `?tam`) e as preferências (cookie), valida com Zod, chama `listarPlacas()` de `lib/dados/` e devolve só a página e os totais. `listarPlacas()` fala com uma fonte; hoje a única é `lib/dados/fonte-de-exemplo.ts`, que lê `lib/exemplo/` e só funciona com `EIXO_DADOS=exemplo`. O TanStack Table roda em modo manual (colunas, visibilidade, ordem das colunas); não pagina, ordena nem filtra.

**Tech Stack:** Next.js 16 (Server Components, Suspense, PPR), TanStack Table, Zod, Tailwind/base-ui, Vitest, Playwright.

**Spec:** `docs/decisoes.md` (entradas "Dados de exemplo até o Acompanhamento da Frota ficar pronto", "Qualidade de interação" e "Armadilhas conhecidas"), `CLAUDE.md` (Padrões de tela, Qualidade de interação, Armadilhas conhecidas) e o desenho aprovado na conversa de 29/10/2026 (abordagem B e os quatro reforços, resumidos abaixo em "Decisões aprovadas").

## Decisões aprovadas

1. **Porta única para o exemplo:** só `lib/dados/fonte-de-exemplo.ts` importa `lib/exemplo/`. Ela lança erro a menos que `EIXO_DADOS=exemplo`. O teste de barramento libera apenas ela, os testes (`*.test.ts(x)`), `lib/exemplo/` e `app/**/desenvolvimento/`. A variável **nunca é definida na Vercel** (registrado em `docs/decisoes.md` e em `.env.example`); vive em `.env.development` (só `pnpm dev`) e no `webServer` do Playwright e no CI de testes.
2. **Preferências em cookie** (`eixo-tabela-placas`: tamanho da página, densidade, colunas e ordem das colunas), validadas na leitura (valor permitido, coluna existente) com padrão se inválido. Gravadas no cliente por `document.cookie` (não é Server Action: é preferência visual). No login (Fase 3) passam para o banco.
3. **Contagem dos chips:** a de cada grupo ignora a seleção do próprio grupo e respeita a busca, os outros grupos e "inclui baixadas". Chip com contagem zero fica apagado, mas continua clicável se estiver selecionado (para desfazer).
4. **Teto de 100** linhas por página no servidor, mesmo que a URL peça mais. **"Inclui baixadas"** (VND e SUC) desligado por padrão.

## Global Constraints

- Sem cor, tamanho de fonte ou formato à mão: tokens, `Etiqueta`, `Placa`, `components/formato/` (`formatarInteiro`, `formatarData`). Proibido `Intl`, `toLocale*` e `toFixed` fora de `components/formato/`; hex só em `app/tokens.css`.
- Cor de status diz como está a placa (Etiqueta de status); cor de módulo (Frota `#4338CA`) só no cabeçalho da tela. Nunca misturar.
- Textos: português, minúsculas normais, botão = verbo + objeto; erro diz o que houve e como resolver; vazio convida a agir.
- Nenhuma tela soma linhas no navegador: totais e contagens vêm de `listarPlacas()`.
- Largura total; rolagem lateral só dentro da tabela; cabeçalho e primeira coluna fixos; referências 1366 × 768 e 1920.
- A sigla exata aparece na linha e no filtro avançado; o chip é só agrupamento.
- Parâmetros da URL, na ordem: `q`, `chip` (repetido), `sigla` (repetido), `baixadas=1`, `ordem` (`campo` ou `-campo` para decrescente), `pagina` (base 1), `tam`. Mudar `q`, `chip`, `sigla`, `baixadas`, `ordem` ou `tam` volta para `pagina=1`; atualizar a página não.
- Desempate: toda ordenação termina em `id` crescente. Padrão: `placa` crescente, `tam=25`, densidade compacta.
- Sem push, sem merge, sem `--force`; sem Supabase na nuvem; sem segredo em arquivo. Commits por assunto, com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Tabela sigla → chip (ponto de partida aprovado por Alexandre)

| Chip | Siglas |
|------|--------|
| Em atividade | DOp, ACe, CAr, CAn, ETc, ADe, DEs, ETv |
| Impedida | MAc, MAt, MAv, MAN, REF, SIN, SDo, DOC |
| Atenção | SMo, FOg, FEr, VAz |
| Pátio | PÁT |
| Fora | ALU, EMP, VEN, SUC, VND |

26 siglas, cada uma em um só chip (confere com a régua do `CLAUDE.md`). **Baixadas:** VND e SUC. Os nomes por extenso (aprovados por Alexandre em 29/10/2026) ficam em `docs/glossario.md` e em `NOMES_DAS_SIGLAS`. O grupo extra de chips por **tipo de ativo** (cavalo, implemento, equipamento, caminhão, veículo pequeno, apoio) entra na Tarefa 9 (aprovado).

## Review Focus

Entradas que a especificação implica e nenhuma tarefa de regra cobre por si; cada uma ganha teste na tarefa dona.

1. Busca com apóstrofo, `%`, `_`, emoji, só espaços e placa digitada com hífen ou minúscula (`aaa-0a00`): acha a placa, não quebra, não vira filtro vazio. (Tarefa 5)
2. `pagina=0`, `pagina=abc`, `pagina=9999`, `tam=500`, `tam=-1`, `ordem=` desconhecida: padrão ou limite, nunca erro nem página em branco. (Tarefa 4)
3. Ordenar por coluna com valores nulos (motorista, CRLV) e com muitos empates: nulos sempre no fim, e percorrer todas as páginas não repete nem perde nenhuma linha. (Tarefa 5)
4. Cookie corrompido, com coluna inexistente, tamanho fora da lista, JSON gigante ou texto em vez de JSON: padrão, sem erro. (Tarefa 8)
5. Filtros que zeram o resultado: vazio com convite e botão "Limpar filtros"; chip selecionado com contagem zero continua clicável. (Tarefas 5 e 7)

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---------|------------------|
| `lib/dominio/status.ts` | 26 siglas, `grupoDaSigla`, `SIGLAS_DE_BAIXA` |
| `lib/exemplo/placas.ts`, `lib/exemplo/casos-feios.ts` | placas fictícias `AAA0A00…` na forma do modelo futuro |
| `lib/dados/fonte-de-exemplo.ts` | única porta para `lib/exemplo/`; consulta em memória, `?lento` e `?falha` |
| `lib/dados/fonte.ts` | escolhe a fonte (hoje só a de exemplo; outra coisa lança erro claro) |
| `lib/dados/placas.ts` | tipos e `listarPlacas()` |
| `lib/navegacao/tabela.ts` | `lerTabela`/`escreverTabela` (URL ⇄ consulta), Zod, limites |
| `lib/navegacao/preferencias-da-tabela.ts` | `lerPreferencias`/`serializarPreferencias` (cookie) |
| `lib/qualidade/barramento-do-exemplo.ts` (+ teste) | barra importação de `lib/exemplo/` fora das portas liberadas |
| `components/tabela/` | `tabela-de-dados.tsx`, `cabecalho-ordenavel.tsx`, `paginador.tsx`, `estados.tsx`, `colunas.tsx`, `densidade.tsx` |
| `app/(sistema)/frota/placas/page.tsx` (+ `error.tsx`) | a tela |

## Tarefa 1: base (dependências, ambiente, registro)

**Files:** `package.json`, `.env.development`, `.env.example`, `playwright.config.ts`, `.github/workflows/*.yml` (só o job de testes), `docs/decisoes.md`

- [ ] **Passo 1:** `pnpm add @tanstack/react-table zod` (versões fixas, `pnpm-lock.yaml` comitado). Confirmar que `.env.development` não está no `.gitignore` e que não há segredo nele.
- [ ] **Passo 2:** `.env.development` com `EIXO_DADOS=exemplo`; `.env.example` com a variável comentada e a frase "nunca definir na Vercel"; `playwright.config.ts` e o job de testes do CI passam `EIXO_DADOS=exemplo` ao servidor de teste.
- [ ] **Passo 3:** entrada em `docs/decisoes.md`: "Lista de placas: abordagem B, porta única do exemplo e `EIXO_DADOS` nunca na Vercel", com os quatro reforços.
- [ ] **Passo 4:** `pnpm lint && pnpm typecheck && pnpm test` verdes. Commit: `chore: tanstack table, zod e EIXO_DADOS para a lista de placas`.

## Tarefa 2: regras das siglas e dos alertas (`lib/dominio/status.ts` e `alertas.ts`)

**Interfaces — Produces:** `SIGLAS` (as 26, `as const`), `type Sigla`, `grupoDaSigla(sigla: Sigla): Status` (`Status` de `lib/visual/tons`), `NOMES_DAS_SIGLAS: Record<Sigla, string>`, `SIGLAS_DE_BAIXA: readonly Sigla[]` (`VND`, `SUC`), `ehBaixada(sigla: Sigla): boolean`. Em `alertas.ts`: `interface DadosParaAlertas { tipo: string; modelo: string; sigla: Sigla; desde: string; motorista: string | null; crlvVenceEm: string | null; crs: { inicio: string; fim: string | null }[]; semCavalo: boolean }`, `type Alerta = { codigo: "modelo-a-definir" | "crlv-vencido" | "sem-motorista" | "implemento-solto" | "cr-sobreposto"; texto: string }`, `alertasDaPlaca(dados: DadosParaAlertas, hoje: string): Alerta[]`.

- [ ] **Passo 1 (testes primeiro):** `status.test.ts`: "toda sigla do CLAUDE.md tem exatamente um chip" (lê as 26 de um array copiado do `CLAUDE.md` no teste); "a tabela é a aprovada" (sigla a sigla); "Em atividade tem 8, Impedida 8, Atenção 4, Pátio 1, Fora 5"; "VND e SUC são baixadas e ninguém mais"; `PÁT` com acento; "os 26 nomes por extenso são exatamente os aprovados" e "`docs/glossario.md` traz cada sigla com o mesmo nome" (lê o arquivo, para os dois não divergirem). `alertas.test.ts`: cada regra com um exemplo que alerta e um que não; limites: CRLV que vence **hoje** não alerta e o de ontem alerta; implemento sem cavalo há 30 dias não alerta e há 31 alerta; "dois CRs" só quando há dois vigentes **hoje**, com `[início, fim)` (um que termina hoje e outro que começa hoje **não** se sobrepõem); cavalo sem motorista só alerta em atividade; modelo `"A DEFINIR"` (maiúsculas e minúsculas) alerta.
- [ ] **Passo 2:** ver falhar (módulo inexistente); implementar com um `Record<Sigla, Status>`; ver passar.
- [ ] **Passo 3:** commit `feat: siglas de status e o chip de cada uma`.

## Tarefa 3: dados de exemplo e o barramento

**Files:** `lib/exemplo/placas.ts`, `lib/exemplo/casos-feios.ts`, `lib/exemplo/placas.test.ts`, `lib/qualidade/barramento-do-exemplo.ts`, `lib/qualidade/barramento-do-exemplo.test.ts`

**Interfaces — Produces:** `type TipoDeAtivo = "cavalo" | "implemento" | "equipamento" | "caminhao" | "veiculo-pequeno" | "apoio"`; `interface PlacaDeExemplo { id: string; placa: string; renavam: string; tipo: TipoDeAtivo; modelo: string; ano: number | null; sigla: Sigla; desde: string /* aaaa-mm-ddThh:mm */; filial: string; operacao: string | null; crs: { codigo: string; nome: string; inicio: string; fim: string | null }[] /* [início, fim) */; gestor: string; motorista: string | null; crlvVenceEm: string | null; km: number | null; valorFipeCentavos: number | null; conjunto: { cavaloId: string | null; implementoIds: string[] } /* composição vigente: cavalo traz os implementos; implemento traz o cavalo */ }`; `PLACAS_DE_EXEMPLO: readonly PlacaDeExemplo[]` (≈ 240, determinísticas, sem sorteio sem semente). `barramentoDoExemplo(arquivos: {caminho: string; texto: string}[]): string[]` devolve os caminhos que importam `lib/exemplo` ou `@/lib/exemplo` sem estar liberados.

- [ ] **Passo 1 (testes primeiro):** `placas.test.ts`: placas únicas e no formato `AAA0A00`; `id` único; cada sigla das 26 aparece ao menos uma vez; casos feios presentes: modelo `"A DEFINIR"`, cavalo com dois CRs vigentes em períodos que **não** se sobrepõem (e um caso que se sobrepõe, para a tela mostrar o defeito), implemento solto há mais de 30 dias, cavalo sem motorista, `crlvVenceEm` no passado, motorista nulo, `operacao` nula; as vigências respeitam `[início, fim)`.
  `barramento-do-exemplo.test.ts`: exemplos bom e ruim (um arquivo de `app/` que importa o exemplo é acusado; `lib/dados/fonte-de-exemplo.ts`, `*.test.ts`, `lib/exemplo/**` e `app/x/desenvolvimento/page.tsx` passam); e o teste "no repositório de verdade" sem acusações.
- [ ] **Passo 2:** ver falhar; implementar os dados (gerador determinístico por índice + casos feios escritos à mão) e `barramentoDoExemplo`; ver passar.
- [ ] **Passo 3:** commit `feat: dados de exemplo de placas e o teste que barra o import fora das portas`.

## Tarefa 4: URL e preferências → consulta (`lib/navegacao/tabela.ts`)

**Interfaces — Produces:** `interface ConsultaDeTabela { busca: string; chips: string[]; siglas: Sigla[]; baixadas: boolean; ordem: { campo: string; sentido: "asc" | "desc" }; pagina: number; tam: number }`; `lerTabela(params: URLSearchParams, padrao: { tam: number; ordem: string }, camposOrdenaveis: readonly string[]): ConsultaDeTabela`; `escreverTabela(params: URLSearchParams, consulta: ConsultaDeTabela, padrao): URLSearchParams` (omite o que é padrão; zera a página quando outro campo muda via `mudarConsulta`). `TETO_DE_TAM = 100`.

- [ ] **Passo 1 (testes primeiro):** ida e volta (`escrever` depois `ler` devolve a mesma consulta); `pagina=0|abc|-3` → 1; `tam=500` → 100; `tam=-1|abc` → padrão; `ordem=desconhecida` → padrão; `ordem=-dias` → desc; `sigla=XYZ` descartada; `baixadas=1` → true; parâmetros alheios (contexto global, `modo`) ficam intactos; `mudarConsulta` com outro filtro volta a `pagina=1` e com a mesma consulta mantém a página.
- [ ] **Passo 2:** ver falhar; implementar com Zod (`z.coerce`, `.catch(padrão)`); ver passar. Commit `feat: consulta de tabela na URL, com limites`.

## Tarefa 5: `listarPlacas()` e a fonte de exemplo

**Files:** `lib/dados/placas.ts`, `lib/dados/fonte.ts`, `lib/dados/fonte-de-exemplo.ts`, `lib/dados/placas.test.ts`

**Interfaces — Produces:** `interface LinhaDePlaca { id; placa; tipo; modelo; conjunto: { cavalo: string | null; implementos: string[] } /* placas, não ids */; gestor; operacao: string | null; cr: string | null /* vigente em hoje */; sigla; nomeDaSituacao; grupo: Status; diasNoStatus: number; alertas: Alerta[]; km: number | null; valorFipeCentavos: number | null; motorista: string | null; crlvVenceEm: string | null; filial }`; `interface PaginaDePlacas { linhas: LinhaDePlaca[]; total: number; pagina: number; paginas: number; tam: number; contagens: Record<string, number> /* por chip */ }`; `listarPlacas(consulta: ConsultaDeTabela, hoje: string): Promise<PaginaDePlacas>`. Campos ordenáveis: `placa`, `tipo`, `modelo`, `conjunto` (pela placa do cavalo, depois dos implementos), `gestor`, `operacao`, `situacao` (pela sigla), `alertas` (quantidade), `km`, `cr`, `fipe`, `dias`.

- [ ] **Passo 1 (testes primeiro, `placas.test.ts`, com `EIXO_DADOS=exemplo`):**
  - sem filtro nem baixadas: `total` = quantidade de placas cuja sigla não é VND/SUC; com `baixadas: true` inclui todas.
  - **desempate:** percorrer todas as páginas (`tam` 7) em cada campo ordenável, nas duas direções, dá a lista inteira sem repetir nem perder `id` e igual à ordenação completa (armadilha 1).
  - nulos sempre no fim, em `asc` e em `desc`.
  - busca: `aaa-0a00`, `aaa0a00`, ` AAA0A00 ` (espaços) acham a mesma placa; busca por trecho do modelo e do gestor; `'`, `%`, `_`, emoji e `   ` não quebram (só-espaços = sem busca).
  - chips: dois chips do mesmo grupo = OU; grupos diferentes = E; `sigla=PÁT` combina em E com o chip.
  - **contagens:** a do grupo `status` ignora a seleção de `status` mas respeita a busca, o grupo `tipo` e `baixadas`; a do grupo `tipo` idem; chip zerado tem contagem 0 (e não some do objeto).
  - `pagina` acima do fim devolve a última; `paginas` ≥ 1 mesmo com zero resultado; `tam` acima de 100 nunca devolve mais de 100 linhas.
  - sem `EIXO_DADOS=exemplo`, `listarPlacas()` lança "A fonte de exemplo só roda com EIXO_DADOS=exemplo".
- [ ] **Passo 2:** ver falhar; implementar a consulta em memória na fonte de exemplo (filtros → ordenação com `id` no fim → corte da página); `placas.ts` só delega para `fonte()`. Ver passar.
- [ ] **Passo 3:** `?lento=<ms>` e `?falha=1` ficam como opções de `ConsultaDeTabela.simulacao` (`{ lentoMs?: number; falha?: boolean }`), lidas só pela fonte de exemplo; teste: com `falha`, lança erro; com `lentoMs`, demora pelo menos esse tempo.
- [ ] **Passo 4:** `pnpm test` (inclui o teste de barramento e as verificações de `armadilhas`) verde. Commit `feat: listarPlacas com filtros, ordem estável, contagens e página`.

## Tarefa 6: a lista aparece em /frota/placas (tabela simples)

**Files:** `components/tabela/tabela-de-dados.tsx`, `cabecalho-ordenavel.tsx`, `paginador.tsx`, `app/(sistema)/frota/placas/page.tsx`, `e2e/placas.spec.ts`

**Interfaces — Produces:** `TabelaDeDados<T>({ colunas, linhas, ordem, aoOrdenar, rotulo })` (TanStack em modo manual; cabeçalho com `aria-sort`; `<table>` semântica); `Paginador({ pagina, paginas, total, tam, aoMudar })` (mostra "Mostrando X–Y de N placas" com o total já filtrado e "página P de Q"). A página lê `searchParams`, chama `lerTabela` e `listarPlacas`, monta `PaginaDeLeitura` + `BarraDeConsultaDaPagina` com os chips e as contagens + a tabela. **Colunas padrão (aprovadas):** Placa (`Placa`), Tipo, Modelo, Conjunto (placas do cavalo e dos implementos em mini placas; "—" se solo), Gestor, Operação, Situação (`Etiqueta` do grupo com a **sigla e o nome por extenso**) e Alertas (quantidade, com a lista no tooltip e para leitor de tela). **Fora do padrão, no seletor, desligadas:** KM (`formatarKm`), CR (vigente) e Valor FIPE (`Moeda`).

- [ ] **Passo 1 (e2e primeiro, `placas.spec.ts`, projetos 1366 e 1920):** título "Placas" e a tabela com a primeira linha `AAA0A00`; chips mostram as contagens do servidor (e a soma dos chips de status = total sem filtro); clicar num chip filtra e vai à URL (`?chip=`), recarregar mantém; busca por `AAA0A0` filtra; clicar no cabeçalho "Placa" ordena (`aria-sort`) e vai à URL; segunda página (`pagina=2`) mostra linhas diferentes e "Mostrando 26–50"; Voltar do navegador desfaz um passo e não sai do sistema; a **página não rola** na horizontal em 1366 e 1920.
- [ ] **Passo 2:** ver falhar (tela "Em breve"); implementar; `Suspense` com esqueleto simples em volta da tabela; ver passar.
- [ ] **Passo 3:** `pnpm lint && pnpm typecheck && pnpm test` e o e2e da tela verdes.
- [ ] **Passo 4:** commit `feat: lista de placas em /frota/placas (chips, busca, ordem e página)`.

### CHECKPOINT 1 — a lista aparece
Capturas em 1366 e 1920, claro e escuro (lista, filtro por chip, segunda página, ordenação) e a rota para abrir com `pnpm dev` (`/frota/placas`). Parar e pedir aprovação do visual antes de seguir.

## Tarefa 7: estados (carregando, vazio, erro) e a busca que cancela

**Files:** `components/tabela/estados.tsx`, `app/(sistema)/frota/placas/error.tsx`, ajustes na página, `e2e/placas.spec.ts`

- [ ] **Passo 1 (e2e primeiro):** com `?lento=800` aparece o esqueleto (linhas cinza do tamanho da tabela, sem mudar o layout) e some quando chega; com `?q=zzzz` aparece o vazio "Nenhuma placa encontrada" com o botão "Limpar filtros" que volta à lista; com `?falha=1` aparece o erro com o que houve e "Tentar de novo", que, sem `falha`, recarrega a lista; **busca digitada cancela a resposta anterior:** com `?lento=600`, digitar "AAA0A0" e logo depois "AAA0A1" termina mostrando só o resultado de "AAA0A1" (armadilha 4); atualizar a página (`F5` e `router.refresh`) mantém filtro, ordem e página (armadilha 2); chip selecionado com contagem zero aparece apagado mas clicável.
- [ ] **Passo 2:** ver falhar; implementar (`error.tsx` com `reset`); ver passar. Commit `feat: estados da lista de placas (carregando, vazio e erro)`.

## Tarefa 8: tamanho de página, densidade e preferências em cookie

**Files:** `lib/navegacao/preferencias-da-tabela.ts` (+ teste), `components/tabela/densidade.tsx`, `paginador.tsx`, ajustes na página

**Interfaces — Produces:** `interface PreferenciasDaTabela { tam: 25 | 50 | 100; densidade: "compacta" | "confortavel"; colunas: string[] | null; ordemDasColunas: string[] | null }`; `lerPreferencias(valor: string | undefined, colunasValidas: readonly string[]): PreferenciasDaTabela` (nunca lança); `serializarPreferencias(p): string`; nome do cookie `eixo-tabela-placas`.

- [ ] **Passo 1 (testes primeiro):** `undefined`, vazio, `"não é json"`, JSON de tipo errado, `tam: 7|"x"|9999`, `densidade: "enorme"`, coluna inexistente, coluna repetida e valor com mais de 2 000 caracteres: tudo cai no padrão campo a campo (valor válido vizinho é mantido); ida e volta; e2e: escolher 50 por página persiste ao recarregar e na volta de outra tela (o servidor lê o cookie e o `tam` da URL, quando existe, vale mais); densidade compacta/confortável muda a altura da linha e persiste.
- [ ] **Passo 2:** ver falhar; implementar (leitura via `cookies()` dentro do `Suspense`, gravação por `document.cookie`, `path=/`, 1 ano, `SameSite=Lax`); ver passar. Commit `feat: tamanho de página e densidade lembrados em cookie validado`.

### CHECKPOINT 2 — estados e preferências
Capturas dos estados (esqueleto, vazio, erro), das duas densidades e do seletor de tamanho, em 1366 e 1920, claro e escuro. Aprovar antes das colunas.

## Tarefa 9: colunas escolhíveis e reordenáveis; grupo de chips por tipo

**Files:** `components/tabela/colunas.tsx`, ajustes em `tabela-de-dados.tsx` e na página

- [ ] **Passo 1 (testes primeiro):** Vitest: com as colunas do cookie, a tabela mostra só elas e na ordem escolhida; `colunas: null` mostra as 8 padrão; a coluna "Placa" (primeira) não pode ser ocultada. Playwright: o menu "Colunas" liga e desliga colunas com o teclado (KM, CR e Valor FIPE vêm desligadas) e persiste; reordenar por botões "Mover para a esquerda/direita" (teclado e toque; arrastar é só reforço) persiste; **em 1920 aparecem mais colunas que em 1366** (as "de largura": Motorista, Filial e Dias na situação) sem rolagem lateral da página; a escolha explícita da pessoa vale em qualquer largura.
- [ ] **Passo 2:** ver falhar; implementar (colunas "de largura" escondidas por CSS abaixo de 1700 px enquanto não há escolha); ver passar.
- [ ] **Passo 3 (se a pergunta (b) for aceita):** segundo grupo de chips por tipo de ativo, com a mesma regra de contagem; teste e2e: filtrar por "Cavalo" muda as contagens do grupo de status e **não** as do grupo de tipo.
- [ ] **Passo 4:** commit `feat: colunas escolhíveis e reordenáveis, e mais colunas em 1920`.

## Tarefa 10: cabeçalho e primeira coluna fixos, rolagem só na tabela, modo foco

**Files:** `components/tabela/tabela-de-dados.tsx`, `components/layout/modo-foco.tsx`, `app/(sistema)/layout.tsx`

- [ ] **Passo 1 (e2e primeiro, 1366 e 1920):** com 100 linhas e muitas colunas escolhidas, só a tabela rola (a página não: `scrollWidth` e `scrollHeight` do `documentElement` iguais à janela); o cabeçalho e a coluna "Placa" continuam à vista ao rolar; `?foco=1` esconde a barra lateral e o topo e a tabela ocupa a tela; "Sair do modo foco" e `Esc` voltam; o modo vai à URL.
- [ ] **Passo 2:** ver falhar; implementar (`position: sticky`, container com `overflow: auto` e altura da janela); ver passar. Commit `feat: tabela com cabeçalho e coluna fixos e modo foco`.

## Tarefa 11: Mais filtros (sigla exata e baixadas)

**Files:** `components/layout/barra-de-consulta.tsx` (habilita "Mais filtros" quando a tela passa o painel), `components/tabela/mais-filtros.tsx`

- [ ] **Passo 1 (e2e primeiro):** "Mais filtros" abre um painel com as 26 siglas, cada uma com **a sigla, o nome por extenso** e o chip de origem, e o interruptor "Inclui baixadas (VND e SUC)" (desligado); marcar `PÁT` filtra (`?sigla=PÁT`); ligar baixadas mostra as placas VND/SUC e muda o total e as contagens; Esc fecha e o foco volta ao botão; "Visões salvas" segue desabilitado, com a dica "Entra na próxima entrega".
- [ ] **Passo 2:** ver falhar; implementar; ver passar. Commit `feat: mais filtros com sigla exata e inclui baixadas`.

## Tarefa 12: fechamento

- [ ] **Passo 1:** em build limpo, `pnpm exec prettier --check .`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm exec supabase test db`, `pnpm exec supabase db lint --fail-on warning` e o e2e completo (1366, 1920, tablet 820, celular 390; a lista no celular mostra o aviso de computador e não rola a página).
- [ ] **Passo 2:** revisão por revisor independente (skill `requesting-code-review`); corrigir o importante com teste; registrar o restante em `docs/decisoes.md`.
- [ ] **Passo 3:** registrar em `docs/decisoes.md` o que a 2C-1 decidiu (colunas padrão, tamanhos 25/50/100, densidade padrão compacta, nomes dos parâmetros da URL) e atualizar a tabela de "Qualidade de interação" com os testes que passaram a ativos.
- [ ] **Passo 4:** push da branch e PR "Fase 2C-1: lista de placas", sem merge; mostrar os checks.

### CHECKPOINT 3 — final da 2C-1
Capturas finais (1366 e 1920, claro e escuro; tablet e celular), resultado dos checks e a rota. Aprovar antes de abrir a branch da 2C-2.

## O que fica fora da 2C-1

Painel lateral de espiar (2C-2); ficha da placa e "voltar da ficha devolve página e linha" (2C-3); seleção em lote e ações de gravação (a partir da 2D); "Visões salvas"; nomes por extenso das siglas (depende da resposta (a)).
