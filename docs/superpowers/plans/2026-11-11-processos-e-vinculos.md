# Plano: processos e vínculos com história

Escrito em 11/11/2026. **A fila atual não muda:** integrar os branches pendentes, esqueleto global (com a
parada única para Alexandre ler `docs/esqueleto-global.md`), "Lançar o dia" + Movimento, Abastecimento v2
e o resto da Parte B. As fatias abaixo **entram nessa fila** nos pontos indicados em "Dependências". Cada
uma vira um prompt curto: "execute a fatia X do plano".

Desenho: `docs/gerenciador-de-processos.md` e `docs/vinculos-com-historia.md`. Hipóteses H1 a H7 em
`docs/decisoes.md` (11/11/2026): cada fatia só implementa o que Alexandre já confirmou.

Regras de todas as fatias: teste antes do código em `lib/dominio/`; pgTAP em toda política e função;
função atômica com chave de envio e versão; nada de dado de pessoa no repositório, no chat ou no CI; sem
nuvem até Alexandre pedir; commit direto na `main`, arquivo por arquivo.

## V0. Vínculos com história

- **Modelo e ritmo:** banco, Opus, **com checkpoint** (risco alto: banco, RLS, função atômica, dados reais).
- **Objetivo:** a placa segue o CR; trocar o CR é uma ação só; a história fica na operação. Resolve as
  faltas i a iv de `docs/vinculos-com-historia.md`.
- **Tabelas:** generalizar `nucleo.cr_de_servico_na_operacao` para todo CR com vigência (frota, acionista
  e serviço), mantendo o `EXCLUDE`; preencher a partir de `placa_na_operacao` sem perder a montagem; visão
  de divergência entre a operação do CR e a da placa. Tokens `vigente` e `encerrado` nos tokens do Eixo.
- **Funções:** `trocar_cr(placa, cr_novo, data, motivo, origem_da_data)` atômica, sem buraco, que também
  move a placa de operação; troca retroativa marcada "correção tardia" (H3).
- **Telas:** assistente **Trocar CR**; **Ficha do CR** (nova); aba CRs da placa; histórico e filtro "só
  vigentes" ou "incluir histórico" na ficha da operação e nas listas.
- **Aceite:** pgTAP (atômico, sem buraco, nada apagado, a operação da placa muda na data, A tem a placa até
  a troca e B depois, o resultado do mês acompanha, RLS com usuário de cada perfil); e2e do caminho
  principal; teste de rótulo, ícone e contraste AA nos dois temas.
- **Dependências:** H1 a H3 confirmadas por Alexandre. **Fecha antes de qualquer carga real na nuvem.**

## P1. Caixa de Tarefas

- **Objetivo:** é a Parte B generalizada, **sem reescrevê-la**: a caixa lê as tarefas que nascem dos
  estados de `transferencia`, `custodia`, `chegada`, `ordem_de_carregamento`,
  `confirmacao_da_carteira` e `fila_de_excecoes`.
- **Tabelas e funções:** schema `processos` com `instancia`, `tarefa` e `evento`; `minhas_tarefas`,
  `tarefas_da_fila`, `pegar_tarefa`. Tarefa cai para o dono do objeto; sem dono, vai para a fila do papel.
- **Telas:** **Início › Tarefas** (caixa por pessoa e por fila, com prazo e situação); o cartão abre o
  wizard com o contexto preenchido, com "por que você vê isto" e "o que acontece depois"; rascunho no
  banco.
- **Aceite:** pgTAP de RLS por escopo; só uma pessoa pega a tarefa da fila (duas ao mesmo tempo: uma
  falha); tarefa some da caixa quando o estado de negócio muda; e2e: a tarefa abre o wizard certo.
- **Dependências:** afb7 integrado (Tarefas e fila de exceções) e o esqueleto global. H4 e H7.

## P2. Responsáveis e substituição

- **Objetivo:** dizer quem responde por cada passo e quem cobre quem.
- **Tabelas e funções:** `processos.delegacao` (de, para, início, fim, âmbito), matriz de responsáveis
  (processo × passo × papel × escopo) versionada; ampliar `config.papel` com os papéis de negócio;
  `reatribuir`, `delegar`.
- **Telas:** **Administração › Processos e responsáveis** (a matriz); delegação a partir de Tarefas. O
  Administrador reatribui, mas não age em nome de ninguém (H5).
- **Aceite:** pgTAP (a substituição só vale dentro do período; fora dele a tarefa volta ao dono; RLS);
  e2e de uma delegação com período.
- **Dependências:** P1. H5.

## P3. Processos como dado

- **Objetivo:** os fluxos passam a ser dado versionado, não código.
- **Tabelas e funções:** `processo`, `passo`, `transicao` completos; `iniciar_processo` e `avancar`. Os
  primeiros processos, com prazos (H4): **lançar o dia**, **confirmação mensal**, **baixa de placa com
  quatro olhos** e **trocar CR** (reaproveita a V0).
- **Telas:** o wizard de cada processo, com modo rápido para quem repete (em lote, "X de Y") e resumo do
  antes e do depois com desfazer quando possível. Prazo vencido sinaliza e nunca cancela.
- **Aceite:** pgTAP (a versão antiga do processo continua valendo para as instâncias abertas; quem pede a
  baixa não a aprova; evento imutável); e2e dos quatro fluxos; teste de prazo vencido.
- **Dependências:** P1, P2 e V0 (para trocar CR). "Lançar o dia" + Movimento da fila principal.

## P4. Painel de processos

- **Objetivo:** mineração de processo: tempo por etapa, prazo vencido e gargalos.
- **Tabelas e funções:** leitura sobre `evento` e `tarefa` (visões; o banco entrega os totais prontos, sem
  soma no navegador); definição em `docs/glossario.md` de cada métrica.
- **Telas:** **Administração › Painel de processos**, no padrão de telas.
- **Aceite:** teste de cada métrica contra um caso conhecido; pgTAP de RLS; e2e em 1366 e 1920.
- **Dependências:** P3 com eventos suficientes para medir.

## P5. Acerto de acionista

- **Objetivo:** o processo do acerto com o acionista, com quatro olhos.
- **Tabelas e funções:** novo processo sobre a camada de P3; usa os parceiros acionistas e os CRs de
  acionista.
- **Telas:** o wizard do acerto, com resumo do antes e do depois.
- **Aceite:** pgTAP (quatro olhos, evento imutável, o valor bate com a fonte); e2e do caminho principal.
- **Dependências:** P3 e a **ponte do Sankhya**. Só depois dela.

## Revisão estrutural (11/11/2026): fatias C0 a C4 e D0

Vêm da rodada de revisão estrutural (`docs/revisao-estrutural.md`, `docs/cr-regras.md`,
`docs/v1-frutos-e-licoes.md`). A fila principal continua a mesma. Ordem sugerida: **V0 e C0 juntas** (as duas
mexem no vínculo CR-operação), depois **D0**, depois **C1**, **C2**, **C3** e **C4**. Todas dependem da
hipótese **H8** (`docs/decisoes.md`) e das H1 a H3. Todas são banco e regra de negócio: **Opus, com
checkpoint**, e **só no staging e no banco local**; nada na nuvem.

## C0. CR canônico

- **Objetivo:** um modelo só do CR. O vínculo **CR-operação passa a ter vigência para todo CR** e existe
  **uma função que resolve "CR > placa > operação na data D"**. Fecha as divergências 1, 3 e 4 de
  `docs/cr-regras.md`.
- **Tabelas:** generalizar `nucleo.cr_de_servico_na_operacao` para todo CR (frota, acionista e serviço),
  preencher a partir de `cr.operacao_id` e de `placa_na_operacao` sem perder a montagem (o caminho de menor
  risco de `docs/vinculos-com-historia.md`); marcar `cr.operacao_id` como legado até chegar a zero de
  divergência.
- **Funções:** `nucleo.resolver_cr(p_data date, p_codcencus, p_placa)` devolvendo CR, placa e operação
  vigentes naquela data (por data D, não por mês); `nucleo.cr_da_operacao_no_mes` passa a chamar esta função.
  Um CR inativo ou bloqueado continua resolvido (regra a).
- **Testes de aceite:** pgTAP (a função devolve a operação certa nos limites `[início, fim)`; CR bloqueado
  com despesa resolve; troca de CR muda o resultado na data); **teste de arquitetura** (I5: falha se
  qualquer consulta lê `cr.operacao_id`, `cr_do_ativo`, `placa_na_operacao` ou `cr_de_servico_na_operacao`
  fora da função); pgTAP de RLS com usuário de cada perfil.
- **Dependências:** H1 confirmada. É a base de V0, D0 e C1 a C4.

## D0. Lançamento classificado em 1 tipo, com total que bate

- **Objetivo:** todo lançamento cai em exatamente 1 dos 10 tipos e o total por mês sempre bate. **Sobre o
  staging**, sem esperar a ponte.
- **Tabelas e funções:** `config.tipo_de_lancamento` (os 10 tipos, com a ordem de decisão e se entra no
  resultado da operação); `nucleo.tipo_do_lancamento(...)` (a ordem de `docs/cr-regras.md`); visão
  `nucleo.lancamento_atribuido` (lançamento, CR, tipo, placa, operação, competência); "sem destino" e a
  fila de exceções com dono e prazo para o que não for atribuído (regra e). Neutralização de frete de
  terceiro e impostos (regra d).
- **Testes de aceite:** I1, I2, I3, I4 e I9 sobre o staging: nenhum lançamento com 0 ou 2 tipos; soma por
  tipo mais "sem destino" = total, mês a mês e valor a valor; entradas = atribuídas + fila. O relatório de
  reconciliação mostra só **agregados** (nada de CPF, nome ou placa).
- **Dependências:** C0 e a pergunta de `docs/cr-regras.md` (divergência 6: a base da competência no
  staging). Antes da ponte do Sankhya.

## C1. Saúde do CR

- **Objetivo:** uma tela que diz, para cada CR, se ele está bem: com operação vigente, com placa quando o
  tipo exige, sem duplicata, sem despesa em "sem destino", e o que fazer.
- **Tabelas e funções:** visão `nucleo.saude_do_cr` (um CR por linha, com o problema e o dono); regras de
  sinalização em `lib/dominio/` (puras, com teste). Reaproveita a fila de exceções.
- **Telas:** **Ficha do CR** ganha a aba "Saúde"; lista de CRs com chips por problema, com contagem, 20 por
  página e olho.
- **Testes de aceite:** um caso por problema (CR sem operação, sem placa onde era exigida, repetido, placa
  com 2 CRs do mesmo tipo, bloqueado com despesa); RLS por perfil; e2e em 1366 e 1920.
- **Dependências:** C0, D0 e a V0 (ficha do CR).

## C2. Rastro do número

- **Objetivo:** clicar em um valor mostra o caminho até os lançamentos: valor → operação → CR → placa →
  lançamento, com o "porquê" de cada passo. É o princípio "explicável" em ato.
- **Tabelas e funções:** `nucleo.rastro_do_valor(p_metrica, p_chave, p_mes)` devolvendo os degraus e os
  totais por degrau (o banco soma; a tela não soma); usa só a função de resolução e a de atribuição.
- **Telas:** painel lateral "De onde vem este número", aberto de qualquer valor da cascata, da ficha e do
  Resultados; cada degrau mostra o código do Sankhya e o motivo.
- **Testes de aceite:** a soma dos degraus = o valor clicado (I2); o rastro de um valor conhecido bate com o
  staging; o painel fecha com Esc e devolve o foco; RLS: ninguém vê degrau de operação que não vê.
- **Dependências:** C0 e D0.

## C3. Impacto antes de gravar a troca de CR

- **Objetivo:** antes de confirmar **Trocar CR** (V0), o assistente mostra o que muda: quanto do resultado
  de cada operação, por mês, passa de uma para a outra, e quais meses já estão fechados.
- **Tabelas e funções:** `nucleo.impacto_da_troca_de_cr(p_placa, p_cr_novo, p_data)` somente leitura,
  devolvendo antes e depois por operação e mês; a V0 (`trocar_cr`) só grava depois.
- **Telas:** o passo final do assistente Trocar CR com o resumo do antes e do depois e o aviso "correção
  tardia" quando a data é retroativa (H3).
- **Testes de aceite:** antes + depois somam o mesmo total (nada se perde); mês fechado exige a permissão
  definida em H3; o impacto de uma troca conhecida bate com a gravação real.
- **Dependências:** V0, C0, D0 e H3.

## C4. Fechamento do mês com trava

- **Objetivo:** o mês fecha, com a conferência feita e a trava visível; depois de fechado, mudança só por
  **ajuste justificado, com aprovação por alçada**, nunca por edição do fato.
- **Tabelas e funções:** `nucleo.fechamento_do_mes` (mês, situação: aberto, em conferência, fechado; quem,
  quando, totais congelados); `fechar_mes` atômica, que **recusa** se houver exceção aberta com prazo
  vencido ou se o total não bater (I2); `reabrir_mes` só com alçada e motivo, registrada em evento. Roda
  como processo de P3 (fechamento mensal da operação).
- **Telas:** Resultados › Fechamentos (hoje esqueleto): o lacre do mês, a lista de pendências e o histórico
  de ajustes.
- **Testes de aceite:** pgTAP (não fecha com exceção vencida; não fecha se o total não bate; mês fechado
  recusa gravação direta; reabrir exige alçada e deixa evento; RLS); e2e do caminho principal.
- **Dependências:** C0, D0, C1, P3 (processos como dado) e a definição de alçada (H3 e H6).

## Nova ordem de execução (11/11/2026)

**Depois da Etapa 5 do prompt único** (A5 e A1), a ordem é: **M1** (Meu dia, receber em lote, wizard em
popup), **M2** (Posição do dia), **A2** (Lançar o dia no wizard em popup, integrando a situação do dia à M2),
**V0 e Trocar CR**, **P3** (processos como dado), **A4** (rota na rodovia, que passa a **depender de M2**). A fila
principal do restante não muda.

## M1. Meu dia, Receber placas em lote e wizard em popup

- **Modelo e ritmo:** banco (funções de leitura novas, RLS pela carteira) e tela. Risco médio: **para no
  checkpoint** e espera o "aprovado" antes de aplicar no banco local.
- **Objetivo:** o gestor de frota cai numa fila guiada (receber placas, posição do dia, confirmar carteira, outras
  tarefas); "Receber placas" em lote com Aceitar, Aceitar com pendências e Recusar; o variante de **popup
  central** do `Assistente` e a aposentadoria da variante lateral.
- **Tabelas e funções:** nenhuma tabela nova de regra; leitura `nucleo.meu_dia()` e `nucleo.pedidos_para_receber()`
  (security invoker, a RLS da carteira vale); o lote chama, **uma por placa**, as funções que já existem
  (`receber_transferencia`, `concluir_transferencia`, `devolver_pedido_contestado`; pendências em
  `transferencia_pendencia`), pela Server Action (Zod, `exigirPermissao()`); o prazo da transferência é parâmetro.
- **Telas:** `docs/meu-dia.md`; ficha `docs/fichas-de-tela/inicio-meu-dia.md`; o popup central em
  `components/wizard/`.
- **Testes de aceite:** pgTAP (ordem da fila, só o destino decide, o Administrador não decide, RLS);
  unitário (falha de uma placa não impede as outras, repetir o clique não duplica, motivo obrigatório); e2e do
  caminho principal; fidelidade ao protótipo.
- **Dependências:** Etapa 5 (A5 e A1), caixa de Tarefas (P1, já integrada), H5 e H4.

## M2. Posição do dia

- **Modelo e ritmo:** banco (tabelas e funções novas, RLS, dado de localização de ativo) e tela. Risco alto:
  **para no checkpoint** e espera o "aprovado".
- **Objetivo:** o popup obrigatório, todos os dias no primeiro acesso depois das 5h, que lista os conjuntos da
  carteira e não fecha até todos serem respondidos (Continua em, Mudou de cidade, Sem sinal), com presets de
  oficina e pátio, a situação do dia no mesmo passo, o alerta de distância improvável, rascunho e liberação só
  pelo líder, com motivo.
- **Tabelas e funções:** `config.cidade` (a partir de `cidades_brasil` do dump da v1, 5.571 linhas),
  `nucleo.posicao_do_conjunto` (chave única por conjunto, dia e origem), `nucleo.liberacao_da_posicao`, tipo
  `posicao_pendente` na fila de exceções; `posicoes_do_dia`, `registrar_posicao_do_dia`,
  `liberar_posicao_do_dia`, `distancia_improvavel`; carga provisória `staging.posicao_diaria`
  (`vehicle_posicoes_diarias`, 5.147 pontos, 165 veículos).
- **Telas:** `docs/posicao-do-dia.md`; ficha `docs/fichas-de-tela/inicio-posicao-do-dia.md`.
- **Testes de aceite:** pgTAP (unicidade, correção sem apagar, RLS por perfil, só o líder libera, pendência
  única); unitário (regra das 5h, distância e fator, sem coordenada não alerta); e2e; fidelidade ao protótipo.
- **Dependências:** M1 (a fila guiada), a tabela de cidades, H5. **Alimenta** A2, A4 e o Movimento.

## CI-2. Teste de migração sobre dados (NÃO executar agora)

Pedido de Alexandre em 11/11/2026, depois do defeito do lote de número (a migration reclassificou exceções e deixou as
antigas abertas; só apareceu num banco que já tinha staging carregado, porque o CI roda com o staging vazio).

- **O que é:** aplicar as migrations novas num banco com fixtures **fictícias** de staging e de fila (estado "antes"
  parecido com o real) e conferir, depois da migration, as contagens e a **idempotência** (rodar a função duas vezes não
  muda nada na segunda).
- **Onde:** job do CI que sobe o banco, aplica as migrations até a anterior, insere as fixtures, aplica as novas e roda
  as conferências; nada de dado real, nada de nuvem.
- **Obrigatória ANTES da carga na nuvem.** Sem ela verde, não há carga.
- **Aceite:** reproduz o caso de 11/11 (18 antigas abertas, 15 reclassificadas): termina com 3 abertas do tipo certo e
  15 fechadas com motivo, nenhuma apagada; segunda rodada com zero alterações.
