# Fase 2C-3: ficha da placa (ficha padrão das raízes) — design e plano

> **Para quem executa:** usar `superpowers:executing-plans`, tarefa por tarefa, teste antes do código (ver falhar), commit por assunto. Branch `fase-2c-3-ficha-da-placa`, criada da `main` depois do merge do PR #13 (2C-2). Sem push, sem merge, sem `--force`.

**Meta:** a ficha da placa em `/frota/placas/AAA0A00`, construída como **ficha padrão reutilizável** pelas outras raízes (Pessoa, Operação, Parceiro): cabeçalho com identidade e situação, linha do tempo horizontal pela régua de status, seis abas fixas e ações do momento.

**Arquitetura:** `components/ficha/` guarda a casca genérica (recebe identidade, situação, eventos e abas como dados e encaixes); `app/(sistema)/frota/placas/[placa]/` é a primeira raiz que a usa. As regras (aba válida, placa da rota, segmentos da linha do tempo, ações do momento, retorno à lista) são funções puras em `lib/` com teste. O estado da ficha mora na URL (`?aba=`). Voltar da ficha devolve a lista no mesmo ponto por um registro de retorno guardado ao sair dela.

**Stack:** a mesma da 2C-2 (Next.js 16 App Router com `cacheComponents`, TypeScript estrito, Tailwind + base-ui, Vitest, Playwright). **Base:** `main` com a 2C-2 mesclada (`3994a30`).

## O que eu li antes de desenhar (fatos do código)

- **Não existe histórico de eventos nos dados de exemplo.** Cada placa tem só `sigla` e `desde`. A linha do tempo precisa de eventos novos (`lib/exemplo/`), coerentes com a situação atual.
- **A trilha (`lib/navegacao/trilha.ts`) só entende rotas do catálogo.** `acharTela("/frota/placas/AAA0A00")` devolve nada, então a ficha ficaria sem trilha. Precisa de "rota filha" no catálogo.
- **A "Em breve" existente é de tela inteira e por rota do catálogo** (`TelaEmBreve`). As abas precisam de uma versão menor; extraio a parte visual comum.
- **Hoje o clique na linha abre o painel** (`cliqueAbreAPlaca`) e a célula da placa é o botão "Espiar". A primeira coluna é um `<td>` fixo.
- **O teste de barramento só olha arquivos com `"use client"`** (`clienteImportaAFonte`). `resumo-da-placa.tsx` e `navegacao-do-painel.tsx` entram no navegador sem a diretiva.
- **O foco ao fechar o painel** cai no `body` se a lista está vazia (não há caixa "rolável" nem botão), pendência da 2C-2.
- **`ACOES` já existe** em `lib/navegacao/acoes.ts` (duas ações, ambas `em-breve`) com `podeVerAcao(perfil, acao)`: só Administrador e Diretoria veem ação em breve (`veEmBreve`). O perfil atual é provisório: Administrador (`perfilAtual()`).

## Decisões aprovadas por Alexandre (30/10/2026)

1. **O clique na linha continua abrindo o painel de espiar** (não vai para a ficha). A placa da primeira coluna vira **link real para a ficha**, a coluna passa a `th scope="row"`, e o botão "Espiar" continua. "Abrir ficha completa" no painel também leva à ficha, e a trilha da ficha termina na placa (Frota › Placas › AAA0A00; "Placas" volta à lista).
2. **Seis abas:** Resumo, Linha do tempo, Documentos, Resultado, Mapa e Mapa mental. Só Resumo e Linha do tempo têm conteúdo; as outras quatro usam o componente "Em breve". O `CLAUDE.md` não é alterado.
3. **Esc não sai da ficha.** Sai por "Voltar à lista", pela trilha e pelo Voltar do navegador.
4. **Placa mal escrita = 404; bem escrita e inexistente = "Placa não encontrada" dentro do casco do sistema, com status 200.** Placa baixada abre normalmente, com aviso.
5. **Ações do momento reaproveitam `ACOES` (`lib/navegacao/acoes.ts`)**, sempre desligadas (`aria-disabled`, mensagem "chega com os assistentes (2D)") e **visíveis só para Administrador e Diretoria** (`podeVerAcao`). A escolha de quais ações aparecem por placa é uma regra provisória e pequena (Tarefa 1).
6. **Abrir a ficha pelo painel usa `push`:** Voltar da ficha leva de volta à lista com o painel aberto.

## Global Constraints

- Sem cor, tamanho de fonte nem formato à mão: tokens; `Etiqueta`, `Placa`, `Moeda`, `components/formato/` (data, data e hora, km). Proibido `Intl`, `toLocale*`, `toFixed` fora de `components/formato/`; hex só em `app/tokens.css`. **Cor de módulo diz onde a pessoa está; cor de status diz como está a placa; nunca misturar.** A linha do tempo usa só cores de status.
- Textos em português, minúsculas normais, botão = verbo + objeto ("Voltar à lista", "Abrir ficha completa", "Espiar AAA0A00"); erro diz o que houve e como resolver; tela vazia convida a agir.
- Placa da rota: maiúscula, 7 caracteres `/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/`. A validação passa a ser uma só (`lib/dominio/placa.ts`), usada por `?espiar=` e pela rota.
- A aba vai na URL (`?aba=`); só os seis ids conhecidos valem, o resto vira Resumo, sem erro. Mudar de aba usa `replaceState` (não empilha histórico).
- Voltar da ficha devolve **a mesma página, ordem, filtros, tamanho, colunas, rolagem da tabela e o foco na linha**. Fechar é fechar (regra 1 de "Qualidade de interação").
- Duas larguras de referência 1366 e 1920, mais tablet 820 e celular 390, em claro e escuro, a cada checkpoint. Toda tela abre em menos de 1 segundo.
- Armadilhas: sem `select *` em `lib/dados/`; sem Server Action nova; fonte de exemplo continua a única porta de `lib/exemplo/`; o navegador nunca importa `lib/dados/{placas,fonte,fonte-de-exemplo}`; intervalos `[início, fim)` na linha do tempo.
- `pnpm dev` na porta 3000 ligado a cada checkpoint; e2e de produção só com ele parado e com autorização.

## Review Focus (entradas que o desenho implica e nenhuma tarefa de regra cobre sozinha)

1. `/frota/placas/aaa-0a00`, `/frota/placas/AAA0A0`, `/frota/placas/%3Cscript%3E`, placa enorme, `?aba=<script>`, `?aba=` repetido: nunca quebra, nunca vira HTML; mal escrita dá 404, aba inválida cai no Resumo. (T1, T5)
2. Voltar da ficha quando a lista saiu do cache, o filtro mudou, a placa não está mais na página, ou a pessoa chegou à ficha por link direto (sem lista atrás): nunca restaura a coisa errada e nunca sai do sistema. (T6)
3. Eventos no mesmo minuto, em sequência no mesmo dia, o primeiro evento antes da janela, evento no futuro, nenhum evento: a linha do tempo não quebra e a soma dos segmentos é a janela inteira. (T1, T2)
4. Abas por teclado: Tab entra uma vez na lista de abas, setas andam, Home e End vão às pontas, Enter e espaço ativam, o foco não se perde ao trocar de aba. (T4)
5. Cabeçalho e abas em 390 px: as seis abas rolam dentro da própria faixa, sem rolagem lateral da página e sem esconder a aba ativa. (T4, T7)

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/dominio/placa.ts` (+ teste) | `placaNormalizadaValida(texto)`: a regex única, usada por `lib/navegacao/espiar.ts` e pela rota |
| `lib/navegacao/ficha.ts` (+ teste) | `ABAS_DA_FICHA` (id, nome), `lerAba(params)`, `comAba(params, aba)` |
| `lib/dominio/linha-do-tempo.ts` (+ teste) | `segmentosDaLinhaDoTempo(eventos, janela, agora)`: faixas `[início, fim)` por grupo da régua, cortadas pela janela |
| `lib/dominio/acoes-do-momento.ts` (+ teste) | `idsDasAcoesDoMomento(placa)`: quais ids de `ACOES` combinam com a situação (regra provisória); a tela cruza com `podeVerAcao(perfil, ...)` e mostra todas desligadas |
| `lib/navegacao/retorno-da-lista.ts` (+ teste) | `guardarRetorno`, `lerRetorno`: URL da lista, rolagem da tabela e placa, com validade e conferência de URL |
| `lib/exemplo/eventos.ts` (+ teste) | eventos de exemplo coerentes com `sigla` e `desde` |
| `lib/dados/*` | `FichaDaPlaca` e `obterFicha()`; a fonte ganha `obterEventos` |
| `components/ficha/` | `ficha-da-raiz.tsx`, `cabecalho-da-ficha.tsx`, `abas-da-ficha.tsx` (cliente), `linha-do-tempo.tsx`, `eventos-da-ficha.tsx`, `aba-em-breve.tsx`, `acoes-da-ficha.tsx` |
| `components/navegacao/em-breve.tsx` | parte visual comum extraída de `tela-em-breve.tsx` |
| `app/(sistema)/frota/placas/[placa]/` | `page.tsx`, `ficha-da-placa.tsx`, `loading.tsx`, `error.tsx` |
| `app/(sistema)/desenvolvimento/ficha/` | demonstração da ficha com dado de exemplo (para o Checkpoint 1) |
| `components/tabela/*` | primeira coluna `th scope="row"` com link e botão Espiar; linha leva à ficha; `retorno` restaurado |
| `lib/qualidade/barramento-do-exemplo.ts` (+ teste) | `clienteImportaAFonte` passa a seguir as importações |
| `e2e/ficha*.spec.ts`, `e2e/ficha*.casca.spec.ts` | desktop e tablet/celular |

## Tarefa 1: as regras puras (teste primeiro, ver falhar)

**Arquivos:** os de `lib/dominio/` e `lib/navegacao/` acima. **Produz:**
`placaNormalizadaValida(texto: string): boolean`; `ABAS_DA_FICHA: readonly { id: "resumo"|"linha-do-tempo"|"documentos"|"resultado"|"mapa"|"mapa-mental"; nome: string; comConteudo: boolean }[]`; `lerAba(p: URLSearchParams): AbaId` (inválida, ausente, repetida ou enorme → `"resumo"`); `comAba(p, aba): URLSearchParams` (preserva o resto; `"resumo"` tira o parâmetro); `segmentosDaLinhaDoTempo(eventos: { sigla: Sigla; em: string }[], janela: { de: string; ate: string }, agora: string): { sigla: Sigla; grupo: Status; de: string; ate: string; minutos: number }[]`; `idsDasAcoesDoMomento(p: { tipo: TipoDeAtivo; sigla: Sigla }): string[]` (ids de `ACOES`: `DOp` leva "Receber placa"; `PÁT` leva "Disponibilizar ao Operacional"; baixadas e as demais, nenhum); `guardarRetorno(r)` e `lerRetorno(urlAtual, agora)`.

- [ ] **Passo 1 (testes):** `placaNormalizadaValida` aceita `AAA0A00`, `ABC1234`, rejeita minúscula, hífen, espaço, 6 e 8 caracteres, HTML, byte nulo; `espiar.ts` passa a usá-la e os testes da 2C-2 seguem verdes. `lerAba`: cada um dos seis ids; `?aba=Documentos`, `?aba=`, `?aba=a&aba=b`, `?aba=<script>`, 500 caracteres → `"resumo"`; `comAba` preserva `espiar`, filtros e repetidos. `segmentosDaLinhaDoTempo`: um evento só; dois no mesmo minuto (o último vale, o anterior some com zero minutos); vários no mesmo dia com hora; primeiro evento antes da janela (corta no início); evento depois de `agora` ignorado; sem eventos (um segmento "sem registro" que cobre a janela, nunca vazio); fim da última faixa em `agora`; soma dos minutos = janela inteira; limites `[início, fim)`; virada de dia. `idsDasAcoesDoMomento`: baixada (VND, SUC) sem ações; `DOp` só "Receber placa"; `PÁT` só "Disponibilizar ao Operacional"; as demais siglas nenhuma; todo id devolvido existe em `ACOES`; a ficha mostra a ação só para Administrador e Diretoria (`podeVerAcao`) e desligada, com a mensagem "chega com os assistentes (2D)". `retorno`: expira, não vale para outra URL, não vale sem registro, é apagado depois de lido.
- [ ] **Passo 2:** ver falhar; implementar o mínimo; ver passar; `pnpm test` inteiro.
- [ ] **Passo 3:** commit `feat: regras da ficha (aba, placa, linha do tempo, ações e retorno)`.

## Tarefa 2: os dados (eventos e `obterFicha`)

**Arquivos:** `lib/exemplo/eventos.ts`, `lib/dados/{placas-tipos,placas,fonte,fonte-de-exemplo}.ts`, testes. **Produz:** `EventoDeStatus { sigla: Sigla; em: string /* aaaa-mm-ddThh:mm */ }`; `FichaDaPlaca extends DetalheDaPlaca { eventos: EventoDeStatus[] }`; `obterFicha(placa: string, hoje: string, opcoes?): Promise<FichaDaPlaca | null>`; `DadosDaFicha = {situacao:"ok",ficha} | {situacao:"nao-encontrada"}` (e erro sobe para o `error.tsx`).

- [ ] **Passo 1 (testes):** para cada placa de exemplo, o último evento tem a `sigla` e o `desde` da placa; eventos em ordem crescente, no máximo um a cada minuto; entre 3 e 12 eventos; só siglas válidas da régua; determinístico para o mesmo `hoje`; `AAA0A04`, `AAA0A10`, `AAA0A22`, `AAA0C17` (os casos feios) têm eventos coerentes com o alerta; `obterFicha` normaliza `aaa-0a04`, devolve `null` se não existe, acha baixada, recusa sem `EIXO_DADOS=exemplo`, respeita `?lento`; o barramento segue verde.
- [ ] **Passo 2:** ver falhar; implementar; ver passar. `obterFicha` pede só as colunas necessárias (sem `select *`); nota para a Fase 3 em `docs/decisoes.md`: `obterFicha()` confere permissão e escopo, e a ficha é uma consulta por abertura.
- [ ] **Passo 3:** commit `feat: eventos de exemplo e obterFicha`.

## Tarefa 3: o barramento segue importações e o foco com a lista vazia (pendências da 2C-2)

**Arquivos:** `lib/qualidade/barramento-do-exemplo.ts` (+ teste), `components/tabela/painel-de-espiar.tsx`, `e2e/espiar.historico.spec.ts`.

- [ ] **Passo 1 (testes):** `clienteImportaAFonte` pega o arquivo **sem** `"use client"` que é importado por um com a diretiva e importa `lib/dados/placas`, `fonte` ou `fonte-de-exemplo` (cadeia de dois e três níveis, alias `@/` e caminho relativo); não pega arquivo só de servidor; resolve `index` e extensões; não entra em laço com importação circular; o código atual do repositório continua sem violação. E2E: `?q=zzzzzzzz&espiar=AAA0A00` (lista vazia) e Esc: o foco vai para um lugar útil (o campo de busca), nunca para o `body`; `?falha=1&espiar=AAA0A00` mostra o erro da lista e nenhum painel.
- [ ] **Passo 2:** ver falhar; implementar (`devolverFoco` ganha o terceiro destino: o campo de busca, depois `#conteudo`); ver passar.
- [ ] **Passo 3:** commit `test: barramento segue as importações e foco com a lista vazia`.

## Tarefa 4: a casca da ficha (`components/ficha/`) e a demonstração

**Arquivos:** os de `components/ficha/`, `components/navegacao/em-breve.tsx` (extraído de `tela-em-breve.tsx`), `app/(sistema)/desenvolvimento/ficha/`. **Produz:** `FichaDaRaiz({ cabecalho, linhaDoTempo, abas: { id; conteudo: ReactNode }[], abaAtiva, acoes })`; `AbasDaFicha({ abas, abaAtiva })` (cliente); `CabecalhoDaFicha({ identidade, situacao, aviso?, aoVoltar })`; `LinhaDoTempo({ segmentos, janela })`; `AbaEmBreve({ nome, descricao })`.

- [ ] **Passo 1 (testes):** abas com `role="tablist"`, `role="tab"` com `aria-selected` e `aria-controls`, painel com `role="tabpanel"` e `aria-labelledby`, **tabulação em roving** (só a aba ativa entra no Tab; setas esquerda e direita andam e dão a volta; Home e End vão às pontas; Enter e espaço ativam; ativação automática ao andar com as setas), foco visível, alvo de 24 px ou mais; trocar de aba usa `replaceState` e preserva o resto da URL; recarregar devolve a aba. Cabeçalho: um só `h1`, situação com sigla e nome por extenso, aviso de baixada, "Voltar à lista" como botão. Linha do tempo: faixas na cor do grupo (só tokens de status), cada faixa com nome acessível ("ETc, Em trânsito carregado, 12 dias") e uma **alternativa em lista** (a aba "Linha do tempo" traz os eventos em tabela), `role="img"` com resumo para o leitor de tela, sem informação só por cor. Demonstração: renderiza a ficha com uma placa de exemplo e as quatro abas "Em breve".
- [ ] **Passo 2:** ver falhar; implementar; ver passar. Componentes genéricos: nada de `Placa`, `placa` ou `Frota` dentro de `components/ficha/` (a raiz entra por encaixes).
- [ ] **Passo 3:** commit `feat: casca da ficha padrão (cabeçalho, linha do tempo, abas e em breve)`.

## Tarefa 5: a rota da ficha da placa

**Arquivos:** `app/(sistema)/frota/placas/[placa]/*`, `lib/navegacao/{catalogo,trilha}.ts`, `components/ficha/*`, testes e `e2e/ficha.spec.ts`. **Produz:** `/frota/placas/[placa]`; trilha "Frota › Placas › AAA0A00"; título da aba do navegador "AAA0A00 · TranSul Eixo".

- [ ] **Passo 1 (testes):** `migalhas("/frota/placas/AAA0A00")` devolve as três migalhas (a de Placas com link para a lista); rota fora do padrão continua sem trilha. E2E: placa válida abre; `aaa-0a00`, `AAA0A0`, `AAA0A000`, `%3Cscript%3E` dão 404; `ZZZ9Z99` mostra "Placa não encontrada" com link para a lista; baixada (VND ou SUC) abre com o aviso; `?aba=documentos` abre a aba e `?aba=lixo` cai no Resumo; trocar de aba mantém a URL e o recarregar devolve; as abas Documentos, Resultado, Mapa e Mapa mental mostram "Em breve"; o Resumo traz as mesmas seções do painel; a Linha do tempo traz a faixa e a tabela de eventos com data e hora; o painel de espiar mostra "Abrir ficha completa" **como link** para a ficha (e abre, com `push`); abre em menos de 1 segundo com `?lento` desligado; `?lento=1500` mostra o esqueleto da ficha; erro mostra o `error.tsx` com "Tentar de novo".
- [ ] **Passo 2:** ver falhar; implementar (`params` assíncrono, `connection()`, `notFound()` só para formato inválido, `generateMetadata`, `loading.tsx` com o esqueleto da ficha). O Resumo reaproveita as seções de `resumo-da-placa.tsx` (extrair `SecoesDaPlaca` para as duas telas usarem sem copiar). Ver passar.
- [ ] **Passo 3:** commit `feat: ficha da placa em /frota/placas/[placa]`.

### CHECKPOINT 1: a ficha em si
Capturas de 1366 e 1920, tablet 820 e celular 390, claro e escuro: ficha do `AAA0A00`, de um caso feio com alertas (`AAA0A10`), da aba Linha do tempo, de uma aba "Em breve", de "Placa não encontrada" e de uma baixada; mais o link para abrir com `pnpm dev`. **Parar e pedir aprovação.**

## Tarefa 6: a placa da lista leva à ficha e Voltar devolve ao mesmo ponto

**Arquivos:** `components/tabela/{tabela-de-dados,tabela-de-placas,celula-da-placa}.tsx`, `lib/navegacao/retorno-da-lista.ts`, `components/ficha/*`, testes e e2e. **O clique na linha não muda:** continua abrindo o painel (`cliqueAbreAPlaca`, que já ignora cliques em links e botões).

- [ ] **Passo 1 (testes):** **a primeira coluna é `th scope="row"`** (continua fixa à esquerda, com o cabeçalho fixo); dentro dela **a mini placa é um link real** para a ficha (clique do meio e Ctrl+clique abrem em outra aba; Enter ativa) e **o botão "Espiar AAA0A00"** (ícone de olho, nome acessível, alvo de 24 px ou mais) fica ao lado; clicar na placa leva à ficha e **não** abre o painel; clicar no resto da linha abre o painel como hoje; Tab passa pelo link e pelo botão; o leitor de tela anuncia a linha pelo nome da placa. **Retorno:** da lista na página 2, ordem por gestor e filtros, rolada na vertical e na horizontal, abrir a ficha (pelo link da placa, pelo "Abrir ficha completa" do painel) e voltar ("Voltar à lista", trilha e Voltar do navegador): mesma URL, página, ordem, filtros, tamanho de página, colunas, **mesma rolagem da tabela e o foco no link da linha**; se a placa não está mais na página, o foco vai à caixa da tabela; link direto para a ficha (sem lista atrás): "Voltar à lista" e a trilha levam a `/frota/placas`; o registro expira e não restaura outra URL; Voltar da ficha aberta pelo painel devolve a lista **com o painel aberto** (o "Abrir ficha completa" usa `push`). A atualização da lista e a edição concorrente não são afetadas.
- [ ] **Passo 2:** ver falhar; implementar (guardar o retorno no clique do link da placa e do "Abrir ficha completa"; restaurar depois da hidratação da lista, só quando houve Voltar ou Avançar recente e a URL confere). Ver passar. Atualizar os testes da 2C-2 que clicavam na placa para abrir o painel (agora é o botão Espiar).
- [ ] **Passo 3:** commit `feat: placa da lista leva à ficha (th de linha, link e Espiar) e Voltar devolve ao mesmo ponto`.

### CHECKPOINT 2: a lista e o retorno
Capturas da lista com o novo primeiro campo (compacta e confortável, 1366 e 1920, tablet, celular, claro e escuro) e um passo a passo gravado do retorno (lista na página 2, rolada, ficha, Voltar). **Parar e pedir aprovação.**

## Tarefa 7: fechamento

- [ ] Verificação completa **com `pnpm dev` parado e autorizado:** `rm -rf .next && pnpm build`, e2e completo em produção (todos os dispositivos), `supabase test db`, `supabase db lint`, `pnpm lint`, `pnpm typecheck`, `prettier --check .`, unitários.
- [ ] Teste de acessibilidade das abas e do cabeçalho em tablet e celular; hidratação lenta da rota da ficha (mesmo e2e de CPU 6x e atraso nos `.js`).
- [ ] Revisor independente, com atenção a: retorno da lista (corridas, expiração, URL trocada), abas por teclado, link da linha x clique da linha x botão Espiar (clique duplo, seleção de texto), barramento novo (falsos positivos e laços), as 14 armadilhas e `lib/exemplo/` sobre o código novo. Corrigir o que for importante, um commit por assunto, teste antes.
- [ ] `docs/decisoes.md`: a ficha padrão e seus encaixes; o clique na linha continua abrindo o painel e a placa é o link; seis abas, quatro "Em breve"; Esc não sai da ficha; inexistente x malformada; ações do momento desligadas; o retorno à lista; para a Fase 3, `obterFicha()` confere permissão e escopo. Pendências do projeto: as outras raízes (Pessoa, Operação, Parceiro) entram na casca sem mexer nela.
- [ ] Push da branch e PR **somente com sua autorização**; religar o `pnpm dev` e confirmar `/frota/placas` e `/frota/placas/AAA0A00` em 200.

## O que fica fora da 2C-3

Abas Documentos, Resultado e Mapa com conteúdo (só "Em breve"); "Mapa mental"; escrita de qualquer tipo (todo editar é wizard, 2D); permissão e escopo (Fase 3); a ficha de Pessoa, Operação e Parceiro (só a casca está pronta para elas); linha do tempo com dados reais do Sankhya; janela da linha do tempo escolhida pela pessoa (fixa em 30 dias nesta entrega, com a lista de eventos completa na aba).
