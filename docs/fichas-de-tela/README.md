# Fichas de tela

Escrito em 11/11/2026. **Só desenho**: as fichas dizem o que cada tela precisa responder; nada aqui está construído além
do que cada ficha marca como "pronta". Cada ficha cita os documentos de origem (`docs/acompanhamento-v2.md`,
`docs/vinculos-com-historia.md`, `docs/cr-regras.md`, `docs/gerenciador-de-processos.md`, `docs/v1-frutos-e-licoes.md`,
`docs/revisao-estrutural.md`, `docs/padrao-de-telas.md`) e os dados dos exemplos são fictícios.

## Índice

| Ficha | Módulo | Rota | Estado no catálogo |
| --- | --- | --- | --- |
| [`frota-acompanhamento.md`](frota-acompanhamento.md) | Frota | `/frota/acompanhamento` | pronta (grade por placa); grade por conjunto é desenho |
| [`frota-acompanhamento-wizard.md`](frota-acompanhamento-wizard.md) | Frota | popup sobre o Acompanhamento (rota proposta) | esqueleto |
| [`frota-acompanhamento-barra-lateral.md`](frota-acompanhamento-barra-lateral.md) | Frota | painel `?detalhe=` (rota proposta) | esqueleto |
| [`frota-acompanhamento-legenda.md`](frota-acompanhamento-legenda.md) | Frota | `/frota/acompanhamento/legenda` (rota proposta) | esqueleto |
| [`frota-acompanhamento-status-do-motorista.md`](frota-acompanhamento-status-do-motorista.md) | Frota | linha e aba do Acompanhamento (rota proposta) | esqueleto |
| [`inicio-tarefas.md`](inicio-tarefas.md) | Início | `/inicio/tarefas` | pronta (caixa por fila é desenho) |
| [`admin-auditoria.md`](admin-auditoria.md) | Administração | `/admin/auditoria` | esqueleto |
| [`trocar-cr.md`](trocar-cr.md) | Frota e Cadastros | popup (rota proposta) | esqueleto |
| [`operacoes-placas-e-crs-com-historia.md`](operacoes-placas-e-crs-com-historia.md) | Operações | aba da ficha `/operacoes/lista/<id>` | esqueleto |
| [`cadastros-ficha-do-cr.md`](cadastros-ficha-do-cr.md) | Cadastros | `/cadastros/crs/<codigo>` (rota proposta) | esqueleto |
| [`cadastros-saude-do-cr.md`](cadastros-saude-do-cr.md) | Cadastros | `/cadastros/saude-do-cr` (rota proposta) | esqueleto |
| [`resultados-rastro-do-numero.md`](resultados-rastro-do-numero.md) | Resultados | painel `?rastro=` (rota proposta) | esqueleto |

O estado vem de `lib/navegacao/catalogo.ts`; onde a tela ainda não tem rota, a ficha marca "rota proposta".

## A regra anti-genérico: os 8 campos

Toda tela do Eixo nasce de uma ficha com **estes 8 campos, nesta ordem e com estes títulos**. A ficha é o contrato: se um
campo não puder ser preenchido com conteúdo da TranSul, a tela ainda não está pronta para ser construída.

1. **A pergunta que a tela responde**: nas palavras da TranSul, curta e concreta.
2. **Quem usa e que decisão toma**: perfil e o que muda no dia dele depois de olhar.
3. **A ação principal e as ações de cada estado**: carregando, vazio, erro, sem permissão, sem dados ainda e dado
   parcial. Cada estado que pede algo ao usuário oferece a ação (botão = verbo + objeto). Ver o critério (k).
4. **O elemento de assinatura**: o que só o Eixo mostra nessa tela.
5. **De onde vem o número**: CR > placa > operação pela data de competência, a função ou a visão do banco, a regra de
   `docs/cr-regras.md`. Sem fonte: "Sem dados ainda: depende de X".
6. **O vazio honesto**: o texto exato quando falta dado e o que convida a fazer. Nunca R$ 0,00 no lugar de "sem dado".
7. **A regra da v1 portada**: com o documento de origem na v1 e o que o Eixo melhora; se não houver, "sem regra da v1".
8. **Por que a tela não é uma tabela comum**: o que ela faz que uma lista com filtros não faz.

No fim de cada ficha: **Rota e estado**, **Estados e rótulos de vigência** (quando há vínculo com data: vigente em verde
e encerrado em vermelho suave, sempre com rótulo, data e ícone), **Atalhos** (Ctrl+K e teclado) e **Dúvidas e hipóteses**
(o que não se soube preencher, a hipótese mais simples escolhida). Um leitor deve reconhecer a tela só pela ficha.

## Critério (k): sem beco de ação

Todo estado que pede algo à pessoa **oferece a ação** que resolve. Nenhuma tela termina em "não há nada" nem em "erro"
sem um próximo passo. O botão é verbo + objeto e mantém o mesmo nome do começo ao fim ("Trocar CR" → "CR trocado"). Os
estados que a ficha precisa tratar: carregando (esqueleto), vazio, erro (**Tentar de novo**), sem permissão (**Pedir
acesso**), sem dados ainda e dado parcial. Teste: a matriz de estados por tela falha se um estado não tiver ação.

### O que cada módulo exige (só os módulos destas fichas)

**Frota**

| Estado | Ação oferecida |
| --- | --- |
| Conjunto sem lançamento hoje (célula "lançar") | **Lançar situação** (wizard em popup) |
| Mês sem eventos (tudo em PÁT) | **Lançar o dia** (modo rápido pelo cabeçalho) |
| Filtro sem conjunto | **Limpar filtros** |
| Dia futuro | **Programar situação** (fica fora do realizado) |
| Programado no dia e não confirmado | **Confirmar situação** (tarefa) |
| Lote com um conjunto recusado | **Remover da lista e lançar os outros** |
| Mês fechado | **Pedir permissão** (tarefa) |
| Último evento errado | **Corrigir o último evento** (com motivo) |
| Conjunto sem motorista, ou férias sem substituto | **Indicar substituto** |
| Sem posição para a rota | "Sem dados ainda: depende de posição do veículo" e **Abrir o detalhe** |
| Sem financeiro (falta a ponte do Sankhya) | "Sem dados ainda" e **Ver a fila de exceções** |
| Placa sem CR ou com CR a trocar | **Trocar CR** ou **Vincular CR** |
| Erro de leitura | **Tentar de novo** |

**Início**

| Estado | Ação oferecida |
| --- | --- |
| Tarefa atrasada | a ação do cartão: **Receber placa**, **Confirmar as 2 restantes**, **Lançar o dia** |
| Tarefa na fila sem dono | **Pegar tarefa** (só uma pessoa consegue) |
| Tarefa pega por outra pessoa | **Atualizar a lista** (sem perder a posição) |
| Caixa vazia | **Abrir o Acompanhamento** |
| Substituição ativa ou terminada | **Alterar substituição** |
| Exceção de cadastro | **Corrigir placa** |
| Números do mês sem base | "Sem dados ainda" e **Ver as tarefas abertas** |

**Administração**

| Estado | Ação oferecida |
| --- | --- |
| Filtro da trilha sem evento | **Limpar filtros** |
| Período sem mudança | **Ampliar o período** |
| Exportação grande demais | **Escolher o mês** |
| Tabela sem auditoria | **Ver tabelas sem auditoria** |
| Sem permissão | **Abrir a linha do tempo da placa** |
| Evento sem motivo | **Abrir o registro** |

**Operações**

| Estado | Ação oferecida |
| --- | --- |
| Operação sem placa | **Vincular CR** |
| "Só vigentes" sem nenhuma placa | **Incluir histórico** |
| Placa que diverge do CR | **Resolver na fila de exceções** |
| Placa que mudou de operação | **Ver a troca** (link) e **Trocar CR** (quem pode) |
| Resultado sem a ponte do Sankhya | "Sem dados ainda: depende da ponte do Sankhya (viagens e despesas)" e **Ver as exceções da operação** |

**Cadastros**

| Estado | Ação oferecida |
| --- | --- |
| CR sem operação | **Vincular operação** |
| CR de frota sem placa | **Vincular placa** |
| CR repetido | **Revisar duplicata** (nunca funde sozinho) |
| Placa com dois CRs do mesmo tipo | **Abrir a fila de exceções** |
| Problema sem dono | **Atribuir dono** (cria tarefa na fila do papel) |
| CR sem código do Sankhya (antes da ponte) | **Completar o código** |
| Nenhum problema | **Ver o histórico de conferências** |
| Parâmetro do corte travado | "Corte do dia 10 já aplicado na origem" e **Ver a regra** |

**Resultados**

| Estado | Ação oferecida |
| --- | --- |
| Valor com "sem destino" | **Resolver o que está sem destino** (leva à Saúde do CR) |
| Valor sem lançamento | **Mudar o período** |
| Sem a ponte do Sankhya | "Sem dados ainda" e **Ver a fila de exceções** |
| Mês incompleto | **Ver o mês fechado anterior** |
| Degrau restrito (RLS) | **Pedir acesso** |
| Lançamento no CR errado | **Trocar CR** (pela causa; o fato do Sankhya nunca é editado) |
| Mês fechado | **Pedir ajuste** (justificado, com alçada) |

## Critério (l): toda linha de lista tem o olhinho

Toda tabela de dados tem o ícone do olho (`IconEye`) como **último botão de cada linha**, com tooltip e `aria-label`
"Ver detalhes de <item>" (a placa, o CR, a operação, o evento). O olho abre o **painel lateral de detalhe**; o painel é
só leitura (sem formulário de gravação); Esc fecha e o foco volta ao botão. A edição e a criação ficam no wizard em popup
central, nunca no painel.

### O que cada módulo exige

- **Frota**: o olho em cada linha da grade (cada conjunto), em cada linha da lista de Placas e em cada placa da seção
  "Fora de conjunto"; o detalhe tem as abas Visão geral, Financeiro, Motorista, Combustível e Rota do mês.
- **Início**: o olho em cada cartão de tarefa abre o contexto (o pedido, a transferência, a carteira) sem abrir o wizard.
- **Administração**: o olho em cada evento da trilha abre o antes e depois campo a campo e o link para o objeto.
- **Operações**: o olho em cada linha de placa e CR da ficha da operação (abre a placa, o CR e a troca que a moveu) e em
  cada linha da lista de operações.
- **Cadastros**: o olho em cada CR da lista de Saúde do CR e em cada vínculo da ficha do CR (abre o detalhe do vínculo
  com o "porquê").
- **Resultados**: o olho em cada degrau do rastro e em cada linha de detalhe da tabela (abre o lançamento com o código do
  Sankhya).

Exceção prevista: o olho dispensa o botão quando a linha inteira já é o link da ficha, mas então a linha mantém o
`aria-label` e o critério (i) do teste de consistência continua cobrindo a tabela.

## Como usar

1. Antes de desenhar ou construir uma tela, escreva ou atualize a ficha dela aqui.
2. Se não souber preencher os campos 1 a 5, registre a dúvida em "Dúvidas e hipóteses", escolha a hipótese mais simples e
   siga; confirme com Alexandre quando o impacto for em regra de negócio.
3. Ao construir, os estados do campo 3 viram testes; o texto do campo 6 é o texto que a tela mostra.

## Atualização de 11/11/2026: Meu dia, Posição do dia e fidelidade ao protótipo

- **Fichas novas:** `inicio-meu-dia.md` (Receber placas em lote) e `inicio-posicao-do-dia.md` (popup
  obrigatório), com os 8 campos e o checklist de fidelidade.
- **Checklist de fidelidade:** toda ficha traz, no fim, o **checklist de fidelidade** (tokens de cor e tons de
  status, fonte e pesos, textos e rótulos, ordem dos elementos, estados vazio, carregando e erro, tema claro e
  escuro, 1366 e 1092) e o que **sempre difere por natureza** (mini placa em Barlow Semi Condensed, ícones Tabler,
  dados reais, mapa real com a linha pela rodovia). Os protótipos estão em `docs/prototipos/` (referência, fora do
  build; ver `docs/prototipos/README.md`).
- **Decisões de Alexandre** (11/11/2026) registradas nas fichas a que se aplicam e em `docs/decisoes.md`:
  gestor de frota com leitura limitada do motorista; prazos e limites como parâmetros em `config.parametro`;
  escala e status do dia do motorista distintos; popup da posição todos os dias, no primeiro acesso depois das
  5h; mês fechado só pela Diretoria, por tarefa; lote do Lançar o dia com a mesma sigla e hora, e Posição do dia
  individual.
- **Fim de cada bloco:** capturas a 1366 (claro e escuro) ao lado do protótipo em `capturas/galeria/<bloco>/` (fora
  do Git) e a lista **Pontos para revisar** com todo desvio e o motivo. Sem comparação de pixel no CI.
