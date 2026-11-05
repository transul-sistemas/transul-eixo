# Fatia 3.9a (fonte do banco para leitura) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a lista de placas, o painel de espiar e a ficha leem do Supabase com a sessão do próprio usuário (RLS), em `EIXO_DADOS=banco`, com dados de desenvolvimento gerados pelas funções atômicas e o desempenho medido em 5.000 ativos.

**Architecture:** uma migration nova cria funções de leitura `SECURITY INVOKER` (a RLS de cada tabela continua valendo): `nucleo.listar_placas`, `nucleo.contar_chips_de_placas`, `nucleo.detalhe_da_placa` e `nucleo.historia_da_placa`, sobre uma visão `nucleo.linha_de_placa`. Em TypeScript, `lib/dados/fonte-do-banco.ts` implementa `FonteDePlacas` com o cliente da sessão; `fonte.ts` escolhe a fonte (`exemplo` só com `EIXO_DADOS=exemplo`; o resto, banco). A escrita no modo banco fica "em breve" até a 3.9b.

**Tech Stack:** Postgres (Supabase local no CI), pgTAP, Next.js App Router, `@supabase/ssr`, Vitest, Playwright.

**Spec:** o pedido de 04/11/2026 (PARTE 2) registrado em `docs/decisoes.md` e o `CLAUDE.md`.

## Global Constraints

- Memória abaixo de 6 GB: e2e, capturas, Supabase local e medição só pelo CI do PR de rascunho; local só Vitest, tsc, lint e Prettier.
- Nada de `service_role` no app; nada de `select *` em `lib/dados/`; consultas paginadas; sem polling.
- Migrations novas (nenhuma antiga editada); RLS e políticas nomeadas; índice em FK e filtros; `plan(N)` igual às asserções.
- Toda função nova executável por `authenticated` entra em `config.funcao_executavel`.
- Teste antes, vendo falhar; mutações nos guardas novos.
- Gerador de dados só no banco local: recusa endereço que não seja `127.0.0.1`/`localhost`; nunca no seed.
- Nomes `app` e `banco` dos jobs intactos; jobs novos só no `pull_request`, não obrigatórios.

## Review Focus

- Gestor A abrindo a ficha da placa do gestor B pelo endereço: 404 (não "erro").
- Busca com acento e caixa diferentes ("grãos" × "GRAOS") acha a mesma placa.
- Ordenação por coluna vazia no banco (km, motorista, CRLV): ordem estável pelo id, sem pular linha entre páginas.
- Página pedida além da última: devolve a última página, com o total certo.
- Placa baixada: some da lista por padrão, aparece com "inclui baixadas" e abre na ficha.

---

### Task 1: Funções de leitura no banco

**Files:** Create `supabase/migrations/<ts>_leitura_das_placas.sql`; Test `supabase/tests/80-leitura-das-placas.test.sql`.

**Produces:**
- `nucleo.linha_de_placa` (view, `security_invoker`): `id, placa, tipo, modelo, cavalo, implementos text[], gestor, operacao, cr, sigla, nome_da_situacao, grupo, desde timestamptz, dias_no_status int, alertas text[], valor_fipe numeric(15,2), filial text, ano int, renavam text, baixada bool, busca text`.
- `nucleo.listar_placas(p_busca text, p_grupos text[], p_tipos text[], p_siglas text[], p_baixadas boolean, p_ordem text, p_decrescente boolean, p_pagina int, p_tam int) returns jsonb` → `{linhas, total, pagina, paginas, tam}` (ordem em lista fechada; vazio no fim; desempate pelo id).
- `nucleo.contar_chips_de_placas(p_busca, p_grupos, p_tipos, p_siglas, p_baixadas) returns table(chip text, quantidade bigint)` (a contagem de cada grupo ignora o próprio grupo).
- `nucleo.detalhe_da_placa(p_placa text) returns jsonb` (linha + `crs`, `crs_vigentes`) e `nucleo.historia_da_placa(p_placa text) returns table(sigla text, em text)`.

- [ ] pgTAP: admin vê todas; gestor A vê só a carteira e não abre a placa de B (detalhe nulo); operacional vê só o que foi entregue à sua filial; baixada fora por padrão; contagens por chip; busca sem acento; ordem estável; página além da última; funções na lista de executáveis. Ver falhar no CI (banco).
- [ ] Migration; CI verde no banco; tipos regenerados pelo artefato do CI.

### Task 2: Gerador de dados de desenvolvimento e carga

**Files:** Create `supabase/dev/dados.sql`, `scripts/db-dev-dados.mjs`, `scripts/db-dev-dados.test.ts`, `lib/qualidade/dados-de-dev.test.ts`; Modify `package.json` (`db:dev-dados`, `db:carga`).

- [ ] `pg_temp.gerar_dados(p_quantidade int)` cria gestores, operações, CRs de frota e de serviço, filiais, ~200 ativos (5 tipos) por `cadastrar_ativo`, conjuntos simples, bi, bitrezão, rodo e "sem nome definido" por `engatar`, situações por `registrar_evento`, entregas ao Operacional, transferências com pendências e baixas.
- [ ] O script recusa banco que não seja local (teste da função pura `bancoLocal(url)`); o seed não contém o gerador (teste).
- [ ] `db:carga` roda o mesmo gerador com 5.000 e o `EXPLAIN (ANALYZE, BUFFERS)` da lista, dos chips e de um filtro por situação, como Administrador e como gestor; saída no resumo do CI.

### Task 3: Fonte do banco em TypeScript

**Files:** Create `lib/dados/fonte-do-banco.ts` (+ teste); Modify `lib/dados/fonte.ts`, `lib/dominio/alertas.ts` (códigos do banco), `lib/qualidade/eixo-dados.ts`.

- [ ] Vitest com o cliente simulado: mapeia a consulta da tabela para os parâmetros; converte jsonb para `LinhaDePlaca`/`DetalheDaPlaca`/`FichaDaPlaca`; nulo vira `null`; erro do banco lança. `fonteDePlacas()` usa o banco sem `EIXO_DADOS=exemplo`.

### Task 4: A sessão real na tela e as gravações em breve

**Files:** Modify `app/(sistema)/layout.tsx`, `components/navegacao/barra-lateral.tsx`, `lib/seguranca/gestor-atual.ts`, os assistentes (`usuario`), `app/(sistema)/frota/placas/acoes.ts`.

- [ ] Nome e e-mail de quem entrou no rodapé da barra; memória da barra e rascunhos pela chave do usuário (sai `USUARIO_PROVISORIO`); `gestorAtual()` da sessão; no modo banco, ações de gravação devolvem "em breve" e os botões ficam desabilitados com o aviso.

### Task 5: CI (capturas em job próprio, modo banco) e e2e do modo banco

**Files:** Modify `.github/workflows/verificacao.yml`, `lib/qualidade/workflow-verificacao.test.ts`; Create `playwright.banco.config.ts`, `e2e-banco/*.spec.ts`, `e2e/inicio.capturas.ts`.

- [ ] Job `capturas` (pull_request): telas de acesso, tela inicial logada (1366 e celular com a gaveta aberta, claro e escuro) e a barra com o Sair.
- [ ] Job `modo-banco` (pull_request): gerador, e2e pequeno no modo banco (lista, painel, ficha, sem vínculo, escopo por carteira e por filial) e a medição de 5.000.
- [ ] PR de rascunho; CI lido uma vez; checkpoint.
