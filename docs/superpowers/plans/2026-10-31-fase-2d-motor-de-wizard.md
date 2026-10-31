# Fase 2D — Motor de wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (ou subagent-driven-development) para executar tarefa a tarefa. Passos com `- [ ]`.

**Status:** APROVADO por Alexandre em 31/10/2026, com as respostas 1–5 (no fim). Tarefa 0 feita na branch `fase-2d-motor-de-wizard` (catálogo de ações e regra do momento). O restante espera o checkpoint a cada tarefa.

**Goal:** Entregar o motor de wizard (regras na tela e no servidor iguais) e os três primeiros assistentes (Cadastrar placa, Receber placa, Disponibilizar ao Operacional) com dados de exemplo, sem banco.

**Architecture:** Regras puras e testáveis em `lib/` (esquemas Zod únicos, definição de assistente, rascunho, resultado da ação, custódia). Interface em `components/wizard/`: um `Assistente` modal sobre a tela de origem (estado `?assistente=` na URL) e um `MiniAssistente` em painel lateral para o "+". Gravação por Server Action fina (valida com Zod, confere `exigirPermissao()`, grava na fonte de exemplo, invalida o cache) que devolve sempre `ResultadoDaAcao` (linha ou erro tipado).

**Tech Stack:** React Hook Form + `@hookform/resolvers` + Zod 4 (já no projeto) · base-ui Drawer/Dialog (como o painel de espiar) · Tailwind e tokens existentes · Vitest, Playwright · Next 16 (`cacheComponents`, `updateTag`).

**Spec:** `CLAUDE.md` (regras 1–6, armadilhas 1–14, "Qualidade de interação" 1–6, "Textos da interface"), `docs/projeto-tecnico.md` (Fase 2D; "toda escrita usa o motor"), `docs/glossario.md`.

## Global Constraints

- Toda inclusão, edição e exclusão é por wizard: stepper horizontal, resumo ao vivo, rascunho salvo; campo de seleção sem opção tem o "+" com mini-wizard lateral.
- **Custódia (corrigida por Alexandre):** *Disponibilizar ao Operacional* leva a placa de PÁT, VAz ou ETv para DOp, escolhendo a filial (módulo Frota). *Receber placa* é a **transferência entre gestores de frota** (módulo **Frota**, não Operacional): quem recebe confere o que chega, define situação, conjunto, operação e CR, motorista e meta, resolve pendências e conclui; o gestor que envia deixa motivo e pendências conhecidas. DOp → ACe (alocar a um lote) é do módulo Operacional e fica fora da 2D. Na 2D o Receber opera sobre um **pedido de transferência de exemplo**; o aviso em tempo real fica para a Central de Tarefas.
- Uma placa existe uma vez só (regra 1): duplicata é erro tipado `placa_ja_existe` com link para a ficha, e o banco futuro tem chave única.
- O mesmo schema Zod na tela e no servidor (arquivo único em `lib/dominio/`).
- Server Action: valida a entrada (Zod) e confere `exigirPermissao()`; nada de `service_role`; nada de segredo em arquivo.
- Gravação confere o erro e devolve a linha (armadilha 7); clique duplo não duplica (6); edição concorrente avisa (5); toda gravação invalida o cache afetado (11).
- Moeda: um único componente (`CampoMoeda`, `Moeda`); proibido `Intl`/`toLocaleString`/`toFixed` fora de `components/formato/`; nenhum hex fora de `app/tokens.css`.
- Botão = verbo + objeto, o mesmo nome do começo ao fim ("Receber placa" → "Placa recebida"); erro diz o que houve e como resolver, sem pedir desculpas; frases em minúscula normal, sem rótulos em maiúsculas.
- "Fechar é fechar": fechar volta à tela de origem com filtros, página, ordem e rolagem intactos; com dados preenchidos pergunta antes de descartar; Voltar do navegador desfaz um passo e não sai do sistema.
- Dados de exemplo só por `lib/dados/fonte-de-exemplo.ts` (barramento); `EIXO_DADOS=exemplo` nunca em produção; o navegador nunca importa `lib/dados/*` nem `lib/exemplo/*`.
- Telas de referência 1366×768 e 1920; tablet 820 e celular 390 desde o início; teclado completo.
- Branch curta por entrega; capturas (1366, 1920, claro, escuro, 820, 390) e a rota para abrir com `pnpm dev` a cada checkpoint; sem push de segredos, sem merge, sem `--force`.

## Review Focus

1. Dois cliques rápidos em "Cadastrar placa" (e Enter repetido): uma placa só; a segunda resposta devolve a mesma linha.
2. Placa em outro formato (minúscula, hífen, espaço, antiga × Mercosul): normaliza, valida e acusa duplicata contra a forma normalizada.
3. Receber placa quando outra pessoa já mudou a situação: aviso "este registro mudou" com a situação atual e escolha entre recarregar e revisar, sem perder o que foi digitado.
4. Fechar com dados (Esc, "×", fundo, Voltar do navegador, trocar de rota): pergunta uma vez, salva rascunho, e nunca joga para fora do sistema; rascunho de schema antigo é descartado com aviso.
5. Mini-wizard dentro do wizard: Esc fecha só o de cima, foco volta ao "+", o campo volta preenchido, e o mini não vira rascunho do pai.
6. `localStorage` bloqueado ou cheio: o assistente funciona sem rascunho e avisa uma vez.
7. Servidor lento ou com erro: carregando, erro com "Tentar de novo", e o mesmo `chaveDeEnvio` na nova tentativa.

## File Structure

- `lib/dominio/esquemas/placa.ts` (+test): `esquemaCadastrarPlaca`, `esquemaRecebimento` (confere, situação, conjunto, operação, CR, motorista, meta, pendências resolvidas), `esquemaDisponibilizacao` (placa, filial), `esquemaEnvioDeTransferencia` (motivo, pendências conhecidas), regras (RENAVAM com dígito, ano, valor por tipo, CR exige operação, situação inicial permitida ao tipo).
- `lib/dominio/custodia.ts` (+test): `podeDisponibilizar(sigla)` (PÁT, VAz, ETv → DOp) e a regra do pedido de transferência (`PedidoDeTransferencia`: origem, destino, motivo, pendências conhecidas, situação do pedido).
- `lib/wizard/definicao.ts`, `passos.ts`, `rascunho.ts`, `resultado.ts`, `chave-de-envio.ts` (+tests): regras puras do motor.
- `lib/seguranca/exigir-permissao.ts` (+test): `exigirPermissao({ modulo, acao })` provisório por perfil; troca por sessão e RLS na Fase 3.
- `lib/exemplo/armazem.ts` + extensão de `lib/dados/fonte.ts`/`fonte-de-exemplo.ts`: escrita em memória (cadastrar, receber, disponibilizar) e um pedido de transferência de exemplo, idempotência por `chaveDeEnvio`, versão por placa, eventos com hora.
- `components/wizard/`: `assistente.tsx`, `passos-do-assistente.tsx` (stepper + barra + timeline), `resumo-ao-vivo.tsx`, `campo-com-mais.tsx`, `mini-assistente.tsx`, `confirmar-descarte.tsx`, `barra-de-acoes.tsx`, `aviso-de-conflito.tsx`, `campos/` (texto, seleção, moeda, placa).
- `app/(sistema)/frota/placas/acoes.ts` (`"use server"`: cadastrar, receber, disponibilizar; tudo no módulo Frota); gatilhos nas telas (lista, ficha, Ctrl+K) via `ACOES` com `estado: "pronto"`.
- `e2e/assistente.*.spec.ts` (+`.casca.spec.ts` para 820 e 390), `lib/qualidade/` (testes de barramento e de armadilhas para as Server Actions).

---

## Tarefa 0 — Correção do catálogo de ações (primeira da branch da 2D, depois do merge do #15)

- [ ] **Teste antes, visto falhar** (`lib/navegacao/acoes.test.ts`, `lib/dominio/acoes-do-momento.test.ts`): "Receber placa" é `frota.receber-placa`, módulo `frota`, permissão `{ modulo: "frota", acao: "criar" }`; Operacional **não** vê "Receber placa" na busca; Gestor de frota vê. `idsDasAcoesDoMomento({ sigla })` devolve `frota.disponibilizar-ao-operacional` para PÁT, VAz e ETv, e **nada** para DOp (DOp → ACe é do Operacional, fora da 2D); o Receber não depende da sigla: aparece quando há pedido de transferência pendente para o gestor (`acoesDaPlaca({ sigla, pedidoPendente })`).
- [ ] Atualizar `lib/navegacao/acoes.ts` (id, módulo, permissão, descrição: "Recebe a placa transferida por outro gestor de frota e conclui a conferência") e `lib/dominio/acoes-do-momento.ts`; ajustar quem consome o id antigo (`operacional.receber-placa`); commit.

## Checkpoint 1 — Regras puras (sem tela)

### Task 1: Esquemas e custódia
**Interfaces — Produces:** `esquemaCadastrarPlaca`, `esquemaRecebimento`, `esquemaDisponibilizacao`, `esquemaEnvioDeTransferencia`; `validarRenavam(s: string): boolean`; `siglasIniciaisDoTipo(tipo: TipoDeAtivo): Sigla[]`; `podeDisponibilizar(sigla: Sigla): boolean`.
- [ ] Testes primeiro: placa normaliza e rejeita formato; RENAVAM (11 dígitos, dígito verificador); ano entre 1980 e ano atual + 1; **cavalo e caminhão: código FIPE e valor FIPE digitados; implemento, equipamento e apoio: valor manual + fonte + data do valor** (sem lista de modelos); CR obrigatório quando há operação; **situação inicial padrão PÁT, aceita as que se aplicam ao tipo (MAN, DOC, ALU, EMP, VEN etc.), recusa baixa (SUC, VND) e não há conjunto no cadastro**; `podeDisponibilizar` verdadeiro só para PÁT, VAz e ETv; Disponibilizar exige filial; Receber exige situação, operação e CR coerentes e não conclui com pendência aberta; o envio exige motivo.
- [ ] Ver falhar; implementar; ver passar; commit.

### Task 2: Motor puro (`lib/wizard`)
**Interfaces — Produces:** `DefinicaoDeAssistente`, `passoComErro(definicao, erros): number | null`, `chaveDoRascunho(usuario, assistente, registro?)`, `lerRascunho/guardarRascunho/apagarRascunho(armazem, …)` (com `versaoDoEsquema`), `ResultadoDaAcao<T>` (`{ ok: true; linha: T } | { ok: false; erro: { codigo; mensagem; campos?; atual? } }`), `novaChaveDeEnvio()`.
- [ ] Testes: avançar só com o passo válido; erro leva ao primeiro passo com erro; rascunho de versão antiga é descartado; armazém que lança (bloqueado/cheio) vira "sem rascunho", sem exceção; resultado tipado cobre `placa_ja_existe`, `conflito`, `sem_permissao`, `entrada_invalida`, `falha`.
- [ ] Implementar mínimo; commit.

### Task 3: `exigirPermissao` e escrita de exemplo
- [ ] Testes: Gestor de frota cadastra, recebe e disponibiliza (módulo Frota); Operacional não recebe nem cadastra; Administrador e Diretoria tudo; sem permissão lança `ErroDePermissao`. Escrita: mesma `chaveDeEnvio` devolve a mesma linha uma vez só; placa já existente (em qualquer formato) devolve `placa_ja_existe`; `versaoEsperada` velha devolve `conflito` com a linha atual; receber um pedido já concluído ou cancelado devolve `conflito`; cada escrita gera evento com hora (o Receber conclui o pedido e troca o gestor com vigência `[início, fim)`).
- [ ] Implementar na fonte de exemplo (memória do processo, nunca importada pelo navegador); testes de barramento continuam verdes; commit.

**Parar aqui:** mostrar resultado dos testes e pedir aprovação do Checkpoint 1.

## Checkpoint 2 — Motor de interface (um assistente de teste)

### Task 4: Casca do assistente
- [ ] Testes de componente e e2e: abre por `?assistente=` (push), Voltar fecha; stepper horizontal com `aria-current="step"`, barra de progresso, timeline; resumo ao vivo à direita atualiza ao digitar; em 820 e 390 o stepper vira "Passo 2 de 5 · título" + barra e o resumo vira gaveta "Ver resumo".
- [ ] Teclado: Enter avança (fora de textarea e seleção aberta), Esc fecha (pergunta se sujo), foco no primeiro campo com erro, foco preso, foco volta a quem abriu; tudo por teclado.
- [ ] Implementar; capturas.

### Task 5: Fechar é fechar, rascunho e envio
- [ ] Testes: descartar pergunta com o nome do assistente; "Continuar editando" é o foco padrão; rascunho salvo ao sair e reaberto ao voltar; botão de concluir com `aria-disabled` durante o envio (clique duplo e Enter repetido enviam uma vez); carregando, erro e "Tentar de novo" com a mesma `chaveDeEnvio`; conflito mostra aviso sem perder dados.
- [ ] Implementar; commit.

### Task 6: "+" e mini-wizard
- [ ] Testes: o "+" aparece só em campo de seleção; abre painel lateral (folha de baixo no celular); Esc fecha só o mini; ao concluir o campo volta preenchido e o foco volta ao "+"; mini com dados pergunta antes de descartar.
- [ ] Implementar com um catálogo de exemplo (gestor, operação, CR) criado pelo mini; commit.

**Parar aqui:** capturas (1366, 1920, claro, escuro, 820, 390), rota para abrir, e aprovação do visual do Checkpoint 2.

## Checkpoint 3 — Primeiros assistentes

### Task 7: Cadastrar placa
Passos: Identificação (placa, RENAVAM, tipo) → Veículo (marca, modelo, ano) → Valor (cavalo e caminhão: código FIPE e valor; implemento e equipamento: valor manual, fonte e data; apoio como os demais) → Posse (gestor, operação, CR) → Situação inicial (padrão PÁT; só as do tipo; sem baixa) → Conferir. Sem conjunto.
- [ ] e2e: cadastra e a placa aparece na lista e na ficha sem recarregar (cache invalidado), com evento "cadastrada"; duplicata acusa e leva à ficha; troca de tipo troca os campos de valor sem perder o resto; "+" cria gestor, operação ou CR na hora.

### Task 8: Disponibilizar ao Operacional e Receber placa (ambos no módulo Frota)
- [ ] **Disponibilizar:** de PÁT, VAz ou ETv para DOp, escolhendo a filial; gatilhos: "Ações" da ficha e Ctrl+K; fora dessas situações a ação não é oferecida.
- [ ] **Receber placa:** assistente do gestor que recebe, sobre um **pedido de transferência de exemplo** (mostra o motivo e as pendências conhecidas deixados por quem enviou): confere o que chega, define situação, conjunto, operação e CR, motorista e meta, resolve as pendências e conclui. Gatilhos: "Ações" da ficha (quando há pedido pendente) e Ctrl+K. Sem aviso em tempo real (Central de Tarefas, depois). O assistente de *enviar* a transferência fica fora da 2D (o pedido de exemplo já nasce pronto).
- [ ] `ACOES` desses dois passa a `estado: "pronto"`.
- [ ] e2e: Disponibilizar muda a situação para DOp com a filial escolhida, o resumo e a linha do tempo; Receber troca o gestor, atualiza situação, operação e CR, conclui o pedido e o registra na linha do tempo; segunda aba recebe "este registro mudou"; perfil Operacional não vê Receber nem Cadastrar; Gestor de frota vê os três.

### Task 9: Fechamento
- [ ] Lint, tipos, unitários, build limpo, e2e completo em produção (1366, 1920, 820, 390), revisão independente (foco: clique duplo, formatos de placa, conflito, rascunho, mini dentro de wizard, `localStorage` bloqueado), `docs/decisoes.md`, PR sem merge.

## Fica fora da 2D
Banco, RLS e sessão real (Fase 3); editar e excluir por wizard (mesmo motor, depois do núcleo de dados); consulta FIPE por API (hoje o código e o valor são digitados); fila e totem; conjunto (cavalo + implementos) no cadastro; DOp → ACe (alocar a um lote), que é do módulo Operacional; assistente de enviar transferência e aviso em tempo real (Central de Tarefas).

## Decisões de Alexandre (31/10/2026)
1. Assistente em **modal de tela quase cheia** sobre a origem, com `?assistente=` na URL.
2. FIPE: **digitar código e valor**; implemento e equipamento com valor manual, fonte e data; sem lista de modelos inventada.
3. Situação inicial: padrão PÁT; aceita as do tipo (MAN, DOC, ALU, EMP, VEN etc.); baixa (SUC, VND) fora; sem conjunto no cadastro.
4. Custódia corrigida (ver Global Constraints e Tarefa 0): Receber placa é transferência entre gestores, módulo Frota; Disponibilizar de PÁT/VAz/ETv para DOp com filial; DOp → ACe fica no Operacional.
5. Rascunho em **`localStorage`** por pessoa e navegador, **validado na leitura**, **sem dados sensíveis**, até a Fase 3.
