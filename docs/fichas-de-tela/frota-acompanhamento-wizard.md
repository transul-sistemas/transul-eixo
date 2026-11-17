# Ficha: Frota › Acompanhamento › o wizard Lançar situação (popup central)

Escrita em 11/11/2026. **Só desenho.** Desenho de origem: `docs/acompanhamento-v2.md`, item (b); fatia A2 do plano
`2026-11-11-acompanhamento-v2.md`. Referência de layout: artefato do Acompanhamento, `Wizard-situacao.dc.html` e
`Wizard-conferir.dc.html` (dados fictícios).

## 1. A pergunta que a tela responde

"O que este conjunto está fazendo neste dia, e o que muda na frota quando eu gravo isso?"

Responde antes de gravar: a situação nova, o que ela fecha, o que o conjunto herda e quanto a disponibilidade do dia
sobe ou desce.

## 2. Quem usa e que decisão toma

- **Gestor de frota**: lança a situação do dia dos conjuntos da carteira, um a um (clicando na célula) ou em lote
  (clicando no cabeçalho do dia). Decide o que aconteceu de fato: carregando, em trânsito, parado na oficina.
- **Gestor de frota, dia passado**: faz correção tardia com motivo.
- **Diretoria**: não grava direto (H6); o pedido vira tarefa e aprovação.
- **Administrador**: corrige o último evento quando o gestor errou, com motivo.

## 3. A ação principal e as ações de cada estado

Botão principal, o mesmo nome do começo ao fim: **Lançar situação** (no fim, "Situação lançada"). Em lote: **Lançar
para 4 conjuntos** ("4 de 4 lançados").

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto do passo atual | nenhuma |
| Vazio (conjunto sem sigla válida) | "Nenhuma situação vale para este conjunto neste dia." | **Ver a legenda** |
| Erro ao gravar | "Não foi possível lançar. Nada foi gravado. [causa]" | **Tentar de novo** |
| Recusa de um do lote | "O conjunto ZDM1A04 foi recusado: [motivo]. Nenhum conjunto foi gravado." | **Remover da lista e lançar os outros** |
| Sem permissão | "Seu perfil só lê a Frota." | **Pedir aprovação** (cria tarefa) |
| Mês fechado | "Outubro já fechou; a correção exige a permissão do fechamento." | **Pedir permissão** (tarefa) |
| Dado parcial (sem motorista) | Aviso "o conjunto está sem motorista; a sigla SMo vale" | **Indicar substituto** |
| Rascunho existente | "Você tem um lançamento não salvo deste conjunto." | **Continuar o rascunho** ou **Descartar** |

## 4. O elemento de assinatura

Os **cinco grupos de situação** com a sigla em destaque (Em operação, Aguardando, Manutenção, Parado, Portaria), só as
válidas para o conjunto; o **histórico do dia** (cada evento com hora e autor) com "Corrigir o último evento"; e o passo
**Conferir com antes e depois**, os efeitos ("o conjunto inteiro, cavalo e 3 implementos, fica em CAr") e o
**impacto na disponibilidade** ("conjuntos com lançamento 9 → 13 de 14; disponibilidade 71% → 79%").

## 5. De onde vem o número

- Grupos e validade por tipo: a régua de 25 siglas (`docs/glossario.md`), com a distribuição aprovada em 11/11/2026.
  ALU, EMP, VEN, SUC e VND nascem de posse e baixa, não deste wizard.
- Gravação: função atômica proposta `nucleo.lancar_situacao_do_dia(p_conjuntos, p_sigla, p_em, p_observacao,
  p_chave_de_envio)` com "X de Y" no retorno; correção por `nucleo.corrigir_ultimo_evento`.
- Impacto do passo Conferir: `nucleo.impacto_do_lancamento` (somente leitura). Não é recalculado na tela.
- Programado: `nucleo.situacao_programada`, tabela própria, fora do realizado e de "X de Y".
- Meta de prazo (lançar até 10h do dia seguinte): H4 de `docs/decisoes.md`.

## 6. O vazio honesto

- Sem evento no dia: "Nenhum registro neste dia. A primeira situação define como o conjunto amanheceu." Convida a
  escolher o grupo.
- Dia futuro: "Este dia ainda não chegou. A situação será gravada como **Programada** e não conta no realizado."
  Botão: **Programar situação**.
- Nada a corrigir: o botão "Corrigir o último evento" só existe quando há evento; sem ele, o texto é "Nada a corrigir".

## 7. A regra da v1 portada

- Siglas e a regra de que o status do cavalo vale para a carreta engatada: `docs/propostas/2026-10-02-status-diario.md`
  (v1). O Eixo melhora com hora, vários eventos por dia, evento imutável e correção com motivo.
- Lançar em dia passado: a v1 aceitava edição silenciosa da célula (`DIAGNOSTICO_SISTEMA.md`, "ajuste manual fora do
  sistema"). O Eixo exige motivo, marca como correção tardia e conta no selo.
- Popups do gestor: `docs/propostas/2026-10-14-popups-gestor.md` (v1), só como inspiração do fluxo curto.

## 8. Por que a tela não é uma tabela comum

Um formulário de edição trocaria o valor da célula. O wizard grava um **evento imutável com hora**, mostra o antes e o
depois, fecha as camadas de menor prioridade, herda aos implementos, recusa mês fechado e é tudo ou nada em lote. A
tela também sabe lidar com o futuro (Programado) e com o passado (correção tardia).

---

## Rota e estado

- **Construída (Fase 1, n1-tela, 13/11/2026):** Lançar situação (com hora opcional e "Corrigir o último evento"), "Lançar o dia" pelo número do dia no cabeçalho (tudo ou nada, com os recusados) e o Programado na célula futura (programar, confirmar, cancelar).
- Rota proposta: popup sobre `/frota/acompanhamento` (`?lancar=<conjunto>&dia=aaaa-mm-dd`), sem rota própria.
- Módulo Frota. Quem vê: Gestor de frota (escreve), Administrador (escreve e corrige); Diretoria só pela tarefa.
- Estado no catálogo: **esqueleto** do wizard novo (hoje existe o mini-wizard lateral de 2 passos, a aposentar).

## Estados e rótulos de vigência

O evento mostra "Vigente" (o último do dia, com ícone) e, ao ser corrigido, "Corrigido em dd/mm/aaaa" (suave, com
motivo). Programado: tracejado, com o rótulo "Programado para dd/mm/aaaa" e ícone de calendário.

## Atalhos

Passos: Enter continua, Esc fecha (pergunta antes de descartar, salva rascunho), Ctrl+Enter confirma o passo final.
Ctrl+K: "Lançar situação" e "Lançar o dia". O foco volta à célula que abriu o popup.

## Dúvidas e hipóteses

- (H) Em lote, todos os conjuntos recebem a **mesma** sigla e a mesma hora; hora diferente por conjunto fica fora da
  primeira versão.
- (H) O texto do aviso de mês fechado depende da permissão de H3, ainda por definir.
- Dúvida: o limite de rascunho por pessoa (um por conjunto e dia). Hipótese: um por conjunto e dia.

## Decisões de Alexandre (11/11/2026)

- **Lote do Lançar o dia:** **mesma sigla e mesma hora para todos** os conjuntos escolhidos, tudo ou nada com "X de Y". A **Posição do dia é individual por conjunto** (`docs/posicao-do-dia.md`), e não usa este lote.
- **Mês fechado (H3):** lançar em dia de mês fechado exige a permissão da Diretoria, por tarefa e com motivo (ver `trocar-cr.md`).

## Checklist de fidelidade

**Referência visual:** `docs/prototipos/acompanhamento/2-wizard-situacao.html e docs/prototipos/acompanhamento/3-wizard-conferir.html`. Marque cada item ao fim do bloco, com a captura a 1366 (claro e escuro)
ao lado do protótipo em `capturas/galeria/<bloco>/` (fora do Git); todo desvio vai para **Pontos para revisar**,
com o motivo.

- [ ] **Tokens de cor:** fundo `#F6F7FB`, superfícies brancas, texto `#0F1729`, linhas `#ECEEF4`, azul de ação
  `#3355FF`; cor do módulo Frota `#4338CA`; nenhum hexadecimal escrito à mão (só tokens).
- [ ] **Tons de status:** verde de "em atividade" em cinco degraus (`--status-atividade-1` a `-5`), âmbar (2),
  vermelho (3) e cinza (2); **vigente verde e encerrado vermelho suave, sempre com rótulo, data e ícone, nunca só
  pela cor**; contraste de 4,5:1 nos dois temas.
- [ ] **Fonte e pesos:** Barlow (400, 500, 600 e 700); títulos e números como no protótipo; a placa em Barlow
  Semi Condensed.
- [ ] **Textos e rótulos:** os do protótipo, em letra minúscula normal: "Lançar situação", "Histórico do dia", "Corrigir o último evento", "Nova situação", os cinco grupos (Em operação, Aguardando, Manutenção, Parado, Operacional), "Lançar para N conjuntos".
- [ ] **Ordem dos elementos:** título e subtítulo (placa, tipo, data); stepper (Dia e conjunto, Situação, Hora e observação, Conferir); histórico do dia com "Corrigir o último evento"; a escolha em cinco grupos; o aviso do conjunto; no Conferir, antes e depois, "o que acontece", lançar a mais conjuntos e o impacto no dia; rodapé (Cancelar, Voltar, Continuar).
- [ ] **Estados:** vazio ("Sem dados ainda: depende de X"), carregando (esqueleto), erro (mensagem por causa e
  "Tentar de novo"), sem permissão, dado parcial; cada estado que pede algo oferece a ação.
- [ ] **Tema claro e escuro** (primeira classe), com os tokens e o contraste.
- [ ] **1366 e 1092:** sem rolagem lateral da página; em 1920 aparecem mais colunas, sem apenas esticar.

**O que sempre difere por natureza (não é desvio):** a placa é o componente da **mini placa Mercosul** em
**Barlow Semi Condensed** (o protótipo desenha uma placa genérica); os **ícones são Tabler** (o protótipo usa
SVG avulso); os **dados são reais** (o protótipo é fictício); o **mapa é real**, com a linha pela rodovia (onde
houver mapa); moeda, data e números pelos componentes de `components/formato/`; **20 por página e olhinho em toda
linha** (o protótipo mostra poucas linhas). Específico desta tela: o protótipo desenha o popup de 700 px; no Eixo é o componente `Assistente` em variante de popup central, com rascunho salvo, "fechar é fechar" e Esc; o protótipo mostra o grupo "Operacional" com DOp, que o Eixo só oferece quando a regra de entrega permitir.
