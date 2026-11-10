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
  Pendências registradas no próprio teste: Operações e Parceiros (a função de leitura devolve a lista
  inteira e precisa de `p_pagina`/`p_tam`), catálogos e usuários.

## Período das telas de Operações

- Chips de mês (12 meses terminando no mês fechado) **mais** "Acumulado": ano até aqui, últimos 12 meses
  e todos os meses. Dentro de um mês, a curva dia a dia.
- O mês padrão é o **mês fechado mais recente** (`nucleo.mes_fechado_mais_recente`, espelhado em
  `lib/dominio/periodo.ts`): o mês M fecha quando passa o dia do corte do mês seguinte. Em 10/11 com
  corte 10 é setembro; em 11/11, outubro. Os dados pararem em outro mês não muda o padrão.
- A variação dos KPIs compara com o período de mesma duração logo antes.
