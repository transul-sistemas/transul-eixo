# Ficha: Início › Tarefas (a caixa de tarefas)

Escrita em 11/11/2026. A tela já existe como **pronta** na primeira versão (lê `nucleo.tarefas_do_usuario()` e a fila de
exceções); a caixa por pessoa e por fila de papel é a fatia P1 de `docs/superpowers/plans/2026-11-11-processos-e-vinculos.md`
(**ainda desenho**). Desenho de origem: `docs/gerenciador-de-processos.md`. Referência de layout: artefato de Tarefas,
`Main.dc.html` (dados fictícios).

## 1. A pergunta que a tela responde

"O que espera a **minha** ação hoje, o que está atrasado e o que ninguém pegou ainda na fila do meu papel?"

## 2. Quem usa e que decisão toma

- **Gestor de frota**: vê "Receber a placa ZDM1A02" (transferência de placa, prazo de 5 dias), "Confirmar a carteira de
  outubro" (até o dia 5 do mês seguinte), "Lançar o dia 11" (até as 10h do dia seguinte) e "Indicar substituto". Decide a
  ordem do dia: o atrasado primeiro, depois o que vence hoje.
- **Operacional**: vê as tarefas do pátio e da fila do totem da filial dele.
- **Diretoria**: vê as aprovações que esperam (escrita da Diretoria passa por tarefa e aprovação, H6).
- **Administrador**: reatribui uma tarefa parada, mas **não age em nome de ninguém** (H5).

## 3. A ação principal e as ações de cada estado

A ação principal depende do cartão e **sempre abre o wizard com o contexto preenchido**: **Receber placa**, **Confirmar as
2 restantes**, **Lançar o dia**, **Indicar substituto**, **Corrigir placa**. Na fila sem dono: **Pegar tarefa**.

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto de três cartões e dos números do mês | nenhuma |
| Vazio (caixa limpa) | "Nenhuma tarefa sua. Sua carteira está em dia." | **Abrir o Acompanhamento** |
| Vazio (fila do papel) | "Ninguém aguarda na fila do seu papel." | **Ver tarefas atrasadas da equipe** (só quem pode) |
| Erro | "Não foi possível carregar as tarefas." | **Tentar de novo** |
| Sem permissão | "Seu perfil não tem tarefas." | **Pedir acesso ao Administrador** |
| Sem dados ainda | Os números do mês (no prazo, tempo médio) mostram "Sem dados ainda: depende de tarefas concluídas no mês" | **Ver as tarefas abertas** |
| Dado parcial | "Confirmação mensal: 12 de 14 confirmadas" no próprio cartão | **Confirmar as 2 restantes** |
| Tarefa pega por outra pessoa | "Fulano acabou de pegar esta tarefa." | **Atualizar a lista** (sem perder a posição) |
| Delegada a mim | Aba "Delegadas a mim" com o período da substituição | **Ver a delegação** |

## 4. O elemento de assinatura

O **cartão que diz por que você o vê** ("Enviada por Gestor Demo 03. Você vê porque é o gestor de destino. Prazo de 5
dias.") e o que acontece depois, com o prazo em etiqueta (atrasada há 3 dias, vence amanhã às 10h, sem prazo). As abas
**Minhas, Da minha fila, Atrasadas, Delegadas a mim** e o bloco **Substituição** ("Gestor Demo 03 cobre você de 12/11 a
20/11; as tarefas voltam sozinhas"). Nenhuma outra tela do Eixo mostra o dono, o prazo e o motivo juntos.

## 5. De onde vem o número

- Hoje: `nucleo.tarefas_do_usuario()` (security invoker, RLS de quem chama) e `nucleo.fila_de_excecoes`.
- Alvo (P1): `processos.tarefa` com `vence_em` e situação; `minhas_tarefas`, `tarefas_da_fila`, `pegar_tarefa` (só uma
  pessoa consegue; a segunda recebe "já foi pega"). A tarefa **nasce do estado do negócio**: `nucleo.transferencia`,
  `custodia`, `operacional.chegada`, `ordem_de_carregamento`, `confirmacao_da_carteira`. Quando o estado muda, a tarefa
  some da caixa.
- Prazos iniciais (H4): receber placa 5 dias; carteira até o dia 5 do mês seguinte; lançar o dia até as 10h do dia
  seguinte. Prazo vencido **sinaliza e nunca cancela**.
- "Programado" no dia vira tarefa de confirmar (`nucleo.situacao_programada`).
- Os números do mês (92% no prazo, 1,8 dia): vêm do banco; sem tarefas concluídas, "Sem dados ainda".

## 6. O vazio honesto

- Sem tarefas: "Nenhuma tarefa sua. Quando algo esperar a sua ação, aparece aqui com o prazo e o motivo." Convida a abrir
  o Acompanhamento.
- Fila sem dono vazia: "A fila do seu papel está vazia."
- Nunca "0% no prazo" por falta de conclusão: "Sem dados ainda".

## 7. A regra da v1 portada

- Confirmação mensal da carteira (dia 5): `docs/propostas/2026-10-08-confirmacao-mensal-operacao.md` (v1).
- Autonomia do gestor para cadastro e exceções: `docs/propostas/2026-10-08-autonomia-gestores-cadastro.md` (v1).
- A v1 distribuía o trabalho por **papel rígido por subsistema** e tinha "ajuste manual fora do sistema"
  (`DIAGNOSTICO_SISTEMA.md`). O Eixo separa perfil (porta), papel (função) e vínculo (escopo), mais a substituição com
  período, e tudo vira evento imutável.

## 8. Por que a tela não é uma tabela comum

Uma lista de pendências não tem dono, prazo nem motivo. Aqui a tarefa é a **vez de alguém** num processo: cai para o
dono do objeto, ou para a fila do papel; só uma pessoa a pega; a substituição por período a move e a devolve sozinha; o
cartão abre o wizard certo; e quando o fato muda no negócio, a tarefa desaparece sem ninguém "dar baixa".

---

## Rota e estado

- Rota: `/inicio/tarefas`. Módulo Início (azul de ação). Quem vê: todos os perfis (cada um só as suas e as da fila do
  papel).
- Estado no catálogo: **pronta** (primeira versão); a caixa por fila e a delegação são P1 e P2, ainda desenho.

## Estados e rótulos de vigência

A substituição mostra "Vigente de 12/11 a 20/11" (verde, ícone) e, depois do fim, "Encerrada em 20/11" (vermelho suave).
Tarefa atrasada: "atrasada há N dias" (âmbar a vermelho suave, com ícone, nunca só a cor).

## Atalhos

Ctrl+K: "Minhas tarefas", "Tarefas atrasadas", "Pegar a próxima tarefa da fila". Teclado: `J` e `K` entre cartões, Enter
abre o wizard da tarefa, Esc fecha e devolve o foco ao cartão.

## Dúvidas e hipóteses

- (H) Notificação só dentro do sistema; e-mail depois do SMTP (H7).
- Dúvida: tarefa sem prazo ("exceção de cadastro") fica no fim da lista; hipótese: ordenar por prazo e, sem prazo, por
  data de abertura.
- (H) "Tempo médio" é o tempo entre abrir e concluir, em dias corridos.

## Decisões de Alexandre (11/11/2026)

- **Prazos e limites** (receber placa, confirmar carteira, lançar o dia, indicar substituto) são **parâmetros em `config.parametro`**, editáveis só pelo Administrador, com auditoria.
- **Meu dia:** o gestor de frota entra na fila guiada (`docs/meu-dia.md`); esta caixa é a lista de tudo o que sobra depois.

## Checklist de fidelidade

**Referência visual:** `docs/prototipos/tarefas-e-vinculos/1-inicio-tarefas.html`. Marque cada item ao fim do bloco, com a captura a 1366 (claro e escuro)
ao lado do protótipo em `capturas/galeria/<bloco>/` (fora do Git); todo desvio vai para **Pontos para revisar**,
com o motivo.

- [ ] **Tokens de cor:** fundo `#F6F7FB`, superfícies brancas, texto `#0F1729`, linhas `#ECEEF4`, azul de ação
  `#3355FF`; cor do módulo Início (azul de ação `#3355FF`); nenhum hexadecimal escrito à mão (só tokens).
- [ ] **Tons de status:** verde de "em atividade" em cinco degraus (`--status-atividade-1` a `-5`), âmbar (2),
  vermelho (3) e cinza (2); **vigente verde e encerrado vermelho suave, sempre com rótulo, data e ícone, nunca só
  pela cor**; contraste de 4,5:1 nos dois temas.
- [ ] **Fonte e pesos:** Barlow (400, 500, 600 e 700); títulos e números como no protótipo; a placa em Barlow
  Semi Condensed.
- [ ] **Textos e rótulos:** os do protótipo, em letra minúscula normal: "Tarefas", "Minhas (N)", "Da minha fila (N)", "Atrasadas (N)", "Delegadas a mim (N)", "atrasada há N dias", "vence amanhã às 10h", "Pegar", "O seu mês", "Substituição".
- [ ] **Ordem dos elementos:** título e o perfil; abas (Minhas, Da minha fila, Atrasadas, Delegadas a mim); coluna de cartões (Atrasadas, Para hoje, Da fila do meu papel); coluna lateral (o seu mês, substituição, como funciona).
- [ ] **Estados:** vazio ("Sem dados ainda: depende de X"), carregando (esqueleto), erro (mensagem por causa e
  "Tentar de novo"), sem permissão, dado parcial; cada estado que pede algo oferece a ação.
- [ ] **Tema claro e escuro** (primeira classe), com os tokens e o contraste.
- [ ] **1366 e 1092:** sem rolagem lateral da página; em 1920 aparecem mais colunas, sem apenas esticar.

**O que sempre difere por natureza (não é desvio):** a placa é o componente da **mini placa Mercosul** em
**Barlow Semi Condensed** (o protótipo desenha uma placa genérica); os **ícones são Tabler** (o protótipo usa
SVG avulso); os **dados são reais** (o protótipo é fictício); o **mapa é real**, com a linha pela rodovia (onde
houver mapa); moeda, data e números pelos componentes de `components/formato/`; **20 por página e olhinho em toda
linha** (o protótipo mostra poucas linhas). Específico desta tela: os cartões do protótipo usam botões avulsos; no Eixo cada botão **abre direto o assistente** do passo, com o contexto preenchido; as contagens e os prazos vêm do banco.
