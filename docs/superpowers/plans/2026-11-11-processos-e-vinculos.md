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
