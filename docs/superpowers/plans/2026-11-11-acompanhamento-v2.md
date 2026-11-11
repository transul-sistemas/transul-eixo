# Plano: Acompanhamento v2

Escrito em 11/11/2026. **Só plano: nenhuma fatia começou.** Desenho em `docs/acompanhamento-v2.md`; a regra
do wizard em popup central, em `docs/padrao-de-telas.md`. A fila principal não muda: as fatias abaixo entram
nela nos pontos de "Dependências". Cada uma vira um prompt curto: "execute a fatia X do plano".

Regras de todas as fatias: teste antes do código em `lib/dominio/`; pgTAP em toda função e política; função
atômica com chave de envio e versão; nada de dado real no repositório, no chat ou no CI (os scripts mostram
só agregados); sem nuvem até Alexandre pedir; sem Sankhya e sem API nesta etapa; validação visual em 1366 e
1920, claro e escuro; commit direto na `main`, arquivo por arquivo, um assunto por commit.

## A1. Grade por conjunto e faixa de chips

- **Modelo e ritmo:** banco e tela. Risco médio (função de leitura nova, RLS por escopo): checkpoint no fim.
- **Objetivo:** a grade passa de "uma linha por placa" a **uma linha por conjunto**, com a situação do
  cavalo valendo para o conjunto, o selo de lançamentos por célula, a coluna de hoje destacada, a faixa de
  chips com contagem e a medida "X de Y conjuntos com lançamento hoje".
- **Tabelas e funções:** nenhuma tabela nova. Função `nucleo.grade_por_conjunto(p_mes, filtros, página,
  tamanho)` (security invoker, a RLS de quem chama vale) devolvendo, por conjunto: cavalo, implementos
  engatados, nome do conjunto (pela nomenclatura), tipo Frota ou Acionista (CR vigente), modelo e ano, a
  situação de cada dia **herdada do cavalo**, a quantidade de eventos por dia e a marca de manual ou
  correção tardia; motorista só com Pessoas › ver. `nucleo.conjuntos_com_lancamento_no_dia(p_dia)` devolve
  X e Y. Total e contagem dos chips vêm do banco, nunca somados no navegador. Entrada de X e Y em
  `docs/glossario.md`.
- **Telas:** `/frota/acompanhamento` (modo Grade): linha por conjunto, implementos recuados, seção "Fora de
  conjunto", cabeçalho e primeira coluna fixos, 20 por página, olho no fim da linha, estado na URL.
- **Testes de aceite:** pgTAP (o implemento herda a sigla do cavalo; engatar e desengatar no meio do mês muda
  a linha no dia certo; X de Y bate com a contagem manual numa fixture fictícia; motorista só com Pessoas;
  RLS por perfil); unitário das regras de herança em `lib/dominio/`; e2e em 1366 e 1920 sem rolagem lateral
  da página; teste de rótulo e ícone da coluna de hoje (não só cor).
- **Dependências:** a composição vigente (`nucleo.composicao`) e a nomenclatura (já existem). Para ver
  movimento de verdade, os dados de teste da demonstração (cenário 4).

## A2. Wizard em popup, Lançar o dia, Programado e Movimento

- **Modelo e ritmo:** banco (função atômica, tabela nova) e tela. Risco alto (gravação de evento, permissão,
  mês fechado): para no checkpoint e espera o "aprovado".
- **Objetivo:** o assistente de lançar situação abre em **popup central**, em qualquer data, com os quatro
  passos (Dia e conjunto, Situação em 5 grupos, Hora e observação, Conferir); **remover vira corrigir o
  último evento, com motivo**; dia futuro vira **Programado** (se Alexandre aprovar). **Esta fatia se junta
  à "Lançar o dia" e ao Movimento** da fila principal: o lançar do dia em lote é o modo rápido do mesmo
  wizard.
- **Tabelas e funções:**
  - `nucleo.situacao_programada` (conjunto, sigla, para quando, quem, motivo, situação: programada,
    confirmada, cancelada; versão), RLS, exclusão lógica; tarefa de confirmar no dia (caixa de Tarefas, P1);
  - `nucleo.lancar_situacao_do_dia(p_conjuntos uuid[], p_sigla, p_em, p_observacao, p_chave_de_envio)`
    atômica, com "X de Y" no retorno, que grava o evento no cavalo (herança aos implementos), marca
    **correção tardia** quando a data é anterior a hoje e recusa mês fechado sem a permissão de H3;
  - `nucleo.corrigir_ultimo_evento(p_ativo, p_camada, p_motivo)` (exclusão lógica do último evento da
    camada, com motivo obrigatório);
  - `nucleo.impacto_do_lancamento(...)` somente leitura, para o passo Conferir (antes e depois, efeitos e
    disponibilidade do dia);
  - Movimento: a lista de eventos do dia (quem, o quê, quando, origem), paginada, com filtro por sigla,
    conjunto e origem (**o desenho fino do Movimento é desta fatia**).
- **Telas:** o popup do assistente (variante central de `components/wizard/`), o modo rápido pelo cabeçalho do
  dia, o tracejado do Programado na grade, a tela Movimento.
- **Testes de aceite:** pgTAP (atômico: tudo ou nada; chave de envio repetida não duplica; só o último evento
  é corrigido; correção tardia marcada; mês fechado recusa sem permissão; programado fora de "X de Y", da
  disponibilidade e do resultado; confirmar no dia grava o evento real; RLS por perfil); unitário dos grupos
  de siglas e da validade por conjunto; e2e do caminho principal (lançar pela célula, lançar em lote pelo
  dia, corrigir, programar) e teste de "fechar é fechar" (rascunho, Esc, foco volta à célula).
- **Dependências:** A1 (a grade por conjunto), **M1 e M2** (o Lançar o dia integra a situação do dia à
  Posição do dia), P1 (caixa de Tarefas, para confirmar o programado), H3 e H4
  de `docs/decisoes.md`. Hipótese dos cinco grupos confirmada.

## A3. Barra lateral com as abas

- **Modelo e ritmo:** tela e funções de leitura. Risco médio.
- **Objetivo:** o painel lateral é **só detalhe**, com as abas Visão geral, Financeiro, Motorista,
  Combustível e Rota do mês. No Financeiro, a meta compara com o **esperado até a data** e rotula "mês em
  curso", sem classificar como crítico sem dado.
- **Tabelas e funções:** `nucleo.financeiro_do_conjunto(p_conjunto, p_mes)` (receita, custo, resultado,
  meta, esperado até a data, rótulo do mês, "dados até"), usando a função de resolução do CR
  (`docs/cr-regras.md`, fatia C0) e as duas linhas de receita; Combustível pelo Abastecimento (litros, km,
  média) com custo do Sankhya, sem somar os dois.
- **Telas:** o painel de detalhe com as cinco abas; Motorista só com Pessoas › ver; "Sem dados ainda:
  depende de X" em toda parte sem fonte.
- **Testes de aceite:** unitário e pgTAP do esperado até a data (dia 1, dia 11, último dia e mês fechado,
  com fixtures fictícias); o mês em curso sem receita não vira "crítico"; Motorista invisível sem Pessoas;
  RLS; e2e: o painel abre da placa e da linha, fecha com Esc e devolve o foco; sem R$ 0,00 por falta de dado.
- **Dependências:** A1; C0 e D0 para o Financeiro por conjunto (ou o Financeiro mostra "Sem dados ainda"
  até lá); o lote de "dados até" (integrado).

## A4. Rota na rodovia

- **Modelo e ritmo:** banco, worker e mapa. Risco médio-alto (chave de serviço externo, cota diária).
- **Objetivo:** a aba **Rota do mês** mostra o caminho pela estrada, com carregado e vazio, paradas com
  tempo, replay por dia, km pela estrada contra km faturado e a atribuição ao OpenStreetMap e ao
  OpenRouteService.
- **Tabelas e funções:**
  - carga provisória do dump da v1 (`C:\Backups\transul_v1_completo.dump`, só leitura): `config.cidade`
    (5.571 municípios) e `staging.posicao_diaria` (5.147 pontos, 165 veículos, de 27/07 a 28/10/2026), com o
    `vehicle_id` convertido em placa na carga; o script mostra só contagens;
  - `nucleo.rota_por_par_de_cidades` (único por origem, destino e perfil `driving-hgv`) e
    `nucleo.consumo_do_servico_de_rotas` (dia, consultas) com o limite em `config.parametro`;
  - `nucleo.rota_do_mes(p_placa, p_mes)`; worker que preenche o cache dos pares que faltam, com a chave do
    serviço **só no worker** (nunca no `.env.local` do navegador, nunca na Vercel do cliente);
  - sem cota: linha reta marcada "ainda não calculada".
- **Telas:** o mapa (MapLibre + OpenStreetMap) na aba Rota do mês, com legenda de carregado e vazio, paradas,
  replay e o rótulo "rota estimada pela rodovia"; atribuição sempre visível.
- **Testes de aceite:** pgTAP (o cache é único por par; um segundo pedido do mesmo par não consulta o
  serviço; ao atingir o limite não consulta; RLS); teste do worker com serviço simulado (sem rede), cobrindo
  cota, erro e nova tentativa; unitário da divisão carregado e vazio pelas siglas do dia; e2e do mapa com
  rota fictícia e atribuição presente; teste de que **nenhuma chave** aparece no código do navegador.
- **Dependências:** A3 (a aba existe); **M2 (a Posição do dia é a fonte principal das posições; o dump da
  v1 é só o histórico inicial)**; a conferência da política de uso dos tiles do OpenStreetMap; a ponte
  do Sankhya para origem e destino das viagens e para o km faturado (até lá, o par é o das duas cidades
  consecutivas e o km faturado mostra "Sem dados ainda").

## A5. Legenda gerada e tons de cor

- **Modelo e ritmo:** tela e regra pura; uma migration só se `config.status` for a fonte do catálogo.
  Risco baixo a médio (visual e teste).
- **Objetivo:** a legenda sai da régua, com os cinco tons de verde e os tons dos outros grupos, e a sigla é
  sempre escrita (a cor só reforça).
- **Tabelas e funções:** o campo **significado** em `lib/dominio/status.ts` (e em `config.status`, com o
  teste de espelho existente, se for a fonte); nenhuma função de leitura nova: a tela da legenda lê o
  catálogo. Tokens `--status-atividade-1` a `-5` (e os de âmbar, vermelho e cinza) em `app/globals.css`,
  nos temas claro e escuro, lidos só pelos tokens.
- **Telas:** botão **"Legenda"** e **faixa rápida** na grade; tela **"Legenda e siglas"**
  (`/frota/acompanhamento/legenda`) com busca e "Imprimir ou salvar em PDF"; nome da sigla ao passar o mouse
  e ao tocar (`aria-label` e balão); sem rolagem lateral em 1366, 1092, 820 e 390.
- **Testes de aceite:** **completude da régua** (falha se faltar nome, grupo, tom ou significado, ou se uma
  sigla não aparecer na legenda); **contraste de 4,5:1** em todos os pares fundo e texto de status, nos dois
  temas; teste de que nenhuma cor de status está escrita à mão fora dos tokens; teste de componente da busca
  e do balão ao toque; e2e: abrir a legenda pelo botão e achar uma sigla pela busca.
- **Dependências:** nenhuma (independente de A1). Valores do tema escuro e dos outros grupos aguardam
  confirmação.

## A6. Status do motorista

- **Modelo e ritmo:** banco (tabela nova, RLS por Pessoas) e tela. Risco alto (dado de pessoa, permissão):
  para no checkpoint.
- **Objetivo:** a linha fina do motorista sob cada conjunto, a contagem por status na faixa do topo e a aba
  Motorista com o calendário do mês; o realizado do dia é diferente da escala; causa e efeito entre motorista
  e conjunto.
- **Tabelas e funções:** `pessoas.status_do_dia_do_motorista` (pessoa, dia, código, origem, registrado por e
  quando, exclusão lógica com motivo, versão; único por pessoa e dia vigente), RLS só para quem tem Pessoas ›
  ver; função `pessoas.motorista_do_conjunto_no_mes(p_conjunto, p_mes)` (realizado, escala e substituto,
  security invoker, sem remuneração); `pessoas.contagem_de_status_do_dia(p_dia)`; a regra de causa e efeito
  em `lib/dominio/` (motorista de folga ou férias sem substituto leva o conjunto a FOg ou FEr); a tarefa
  "indicar substituto" na caixa de Tarefas (P1) quando há férias programadas sem substituto.
- **Telas:** linha fina com interruptor na grade (dias futuros em itálico e pontilhado), chips de motorista
  na faixa do topo, aba **Motorista** com o calendário do mês; **só para quem vê Pessoas**; remuneração,
  diária e premiação só com Pessoas e Resultados.
- **Testes de aceite:** pgTAP (o realizado é único por pessoa e dia; correção só com motivo; RLS: sem Pessoas
  não há linha nem aba; função sem coluna de remuneração); unitário da causa e efeito (folga ou férias sem
  substituto vira FOg ou FEr; com substituto não); a tarefa nasce uma vez (idempotente); e2e do caminho
  principal e teste de que perfil sem Pessoas não enxerga o motorista.
- **Dependências:** A1 (grade por conjunto), P1 (caixa de Tarefas), os códigos do motorista confirmados e o
  mapeamento de T, F, FE e AT da escala atual para os códigos novos. **Dois motoristas por conjunto ficam
  fora desta fatia.**

## Nova ordem (11/11/2026)

Depois da Etapa 5 (A5 e A1): **M1, M2, A2, V0 e Trocar CR, P3, A4** (ver
`docs/superpowers/plans/2026-11-11-processos-e-vinculos.md`). **A4 depende de M2**, e não só do dump da v1: as
posições do dia dos gestores são a fonte principal da rota; a carga da v1 (165 veículos) só dá o histórico
inicial. Placa sem posição mostra "Sem dados ainda: depende de posição do veículo".
