# Padrão de telas de dados

Vale para toda tela de dados do Eixo. O que está marcado como **obrigatório** é regra de Alexandre
(10/11/2026) e tem teste automático.

## Composição (de cima para baixo)

1. Contexto global, título e ações (esqueleto de leitura, `PaginaDeLeitura`).
2. **Faixa de KPIs com variação contra o período anterior** (`FaixaDeKpis` e `CartaoDeKpi`). Sem base de
   comparação (período anterior zero ou vazio) a variação não aparece: nunca se inventa número.
3. **Uma visão principal grande** (o gráfico ou a tabela que responde à pergunta da tela).
4. **Dois ou três painéis de apoio** numa grade de 12 colunas que ocupa a largura (`GradeDePaineis`):
   8 + 4, 6 + 6 ou 4 + 4 + 4. Nunca um cartão de um terço com o resto vazio.
5. **Tabela de detalhe** por baixo, com o ícone do olho (`IconEye`) como **último botão de toda linha**,
   com tooltip e `aria-label` "Ver detalhes de <item>". O olho abre o painel lateral; Esc fecha e o foco
   volta ao botão.
6. Gráfico só quando ajuda uma decisão. Cores pelos tokens e números por `components/formato/`.
7. Tema claro e escuro, sem rolagem horizontal da página, estados vazio, carregando e erro.

Onde não há fonte de dados: "Sem dados ainda: depende de <fonte>". Nunca um número inventado.

## Listas: 20 linhas por página (obrigatório)

- Toda lista de dados abre com **20 linhas por página**; o seletor oferece 20, 50 e 100 e a escolha é
  lembrada por pessoa no cookie único `eixo-tam-pagina`. `tam` na URL vale mais que o cookie.
- A paginação é feita **no banco** (`p_pagina`, `p_tam`), com filtros, ordem e página na URL e ordenação
  sempre com desempate pela chave única (armadilha 1).
- Componentes: `Paginador` (tabelas), `PaginasDaLista` + `SeletorDeTamanho` (listas próprias: Pátio,
  Ordens, Carteira, grade do Acompanhamento) e `lib/navegacao/preferencias-da-tabela.ts`.
- Teste: `lib/qualidade/lista-de-vinte.test.ts`, o critério (i) do teste de consistência do "esqueleto
  global". Falha quando uma tabela de dados não usa o componente padrão ou não abre com 20.
  Pendências registradas no próprio teste: catálogos (página própria de 50) e tabela de usuários.

## Período das telas de Operações

- Chips de mês (12 meses terminando no mês fechado) **mais** "Acumulado": ano até aqui, últimos 12 meses
  e todos os meses. Dentro de um mês, a curva dia a dia.
- O mês padrão é o **mês fechado mais recente** (`nucleo.mes_fechado_mais_recente`, espelhado em
  `lib/dominio/periodo.ts`): o mês M fecha quando passa o dia do corte do mês seguinte. Em 10/11 com
  corte 10 é setembro; em 11/11, outubro. Os dados pararem em outro mês não muda o padrão.
- A variação dos KPIs compara com o período de mesma duração logo antes.

## Componentes-base

- `CartaoDeKpi` (dentro da `FaixaDeKpis`): rótulo, valor, variação contra o período anterior (seta e
  percentual; o custo que sobe fica em tom negativo) e `semDados` ("Sem dados ainda: depende de ...").
- `PainelDeGrafico`: o painel de um gráfico ou tabela, com os estados `ok`, `carregando`, `vazio` e `erro`.
- `GradeDePaineis` e `CelulaDaGrade`: a grade de 12 colunas; `linhasFecham` confere que cada linha soma 12.
- Gráficos (ECharts, cores dos tokens): `Grafico` (barras e linhas), `GraficoDeCascata`, `GraficoDeRosca`,
  `GraficoDeArvore`.
- `BotaoDoOlho`: o olho de fim de linha, com tooltip, `aria-label` "Ver detalhes de <item>" e o painel lateral.
- `SeletorDePeriodo`: chips de mês e o acumulado (`mes=` ou `acum=` na URL).

## Falta de dado nunca vira R$ 0,00

Sem nenhuma receita e nenhum custo na janela (o staging do Sankhya ainda vazio), os KPIs e os painéis
mostram "Sem dados ainda: depende da ponte do Sankhya (viagens e despesas)" e as colunas de dinheiro da lista
mostram traço. O teste `lib/dominio/resultado-da-operacao.test.ts` e o e2e `e2e-banco/operacoes-ficha.spec.ts`
guardam a regra.

## Assistente em popup central; painel lateral só para detalhe

Regra de Alexandre (11/11/2026): **o wizard abre em popup central; a barra lateral é só para detalhe.**

- **Wizard** (inclusão, edição, exclusão e lançamento): diálogo centralizado, com stepper horizontal,
  resumo ao vivo, rascunho salvo e "fechar é fechar". Nunca na lateral.
- **Painel lateral** (`BotaoDoOlho`, Espiar, ficha curta): só para **ler o detalhe** de um item, sem
  formulário de gravação.
- O componente `Assistente` (`components/wizard/assistente.tsx`) tem duas variantes: `modal` (popup central) e
  `empilhado` (o mini-wizard do "+": popup central menor, sobre o assistente de baixo, sem rascunho). A variante
  `lateral` foi aposentada em 13/11/2026 (n1-tela); o teste `lib/qualidade/assistente-em-popup.test.ts` barra a volta.

### Assistentes que usavam a variante lateral (convertidos em 13/11/2026)

| Assistente | Arquivo | O que fazer |
| --- | --- | --- |
| Lançar situação | `app/(sistema)/frota/acompanhamento/lancar-situacao.tsx` | Vira o wizard em popup central (fatia A2 de `docs/superpowers/plans/2026-11-11-acompanhamento-v2.md`) |
| Avançar placa | `app/(sistema)/operacional/patio/avancar-placa.tsx` | Popup central |
| Marcar dia | `app/(sistema)/pessoas/escala/marcar-dia.tsx` | Popup central |
| Mini-cadastro de catálogo (o "+" do campo de seleção) | `app/(sistema)/frota/placas/assistentes/mini-cadastro-de-catalogo.tsx` | **Aprovado por Alexandre (11/11/2026):** popup central **menor e empilhado** sobre o assistente de baixo, sem rascunho próprio; a regra 2 do `CLAUDE.md` foi ajustada |
| Assistente de teste (demonstração) | `app/(sistema)/admin/demonstracao/assistente-de-teste.tsx` | Acompanha o mini-cadastro (é a vitrine da variante) |

Os demais assistentes (cadastrar, receber, entregar, devolver, corrigir e os de Operações, Pessoas,
Parceiros e Cadastros) já usam a variante `modal` e só trocam de tamanho, se for decidido.

## Tabela em grade preenche a largura; só rola por dentro

Regra de Alexandre (11/11/2026). Vale para toda **tabela em grade** (colunas que são dias, meses ou períodos):
a grade do Acompanhamento, a grade do Movimento, a Escala e qualquer outra que nasça com colunas de tempo.

- **A grade preenche a largura do cartão.** Nenhuma faixa vazia à direita depois da última coluna. Hoje as colunas dos
  dias têm largura fixa e, em tela larga (por exemplo, perto de 1667 px), sobra uma faixa vazia depois do dia 30.
- **Colunas de tempo com largura fluida:** `repeat(var(--dias), minmax(40px, 1fr))`, com **teto de cerca de 80 px
  por célula**. O número de colunas **segue os dias do mês** (28 a 31).
- **A primeira coluna** (o conjunto, a placa) tem **largura fixa** e fica **sticky**.
- **Em tela estreita a grade rola por dentro do cartão**, com o **cabeçalho dos dias** e a **primeira coluna fixos**.
  **A página nunca ganha rolagem horizontal.**
- **Densidade Compacto ou Confortável**, em um seletor lembrado **por usuário** (como o tamanho de página).
- **Cabeçalho com o dia da semana**; **fim de semana com fundo levemente diferente** (token próprio, nunca só a cor
  do texto); **coluna de hoje destacada**, com rótulo e não só pela cor.
- **Acima do teto** (telas de mais de cerca de 2.500 px, em que 80 px por célula já não preenchem) **(H)** o cartão
  passa a ter a largura da grade: o cartão encolhe, e não sobra faixa vazia dentro dele.
- **Critério de aceite (e2e):** em **1366, 1667 e 1920 px**, a soma das colunas ocupa a largura do cartão, sem sobra à
  direita; em **1092 px** a rolagem é interna e a página não rola; nos temas **claro e escuro**. O teste mede as
  larguras reais das colunas no navegador.
