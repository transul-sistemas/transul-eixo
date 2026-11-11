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
