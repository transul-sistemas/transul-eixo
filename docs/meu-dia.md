# Meu dia

Escrito em 11/11/2026 (Alexandre). **Só desenho: nada aqui está construído.** Referência visual (layout, não
código): `docs/prototipos/tarefas-e-vinculos/4-meu-dia-receber-placas.html` (origem:
https://claude.ai/artifact/R4XnmLHR55bc17ra993Yy6, tela 4). Ficha de tela: `docs/fichas-de-tela/inicio-meu-dia.md`.
Fatia: **M1** em `docs/superpowers/plans/2026-11-11-processos-e-vinculos.md`.

## O que é

Quando o **gestor de frota** entra no Eixo, ele cai numa **fila guiada**: uma sequência de assistentes, em
popup central, que cada conclusão abre a próxima sozinha. É a regra de `docs/gerenciador-de-processos.md`
("a tarefa nunca abre uma tela avulsa") aplicada à rotina diária da carteira.

A ordem do Meu dia:

1. **Receber placas** (tarefa 1 de 3): os pedidos de transferência que esperam o gestor, em lote.
2. **Posição do dia** (tarefa 2 de 3): onde estão os conjuntos da carteira hoje (`docs/posicao-do-dia.md`).
3. **Confirmar carteira** (tarefa 3 de 3): a confirmação mensal das placas (assistente que já existe).
4. **Depois, as outras tarefas** da caixa de Tarefas (lançar o dia, indicar substituto, exceções).

Cada passo diz "Tarefa N de 3 do seu dia". Passo sem nada a fazer (sem placas a receber, carteira já
confirmada) **não aparece**: a fila só mostra o que há. Fechar a fila no meio é permitido (menos a Posição do
dia, que é obrigatória; ver o documento dela): o que ficou volta como tarefa na caixa.

## Receber placas (assistente em lote)

Abre em **popup central**, com o stepper dos três passos do dia. Cada linha é uma placa pendente de
transferência **para este gestor**, com:

| Coluna | O que mostra |
| --- | --- |
| Placa | A mini placa Mercosul e o tipo (cavalo, caminhão, semirreboque, "bitrem · cavalo e 2 implementos") |
| Enviada por | O gestor de origem e há quanto tempo (**prazo da transferência**) |
| CR vigente | O código do CR vigente hoje e a operação dele, com o selo "Vigente"; sem CR vigente: "sem CR vigente" e "vira tarefa de cadastro" |
| Pendências | As pendências já conhecidas da placa (RENAVAM, carroceria...) ou "nenhuma" |
| Sua decisão | **Aceitar**, **Com pendências** ou **Recusar** |

### As três decisões

- **Aceitar:** a placa passa para a carteira do gestor.
- **Aceitar com pendências:** a placa **entra** na carteira, e **cada pendência vira uma tarefa** de cadastro
  (a fila de exceções existente, com dono e prazo).
- **Recusar:** a placa **volta ao gestor de origem**, com **motivo obrigatório** (lista de motivos mais "outro",
  com texto). A origem recebe a tarefa de tratar a devolução.

### Regras

1. **Cada placa é um pedido independente.** Se uma falhar, as outras seguem e a tela diz **qual falhou e por
   quê** (por exemplo, "o pedido já foi concluído por outra pessoa"). Nada de "tudo ou nada" aqui, ao contrário
   do Lançar o dia: o resumo final mostra "3 aceitas, 1 com pendências, 1 recusada" e, se houve falha, "1 não
   foi gravada" com a causa e o botão **Tentar de novo** só para ela. A chave de envio impede duplicar ao
   repetir o clique.
2. **Só o gestor de destino decide.** O **Administrador não age em nome de ninguém** (H5): ele pode ver o pedido
   e reatribuir a tarefa, mas o botão de decidir não existe para ele.
3. **Prazo da transferência com sinalização em vermelho suave** ("há 8 dias"): o tom é o de "encerrado/atraso" suave,
   nunca o de erro, **sempre com o texto** (nunca só pela cor). Prazo vencido **sinaliza e nunca cancela** (H4);
   o prazo é parâmetro em `config.parametro`, editável só pelo Administrador, com auditoria.
4. **Mostra o CR vigente e a operação de cada placa** (a regra "a placa segue o CR", H1). Até a função única de
   resolução (C0) existir, o CR vigente vem de `nucleo.cr_do_ativo` e a operação, de `placa_na_operacao`.
5. **Reaproveita o que já existe.** O banco já tem as funções de receber, concluir e devolver
   (`nucleo.receber_transferencia`, `nucleo.concluir_transferencia`, `nucleo.devolver_pedido_contestado`) e a
   tabela de pendências (`nucleo.transferencia_pendencia`). O lote **chama essas funções uma por placa**, cada
   uma na sua transação, pela Server Action (com Zod e `exigirPermissao()`); não há regra nova de transferência.
6. **Estados que pedem ação:** sem permissão (só o gestor de destino vê o botão de decidir; o Administrador vê o
   pedido e a ação "Reatribuir"); erro de leitura (mensagem por causa e **Tentar de novo**); lista vazia ("Nenhuma placa
   espera você. Ir para a Posição do dia"); dado parcial (sem CR vigente: tarefa de cadastro).

## Dados e funções

- **Leitura nova (M1):** `nucleo.meu_dia()` (security invoker, RLS pela carteira): devolve a fila guiada do
  gestor, na ordem, com as contagens ("5 pedidos esperando você") e o que já foi feito hoje; e
  `nucleo.pedidos_para_receber()` com o contexto de cada placa (CR vigente, operação, pendências, prazo).
  Reaproveita `nucleo.contar_para_receber()`.
- **Escrita:** nenhuma função nova de regra. O lote orquestra as existentes. A conclusão de cada passo grava o
  evento do processo (`docs/gerenciador-de-processos.md`) e abre o próximo.
- **Rascunho:** as decisões ainda não confirmadas ficam como rascunho no banco, para retomar em outro computador.

## Testes de aceite (M1)

- pgTAP: `meu_dia()` devolve a ordem certa e some o passo vazio; só o gestor de destino vê e decide; o
  Administrador não decide; a leitura respeita a RLS da carteira.
- Unitário: cada decisão chama a função certa; uma falha não impede as outras; repetir o clique não duplica; o
  motivo da recusa é obrigatório; a pendência vira tarefa uma única vez.
- e2e: entrar como gestor, passar pelos três passos, recusar sem motivo (bloqueia) e com motivo, ver "X de Y".
- Fidelidade ao protótipo: checklist da ficha, capturas a 1366 claro e escuro ao lado do HTML de referência.
