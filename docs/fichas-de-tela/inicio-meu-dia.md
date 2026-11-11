# Ficha de tela: Início › Meu dia (Receber placas)

Regra anti-genérico (`docs/fichas-de-tela/README.md`). Desenho completo em `docs/meu-dia.md`.

## 1. A pergunta que a tela responde

"O que eu preciso fazer hoje na minha carteira, e em que ordem?" E, no primeiro passo: "Quais placas esperam a
minha decisão, e o que eu faço com cada uma?".

## 2. Quem usa e que decisão toma

O **gestor de frota** (e quem o substitui no período). Decide, placa a placa, **aceitar**, **aceitar com
pendências** ou **recusar** (devolvendo ao gestor de origem, com motivo). Depois de decidir, a fila guiada leva
sozinha à Posição do dia e à confirmação da carteira.

## 3. A ação principal e as ações de cada estado

- **Principal:** "Confirmar as N decisões e ir para a Posição do dia".
- **Carregando:** esqueleto do popup. **Vazio:** "Nenhuma placa espera você." com a ação **Ir para a Posição do
  dia**. **Erro:** mensagem por causa e **Tentar de novo**. **Sem permissão** (Administrador): vê o pedido e a
  ação **Reatribuir tarefa**, nunca decidir. **Falha de uma placa:** a tela diz qual e por quê, e oferece
  **Tentar de novo** só para ela. **Sem CR vigente:** a placa pode entrar com pendência e vira tarefa de cadastro.

## 4. O elemento de assinatura

A linha da placa com o **CR vigente e a operação** ao lado ("CR011 · Vigente · Operação A") e o **prazo da
transferência** em vermelho suave com texto ("há 8 dias"); o seletor de três posições (Aceitar, Com pendências,
Recusar) com o motivo que aparece só ao recusar. Nenhuma lista comum mostra o vínculo do CR no momento da decisão.

## 5. De onde vem o número

A fila vem de `nucleo.meu_dia()` e os pedidos, de `nucleo.pedidos_para_receber()` (RLS pela carteira). O CR vigente
vem de `nucleo.cr_do_ativo` e a operação, da resolução CR > placa > operação (hoje `placa_na_operacao`; depois, a
função única da fatia C0). O prazo é parâmetro em `config.parametro`. Sem fonte: "Sem dados ainda: depende de X".

## 6. O vazio honesto

"Nenhuma placa espera você. Siga para a Posição do dia." Placa sem CR vigente: "sem CR vigente: vira tarefa de
cadastro" (nunca um CR inventado).

## 7. A regra da v1 portada

A v1 tinha o "Disponibilizar" e o "Receber" como telas avulsas (`docs/propostas/2026-09-29-posse-situacao.md` e
`2026-10-08-autonomia-gestores-cadastro.md`). O Eixo porta a regra (só o destino decide; recusar devolve com
motivo) e melhora: **lote com decisões independentes**, o CR vigente à vista, a pendência que vira tarefa e a fila
guiada.

## 8. Por que não é uma tabela comum

Uma tabela de pedidos mostra e filtra. Esta tela **decide em lote** e **encadeia o dia**: cada placa é um pedido
independente (uma falha não derruba as outras), a decisão carrega consequência (pendência vira tarefa, recusa vira
tarefa para a origem) e o fim do passo abre o próximo assistente.

## Rota e estado

`/inicio/meu-dia` (rota proposta; abre sozinho ao entrar). Gestor de frota. Esqueleto até a fatia **M1**.

## Checklist de fidelidade

**Referência visual:** `docs/prototipos/tarefas-e-vinculos/4-meu-dia-receber-placas.html`. Marque cada item ao fim do bloco, com a captura a 1366 (claro e escuro) ao lado
do protótipo em `capturas/galeria/<bloco>/` (fora do Git); todo desvio vai para **Pontos para revisar**, com o
motivo.

- [ ] **Tokens de cor:** fundo `#F6F7FB`, superfícies brancas, texto `#0F1729`, linhas `#ECEEF4`, azul de ação
  `#3355FF`; cor do módulo Início (azul de ação `#3355FF`); nenhum hexadecimal escrito à mão (só tokens).
- [ ] **Tons de status:** verde de "em atividade" em cinco degraus, âmbar (2), vermelho (3) e cinza (2); vigente
  verde e encerrado vermelho suave, sempre com rótulo, data e ícone, nunca só pela cor; contraste de 4,5:1 nos
  dois temas.
- [ ] **Fonte e pesos:** Barlow (400, 500, 600 e 700); a placa em Barlow Semi Condensed.
- [ ] **Textos e rótulos:** os do protótipo, em letra minúscula normal: "Receber placas", "N pedidos esperando você", "Tarefa 1 de 3 do seu dia", "Aceitar", "Com pendências", "Recusar", "Motivo (obrigatório)", "Confirmar as N decisões e ir para a Posição do dia".
- [ ] **Ordem dos elementos:** título e data; stepper do dia (Receber placas, Posição do dia, Confirmar carteira); aviso "Tarefa 1 de 3"; a tabela (Placa, Enviada por, CR vigente, Pendências, Sua decisão); o resumo (aceitas, com pendências, recusadas); rodapé (Cancelar, Confirmar).
- [ ] **Estados:** vazio, carregando (esqueleto), erro (mensagem por causa e "Tentar de novo"), sem permissão,
  dado parcial; cada estado que pede algo oferece a ação.
- [ ] **Tema claro e escuro** (primeira classe).
- [ ] **1366 e 1092:** sem rolagem lateral da página.

**O que sempre difere por natureza (não é desvio):** a placa é o componente da mini placa Mercosul em Barlow Semi
Condensed; os ícones são Tabler; os dados são reais; moeda, data e números pelos componentes de
`components/formato/`. Específico desta tela: o popup do protótipo tem 1100 px; no Eixo é o componente `Assistente` em popup central, com rascunho salvo e Esc; o seletor de decisão usa os componentes do sistema.
